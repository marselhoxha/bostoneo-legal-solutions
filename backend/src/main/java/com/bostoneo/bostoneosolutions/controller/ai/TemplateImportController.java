package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.dto.ai.ImportCommitRequest;
import com.bostoneo.bostoneosolutions.dto.ai.ImportCommitResponse;
import com.bostoneo.bostoneosolutions.dto.ai.ImportSessionResponse;
import com.bostoneo.bostoneosolutions.dto.ai.RetokenizeRequest;
import com.bostoneo.bostoneosolutions.service.ai.importing.TemplateImportException;
import com.bostoneo.bostoneosolutions.service.ai.importing.TemplateImportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * REST endpoints for the Sprint 1.5 template-import feature.
 *
 * <p>Workflow:
 *   <ol>
 *     <li>Frontend POSTs multipart files to {@code /analyze} → returns a session id.</li>
 *     <li>Frontend polls {@code /session/{id}} every ~2s for per-file status updates.</li>
 *     <li>Once every file is READY/ERROR/DUPLICATE, frontend POSTs
 *         attorney's decisions to {@code /session/{id}/commit}.</li>
 *   </ol>
 */
@PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_SYSADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_ATTORNEY', 'ROLE_PARALEGAL', 'ROLE_ASSOCIATE')")
@RestController
@RequestMapping("/api/ai/templates/import")
@RequiredArgsConstructor
@Slf4j
public class TemplateImportController {

    private static final int MAX_FILES_PER_BATCH = 50;
    private static final long MAX_BATCH_BYTES = 100L * 1024 * 1024; // 100 MB

    private final TemplateImportService importService;

    /**
     * Accept a batch of files, create an import session, kick off async extraction/analysis per file,
     * and return the session id immediately so the frontend can start polling.
     */
    @PostMapping(value = "/analyze", consumes = "multipart/form-data")
    public ResponseEntity<?> analyze(@RequestParam("files") MultipartFile[] files) {
        if (files == null || files.length == 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "No files uploaded"));
        }
        if (files.length > MAX_FILES_PER_BATCH) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(Map.of("error", "Batch exceeds " + MAX_FILES_PER_BATCH + "-file limit",
                             "filesReceived", files.length));
        }

        long totalBytes = 0;
        for (MultipartFile f : files) totalBytes += f.getSize();
        if (totalBytes > MAX_BATCH_BYTES) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(Map.of("error", "Batch exceeds 100 MB total size limit",
                             "totalBytes", totalBytes));
        }

        UUID sessionId = importService.createSession();

        // Register all files synchronously (adds them to the session in QUEUED state),
        // then kick off extraction+Claude in parallel.
        List<Map<String, Object>> filesMeta = new ArrayList<>();
        for (MultipartFile f : files) {
            String fileId = importService.registerFile(sessionId, f);
            importService.analyzeFileAsync(sessionId, fileId, f, false);
            filesMeta.add(Map.of(
                "fileId", fileId,
                "filename", f.getOriginalFilename() == null ? "unnamed" : f.getOriginalFilename(),
                "size", f.getSize()
            ));
        }

        Map<String, Object> body = new HashMap<>();
        body.put("sessionId", sessionId);
        body.put("files", filesMeta);
        return ResponseEntity.accepted().body(body);
    }

    /**
     * List the current user's last 20 template-import jobs (durable across pod restarts and TTL).
     * Used by the global background-tasks indicator and a future "Recent Imports" history view.
     */
    @GetMapping("/jobs")
    public ResponseEntity<List<Map<String, Object>>> listJobs() {
        return ResponseEntity.ok()
            .header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            .body(importService.listJobsForCurrentUser());
    }

    /**
     * Just the in-flight (PENDING / IN_PROGRESS) jobs — small payload, suitable for the
     * once-on-app-boot seed of the BackgroundTaskService.
     */
    @GetMapping("/jobs/active")
    public ResponseEntity<List<Map<String, Object>>> listActiveJobs() {
        return ResponseEntity.ok()
            .header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            .body(importService.listActiveJobsForCurrentUser());
    }

    /**
     * Return the current state of an import session for UI polling.
     *
     * <p><b>Cache-Control:</b> polling relies on seeing fresh state every 2s. Without explicit
     * no-store headers, some browsers / CDNs / intermediate proxies may cache the 200 JSON
     * response and keep serving the first snapshot forever — which visually freezes the wizard
     * on whatever status the file had on the first poll (e.g. EXTRACTING).
     */
    @GetMapping("/session/{sessionId}")
    public ResponseEntity<ImportSessionResponse> getSession(@PathVariable UUID sessionId) {
        try {
            return ResponseEntity.ok()
                .header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .body(importService.getSessionResponse(sessionId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    /**
     * Re-run AI analysis for a single file — used when the attorney tweaks classification + clicks "Re-analyze".
     * Uses Claude Haiku for cheaper iteration. Note: the multipart file must be re-uploaded here since we
     * don't persist raw bytes between session polls.
     */
    @PostMapping(value = "/session/{sessionId}/reanalyze", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, Object>> reanalyze(@PathVariable UUID sessionId,
                                                          @RequestParam("fileId") String fileId,
                                                          @RequestParam("file") MultipartFile file) {
        try {
            importService.analyzeFileAsync(sessionId, fileId, file, true);
            return ResponseEntity.accepted().body(Map.of("fileId", fileId, "status", "ANALYZING"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Commit the attorney's decisions — persists new templates, applies overwrites, closes the session.
     */
    @PostMapping("/session/{sessionId}/commit")
    public ResponseEntity<ImportCommitResponse> commit(@PathVariable UUID sessionId,
                                                       @RequestBody ImportCommitRequest request) {
        if (request == null || request.getDecisions() == null || request.getDecisions().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        ImportCommitResponse response = importService.commit(sessionId, request);
        return ResponseEntity.ok(response);
    }

    // ==================== Sprint 1.6: Binary preview + retokenize ====================

    /**
     * Stream the cached binary bytes for a single file in an import session — the transformed
     * (token-bearing) copy by default, or the pristine original when {@code variant=original}.
     *
     * <p>The wizard review step fetches this endpoint and hands the bytes to {@code docx-preview}
     * (DOCX) or an iframe / PDF.js viewer (PDF) to show 100% visual fidelity to the source.
     *
     * <p>Returns 404 when:
     * <ul>
     *   <li>the session / file is unknown or expired,</li>
     *   <li>the file is still being analyzed (no bytes cached yet), or</li>
     *   <li>no binary was produced — e.g. legacy .doc, scanned PDF, or the PDF feature flag is off.</li>
     * </ul>
     *
     * <p><b>Cache-Control:</b> bytes can change when the attorney retokenizes. Must never be cached.
     */
    @GetMapping("/session/{sessionId}/files/{fileId}/preview")
    public ResponseEntity<byte[]> getFilePreview(@PathVariable UUID sessionId,
                                                 @PathVariable String fileId,
                                                 @RequestParam(value = "variant", defaultValue = "transformed") String variant) {
        try {
            TemplateImportService.PreviewVariant v = "original".equalsIgnoreCase(variant)
                ? TemplateImportService.PreviewVariant.ORIGINAL
                : TemplateImportService.PreviewVariant.TRANSFORMED;
            TemplateImportService.PreviewBytes preview = importService.getFilePreview(sessionId, fileId, v);
            if (preview == null) return ResponseEntity.notFound().build();

            MediaType mediaType = "DOCX".equals(preview.binaryFormat())
                ? MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                : MediaType.APPLICATION_PDF;

            String safeName = encodeContentDispositionName(preview.filename());

            return ResponseEntity.ok()
                .contentType(mediaType)
                .header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .header("Content-Disposition", "inline; filename=\"" + safeName + "\"")
                .body(preview.bytes());
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    /**
     * Re-run the binary transform after the attorney toggles variables or renames keys in the
     * review step. The cached bytes are replaced in place; the frontend then re-fetches
     * {@code /preview} to see the refreshed tokenization.
     *
     * <p>Returns 204 on success, 422 when the file has no cached binary (text-only fallback).
     */
    @PostMapping("/session/{sessionId}/files/{fileId}/retokenize")
    public ResponseEntity<Map<String, Object>> retokenize(@PathVariable UUID sessionId,
                                                          @PathVariable String fileId,
                                                          @RequestBody(required = false) RetokenizeRequest request) {
        try {
            boolean ok = importService.retokenize(sessionId, fileId, request == null ? new RetokenizeRequest() : request);
            if (!ok) {
                return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(Map.of("error", "No binary template cached for this file — nothing to retokenize."));
            }
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * RFC 5987-safe filename encoding so an upload named "résumé.docx" doesn't break the header.
     */
    private String encodeContentDispositionName(String raw) {
        String safe = raw == null ? "preview" : raw;
        safe = safe.replace("\"", "").replace("\r", "").replace("\n", "");
        return URLEncoder.encode(safe, StandardCharsets.UTF_8).replace("+", "%20");
    }

    // ==================== Exception handlers ====================

    @ExceptionHandler(TemplateImportException.class)
    public ResponseEntity<Map<String, Object>> handleImportException(TemplateImportException e) {
        HttpStatus status = switch (e.getCode()) {
            case FILE_TOO_LARGE          -> HttpStatus.PAYLOAD_TOO_LARGE;
            case UNSUPPORTED_FORMAT      -> HttpStatus.UNSUPPORTED_MEDIA_TYPE;
            case SCANNED_PDF,
                 ENCRYPTED_FILE,
                 CORRUPT_FILE,
                 EMPTY_DOCUMENT           -> HttpStatus.UNPROCESSABLE_ENTITY;
        };
        return ResponseEntity.status(status).body(Map.of(
            "errorCode", e.getCode().name(),
            "message", e.getMessage()
        ));
    }

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<Map<String, Object>> handleSecurityException(SecurityException e) {
        log.warn("Security violation in template import: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
    }
}
