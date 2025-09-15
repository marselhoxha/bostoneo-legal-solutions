package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.service.FileCleanupService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/file-cleanup")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "File Cleanup Administration", description = "Administrative endpoints for file cleanup operations")
public class FileCleanupController {

    private final FileCleanupService fileCleanupService;

    @GetMapping("/candidates")
    @Operation(summary = "Get count of files eligible for cleanup")
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    public ResponseEntity<Map<String, Object>> getCleanupCandidates() {
        int count = fileCleanupService.getCleanupCandidatesCount();
        return ResponseEntity.ok(Map.of(
                "count", count,
                "message", String.format("Found %d files eligible for permanent deletion", count)
        ));
    }

    @PostMapping("/execute")
    @Operation(summary = "Manually execute file cleanup")
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    public ResponseEntity<Map<String, Object>> executeManualCleanup() {
        try {
            FileCleanupService.CleanupResult result = fileCleanupService.performManualCleanup();
            
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "deletedCount", result.getDeletedCount(),
                    "failedCount", result.getFailedCount(),
                    "cutoffDate", result.getCutoffDate(),
                    "message", String.format("Cleanup completed. Deleted: %d, Failed: %d", 
                            result.getDeletedCount(), result.getFailedCount())
            ));
        } catch (Exception e) {
            log.error("Manual cleanup failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }
}