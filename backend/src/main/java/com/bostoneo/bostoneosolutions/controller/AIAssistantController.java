package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.service.ai.DocumentAnalysisService;
import com.bostoneo.bostoneosolutions.service.ai.AIService;
import com.bostoneo.bostoneosolutions.service.ai.ContractAnalysisService;
import com.bostoneo.bostoneosolutions.dto.ai.ContractRiskAssessment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin
public class AIAssistantController {

    private final DocumentAnalysisService documentAnalysisService;
    private final AIService aiService;
    private final ContractAnalysisService contractAnalysisService;

    @PostMapping("/analyze-document")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> analyzeDocument(
            @RequestBody Map<String, String> request) {
        
        String content = request.get("content");
        String documentType = request.getOrDefault("documentType", "legal document");
        String analysisType = request.getOrDefault("analysisType", "summary");
        
        if (content == null || content.trim().isEmpty()) {
            return CompletableFuture.completedFuture(
                ResponseEntity.badRequest().body(Map.of("error", "Content is required"))
            );
        }

        return documentAnalysisService.analyzeDocument(content, documentType, analysisType)
                .thenApply(result -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("analysis", result);
                    response.put("analysisType", analysisType);
                    response.put("documentType", documentType);
                    response.put("timestamp", System.currentTimeMillis());
                    return ResponseEntity.ok(response);
                })
                .exceptionally(ex -> {
                    log.error("Error analyzing document", ex);
                    return ResponseEntity.internalServerError().body(Map.of(
                        "error", "Analysis failed: " + ex.getMessage()
                    ));
                });
    }

    @PostMapping("/quick-summary")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> quickSummary(
            @RequestBody Map<String, String> request) {
        
        String content = request.get("content");
        
        return documentAnalysisService.quickSummary(content)
                .thenApply(summary -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("summary", summary);
                    response.put("timestamp", System.currentTimeMillis());
                    return ResponseEntity.ok(response);
                })
                .exceptionally(ex -> {
                    log.error("Error generating summary", ex);
                    return ResponseEntity.internalServerError().body(Map.of(
                        "error", "Summary generation failed"
                    ));
                });
    }

    @PostMapping("/extract-terms")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> extractKeyTerms(
            @RequestBody Map<String, String> request) {
        
        String content = request.get("content");
        
        return documentAnalysisService.extractKeyTerms(content)
                .thenApply(terms -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("keyTerms", terms);
                    response.put("timestamp", System.currentTimeMillis());
                    return ResponseEntity.ok(response);
                })
                .exceptionally(ex -> {
                    log.error("Error extracting terms", ex);
                    return ResponseEntity.internalServerError().body(Map.of(
                        "error", "Term extraction failed"
                    ));
                });
    }

    @PostMapping("/risk-assessment")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> riskAssessment(
            @RequestBody Map<String, String> request) {
        
        String content = request.get("content");
        
        return documentAnalysisService.riskAssessment(content)
                .thenApply(assessment -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("riskAssessment", assessment);
                    response.put("timestamp", System.currentTimeMillis());
                    return ResponseEntity.ok(response);
                })
                .exceptionally(ex -> {
                    log.error("Error performing risk assessment", ex);
                    return ResponseEntity.internalServerError().body(Map.of(
                        "error", "Risk assessment failed"
                    ));
                });
    }

    @PostMapping("/predict-case-outcome")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> predictCaseOutcome(
            @RequestBody Map<String, String> request) {
        
        String caseDetails = request.get("caseDetails");
        String jurisdiction = request.getOrDefault("jurisdiction", "General");
        
        return aiService.predictCaseOutcome(caseDetails, jurisdiction)
                .thenApply(prediction -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("prediction", prediction);
                    response.put("jurisdiction", jurisdiction);
                    response.put("timestamp", System.currentTimeMillis());
                    return ResponseEntity.ok(response);
                })
                .exceptionally(ex -> {
                    log.error("Error predicting case outcome", ex);
                    return ResponseEntity.internalServerError().body(Map.of(
                        "error", "Case prediction failed"
                    ));
                });
    }

    @PostMapping("/analyze-contract")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> analyzeContract(
            @RequestBody Map<String, String> request) {
        
        String contractText = request.get("contractText");
        
        if (contractText == null || contractText.trim().isEmpty()) {
            return CompletableFuture.completedFuture(
                ResponseEntity.badRequest().body(Map.of("error", "Contract text is required"))
            );
        }

        return contractAnalysisService.analyzeContract(contractText)
                .thenApply(assessment -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("assessment", assessment);
                    response.put("timestamp", System.currentTimeMillis());
                    return ResponseEntity.ok(response);
                })
                .exceptionally(ex -> {
                    log.error("Error analyzing contract", ex);
                    return ResponseEntity.internalServerError().body(Map.of(
                        "error", "Contract analysis failed: " + ex.getMessage()
                    ));
                });
    }

    @PostMapping("/extract-contract-terms")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> extractContractTerms(
            @RequestBody Map<String, String> request) {
        
        String contractText = request.get("contractText");
        
        return documentAnalysisService.extractKeyTerms(contractText)
                .thenApply(terms -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("terms", terms);
                    response.put("timestamp", System.currentTimeMillis());
                    return ResponseEntity.ok(response);
                })
                .exceptionally(ex -> {
                    log.error("Error extracting contract terms", ex);
                    return ResponseEntity.internalServerError().body(Map.of(
                        "error", "Contract term extraction failed"
                    ));
                });
    }

    @PostMapping("/quick-risk-scan")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> quickRiskScan(
            @RequestBody Map<String, String> request) {
        
        String contractText = request.get("contractText");
        
        return contractAnalysisService.quickRiskScan(contractText)
                .thenApply(assessment -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("assessment", assessment);
                    response.put("type", "quick_scan");
                    response.put("timestamp", System.currentTimeMillis());
                    return ResponseEntity.ok(response);
                })
                .exceptionally(ex -> {
                    log.error("Error performing quick risk scan", ex);
                    return ResponseEntity.internalServerError().body(Map.of(
                        "error", "Quick risk scan failed"
                    ));
                });
    }

    @PostMapping("/search-case-law")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> searchCaseLaw(
            @RequestBody Map<String, String> request) {
        
        String query = request.get("query");
        String jurisdiction = request.getOrDefault("jurisdiction", "Federal");
        
        if (query == null || query.trim().isEmpty()) {
            return CompletableFuture.completedFuture(
                ResponseEntity.badRequest().body(Map.of("error", "Search query is required"))
            );
        }

        return documentAnalysisService.searchCaseLaw(query, jurisdiction)
                .thenApply(result -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("result", result);
                    response.put("query", query);
                    response.put("jurisdiction", jurisdiction);
                    response.put("timestamp", System.currentTimeMillis());
                    return ResponseEntity.ok(response);
                })
                .exceptionally(ex -> {
                    log.error("Error searching case law", ex);
                    return ResponseEntity.internalServerError().body(Map.of(
                        "error", "Case law search failed: " + ex.getMessage()
                    ));
                });
    }

    @PostMapping("/interpret-statute")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> interpretStatute(
            @RequestBody Map<String, String> request) {
        
        String statuteText = request.get("statuteText");
        String jurisdiction = request.getOrDefault("jurisdiction", "Federal");
        
        return documentAnalysisService.interpretStatute(statuteText, jurisdiction)
                .thenApply(result -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("interpretation", result);
                    response.put("jurisdiction", jurisdiction);
                    response.put("timestamp", System.currentTimeMillis());
                    return ResponseEntity.ok(response);
                })
                .exceptionally(ex -> {
                    log.error("Error interpreting statute", ex);
                    return ResponseEntity.internalServerError().body(Map.of(
                        "error", "Statute interpretation failed"
                    ));
                });
    }

    @PostMapping("/find-precedents")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> findPrecedents(
            @RequestBody Map<String, String> request) {
        
        String caseDescription = request.get("caseDescription");
        String practiceArea = request.getOrDefault("practiceArea", "General");
        
        return documentAnalysisService.findPrecedents(caseDescription, practiceArea)
                .thenApply(result -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("precedents", result);
                    response.put("practiceArea", practiceArea);
                    response.put("timestamp", System.currentTimeMillis());
                    return ResponseEntity.ok(response);
                })
                .exceptionally(ex -> {
                    log.error("Error finding precedents", ex);
                    return ResponseEntity.internalServerError().body(Map.of(
                        "error", "Precedent search failed"
                    ));
                });
    }

    @PostMapping({"/draft-legal-memo", "/legal-memo"})
    public CompletableFuture<ResponseEntity<Map<String, Object>>> draftLegalMemo(
            @RequestBody Map<String, String> request) {
        
        String topic = request.get("topic");
        String jurisdiction = request.getOrDefault("jurisdiction", "Federal");
        String keyFacts = request.getOrDefault("keyFacts", "");
        
        if (topic == null || topic.trim().isEmpty()) {
            return CompletableFuture.completedFuture(
                ResponseEntity.badRequest().body(Map.of(
                    "error", "Topic is required"
                ))
            );
        }
        
        return documentAnalysisService.draftLegalMemo(topic, jurisdiction, keyFacts)
                .thenApply(result -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("memo", result);
                    response.put("topic", topic);
                    response.put("jurisdiction", jurisdiction);
                    response.put("timestamp", System.currentTimeMillis());
                    return ResponseEntity.ok(response);
                })
                .exceptionally(ex -> {
                    log.error("Error drafting legal memo", ex);
                    return ResponseEntity.internalServerError().body(Map.of(
                        "error", "Legal memo drafting failed: " + ex.getMessage()
                    ));
                });
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "healthy",
            "service", "AI Assistant",
            "timestamp", String.valueOf(System.currentTimeMillis())
        ));
    }
    
    @GetMapping("/test-legal-memo")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> testLegalMemo() {
        return documentAnalysisService.draftLegalMemo("test topic", "Federal", "test facts")
                .thenApply(result -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("memo", result);
                    response.put("timestamp", System.currentTimeMillis());
                    return ResponseEntity.ok(response);
                })
                .exceptionally(ex -> {
                    log.error("Error in test legal memo", ex);
                    return ResponseEntity.internalServerError().body(Map.of(
                        "error", "Test failed: " + ex.getMessage()
                    ));
                });
    }
}