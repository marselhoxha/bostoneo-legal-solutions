package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.service.AIPDFFormService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai/pdf-field-extraction")
@PreAuthorize("hasRole('ROLE_ADMIN') or hasRole('ROLE_SYSADMIN')")
@RequiredArgsConstructor
@Slf4j
public class PDFFieldExtractionController {

    private final AIPDFFormService pdfFormService;

    // SECURITY: Only allow PDF access within these directories
    private static final List<String> ALLOWED_BASE_PATHS = List.of(
        "/app/uploads", "/app/documents", "./documents", "./uploads", "./backend/uploads"
    );

    @PostMapping("/extract-fields")
    public ResponseEntity<Map<String, Object>> extractFields(@RequestBody Map<String, String> request) {
        try {
            String pdfPath = request.get("pdfPath");

            // SECURITY: Validate path — block traversal and restrict to allowed directories
            if (pdfPath == null || pdfPath.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "PDF path is required"));
            }
            if (pdfPath.contains("..") || pdfPath.contains("\0")) {
                log.warn("SECURITY: Path traversal attempt blocked: {}", pdfPath);
                return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Invalid file path"));
            }
            Path normalized = Paths.get(pdfPath).toAbsolutePath().normalize();
            boolean allowed = ALLOWED_BASE_PATHS.stream()
                .anyMatch(base -> normalized.startsWith(Paths.get(base).toAbsolutePath().normalize()));
            if (!allowed) {
                log.warn("SECURITY: PDF path outside allowed directories: {}", normalized);
                return ResponseEntity.status(403).body(Map.of("status", "error", "message", "Access denied — file path not in allowed directory"));
            }

            List<String> fieldNames = pdfFormService.extractPDFFieldNames(pdfPath);
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "fieldCount", fieldNames.size(),
                "fields", fieldNames
            ));
        } catch (Exception e) {
            log.error("Error extracting PDF fields: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of(
                "status", "error",
                "message", "Failed to extract fields"
            ));
        }
    }
}