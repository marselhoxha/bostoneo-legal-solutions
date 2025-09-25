package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.service.PDFStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai/pdf-storage")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "http://localhost:4200", allowCredentials = "true")
public class PDFStorageController {

    private final PDFStorageService pdfStorageService;

    @PostMapping("/download-official-forms")
    public ResponseEntity<Map<String, String>> downloadOfficialForms() {
        try {
            pdfStorageService.downloadOfficialForms();
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Official forms downloaded successfully"
            ));
        } catch (Exception e) {
            log.error("Error downloading official forms: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(
                "status", "error",
                "message", "Failed to download forms: " + e.getMessage()
            ));
        }
    }

    @PostMapping("/download-form")
    public ResponseEntity<Map<String, String>> downloadForm(@RequestBody Map<String, String> request) {
        try {
            String url = request.get("url");
            String filename = request.get("filename");

            String localPath = pdfStorageService.downloadAndStorePDF(url, filename);
            String hash = pdfStorageService.calculatePDFHash(localPath);

            return ResponseEntity.ok(Map.of(
                "status", "success",
                "localPath", localPath,
                "hash", hash
            ));
        } catch (Exception e) {
            log.error("Error downloading PDF form: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(
                "status", "error",
                "message", "Failed to download form: " + e.getMessage()
            ));
        }
    }
}