package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AIDocumentAnalysis;
import com.bostoneo.bostoneosolutions.model.DocumentChunk;
import com.bostoneo.bostoneosolutions.repository.AIDocumentAnalysisRepository;
import com.bostoneo.bostoneosolutions.repository.DocumentChunkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service for chunking documents for semantic search.
 * Splits documents into smaller chunks suitable for embedding.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentChunkingService {

    private final DocumentChunkRepository chunkRepository;
    private final AIDocumentAnalysisRepository analysisRepository;
    private final com.bostoneo.bostoneosolutions.multitenancy.TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    // Target chunk size in characters (roughly 500-750 tokens)
    private static final int TARGET_CHUNK_SIZE = 2000;
    private static final int MAX_CHUNK_SIZE = 3000;
    private static final int MIN_CHUNK_SIZE = 500;

    // Overlap between chunks to maintain context
    private static final int CHUNK_OVERLAP = 200;

    /**
     * Chunk a document and store the chunks.
     * If chunks already exist, they will be replaced.
     */
    @Transactional
    public List<DocumentChunk> chunkDocument(Long analysisId) {
        log.info("Chunking document: analysisId={}", analysisId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        AIDocumentAnalysis analysis = analysisRepository.findByIdAndOrganizationId(analysisId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Analysis not found: " + analysisId));

        // Delete existing chunks
        // SECURITY: Use tenant-filtered delete to prevent cross-org deletion
        chunkRepository.deleteByAnalysisIdAndOrganizationId(analysisId, orgId);

        // Get text content
        String content = analysis.getDocumentContent();
        if (content == null || content.trim().isEmpty()) {
            log.warn("No document content found for analysis: {}", analysisId);
            return new ArrayList<>();
        }

        // Split into chunks
        List<DocumentChunk> chunks = createChunks(content, analysisId);

        // Save chunks
        chunks = chunkRepository.saveAll(chunks);
        log.info("Created {} chunks for document: {}", chunks.size(), analysisId);

        return chunks;
    }

    /**
     * Chunk all documents in a collection.
     */
    @Transactional
    public int chunkCollection(Long collectionId, List<Long> analysisIds) {
        log.info("Chunking collection: collectionId={}, documents={}", collectionId, analysisIds.size());

        int totalChunks = 0;
        for (Long analysisId : analysisIds) {
            try {
                List<DocumentChunk> chunks = chunkDocument(analysisId);

                // Update collection ID for these chunks
                for (DocumentChunk chunk : chunks) {
                    chunk.setCollectionId(collectionId);
                }
                chunkRepository.saveAll(chunks);

                totalChunks += chunks.size();
            } catch (Exception e) {
                log.error("Failed to chunk document: analysisId={}", analysisId, e);
            }
        }

        log.info("Created {} total chunks for collection: {}", totalChunks, collectionId);
        return totalChunks;
    }

    /**
     * Create chunks from text content.
     * Uses a smart chunking strategy that respects paragraph and sentence boundaries.
     */
    private List<DocumentChunk> createChunks(String content, Long analysisId) {
        List<DocumentChunk> chunks = new ArrayList<>();

        // First, try to split by sections/paragraphs
        List<TextSection> sections = splitIntoSections(content);

        int chunkIndex = 0;
        StringBuilder currentChunk = new StringBuilder();
        String currentSection = null;

        for (TextSection section : sections) {
            // If adding this section would exceed max size, save current chunk first
            if (currentChunk.length() + section.content.length() > MAX_CHUNK_SIZE && currentChunk.length() >= MIN_CHUNK_SIZE) {
                chunks.add(createChunk(analysisId, chunkIndex++, currentChunk.toString(), currentSection));

                // Keep overlap from the end of current chunk
                String overlap = getOverlap(currentChunk.toString());
                currentChunk = new StringBuilder(overlap);
            }

            // Add section to current chunk
            if (section.title != null && !section.title.isEmpty()) {
                currentSection = section.title;
                currentChunk.append("\n\n").append(section.title).append("\n");
            }
            currentChunk.append(section.content);

            // If current chunk is at target size, save it
            if (currentChunk.length() >= TARGET_CHUNK_SIZE) {
                chunks.add(createChunk(analysisId, chunkIndex++, currentChunk.toString(), currentSection));

                String overlap = getOverlap(currentChunk.toString());
                currentChunk = new StringBuilder(overlap);
                currentSection = null;
            }
        }

        // Save any remaining content
        if (currentChunk.length() >= MIN_CHUNK_SIZE) {
            chunks.add(createChunk(analysisId, chunkIndex, currentChunk.toString(), currentSection));
        } else if (currentChunk.length() > 0 && !chunks.isEmpty()) {
            // Append small remaining content to last chunk
            DocumentChunk lastChunk = chunks.get(chunks.size() - 1);
            lastChunk.setContent(lastChunk.getContent() + currentChunk.toString());
            lastChunk.setTokenCount(estimateTokenCount(lastChunk.getContent()));
        } else if (currentChunk.length() > 0) {
            // Single small chunk is better than nothing
            chunks.add(createChunk(analysisId, chunkIndex, currentChunk.toString(), currentSection));
        }

        return chunks;
    }

    /**
     * Split content into sections based on headings and paragraphs.
     */
    private List<TextSection> splitIntoSections(String content) {
        List<TextSection> sections = new ArrayList<>();

        // Pattern to match markdown-style headings or all-caps lines (common in legal docs)
        Pattern headingPattern = Pattern.compile(
                "(?m)^(#{1,3}\\s+.+|[A-Z][A-Z\\s]{5,}:?|ARTICLE\\s+\\d+|SECTION\\s+\\d+|PARAGRAPH\\s+\\d+)$"
        );

        Matcher matcher = headingPattern.matcher(content);
        int lastEnd = 0;
        String lastTitle = null;

        while (matcher.find()) {
            // Save content before this heading
            if (matcher.start() > lastEnd) {
                String sectionContent = content.substring(lastEnd, matcher.start()).trim();
                if (!sectionContent.isEmpty()) {
                    sections.add(new TextSection(lastTitle, sectionContent));
                }
            }

            lastTitle = matcher.group().trim();
            lastEnd = matcher.end();
        }

        // Add remaining content
        if (lastEnd < content.length()) {
            String remainingContent = content.substring(lastEnd).trim();
            if (!remainingContent.isEmpty()) {
                sections.add(new TextSection(lastTitle, remainingContent));
            }
        }

        // If no sections found, split by paragraphs
        if (sections.isEmpty()) {
            String[] paragraphs = content.split("\n\n+");
            for (String para : paragraphs) {
                String trimmed = para.trim();
                if (!trimmed.isEmpty()) {
                    sections.add(new TextSection(null, trimmed));
                }
            }
        }

        return sections;
    }

    /**
     * Get overlap text from the end of a chunk (for context continuity).
     */
    private String getOverlap(String content) {
        if (content.length() <= CHUNK_OVERLAP) {
            return content;
        }

        // Try to break at a sentence boundary
        String endPart = content.substring(content.length() - CHUNK_OVERLAP - 100);
        int sentenceEnd = endPart.lastIndexOf(". ");
        if (sentenceEnd > 0) {
            return endPart.substring(sentenceEnd + 2);
        }

        // Fall back to word boundary
        int spacePos = endPart.indexOf(' ');
        if (spacePos > 0) {
            return endPart.substring(spacePos + 1);
        }

        return content.substring(content.length() - CHUNK_OVERLAP);
    }

    /**
     * Create a DocumentChunk entity.
     */
    private DocumentChunk createChunk(Long analysisId, int index, String content, String sectionTitle) {
        DocumentChunk chunk = new DocumentChunk();
        chunk.setAnalysisId(analysisId);
        chunk.setChunkIndex(index);
        chunk.setContent(content.trim());
        chunk.setSectionTitle(sectionTitle);
        chunk.setTokenCount(estimateTokenCount(content));
        return chunk;
    }

    /**
     * Estimate token count (roughly 4 characters per token for English text).
     */
    private int estimateTokenCount(String text) {
        return (int) Math.ceil(text.length() / 4.0);
    }

    /**
     * Helper class for text sections.
     */
    private static class TextSection {
        String title;
        String content;

        TextSection(String title, String content) {
            this.title = title;
            this.content = content;
        }
    }

    /**
     * Check if a document has been chunked.
     */
    public boolean isDocumentChunked(Long analysisId) {
        return chunkRepository.existsByAnalysisId(analysisId);
    }

    /**
     * Get chunks for a document.
     */
    public List<DocumentChunk> getChunksForDocument(Long analysisId) {
        // SECURITY: Use tenant-filtered query
        Long orgId = getRequiredOrganizationId();
        return chunkRepository.findByAnalysisIdAndOrganizationIdOrderByChunkIndexAsc(analysisId, orgId);
    }

    /**
     * Get chunks for a collection.
     */
    public List<DocumentChunk> getChunksForCollection(Long collectionId) {
        // SECURITY: Use tenant-filtered query
        Long orgId = getRequiredOrganizationId();
        return chunkRepository.findByCollectionIdAndOrganizationIdOrderByAnalysisIdAscChunkIndexAsc(collectionId, orgId);
    }
}
