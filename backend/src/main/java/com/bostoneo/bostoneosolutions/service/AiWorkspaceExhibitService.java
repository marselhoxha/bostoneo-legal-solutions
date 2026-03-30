package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.config.AIConfig;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocumentExhibit;
import com.bostoneo.bostoneosolutions.model.FileItem;
import com.bostoneo.bostoneosolutions.repository.AiWorkspaceDocumentExhibitRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.client.WebClient;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.*;

import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor;

/**
 * Service for managing exhibits attached to AI workspace documents.
 * Handles CRUD operations, file retrieval, text extraction (iText + Vision OCR),
 * and building exhibit context for AI prompts.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiWorkspaceExhibitService {

    private final AiWorkspaceDocumentExhibitRepository exhibitRepository;
    private final FileStorageService fileStorageService;
    private final NamedParameterJdbcTemplate jdbc;
    private final AIConfig aiConfig;
    private final WebClient anthropicWebClient;
    private final ObjectMapper objectMapper;

    private static final int MAX_VISION_PAGES = 10;

    // ===== CRUD =====

    /**
     * Get all exhibits for a workspace document, ordered by display_order/label.
     */
    public List<AiWorkspaceDocumentExhibit> getExhibitsForDocument(Long documentId, Long orgId) {
        return exhibitRepository.findByDocumentIdAndOrgId(documentId, orgId);
    }

    /**
     * Add an exhibit by linking an existing case document (from the `documents` table).
     * Copies file metadata from the case document and triggers async text extraction.
     */
    public AiWorkspaceDocumentExhibit addExhibitFromCaseDocument(Long workspaceDocId, Long caseDocumentId, Long orgId) {
        // 1. Look up the case document from `documents` table
        Map<String, Object> caseDoc = lookupCaseDocument(caseDocumentId, orgId);
        if (caseDoc == null) {
            throw new ApiException("Case document not found or access denied: " + caseDocumentId);
        }

        String fileName = (String) caseDoc.get("file_name");
        String filePath = (String) caseDoc.get("file_path");
        String mimeType = (String) caseDoc.get("mime_type");
        Long fileSize = caseDoc.get("file_size") != null ? ((Number) caseDoc.get("file_size")).longValue() : null;

        // 2. Get next label
        String label = exhibitRepository.getNextLabel(workspaceDocId, orgId);
        int count = exhibitRepository.findByDocumentIdAndOrgId(workspaceDocId, orgId).size();

        // 3. Create exhibit entity
        AiWorkspaceDocumentExhibit exhibit = AiWorkspaceDocumentExhibit.builder()
                .documentId(workspaceDocId)
                .organizationId(orgId)
                .caseDocumentId(caseDocumentId)
                .label(label)
                .displayOrder(count)
                .fileName(fileName != null ? fileName : "Unknown")
                .filePath(filePath)
                .mimeType(mimeType)
                .fileSize(fileSize)
                .textExtractionStatus("PENDING")
                .build();

        // 4. Save via repo
        AiWorkspaceDocumentExhibit saved = exhibitRepository.save(exhibit);
        log.info("Added exhibit {} (label={}) from case document {} for workspace doc {}",
                saved.getId(), label, caseDocumentId, workspaceDocId);

        // 5. Trigger async text extraction
        extractTextAsync(saved.getId(), orgId);

        return saved;
    }

    /**
     * Add an exhibit from a FileItem (file_items table) directly.
     * Used by auto-attach when generating documents linked to a case.
     */
    public AiWorkspaceDocumentExhibit addExhibitFromFileItem(Long workspaceDocId, FileItem fileItem, Long orgId) {
        String label = exhibitRepository.getNextLabel(workspaceDocId, orgId);
        int count = exhibitRepository.findByDocumentIdAndOrgId(workspaceDocId, orgId).size();

        AiWorkspaceDocumentExhibit exhibit = AiWorkspaceDocumentExhibit.builder()
                .documentId(workspaceDocId)
                .organizationId(orgId)
                .caseDocumentId(fileItem.getId())
                .label(label)
                .displayOrder(count)
                .fileName(fileItem.getOriginalName() != null ? fileItem.getOriginalName() : fileItem.getName())
                .filePath(fileItem.getFilePath())
                .mimeType(fileItem.getMimeType())
                .fileSize(fileItem.getSize())
                .textExtractionStatus("PENDING")
                .build();

        AiWorkspaceDocumentExhibit saved = exhibitRepository.save(exhibit);
        log.info("Added exhibit {} (label={}) from file_item {} for workspace doc {}",
                saved.getId(), label, fileItem.getId(), workspaceDocId);

        extractTextAsync(saved.getId(), orgId);
        return saved;
    }

    /**
     * Add an exhibit from a direct file upload.
     * Stores the file, optionally saves to case file manager, and triggers text extraction.
     */
    public AiWorkspaceDocumentExhibit addExhibitFromUpload(Long workspaceDocId, MultipartFile file,
                                                            Long caseId, Long orgId, Long userId) {
        try {
            // 1. Upload file to storage
            String storedPath = fileStorageService.storeFile(file, "exhibits");

            // 2. Get next label
            String label = exhibitRepository.getNextLabel(workspaceDocId, orgId);
            int count = exhibitRepository.findByDocumentIdAndOrgId(workspaceDocId, orgId).size();

            // 3. Create exhibit entity
            AiWorkspaceDocumentExhibit exhibit = AiWorkspaceDocumentExhibit.builder()
                    .documentId(workspaceDocId)
                    .organizationId(orgId)
                    .label(label)
                    .displayOrder(count)
                    .fileName(file.getOriginalFilename() != null ? file.getOriginalFilename() : "Uploaded file")
                    .filePath(storedPath)
                    .mimeType(file.getContentType())
                    .fileSize(file.getSize())
                    .textExtractionStatus("PENDING")
                    .build();

            // 4. Save via repo
            AiWorkspaceDocumentExhibit saved = exhibitRepository.save(exhibit);
            log.info("Added exhibit {} (label={}) from upload '{}' for workspace doc {}",
                    saved.getId(), label, file.getOriginalFilename(), workspaceDocId);

            // 5. If caseId is provided, also save to case file manager (file_items table)
            if (caseId != null && userId != null) {
                insertIntoFileItems(storedPath, file, caseId, orgId, userId);
            }

            // 6. Trigger async text extraction
            extractTextAsync(saved.getId(), orgId);

            return saved;

        } catch (Exception e) {
            log.error("Failed to add exhibit from upload for workspace doc {}: {}", workspaceDocId, e.getMessage(), e);
            throw new ApiException("Failed to upload exhibit: " + e.getMessage());
        }
    }

    /**
     * Remove an exhibit by ID with tenant isolation.
     */
    public void removeExhibit(Long exhibitId, Long orgId) {
        exhibitRepository.deleteById(exhibitId, orgId);
        log.info("Removed exhibit {} in org {}", exhibitId, orgId);
    }

    /**
     * Get the raw file bytes for an exhibit (for download/preview).
     * Resolves the file path from either direct upload or linked case document.
     */
    public byte[] getExhibitFile(Long exhibitId, Long orgId) {
        AiWorkspaceDocumentExhibit exhibit = exhibitRepository.findById(exhibitId, orgId)
                .orElseThrow(() -> new ApiException("Exhibit not found: " + exhibitId));

        String filePath = resolveFilePath(exhibit, orgId);
        if (filePath == null || filePath.isEmpty()) {
            throw new ApiException("No file path available for exhibit: " + exhibitId);
        }

        try {
            Resource resource = fileStorageService.loadFileAsResource(filePath);
            try (java.io.InputStream is = resource.getInputStream()) {
                return is.readAllBytes();
            }
        } catch (Exception e) {
            log.error("Failed to load file for exhibit {}: {}", exhibitId, e.getMessage());
            throw new ApiException("Failed to load exhibit file: " + e.getMessage());
        }
    }

    /**
     * Find a single exhibit by ID with tenant isolation.
     */
    public Optional<AiWorkspaceDocumentExhibit> findById(Long exhibitId, Long orgId) {
        return exhibitRepository.findById(exhibitId, orgId);
    }

    /**
     * Reorder exhibits by updating display_order for each exhibit in the list.
     */
    public void reorderExhibits(List<Map<String, Object>> orderList, Long orgId) {
        for (Map<String, Object> entry : orderList) {
            Long exhibitId = ((Number) entry.get("exhibitId")).longValue();
            int displayOrder = ((Number) entry.get("displayOrder")).intValue();
            exhibitRepository.updateDisplayOrder(exhibitId, displayOrder, orgId);
        }
        log.info("Reordered {} exhibits in org {}", orderList.size(), orgId);
    }

    // ===== TEXT EXTRACTION =====

    /**
     * Asynchronously extract text from an exhibit's file.
     * Uses iText for PDFs (with Vision OCR fallback for scanned docs) and
     * Claude Vision API for images.
     */
    @Async
    public void extractTextAsync(Long exhibitId, Long orgId) {
        try {
            exhibitRepository.updateExtractedText(exhibitId, null, "PROCESSING", 0, orgId);

            AiWorkspaceDocumentExhibit exhibit = exhibitRepository.findById(exhibitId, orgId)
                    .orElseThrow(() -> new RuntimeException("Exhibit not found: " + exhibitId));

            byte[] fileBytes = getExhibitFile(exhibitId, orgId);
            String mimeType = exhibit.getMimeType() != null ? exhibit.getMimeType() : "";

            String extractedText;
            int pageCount = 0;

            if (mimeType.equals("application/pdf")) {
                // Try iText text extraction first
                extractedText = extractTextFromPdf(fileBytes);
                pageCount = countPdfPages(fileBytes);

                // If extracted text is too short (likely scanned), fall back to Vision OCR
                if (extractedText.trim().length() < 50) {
                    log.info("PDF appears scanned (minimal text extracted), falling back to OCR for exhibit {}", exhibitId);
                    extractedText = extractTextViaOcr(fileBytes, mimeType);
                }
            } else if (mimeType.startsWith("image/")) {
                extractedText = extractTextViaOcr(fileBytes, mimeType);
                pageCount = 1;
            } else {
                extractedText = "[Unsupported file type for text extraction: " + mimeType + "]";
            }

            exhibitRepository.updateExtractedText(exhibitId, extractedText, "COMPLETED", pageCount, orgId);
            log.info("Text extraction completed for exhibit {} ({} chars, {} pages)", exhibitId,
                    extractedText != null ? extractedText.length() : 0, pageCount);

        } catch (Exception e) {
            log.error("Text extraction failed for exhibit {}: {}", exhibitId, e.getMessage(), e);
            exhibitRepository.updateExtractedText(exhibitId, "Text extraction failed: " + e.getMessage(), "FAILED", 0, orgId);
        }
    }

    /**
     * Extract text from a PDF using iText PdfTextExtractor.
     * Returns page-delimited text content.
     */
    private String extractTextFromPdf(byte[] pdfBytes) {
        try (PdfDocument pdfDoc = new PdfDocument(new PdfReader(new ByteArrayInputStream(pdfBytes)))) {
            StringBuilder text = new StringBuilder();
            for (int i = 1; i <= pdfDoc.getNumberOfPages(); i++) {
                text.append("--- Page ").append(i).append(" ---\n");
                String pageText = PdfTextExtractor.getTextFromPage(pdfDoc.getPage(i));
                if (pageText != null) {
                    text.append(pageText);
                }
                text.append("\n\n");
            }
            return text.toString();
        } catch (Exception e) {
            log.warn("iText PDF text extraction failed: {}", e.getMessage());
            return "";
        }
    }

    /**
     * Count the number of pages in a PDF.
     */
    private int countPdfPages(byte[] pdfBytes) {
        try (PdfDocument pdfDoc = new PdfDocument(new PdfReader(new ByteArrayInputStream(pdfBytes)))) {
            return pdfDoc.getNumberOfPages();
        } catch (Exception e) {
            log.warn("Failed to count PDF pages: {}", e.getMessage());
            return 0;
        }
    }

    /**
     * Extract text via Claude Vision API (OCR).
     * For PDFs: renders pages to JPEG images via PDFBox, then sends to Claude Haiku.
     * For images: sends the raw bytes directly.
     * Follows the same pattern as CaseDocumentService.extractTextWithVisionOCR().
     */
    private String extractTextViaOcr(byte[] fileBytes, String mimeType) {
        try {
            List<Map<String, Object>> contentBlocks = new ArrayList<>();
            contentBlocks.add(Map.of("type", "text", "text",
                    "Extract ALL text from these scanned document pages. Return only the extracted text, preserving paragraph structure. Do not add commentary."));

            if ("application/pdf".equals(mimeType)) {
                // Render PDF pages to JPEG images using PDFBox
                try (InputStream is = new ByteArrayInputStream(fileBytes);
                     PDDocument document = PDDocument.load(is)) {

                    PDFRenderer renderer = new PDFRenderer(document);
                    int pageCount = Math.min(document.getNumberOfPages(), MAX_VISION_PAGES);
                    if (pageCount == 0) return "[Empty PDF document]";

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
                }
            } else if (mimeType.startsWith("image/")) {
                // Send image bytes directly
                String base64 = Base64.getEncoder().encodeToString(fileBytes);
                // Normalize mime type for the API
                String normalizedMime = mimeType;
                if (!Set.of("image/jpeg", "image/png", "image/gif", "image/webp").contains(mimeType)) {
                    normalizedMime = "image/jpeg"; // fallback
                }

                contentBlocks.add(Map.of(
                        "type", "image",
                        "source", Map.of(
                                "type", "base64",
                                "media_type", normalizedMime,
                                "data", base64
                        )
                ));
            } else {
                return "[Unsupported file type for OCR: " + mimeType + "]";
            }

            // Call Claude Haiku Vision API (same pattern as CaseDocumentService)
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
                var root = objectMapper.readTree(response);
                var content = root.path("content");
                StringBuilder sb = new StringBuilder();
                for (var block : content) {
                    if ("text".equals(block.path("type").asText())) {
                        sb.append(block.path("text").asText()).append("\n");
                    }
                }
                String result = sb.toString().trim();
                if (!result.isEmpty()) {
                    log.info("Vision OCR extracted {} chars", result.length());
                    return result;
                }
            }

            return "[OCR extraction returned no text]";

        } catch (Exception e) {
            log.warn("Vision OCR extraction failed: {}", e.getMessage());
            return "[OCR extraction failed: " + e.getMessage() + "]";
        }
    }

    // ===== EXHIBIT VALIDATION =====

    /**
     * Filter out exhibits whose source file_items have been soft-deleted.
     * Only checks exhibits linked to case documents (caseDocumentId != null).
     * Uploaded exhibits (no caseDocumentId) are kept as-is.
     */
    public List<AiWorkspaceDocumentExhibit> filterActiveExhibits(List<AiWorkspaceDocumentExhibit> exhibits) {
        if (exhibits == null || exhibits.isEmpty()) return exhibits;

        // Collect case document IDs that need validation
        List<Long> caseDocIds = exhibits.stream()
                .map(AiWorkspaceDocumentExhibit::getCaseDocumentId)
                .filter(id -> id != null)
                .distinct()
                .collect(java.util.stream.Collectors.toList());

        if (caseDocIds.isEmpty()) return exhibits;

        // Batch query: find which file_items are still active
        Set<Long> activeIds = getActiveFileItemIds(caseDocIds);

        // Filter: keep exhibits that are either uploaded (no caseDocumentId) or still active
        List<AiWorkspaceDocumentExhibit> filtered = exhibits.stream()
                .filter(e -> e.getCaseDocumentId() == null || activeIds.contains(e.getCaseDocumentId()))
                .collect(java.util.stream.Collectors.toList());

        int removed = exhibits.size() - filtered.size();
        if (removed > 0) {
            log.info("Filtered out {} exhibits linked to deleted file_items", removed);
        }
        return filtered;
    }

    /**
     * Batch query to find which file_item IDs are still active (not soft-deleted).
     */
    private Set<Long> getActiveFileItemIds(List<Long> ids) {
        if (ids.isEmpty()) return Collections.emptySet();
        String sql = "SELECT id FROM file_items WHERE id IN (:ids) AND is_deleted = false";
        MapSqlParameterSource params = new MapSqlParameterSource().addValue("ids", ids);
        List<Long> activeList = jdbc.queryForList(sql, params, Long.class);
        return new HashSet<>(activeList);
    }

    // ===== PROMPT HELPER =====

    /**
     * Build exhibit context text for inclusion in AI prompts.
     * Returns a formatted string with all exhibit labels, filenames, extracted text,
     * and referencing rules for the AI to follow.
     */
    public String getExhibitTextForPrompt(Long documentId, Long orgId) {
        List<AiWorkspaceDocumentExhibit> exhibits = exhibitRepository.findByDocumentIdAndOrgId(documentId, orgId);
        exhibits = filterActiveExhibits(exhibits);
        if (exhibits.isEmpty()) return "";

        StringBuilder sb = new StringBuilder("\n\nAVAILABLE EXHIBITS:\n");
        for (AiWorkspaceDocumentExhibit exhibit : exhibits) {
            sb.append("- Exhibit ").append(exhibit.getLabel())
                    .append(": ").append(exhibit.getFileName());
            if (exhibit.getPageCount() != null) {
                sb.append(" (").append(exhibit.getPageCount()).append(exhibit.getPageCount() == 1 ? " page" : " pages").append(")");
            }
            sb.append("\n");

            if (exhibit.getExtractedText() != null && !exhibit.getExtractedText().isEmpty()
                    && "COMPLETED".equals(exhibit.getTextExtractionStatus())) {
                String text = exhibit.getExtractedText();
                if (text.length() > 15000) {
                    text = text.substring(0, 15000) + "\n[... truncated ...]";
                }
                sb.append(text).append("\n\n");
            } else {
                sb.append("[Text extraction ").append(
                        exhibit.getTextExtractionStatus() != null
                                ? exhibit.getTextExtractionStatus().toLowerCase()
                                : "pending"
                ).append(" -- reference by exhibit label only]\n\n");
            }
        }
        sb.append("EXHIBIT REFERENCE RULES:\n");
        sb.append("- Use PLAIN TEXT references in square brackets. Examples: [Exhibit A] or [Exhibit A, p.3]. Do NOT use markdown links, hyperlinks, or any link syntax.\n");
        sb.append("- For single-page exhibits, use just [Exhibit X] without a page number. Only include page numbers (e.g., [Exhibit A, p.3]) for multi-page exhibits when citing a specific page.\n");
        sb.append("- Cite sparingly — one reference per factual assertion or key point. Do NOT repeat the same citation after every clause in the same sentence.\n");
        sb.append("- Only reference exhibits that genuinely support the point being made\n");
        sb.append("- Do not fabricate exhibit content -- only reference what appears in the exhibit text above\n");
        return sb.toString();
    }

    // ===== PRIVATE HELPERS =====

    /**
     * Look up a case document, checking file_items first (current system), then
     * falling back to the legacy documents table for backward compatibility.
     */
    private Map<String, Object> lookupCaseDocument(Long caseDocumentId, Long orgId) {
        // Try file_items table first (current system)
        try {
            String sql = "SELECT original_name AS file_name, file_path, mime_type, size AS file_size " +
                    "FROM file_items WHERE id = :id AND organization_id = :orgId AND is_deleted = false";
            MapSqlParameterSource params = new MapSqlParameterSource()
                    .addValue("id", caseDocumentId)
                    .addValue("orgId", orgId);
            return jdbc.queryForMap(sql, params);
        } catch (Exception e) {
            log.debug("file_items lookup failed for id={}, trying documents table", caseDocumentId);
        }
        // Fallback: legacy documents table
        try {
            String sql = "SELECT file_name, file_path, mime_type, file_size " +
                    "FROM documents WHERE id = :id AND organization_id = :orgId";
            MapSqlParameterSource params = new MapSqlParameterSource()
                    .addValue("id", caseDocumentId)
                    .addValue("orgId", orgId);
            return jdbc.queryForMap(sql, params);
        } catch (Exception e) {
            log.warn("Case document lookup failed for id={}, org={}: {}", caseDocumentId, orgId, e.getMessage());
            return null;
        }
    }

    /**
     * Resolve the actual file path for an exhibit.
     * If the exhibit has a direct filePath (from upload), use that.
     * If it has a caseDocumentId (linked), look up the case document's file_path.
     */
    private String resolveFilePath(AiWorkspaceDocumentExhibit exhibit, Long orgId) {
        // Direct upload path takes priority
        if (exhibit.getFilePath() != null && !exhibit.getFilePath().isEmpty()) {
            return exhibit.getFilePath();
        }
        // Fall back to case document lookup
        if (exhibit.getCaseDocumentId() != null) {
            Map<String, Object> caseDoc = lookupCaseDocument(exhibit.getCaseDocumentId(), orgId);
            if (caseDoc != null) {
                return (String) caseDoc.get("file_path");
            }
        }
        return null;
    }

    /**
     * Insert an uploaded exhibit file into the file_items table so it also appears
     * in the case file manager.
     */
    private void insertIntoFileItems(String storedPath, MultipartFile file, Long caseId, Long orgId, Long userId) {
        try {
            String sql = "INSERT INTO file_items (name, original_name, size, mime_type, extension, file_path, " +
                    "case_id, organization_id, created_by, document_category, document_status, " +
                    "is_starred, is_deleted, version, shared_with_client, created_at, updated_at) " +
                    "VALUES (:name, :originalName, :size, :mimeType, :extension, :filePath, " +
                    ":caseId, :orgId, :userId, 'Exhibit', 'final', " +
                    "false, false, 1, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)";

            String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "uploaded_file";
            String extension = "";
            int dotIndex = originalName.lastIndexOf('.');
            if (dotIndex > 0) {
                extension = originalName.substring(dotIndex + 1).toLowerCase();
            }
            // Use stored path filename as the unique name
            String uniqueName = storedPath.contains("/")
                    ? storedPath.substring(storedPath.lastIndexOf('/') + 1)
                    : storedPath;

            MapSqlParameterSource params = new MapSqlParameterSource()
                    .addValue("name", uniqueName)
                    .addValue("originalName", originalName)
                    .addValue("size", file.getSize())
                    .addValue("mimeType", file.getContentType())
                    .addValue("extension", extension)
                    .addValue("filePath", storedPath)
                    .addValue("caseId", caseId)
                    .addValue("orgId", orgId)
                    .addValue("userId", userId);

            jdbc.update(sql, params);
            log.info("Inserted exhibit upload into file_items for case {} ({})", caseId, originalName);
        } catch (Exception e) {
            // Non-critical: exhibit is already saved, file manager entry is a bonus
            log.warn("Failed to insert exhibit into file_items for case {}: {}", caseId, e.getMessage());
        }
    }
}
