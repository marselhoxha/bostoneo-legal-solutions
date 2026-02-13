package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.CaseDocumentSummary;
import com.bostoneo.bostoneosolutions.model.FileItem;
import com.bostoneo.bostoneosolutions.model.FileItemTextCache;
import com.bostoneo.bostoneosolutions.repository.FileItemRepository;
import com.bostoneo.bostoneosolutions.repository.FileItemTextCacheRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;
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

    private final Tika tika = new Tika();

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
