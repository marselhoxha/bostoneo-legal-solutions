package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.model.FileItem;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.FileItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;

/**
 * SECURITY: This controller now enforces tenant isolation for file downloads.
 * - Permanent files (uploads/) are verified via FileItem database
 * - Temporary files (/tmp/bostoneo-pdfs/) are session-specific and allowed
 */
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
@Slf4j
public class FileDownloadController {

    private final TenantService tenantService;
    private final FileItemRepository fileItemRepository;

    @Value("${app.documents.output-path:uploads/documents}")
    private String documentsOutputPath;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @GetMapping("/download")
    public ResponseEntity<Resource> downloadFile(@RequestParam String path) {
        // SECURITY: Require organization context
        Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
        if (orgId == null) {
            log.warn("SECURITY: File download attempted without organization context - path: {}", path);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        log.info("AUDIT: File download requested - path: {}, organizationId: {}", path, orgId);

        try {
            // Resolve the path relative to the application root
            Path filePath = Paths.get(path);

            // Security check: ensure the file is within allowed directories
            String normalizedPath = filePath.normalize().toString();
            if (!normalizedPath.startsWith("backend/uploads/") &&
                !normalizedPath.startsWith("uploads/") &&
                !normalizedPath.startsWith("/tmp/bostoneo-pdfs/")) {
                log.warn("SECURITY: Attempt to access file outside allowed directories: {}", normalizedPath);
                return ResponseEntity.badRequest().build();
            }

            // SECURITY: Verify file ownership for permanent files (not temp files)
            if (!normalizedPath.startsWith("/tmp/")) {
                Optional<FileItem> fileItem = fileItemRepository.findByFilePathAndOrganizationId(normalizedPath, orgId);
                if (fileItem.isEmpty()) {
                    // Also try without "backend/" prefix
                    String altPath = normalizedPath.startsWith("backend/") ? normalizedPath.substring(8) : "backend/" + normalizedPath;
                    fileItem = fileItemRepository.findByFilePathAndOrganizationId(altPath, orgId);
                }

                if (fileItem.isEmpty()) {
                    log.warn("SECURITY: File access denied - file not found in tenant's records. Path: {}, OrgId: {}", normalizedPath, orgId);
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
                }
                log.info("AUDIT: File ownership verified - FileItem ID: {}, Path: {}", fileItem.get().getId(), normalizedPath);
            }

            File file = filePath.toFile();
            if (!file.exists() || !file.isFile()) {
                return ResponseEntity.notFound().build();
            }

            Resource resource = new FileSystemResource(file);

            // Determine content type
            String contentType = Files.probeContentType(filePath);
            if (contentType == null) {
                contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
                    .body(resource);

        } catch (IOException e) {
            log.error("Error downloading file: {}", path, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/serve/{filename:.+}")
    public ResponseEntity<?> serveFile(@PathVariable String filename) {
        // SECURITY: Require organization context
        Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
        if (orgId == null) {
            log.warn("SECURITY: File serve attempted without organization context - filename: {}", filename);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\": \"Organization context required\"}");
        }

        log.info("Serving file: {} for org: {}", filename, orgId);

        try {
            // Use configured output path for consistency with AIDocumentAnalysisService
            Path filePath = Paths.get(documentsOutputPath, filename);
            String fullPath = filePath.toString();
            log.info("Looking for file at: {}", filePath.toAbsolutePath());

            // SECURITY: Verify file ownership via database
            Optional<FileItem> fileItem = fileItemRepository.findByNameAndOrganizationId(filename, orgId);
            if (fileItem.isEmpty()) {
                // Also try by full path
                fileItem = fileItemRepository.findByFilePathAndOrganizationId(fullPath, orgId);
            }

            if (fileItem.isEmpty()) {
                log.warn("SECURITY: File access denied - file not found in tenant's records. Filename: {}, OrgId: {}", filename, orgId);
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\": \"Access denied\", \"filename\": \"" + filename + "\"}");
            }
            log.info("AUDIT: File ownership verified - FileItem ID: {}, Filename: {}", fileItem.get().getId(), filename);

            File file = filePath.toFile();
            if (!file.exists() || !file.isFile()) {
                log.warn("File not found on disk: {}", filePath.toAbsolutePath());
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\": \"File not found\", \"filename\": \"" + filename + "\"}");
            }

            Resource resource = new FileSystemResource(file);

            // Determine content type
            String contentType = Files.probeContentType(filePath);
            if (contentType == null) {
                contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
            }
            log.info("Serving file {} with content-type: {}", filename, contentType);

            String primaryOrigin = allowedOrigins.split(",")[0].trim();
            String frameAncestors = String.join(" ", allowedOrigins.split(","));
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                    .header("X-Frame-Options", "ALLOW-FROM " + primaryOrigin)
                    .header("Content-Security-Policy", "frame-ancestors 'self' " + frameAncestors)
                    .header(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, primaryOrigin)
                    .header(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true")
                    .header(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate")
                    .body(resource);

        } catch (IOException e) {
            log.error("Error serving file: {}", filename, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\": \"Error reading file\"}");
        }
    }
}
