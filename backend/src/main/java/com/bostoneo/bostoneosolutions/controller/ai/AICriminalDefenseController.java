package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.service.AICriminalDefenseService;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.async.DeferredResult;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai/criminal-defense")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:8085"}, allowCredentials = "true")
public class AICriminalDefenseController {

    private final AICriminalDefenseService criminalDefenseService;
    private final ClaudeSonnet4Service claudeService;

    @PostMapping("/generate-motion")
    public DeferredResult<ResponseEntity<Map<String, Object>>> generateMotion(@RequestBody Map<String, Object> request) {
        log.info("Generating criminal defense motion with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        // Build prompt for Claude AI
        String prompt = String.format("""
            Generate a professional legal motion for criminal defense:
            
            Motion Type: %s
            Court: %s
            Case Number: %s
            Defendant Name: %s
            
            FACTUAL BASIS:
            %s
            
            LEGAL ARGUMENTS:
            %s
            
            REQUESTED RELIEF:
            %s
            
            Please generate a complete, professionally formatted criminal defense motion in Massachusetts court format.
            Include proper legal citations and formatting.
            """,
            request.get("motionType"),
            request.get("courtName"),
            request.get("caseNumber"),
            request.get("defendantName"),
            request.get("factualBasis"),
            request.get("legalArguments"),
            request.get("requestedRelief")
        );
        
        // Call Claude AI
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("content", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error generating motion with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to generate motion: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/calculate-sentence")
    public ResponseEntity<Map<String, Object>> calculateSentence(@RequestBody Map<String, Object> request) {
        log.info("Calculating sentence: {}", request);
        
        try {
            Map<String, Object> result = criminalDefenseService.calculateSentence(request);
            result.put("success", true);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error calculating sentence: ", e);
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @PostMapping("/analyze-case")
    public DeferredResult<ResponseEntity<Map<String, Object>>> analyzeCase(@RequestBody Map<String, Object> request) {
        log.info("Analyzing criminal case with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Analyze this criminal defense case and provide strategic recommendations:
            
            CHARGES: %s
            
            FACTS OF THE CASE:
            %s
            
            PRIOR CRIMINAL RECORD:
            %s
            
            WITNESS INFORMATION:
            %s
            
            EVIDENCE SUMMARY:
            %s
            
            Please provide:
            1. Case strengths (list 3-5 key strengths)
            2. Case weaknesses (list 3-5 key weaknesses)
            3. Recommended defense strategies
            4. Win probability assessment (as percentage)
            5. Best overall strategy
            
            Format the response as a structured analysis.
            """,
            request.get("charges"),
            request.get("facts"),
            request.get("priorRecord"),
            request.get("witnessInfo"),
            request.get("evidenceSummary")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                // Parse Claude's response into structured format
                Map<String, Object> analysis = new HashMap<>();
                analysis.put("success", true);
                analysis.put("fullAnalysis", claudeResponse);
                
                // Try to extract key points from Claude's response
                if (claudeResponse.contains("strengths") || claudeResponse.contains("Strengths")) {
                    analysis.put("strengths", extractBulletPoints(claudeResponse, "strengths"));
                }
                if (claudeResponse.contains("weaknesses") || claudeResponse.contains("Weaknesses")) {
                    analysis.put("weaknesses", extractBulletPoints(claudeResponse, "weaknesses"));
                }
                
                analysis.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(analysis);
            })
            .exceptionally(ex -> {
                log.error("Error analyzing case with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to analyze case: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }
    
    private List<String> extractBulletPoints(String text, String section) {
        // Simple extraction - in production would use better parsing
        List<String> points = new ArrayList<>();
        String[] lines = text.split("\n");
        boolean inSection = false;
        for (String line : lines) {
            if (line.toLowerCase().contains(section.toLowerCase())) {
                inSection = true;
                continue;
            }
            if (inSection && (line.trim().startsWith("-") || line.trim().startsWith("•") || line.trim().startsWith("*"))) {
                points.add(line.trim().substring(1).trim());
            }
            if (inSection && line.trim().isEmpty()) {
                break; // End of section
            }
        }
        return points.isEmpty() ? List.of("See full analysis for details") : points;
    }

    @PostMapping("/analyze-plea")
    public ResponseEntity<Map<String, Object>> analyzePlea(@RequestBody Map<String, Object> request) {
        log.info("Analyzing plea agreement: {}", request);
        
        try {
            Map<String, Object> analysis = criminalDefenseService.analyzePleaAgreement(request);
            analysis.put("success", true);
            return ResponseEntity.ok(analysis);
        } catch (Exception e) {
            log.error("Error analyzing plea: ", e);
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }
}