package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.service.AIDocumentAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.async.DeferredResult;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/ai/document-analyzer")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "http://localhost:4200", allowCredentials = "true")
public class AIDocumentAnalyzerController {

    private final AIDocumentAnalysisService documentAnalysisService;

    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DeferredResult<ResponseEntity<Map<String, Object>>> analyzeDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam("analysisType") String analysisType,
            @RequestParam(value = "userId", required = false) Long userId,
            @RequestParam(value = "caseId", required = false) Long caseId) {

        log.info("Analyzing document: {}, type: {}, analysis: {}",
                file.getOriginalFilename(), file.getContentType(), analysisType);

        // Set timeout to 90 seconds for complex document analysis
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(90000L);

        // Use default user ID if not provided (for testing)
        Long effectiveUserId = userId != null ? userId : 1L;

        documentAnalysisService.analyzeDocument(file, analysisType, effectiveUserId, caseId)
                .thenApply(analysis -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("id", analysis.getAnalysisId());
                    result.put("fileName", analysis.getFileName());
                    result.put("fileSize", analysis.getFileSize());
                    result.put("analysisType", analysis.getAnalysisType());
                    result.put("status", analysis.getStatus());
                    result.put("timestamp", analysis.getCreatedAt().toString());

                    if ("completed".equals(analysis.getStatus())) {
                        Map<String, Object> analysisData = new HashMap<>();
                        analysisData.put("fullAnalysis", analysis.getAnalysisResult());
                        analysisData.put("summary", analysis.getSummary());
                        analysisData.put("riskScore", analysis.getRiskScore());
                        analysisData.put("riskLevel", analysis.getRiskLevel());
                        result.put("analysis", analysisData);
                    }

                    return ResponseEntity.ok(result);
                })
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Error analyzing document: {}", ex.getMessage(), ex);
                        Map<String, Object> error = new HashMap<>();
                        error.put("status", "failed");
                        error.put("error", ex.getMessage());
                        deferredResult.setResult(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error));
                    } else {
                        deferredResult.setResult(result);
                    }
                });

        // Set timeout fallback
        deferredResult.onTimeout(() -> {
            log.warn("Document analysis request timed out");
            Map<String, Object> error = new HashMap<>();
            error.put("status", "failed");
            error.put("error", "Analysis request timed out");
            deferredResult.setResult(ResponseEntity.status(HttpStatus.REQUEST_TIMEOUT).body(error));
        });

        return deferredResult;
    }

    @GetMapping("/analysis-history")
    public ResponseEntity<Map<String, Object>> getAnalysisHistory(
            @RequestParam(value = "userId", required = false) Long userId) {

        // Use default user ID if not provided (for testing)
        Long effectiveUserId = userId != null ? userId : 1L;

        Map<String, Object> response = new HashMap<>();
        response.put("analyses", documentAnalysisService.getAnalysisHistory(effectiveUserId));
        response.put("total", documentAnalysisService.getAnalysisHistory(effectiveUserId).size());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/analysis/{analysisId}")
    public ResponseEntity<Map<String, Object>> getAnalysisById(@PathVariable String analysisId) {
        return documentAnalysisService.getAnalysisById(analysisId)
                .map(analysis -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("id", analysis.getAnalysisId());
                    result.put("fileName", analysis.getFileName());
                    result.put("fileSize", analysis.getFileSize());
                    result.put("analysisType", analysis.getAnalysisType());
                    result.put("status", analysis.getStatus());
                    result.put("timestamp", analysis.getCreatedAt().toString());

                    if ("completed".equals(analysis.getStatus())) {
                        Map<String, Object> analysisData = new HashMap<>();
                        analysisData.put("fullAnalysis", analysis.getAnalysisResult());
                        analysisData.put("summary", analysis.getSummary());
                        analysisData.put("riskScore", analysis.getRiskScore());
                        analysisData.put("riskLevel", analysis.getRiskLevel());
                        result.put("analysis", analysisData);
                    }

                    return ResponseEntity.ok(result);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getAnalysisStats(
            @RequestParam(value = "userId", required = false) Long userId) {

        // Use default user ID if not provided (for testing)
        Long effectiveUserId = userId != null ? userId : 1L;

        return ResponseEntity.ok(documentAnalysisService.getAnalysisStats(effectiveUserId));
    }

}