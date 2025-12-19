package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * Service for answering natural language questions across document collections.
 * Uses RAG (Retrieval Augmented Generation) to find relevant context and generate answers.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CollectionQAService {

    private final SemanticSearchService semanticSearchService;
    private final ClaudeSonnet4Service claudeService;

    /**
     * Response object for collection Q&A
     */
    public static class QAResponse {
        public String answer;
        public List<Source> sources;
        public int tokensUsed;
        public long processingTimeMs;

        public QAResponse() {
            this.sources = new ArrayList<>();
        }
    }

    /**
     * Source citation for Q&A response
     */
    public static class Source {
        public Long documentId;
        public String documentName;
        public String documentType;
        public String sectionTitle;
        public String excerpt;
        public Long chunkId;
        public double relevanceScore;

        public Source() {}
    }

    /**
     * Ask a question about all documents in a collection.
     * Uses RAG to retrieve relevant context and generate an answer.
     */
    public CompletableFuture<QAResponse> askQuestion(Long collectionId, String query, int maxSources) {
        return askQuestion(collectionId, query, maxSources, null);
    }

    /**
     * Ask a question about all documents in a collection with analysis context.
     * Uses RAG to retrieve relevant context and generate an answer.
     *
     * @param analysisContext Optional context: 'respond', 'negotiate', 'client_review', 'due_diligence', 'general'
     */
    public CompletableFuture<QAResponse> askQuestion(Long collectionId, String query, int maxSources, String analysisContext) {
        long startTime = System.currentTimeMillis();
        log.info("Collection Q&A: collectionId={}, query='{}', maxSources={}, context={}",
            collectionId, query, maxSources, analysisContext);

        QAResponse response = new QAResponse();

        // Step 1: Retrieve relevant chunks using semantic search
        List<SemanticSearchService.SearchResult> searchResults =
            semanticSearchService.searchCollection(collectionId, query, maxSources);

        if (searchResults.isEmpty()) {
            response.answer = "I couldn't find any relevant information in the documents to answer your question. " +
                    "Please try rephrasing your question or ensure the collection contains relevant documents.";
            response.processingTimeMs = System.currentTimeMillis() - startTime;
            return CompletableFuture.completedFuture(response);
        }

        // Step 2: Build context from search results
        StringBuilder contextBuilder = new StringBuilder();
        for (int i = 0; i < searchResults.size(); i++) {
            SemanticSearchService.SearchResult result = searchResults.get(i);
            contextBuilder.append(String.format(
                "[Source %d: %s%s]\n%s\n\n",
                i + 1,
                result.sourceDocument,
                result.sectionTitle != null ? " - " + result.sectionTitle : "",
                result.content
            ));

            // Build source citation
            Source source = new Source();
            source.documentId = result.analysisId;
            source.documentName = result.sourceDocument;
            source.documentType = result.sourceDocumentType;
            source.sectionTitle = result.sectionTitle;
            source.excerpt = truncateExcerpt(result.content, 200);
            source.chunkId = result.chunkId;
            source.relevanceScore = result.score;
            response.sources.add(source);
        }

        // Step 3: Build prompt for Claude with context-awareness
        String systemMessage = buildSystemMessage(analysisContext);
        String userPrompt = buildUserPrompt(query, contextBuilder.toString(), searchResults.size());

        // Step 4: Call Claude to generate answer
        return claudeService.generateCompletion(userPrompt, systemMessage, false)
            .thenApply(answer -> {
                response.answer = answer;
                response.processingTimeMs = System.currentTimeMillis() - startTime;
                log.info("Collection Q&A completed in {}ms with {} sources",
                    response.processingTimeMs, response.sources.size());
                return response;
            })
            .exceptionally(e -> {
                log.error("Collection Q&A failed: {}", e.getMessage());
                response.answer = "I encountered an error while analyzing the documents. Please try again.";
                response.processingTimeMs = System.currentTimeMillis() - startTime;
                return response;
            });
    }

    /**
     * Build system message for cross-document analysis with context-awareness
     */
    private String buildSystemMessage(String analysisContext) {
        String contextInstruction = getContextInstruction(analysisContext);

        return String.format("""
            You are a legal document analyst assistant. Your task is to answer questions about a collection of legal documents.
            %s

            IMPORTANT GUIDELINES:
            1. Answer ONLY based on the provided document excerpts - do not make up information
            2. When citing information, reference the source number [Source X]
            3. If documents contain contradictory information, explicitly highlight this
            4. If the question cannot be fully answered from the provided context, say so clearly
            5. Be precise and cite specific clauses, sections, or passages when relevant
            6. Format your response clearly with bullet points or numbered lists when appropriate
            7. If you find inconsistencies between documents, flag them with ⚠️
            8. Always maintain a professional, analytical tone

            Response format:
            - Start with a direct answer to the question
            - Provide supporting details with source citations [Source 1], [Source 2], etc.
            - End with any caveats, inconsistencies, or gaps in the available information
            """, contextInstruction);
    }

    /**
     * Get context-specific instruction for collection Q&A
     */
    private String getContextInstruction(String analysisContext) {
        if (analysisContext == null || analysisContext.equals("general")) {
            return "";
        }

        return switch (analysisContext) {
            case "respond" -> """

                ANALYSIS CONTEXT: The attorney is preparing to respond to these documents from opposing counsel.
                Focus on: response deadlines, counterarguments, weaknesses to exploit, and evidence to gather.
                """;
            case "negotiate" -> """

                ANALYSIS CONTEXT: The attorney is negotiating these documents on behalf of their client.
                Focus on: unfavorable terms, redline suggestions, leverage points, and negotiation priorities.
                """;
            case "client_review" -> """

                ANALYSIS CONTEXT: The attorney needs to explain these documents to their client.
                Focus on: clear explanations accessible to non-lawyers, practical implications, and next steps.
                """;
            case "due_diligence" -> """

                ANALYSIS CONTEXT: The attorney is conducting due diligence for a transaction.
                Focus on: risks, red flags, missing information, deal-breaker issues, and recommended protections.
                """;
            default -> "";
        };
    }

    /**
     * Build user prompt with context
     */
    private String buildUserPrompt(String query, String context, int sourceCount) {
        return String.format("""
            I have a collection of %d legal documents. Based on the following relevant excerpts from these documents, please answer my question.

            === DOCUMENT EXCERPTS ===
            %s
            === END OF EXCERPTS ===

            QUESTION: %s

            Please provide a comprehensive answer based on the document excerpts above. Include source citations [Source X] for each piece of information.
            """, sourceCount, context, query);
    }

    /**
     * Truncate excerpt to specified length
     */
    private String truncateExcerpt(String text, int maxLength) {
        if (text == null) return "";
        if (text.length() <= maxLength) return text;
        return text.substring(0, maxLength) + "...";
    }

    /**
     * Compare two documents in a collection
     */
    public CompletableFuture<QAResponse> compareDocuments(Long collectionId, Long doc1Id, Long doc2Id, String aspect) {
        log.info("Document comparison: collectionId={}, doc1={}, doc2={}, aspect={}",
            collectionId, doc1Id, doc2Id, aspect);

        String query = String.format(
            "Compare the following aspect between the two documents: %s. " +
            "Highlight similarities, differences, and any contradictions.",
            aspect != null ? aspect : "all key terms and provisions"
        );

        // Search within specific documents
        List<SemanticSearchService.SearchResult> doc1Results =
            semanticSearchService.searchDocument(doc1Id, aspect != null ? aspect : "key provisions", 5);
        List<SemanticSearchService.SearchResult> doc2Results =
            semanticSearchService.searchDocument(doc2Id, aspect != null ? aspect : "key provisions", 5);

        QAResponse response = new QAResponse();
        long startTime = System.currentTimeMillis();

        // Build comparison context
        StringBuilder contextBuilder = new StringBuilder();
        contextBuilder.append("=== DOCUMENT 1 ===\n");
        for (SemanticSearchService.SearchResult r : doc1Results) {
            contextBuilder.append(String.format("[%s - %s]\n%s\n\n",
                r.sourceDocument, r.sectionTitle, r.content));
            addSource(response, r);
        }

        contextBuilder.append("\n=== DOCUMENT 2 ===\n");
        for (SemanticSearchService.SearchResult r : doc2Results) {
            contextBuilder.append(String.format("[%s - %s]\n%s\n\n",
                r.sourceDocument, r.sectionTitle, r.content));
            addSource(response, r);
        }

        String systemMessage = """
            You are a legal document comparison expert. Compare the two documents provided and create a detailed analysis.

            Format your response as:
            1. **Key Similarities**: What terms/provisions are consistent
            2. **Key Differences**: What terms/provisions differ
            3. **⚠️ Contradictions**: Any directly conflicting terms
            4. **Recommendations**: Which document's terms are more favorable/complete

            Be specific and cite exact clauses or sections.
            """;

        String userPrompt = String.format("""
            Please compare these two documents focusing on: %s

            %s

            Provide a detailed comparison analysis.
            """, aspect != null ? aspect : "all key provisions", contextBuilder.toString());

        return claudeService.generateCompletion(userPrompt, systemMessage, false)
            .thenApply(answer -> {
                response.answer = answer;
                response.processingTimeMs = System.currentTimeMillis() - startTime;
                return response;
            });
    }

    private void addSource(QAResponse response, SemanticSearchService.SearchResult result) {
        Source source = new Source();
        source.documentId = result.analysisId;
        source.documentName = result.sourceDocument;
        source.documentType = result.sourceDocumentType;
        source.sectionTitle = result.sectionTitle;
        source.excerpt = truncateExcerpt(result.content, 200);
        source.chunkId = result.chunkId;
        source.relevanceScore = result.score;
        response.sources.add(source);
    }
}
