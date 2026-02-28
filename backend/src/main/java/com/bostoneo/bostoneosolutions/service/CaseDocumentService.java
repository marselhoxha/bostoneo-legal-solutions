package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.config.AIConfig;
import com.bostoneo.bostoneosolutions.dto.CaseDocumentSummary;
import com.bostoneo.bostoneosolutions.model.FileItem;
import com.bostoneo.bostoneosolutions.model.FileItemTextCache;
import com.bostoneo.bostoneosolutions.repository.FileItemRepository;
import com.bostoneo.bostoneosolutions.repository.FileItemTextCacheRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.tika.Tika;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for AI research to access case documents.
 * Provides document inventory and text extraction with caching.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CaseDocumentService {

    private final FileItemRepository fileItemRepository;
    private final FileItemTextCacheRepository textCacheRepository;
    private final FileStorageService fileStorageService;
    private final AIConfig aiConfig;
    private final WebClient anthropicWebClient;

    private final Tika tika = new Tika();
    private static final int MAX_VISION_PAGES = 10;

    // File types we can extract text from
    private static final Set<String> EXTRACTABLE_EXTENSIONS = Set.of(
        "pdf", "doc", "docx", "txt", "rtf", "odt", "xls", "xlsx", "csv", "ppt", "pptx", "html", "htm", "md"
    );

    // File types we cannot extract text from
    private static final Set<String> NON_EXTRACTABLE_EXTENSIONS = Set.of(
        "jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico",
        "mp4", "avi", "mov", "mkv", "wmv", "flv", "webm",
        "mp3", "wav", "ogg", "flac", "aac", "wma",
        "zip", "rar", "7z", "tar", "gz"
    );

    /**
     * Get list of all case documents for AI prompt inventory.
     */
    public List<CaseDocumentSummary> getDocumentInventory(Long caseId, Long orgId) {
        if (caseId == null || orgId == null) {
            return Collections.emptyList();
        }

        try {
            List<FileItem> files = fileItemRepository.findByCaseIdAndDeletedFalseAndOrganizationId(caseId, orgId);

            return files.stream()
                .map(f -> CaseDocumentSummary.builder()
                    .id(f.getId())
                    .name(f.getOriginalName())
                    .category(f.getDocumentCategory())
                    .extension(f.getExtension())
                    .sizeBytes(f.getSize())
                    .fileType(f.getFileType())
                    .build())
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Failed to get document inventory for case {}: {}", caseId, e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Get extracted text for a document, using cache when available.
     * Returns up to maxLength characters of extracted text.
     */
    public String getDocumentText(Long fileItemId, Long orgId, int maxLength) {
        if (fileItemId == null || orgId == null) {
            return "Error: Invalid document ID or organization context.";
        }

        // Check cache first
        Optional<FileItemTextCache> cached = textCacheRepository.findByFileItemIdAndOrganizationId(fileItemId, orgId);
        if (cached.isPresent()) {
            FileItemTextCache cache = cached.get();
            switch (cache.getExtractionStatus()) {
                case "success":
                    String text = cache.getExtractedText();
                    if (text.length() > maxLength) {
                        return text.substring(0, maxLength) + "\n\n[... Document truncated at " + maxLength + " characters. Full document is " + cache.getCharCount() + " characters.]";
                    }
                    return text;
                case "failed":
                    return "Error: Text extraction previously failed for this document. " + cache.getErrorMessage();
                case "unsupported":
                    return "This file type is not supported for text extraction (e.g., image, video, audio).";
                default:
                    break; // pending — try again
            }
        }

        // Look up the file item (tenant-filtered)
        Optional<FileItem> fileOpt = fileItemRepository.findByIdAndOrganizationId(fileItemId, orgId);
        if (fileOpt.isEmpty()) {
            return "Error: Document not found or access denied.";
        }

        FileItem fileItem = fileOpt.get();

        // Check if the file type is extractable
        String ext = fileItem.getExtension() != null ? fileItem.getExtension().toLowerCase().replace(".", "") : "";
        if (NON_EXTRACTABLE_EXTENSIONS.contains(ext)) {
            saveCache(fileItemId, orgId, null, "unsupported", "File type '" + ext + "' is not supported for text extraction.", 0);
            return "This file type (." + ext + ") is not supported for text extraction. Only document files (PDF, Word, text, etc.) can be read.";
        }

        // Extract text using Tika
        try {
            Resource resource = fileStorageService.loadFileAsResource(fileItem.getFilePath());
            String extractedText;

            try (InputStream inputStream = resource.getInputStream()) {
                extractedText = tika.parseToString(inputStream);
            }

            if (extractedText == null || extractedText.trim().isEmpty()) {
                // Tika couldn't extract text — try Vision OCR for scanned PDFs
                if ("pdf".equalsIgnoreCase(ext)) {
                    log.info("Tika returned empty for file {} — attempting Vision OCR fallback", fileItemId);
                    String visionText = extractTextWithVisionOCR(resource);
                    if (visionText != null && !visionText.trim().isEmpty()) {
                        extractedText = visionText.trim();
                        saveCache(fileItemId, orgId, extractedText, "success", null, extractedText.length());
                        log.info("Vision OCR extracted {} chars from scanned PDF {}", extractedText.length(), fileItemId);
                        if (extractedText.length() > maxLength) {
                            return extractedText.substring(0, maxLength) + "\n\n[... Document truncated at " + maxLength + " characters. Full document is " + extractedText.length() + " characters.]";
                        }
                        return extractedText;
                    }
                }
                saveCache(fileItemId, orgId, null, "failed", "No text content could be extracted (possibly scanned image).", 0);
                return "No text content could be extracted from this document. It may be a scanned image without OCR text.";
            }

            extractedText = extractedText.trim();

            // Cache the full text
            saveCache(fileItemId, orgId, extractedText, "success", null, extractedText.length());
            log.info("Extracted and cached {} chars from file {} ({})", extractedText.length(), fileItemId, fileItem.getOriginalName());

            // Return truncated if needed
            if (extractedText.length() > maxLength) {
                return extractedText.substring(0, maxLength) + "\n\n[... Document truncated at " + maxLength + " characters. Full document is " + extractedText.length() + " characters.]";
            }
            return extractedText;

        } catch (Exception e) {
            log.error("Text extraction failed for file {}: {}", fileItemId, e.getMessage());
            saveCache(fileItemId, orgId, null, "failed", e.getMessage(), 0);
            return "Error extracting text from document: " + e.getMessage();
        }
    }

    /**
     * Vision OCR fallback: converts PDF pages to JPEG images and sends them
     * to Claude Haiku for text extraction. Used when Tika returns empty
     * (scanned/image-based PDFs).
     */
    private String extractTextWithVisionOCR(Resource resource) {
        try (InputStream is = resource.getInputStream();
             PDDocument document = PDDocument.load(is)) {

            PDFRenderer renderer = new PDFRenderer(document);
            int pageCount = Math.min(document.getNumberOfPages(), MAX_VISION_PAGES);
            if (pageCount == 0) return null;

            // Build image content blocks for the API request
            List<Map<String, Object>> contentBlocks = new ArrayList<>();
            contentBlocks.add(Map.of("type", "text", "text",
                "Extract ALL text from these scanned document pages. Return only the extracted text, preserving paragraph structure. Do not add commentary."));

            for (int i = 0; i < pageCount; i++) {
                BufferedImage image = renderer.renderImageWithDPI(i, 200);
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                ImageIO.write(image, "jpeg", baos);
                String base64 = Base64.getEncoder().encodeToString(baos.toByteArray());

                contentBlocks.add(Map.of(
                    "type", "image",
                    "source", Map.of(
                        "type", "base64",
                        "media_type", "image/jpeg",
                        "data", base64
                    )
                ));
            }

            // Call Claude Haiku vision API
            Map<String, Object> request = Map.of(
                "model", "claude-haiku-4-5-20251001",
                "max_tokens", 16000,
                "messages", List.of(Map.of("role", "user", "content", contentBlocks))
            );

            String response = anthropicWebClient.post()
                .uri("/v1/messages")
                .header("x-api-key", aiConfig.getApiKey())
                .bodyValue(request)
                .retrieve()
                .bodyToMono(String.class)
                .block(java.time.Duration.ofMinutes(3));

            if (response != null) {
                // Extract text from response JSON
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                var root = mapper.readTree(response);
                var content = root.path("content");
                StringBuilder sb = new StringBuilder();
                for (var block : content) {
                    if ("text".equals(block.path("type").asText())) {
                        sb.append(block.path("text").asText()).append("\n");
                    }
                }
                String result = sb.toString().trim();
                return result.isEmpty() ? null : result;
            }
            return null;
        } catch (Exception e) {
            log.warn("Vision OCR fallback failed: {}", e.getMessage());
            return null;
        }
    }

    private void saveCache(Long fileItemId, Long orgId, String text, String status, String error, int charCount) {
        try {
            Optional<FileItemTextCache> existing = textCacheRepository.findByFileItemIdAndOrganizationId(fileItemId, orgId);
            FileItemTextCache cache;
            if (existing.isPresent()) {
                cache = existing.get();
                cache.setExtractedText(text);
                cache.setExtractionStatus(status);
                cache.setErrorMessage(error);
                cache.setCharCount(charCount);
            } else {
                cache = FileItemTextCache.builder()
                    .fileItemId(fileItemId)
                    .organizationId(orgId)
                    .extractedText(text)
                    .extractionStatus(status)
                    .errorMessage(error)
                    .charCount(charCount)
                    .build();
            }
            textCacheRepository.save(cache);
        } catch (Exception e) {
            log.warn("Failed to save text cache for file {}: {}", fileItemId, e.getMessage());
        }
    }
}
