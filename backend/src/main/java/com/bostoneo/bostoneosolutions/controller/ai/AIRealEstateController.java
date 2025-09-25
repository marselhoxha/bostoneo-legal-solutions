package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.service.AIRealEstateService;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.async.DeferredResult;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/ai/real-estate")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:8085"}, allowCredentials = "true")
public class AIRealEstateController {

    private final AIRealEstateService realEstateService;
    private final ClaudeSonnet4Service claudeService;

    @PostMapping("/generate-purchase-agreement")
    public DeferredResult<ResponseEntity<Map<String, Object>>> generatePurchaseAgreement(@RequestBody Map<String, Object> request) {
        log.info("Generating purchase agreement with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Generate a professional Massachusetts real estate purchase and sale agreement:
            
            PROPERTY DETAILS:
            Property Address: %s
            Property Type: %s
            Legal Description: %s
            
            SELLER INFORMATION:
            Name: %s
            Address: %s
            
            BUYER INFORMATION:
            Name: %s
            Address: %s
            
            FINANCIAL TERMS:
            Purchase Price: $%s
            Earnest Money: $%s
            Closing Date: %s
            
            Generate a complete, legally compliant Massachusetts purchase and sale agreement.
            Include all standard provisions, contingencies, and disclosures required by MA law.
            """,
            request.get("propertyAddress"),
            request.get("propertyType"),
            request.get("legalDescription"),
            request.get("sellerName"),
            request.get("sellerAddress"),
            request.get("buyerName"),
            request.get("buyerAddress"),
            request.get("purchasePrice"),
            request.get("earnestMoney"),
            request.get("closingDate")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("content", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error generating purchase agreement with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to generate agreement: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/generate-lease")
    public DeferredResult<ResponseEntity<Map<String, Object>>> generateLease(@RequestBody Map<String, Object> request) {
        log.info("Generating lease agreement with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Generate a professional Massachusetts residential lease agreement:
            
            PROPERTY: %s
            LANDLORD: %s
            TENANT: %s
            
            LEASE TERMS:
            Monthly Rent: $%s
            Security Deposit: $%s
            Lease Term: %s
            Start Date: %s
            Pet Policy: %s
            
            UTILITIES INCLUDED: %s
            
            Generate a complete Massachusetts residential lease agreement with all required disclosures and provisions.
            """,
            request.get("propertyAddress"),
            request.get("landlordName"),
            request.get("tenantName"),
            request.get("monthlyRent"),
            request.get("securityDeposit"),
            request.get("leaseTerm"),
            request.get("startDate"),
            request.get("petPolicy"),
            request.get("utilities")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("content", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error generating lease: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/analyze-title")
    public DeferredResult<ResponseEntity<Map<String, Object>>> analyzeTitle(@RequestBody Map<String, Object> request) {
        log.info("Analyzing title with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Analyze this real estate title information and identify potential issues:
            
            PROPERTY: %s
            CURRENT OWNER: %s
            CHAIN OF TITLE: %s
            LIENS: %s
            ENCUMBRANCES: %s
            EASEMENTS: %s
            
            Provide:
            1. Title defects or issues found
            2. Risk assessment for each issue
            3. Recommended solutions
            4. Required title insurance endorsements
            5. Overall title opinion
            """,
            request.get("propertyAddress"),
            request.get("currentOwner"),
            request.get("chainOfTitle"),
            request.get("liens"),
            request.get("encumbrances"),
            request.get("easements")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("analysis", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error analyzing title: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/generate-deed")
    public DeferredResult<ResponseEntity<Map<String, Object>>> generateDeed(@RequestBody Map<String, Object> request) {
        log.info("Generating deed with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Generate a Massachusetts %s deed:
            
            GRANTOR: %s
            GRANTEE: %s
            PROPERTY: %s
            LEGAL DESCRIPTION: %s
            CONSIDERATION: $%s
            
            Generate a complete, properly formatted Massachusetts deed with all required language and provisions.
            """,
            request.get("deedType"),
            request.get("grantor"),
            request.get("grantee"),
            request.get("propertyAddress"),
            request.get("legalDescription"),
            request.get("consideration")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("content", claudeResponse);
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error generating deed: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/generate-closing-checklist")
    public DeferredResult<ResponseEntity<Map<String, Object>>> generateClosingChecklist(@RequestBody Map<String, Object> request) {
        log.info("Generating closing checklist with Claude AI");
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Generate a comprehensive real estate closing checklist for Massachusetts:
            
            Transaction Type: %s
            Property Type: %s
            Financing: %s
            Closing Date: %s
            
            Create a detailed checklist including:
            1. Pre-closing documents required
            2. Closing day documents
            3. Post-closing tasks
            4. Recording requirements
            5. Title insurance requirements
            6. Lender requirements (if applicable)
            7. Massachusetts specific requirements
            """,
            request.get("transactionType"),
            request.get("propertyType"),
            request.get("financing"),
            request.get("closingDate")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("checklist", claudeResponse);
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error generating checklist: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }
}