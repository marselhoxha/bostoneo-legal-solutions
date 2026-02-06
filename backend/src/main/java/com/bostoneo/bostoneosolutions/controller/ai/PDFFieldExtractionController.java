package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.service.AIPDFFormService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai/pdf-field-extraction")
@RequiredArgsConstructor
@Slf4j
public class PDFFieldExtractionController {

    private final AIPDFFormService pdfFormService;

    @PostMapping("/extract-fields")
    public ResponseEntity<Map<String, Object>> extractFields(@RequestBody Map<String, String> request) {
        try {
            String pdfPath = request.get("pdfPath");
            List<String> fieldNames = pdfFormService.extractPDFFieldNames(pdfPath);

            return ResponseEntity.ok(Map.of(
                "status", "success",
                "fieldCount", fieldNames.size(),
                "fields", fieldNames
            ));
        } catch (Exception e) {
            log.error("Error extracting PDF fields: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(
                "status", "error",
                "message", "Failed to extract fields: " + e.getMessage()
            ));
        }
    }
}