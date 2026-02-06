package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.service.AIFamilyLawService;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.async.DeferredResult;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/ai/family-law")
@RequiredArgsConstructor
@Slf4j
public class AIFamilyLawController {

    private final AIFamilyLawService familyLawService;
    private final ClaudeSonnet4Service claudeService;

    @PostMapping("/calculate-child-support")
    public DeferredResult<ResponseEntity<Map<String, Object>>> calculateChildSupport(@RequestBody Map<String, Object> request) {
        log.info("Calculating child support with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Calculate Massachusetts child support based on these parameters:
            
            INCOME INFORMATION:
            Payor Annual Income: $%s
            Payee Annual Income: $%s
            
            CHILDREN INFORMATION:
            Number of Children: %s
            
            EXPENSES:
            Health Insurance: $%s/year
            Childcare Costs: $%s/year
            Other Deductions: $%s
            
            CUSTODY ARRANGEMENT:
            Shared Custody: %s
            Overnights with Payor: %s
            
            Please calculate:
            1. Weekly child support amount
            2. Monthly child support amount
            3. Annual child support amount
            4. Payor's percentage share
            5. Any applicable deviation factors
            6. Detailed calculation breakdown following Massachusetts guidelines
            
            Format the response with clear calculations and explanations.
            """,
            request.get("payorIncome"),
            request.get("payeeIncome"),
            request.get("numberOfChildren"),
            request.get("healthInsurance"),
            request.get("childcare"),
            request.get("otherDeductions"),
            request.get("parentsShareCustody"),
            request.get("overnightsWithPayor")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("calculation", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error calculating child support with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to calculate: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/generate-custody-agreement")
    public DeferredResult<ResponseEntity<Map<String, Object>>> generateCustodyAgreement(@RequestBody Map<String, Object> request) {
        log.info("Generating custody agreement with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Generate a comprehensive Massachusetts custody agreement with these details:
            
            CUSTODY TYPE:
            Legal Custody: %s
            Physical Custody: %s
            
            PARENTS:
            Parent A: %s
            Parent B: %s
            
            CHILDREN:
            Names: %s
            School District: %s
            
            SCHEDULE:
            Holiday Schedule: %s
            Vacation Time: %s per parent
            
            DECISION MAKING:
            Education: %s
            Medical: %s
            Extracurricular: %s
            Religious: %s
            
            OTHER PROVISIONS:
            Dispute Resolution: %s
            Relocation Notice: %s days
            
            Generate a complete, legally compliant Massachusetts custody agreement with:
            1. Detailed parenting time schedule
            2. Holiday and vacation schedules
            3. Decision-making provisions
            4. Communication guidelines
            5. Modification procedures
            """,
            request.getOrDefault("legalCustody", ""),
            request.getOrDefault("physicalCustody", ""),
            request.getOrDefault("parentAName", ""),
            request.getOrDefault("parentBName", ""),
            request.getOrDefault("childrenNames", ""),
            request.getOrDefault("schoolDistrict", ""),
            request.getOrDefault("holidaySchedule", ""),
            request.getOrDefault("vacationTime", ""),
            ((Map<String, Object>)request.getOrDefault("decisionMaking", new HashMap<>())).get("education"),
            ((Map<String, Object>)request.getOrDefault("decisionMaking", new HashMap<>())).get("medical"),
            ((Map<String, Object>)request.getOrDefault("decisionMaking", new HashMap<>())).get("extracurricular"),
            ((Map<String, Object>)request.getOrDefault("decisionMaking", new HashMap<>())).get("religious"),
            request.getOrDefault("disputeResolution", ""),
            request.getOrDefault("relocationNotice", "")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("agreement", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error generating custody agreement with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to generate agreement: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/prepare-divorce-documents")
    public DeferredResult<ResponseEntity<Map<String, Object>>> prepareDivorceDocuments(@RequestBody Map<String, Object> request) {
        log.info("Preparing divorce documents with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Generate a complete set of Massachusetts divorce documents based on:
            
            DIVORCE TYPE: %s
            
            PARTIES:
            Plaintiff: %s
            Defendant: %s
            
            MARRIAGE DETAILS:
            Marriage Date: %s
            Separation Date: %s
            Grounds: %s
            County: %s
            
            CIRCUMSTANCES:
            Has Children: %s
            Has Property: %s
            Seeking Alimony: %s
            Irretrievable Breakdown: %s
            
            Generate:
            1. Complete list of required documents for this type of divorce
            2. Properly formatted Complaint for Divorce
            3. Summons with instructions
            4. Financial disclosure requirements
            5. Any special forms based on circumstances (children, property, etc.)
            6. Filing instructions and timeline
            
            Format each document according to Massachusetts court requirements.
            """,
            request.get("divorceType"),
            request.get("plaintiffName"),
            request.get("defendantName"),
            request.get("marriageDate"),
            request.get("separationDate"),
            request.get("grounds"),
            request.get("county"),
            request.get("hasChildren"),
            request.get("hasProperty"),
            request.get("seekingAlimony"),
            request.get("irretrievableBreakdown")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("documents", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error preparing divorce documents with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to prepare documents: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/analyze-property-division")
    public DeferredResult<ResponseEntity<Map<String, Object>>> analyzePropertyDivision(@RequestBody Map<String, Object> request) {
        log.info("Analyzing property division with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Analyze property division for Massachusetts divorce:
            
            PROPERTY ASSETS:
            %s
            
            Provide comprehensive analysis including:
            1. Total marital property value
            2. Current allocation to each party
            3. Percentage split analysis
            4. Equalization payment calculation
            5. Tax implications of division
            6. Recommendations for equitable distribution
            7. Special considerations for retirement accounts, real estate, businesses
            8. Massachusetts-specific factors (length of marriage, contributions, needs)
            
            Consider Massachusetts equitable distribution factors and provide detailed recommendations.
            """,
            request.get("propertyAssets")
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
                log.error("Error analyzing property division with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to analyze: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/calculate-alimony")
    public DeferredResult<ResponseEntity<Map<String, Object>>> calculateAlimony(@RequestBody Map<String, Object> request) {
        log.info("Calculating alimony with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Calculate Massachusetts alimony based on:
            
            ALIMONY TYPE: %s
            
            FINANCIAL INFORMATION:
            Payor Annual Income: $%s
            Recipient Annual Income: $%s
            
            MARRIAGE DETAILS:
            Length of Marriage: %s years
            Payor Age: %s
            Recipient Age: %s
            
            FACTORS:
            Recipient Need: %s
            Payor Ability to Pay: %s
            Standard of Living: %s
            Health Conditions: %s
            Non-Economic Contributions: %s
            
            Calculate and provide:
            1. Monthly alimony amount
            2. Annual alimony amount
            3. Duration of alimony (based on MA guidelines)
            4. Tax implications (post-2019 rules)
            5. Modification triggers
            6. Detailed explanation of calculations
            7. Relevant Massachusetts statutory factors considered
            
            Follow Massachusetts Alimony Reform Act guidelines.
            """,
            request.get("alimonyType"),
            request.get("payorIncome"),
            request.get("recipientIncome"),
            request.get("marriageLength"),
            request.get("payorAge"),
            request.get("recipientAge"),
            request.get("recipientNeed"),
            request.get("payorAbilityToPay"),
            request.get("standardOfLiving"),
            request.get("healthConditions"),
            request.get("contributions")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("calculation", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error calculating alimony with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to calculate: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }
}