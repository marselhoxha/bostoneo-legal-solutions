package com.bostoneo.bostoneosolutions.controller;

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

@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = "http://localhost:4200", allowCredentials = "true")
@Slf4j
public class FileDownloadController {

    @Value("${app.documents.output-path:uploads/documents}")
    private String documentsOutputPath;

    @GetMapping("/download")
    public ResponseEntity<Resource> downloadFile(@RequestParam String path) {
        try {
            // Resolve the path relative to the application root
            Path filePath = Paths.get(path);

            // Security check: ensure the file is within allowed directories
            String normalizedPath = filePath.normalize().toString();
            if (!normalizedPath.startsWith("backend/uploads/") &&
                !normalizedPath.startsWith("uploads/") &&
                !normalizedPath.startsWith("/tmp/bostoneo-pdfs/")) {
                return ResponseEntity.badRequest().build();
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
        log.info("Serving file: {}", filename);

        try {
            // Use configured output path for consistency with AIDocumentAnalysisService
            Path filePath = Paths.get(documentsOutputPath, filename);
            log.info("Looking for file at: {}", filePath.toAbsolutePath());

            File file = filePath.toFile();
            if (!file.exists() || !file.isFile()) {
                log.warn("File not found: {}", filePath.toAbsolutePath());
                // Return a proper JSON error instead of letting global handler catch it
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

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                    // Allow iframe embedding from localhost:4200
                    .header("X-Frame-Options", "ALLOW-FROM http://localhost:4200")
                    .header("Content-Security-Policy", "frame-ancestors 'self' http://localhost:4200")
                    .header(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:4200")
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
