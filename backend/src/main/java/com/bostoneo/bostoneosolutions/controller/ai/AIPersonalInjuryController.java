package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.async.DeferredResult;

import java.text.NumberFormat;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * AI-powered Personal Injury practice area endpoints.
 * Provides case value analysis, demand letter generation, and settlement intelligence.
 */
@RestController
@RequestMapping("/api/ai/personal-injury")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:8085"}, allowCredentials = "true")
public class AIPersonalInjuryController {

    private final ClaudeSonnet4Service claudeService;
    private final NumberFormat currencyFormat = NumberFormat.getCurrencyInstance(Locale.US);

    /**
     * Analyze case value with AI insights
     */
    @PostMapping("/analyze-case-value")
    public DeferredResult<ResponseEntity<Map<String, Object>>> analyzeCaseValue(@RequestBody Map<String, Object> request) {
        log.info("Analyzing PI case value with Claude AI");

        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(90000L);

        @SuppressWarnings("unchecked")
        Map<String, Object> calculatedValue = (Map<String, Object>) request.getOrDefault("calculatedValue", new HashMap<>());

        // Extract case context if provided
        @SuppressWarnings("unchecked")
        Map<String, Object> caseContext = (Map<String, Object>) request.get("caseContext");
        String caseContextSection = "";
        if (caseContext != null && caseContext.get("caseNumber") != null) {
            caseContextSection = String.format("""

            LINKED CASE CONTEXT:
            Case Number: %s
            Client: %s
            Case Type: %s
            Status: %s
            Description: %s
            Filing Date: %s
            Court: %s
            """,
                caseContext.getOrDefault("caseNumber", "N/A"),
                caseContext.getOrDefault("clientName", "N/A"),
                caseContext.getOrDefault("caseType", "N/A"),
                caseContext.getOrDefault("status", "N/A"),
                caseContext.getOrDefault("description", "N/A"),
                caseContext.getOrDefault("filingDate", "N/A"),
                caseContext.getOrDefault("courtInfo", "N/A")
            );
        }

        String prompt = String.format("""
            You are an experienced Massachusetts personal injury attorney analyzing case value.
            %s
            INJURY INFORMATION:
            Injury Type: %s
            Injury Description: %s
            Liability Assessment: %s
            Comparative Negligence: %s%%

            DAMAGES CALCULATION:
            Medical Expenses: %s
            Lost Wages: %s
            Future Medical: %s
            Economic Damages Total: %s

            Pain & Suffering Multiplier: %sx
            Non-Economic Damages: %s

            Total Case Value: %s
            Adjusted (after negligence): %s

            Please provide a detailed analysis including:

            1. CASE STRENGTH ASSESSMENT
               - Evaluate the strength of this case based on injury type and liability
               - Identify any potential challenges or strengths
               - Rate case strength on a scale of 1-10

            2. DAMAGES ANALYSIS
               - Evaluate if the multiplier used is appropriate for this injury type
               - Compare to typical Massachusetts jury verdicts for similar injuries
               - Suggest if economic damages calculations are reasonable

            3. SETTLEMENT STRATEGY
               - Recommended initial demand range
               - Expected settlement range based on similar Massachusetts cases
               - Key factors that could increase or decrease value

            4. LITIGATION CONSIDERATIONS
               - Potential issues if case goes to trial
               - Jury appeal factors
               - Expert witness recommendations

            5. NEGOTIATION TALKING POINTS
               - Key arguments to emphasize in demand letter
               - Counter-arguments to anticipate from insurance
               - Documentary evidence to strengthen the case

            Provide specific, actionable advice based on Massachusetts personal injury law.
            %s
            """,
            caseContextSection,
            request.get("injuryType"),
            request.get("injuryDescription"),
            request.get("liabilityAssessment"),
            request.getOrDefault("comparativeNegligence", 0),
            formatCurrency(getDoubleValue(calculatedValue, "medicalExpenses")),
            formatCurrency(getDoubleValue(calculatedValue, "lostWages")),
            formatCurrency(getDoubleValue(calculatedValue, "futureMedical")),
            formatCurrency(getDoubleValue(calculatedValue, "economicDamages")),
            calculatedValue.getOrDefault("multiplier", 2.0),
            formatCurrency(getDoubleValue(calculatedValue, "nonEconomicDamages")),
            formatCurrency(getDoubleValue(calculatedValue, "totalCaseValue")),
            formatCurrency(getDoubleValue(calculatedValue, "adjustedCaseValue"))
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
                log.error("Error analyzing case value with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to analyze: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);

        return deferredResult;
    }

    /**
     * Generate AI-powered demand letter
     */
    @PostMapping("/generate-demand-letter")
    public DeferredResult<ResponseEntity<Map<String, Object>>> generateDemandLetter(@RequestBody Map<String, Object> request) {
        log.info("Generating PI demand letter with Claude AI");

        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(120000L);

        String mode = (String) request.getOrDefault("mode", "express");
        boolean isDetailed = "detailed".equalsIgnoreCase(mode);

        // Extract case context if provided
        @SuppressWarnings("unchecked")
        Map<String, Object> caseContext = (Map<String, Object>) request.get("caseContext");
        String caseContextSection = "";
        if (caseContext != null && caseContext.get("caseNumber") != null) {
            caseContextSection = String.format("""

            LINKED CASE INFORMATION:
            Case Number: %s
            Filed: %s
            Court: %s
            """,
                caseContext.getOrDefault("caseNumber", ""),
                caseContext.getOrDefault("filingDate", ""),
                caseContext.getOrDefault("courtInfo", "")
            );
        }

        String prompt = String.format("""
            You are an experienced Massachusetts personal injury attorney. Generate a %s demand letter.
            %s
            CLAIM INFORMATION:
            Claimant: %s
            Defendant (At-Fault Party): %s
            Insurance Company: %s
            Adjuster Name: %s
            Claim Number: %s
            Policy Limit: %s

            ACCIDENT DETAILS:
            Date of Accident: %s
            Location: %s

            INJURIES:
            Injury Type: %s
            Description: %s

            LIABILITY:
            %s

            DAMAGES:
            Medical Expenses: %s
            Lost Wages: %s
            Future Medical Expenses: %s
            Pain & Suffering (calculated): %s

            TOTAL DEMAND: %s

            Generate a professional demand letter that includes:

            1. HEADING with law firm letterhead placeholder, date, addressee

            2. RE: LINE with claimant name, insured, date of loss, claim number

            3. REPRESENTATION STATEMENT

            4. LIABILITY SECTION
               - Clear narrative establishing defendant's negligence
               - Reference to police report if applicable
               - Witnesses if mentioned

            5. INJURIES AND TREATMENT SECTION
               - Detailed description of injuries
               - Medical providers and treatment received
               - Ongoing symptoms and limitations
               %s

            6. MEDICAL EXPENSES ITEMIZATION
               - List of providers and amounts
               - Total medical expenses

            7. LOST WAGES SECTION (if applicable)
               - Employment information
               - Time missed from work
               - Lost income calculation

            8. FUTURE MEDICAL EXPENSES (if applicable)
               - Anticipated treatment needs
               - Cost projections

            9. PAIN AND SUFFERING NARRATIVE
               - Impact on daily activities
               - Effect on quality of life
               - Emotional and psychological impact
               %s

            10. DAMAGES SUMMARY TABLE

            11. DEMAND AND RESPONSE DEADLINE
                - State the demand amount
                - Set 30-day response deadline
                - Reserve right to file suit

            12. CLOSING with signature block

            Format the letter professionally using proper legal letter formatting.
            %s
            """,
            isDetailed ? "comprehensive, detailed" : "concise but complete",
            caseContextSection,
            request.get("clientName"),
            request.get("defendantName"),
            request.get("insuranceCompany"),
            request.getOrDefault("adjusterName", "[Adjuster Name]"),
            request.getOrDefault("claimNumber", "[Claim Number]"),
            formatCurrency(getDoubleValue(request, "policyLimit")),
            request.get("accidentDate"),
            request.get("accidentLocation"),
            request.get("injuryType"),
            request.get("injuryDescription"),
            request.get("liabilityDetails"),
            formatCurrency(getDoubleValue(request, "medicalExpenses")),
            formatCurrency(getDoubleValue(request, "lostWages")),
            formatCurrency(getDoubleValue(request, "futureMedical")),
            formatCurrency(getDoubleValue(request, "painSufferingAmount")),
            formatCurrency(getDoubleValue(request, "totalDemand")),
            isDetailed ? "- Include detailed medical chronology" : "",
            isDetailed ? "- Provide comprehensive pain and suffering narrative with specific examples" : "",
            isDetailed ? "Make the letter thorough and compelling, suitable for policy limits demands." : "Keep the letter focused and professional."
        );

        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("demandLetter", claudeResponse);
                response.put("mode", mode);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error generating demand letter with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to generate demand letter: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);

        return deferredResult;
    }

    /**
     * Analyze medical records and generate chronology
     */
    @PostMapping("/analyze-medical-records")
    public DeferredResult<ResponseEntity<Map<String, Object>>> analyzeMedicalRecords(@RequestBody Map<String, Object> request) {
        log.info("Analyzing medical records with Claude AI");

        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(90000L);

        String prompt = String.format("""
            You are a medical records analyst for a personal injury law firm.

            MEDICAL PROVIDERS AND RECORDS:
            %s

            INJURY TYPE: %s
            ACCIDENT DATE: %s

            Please analyze these medical records and provide:

            1. MEDICAL CHRONOLOGY
               - Create a timeline of all treatment dates
               - List providers in chronological order
               - Note diagnosis codes and treatments

            2. TREATMENT SUMMARY
               - Types of treatment received
               - Duration of treatment
               - Frequency of visits

            3. GAP ANALYSIS
               - Identify any gaps in treatment
               - Note potential missing records
               - Suggest records that should be obtained

            4. CAUSATION ANALYSIS
               - Connect injuries to accident
               - Note any pre-existing conditions mentioned
               - Identify any superseding events

            5. PROGNOSIS NOTES
               - Future treatment recommendations
               - Permanent impairment indications
               - Maximum Medical Improvement (MMI) indicators

            6. BILLING ANALYSIS
               - Total billed amounts
               - Reasonableness of charges
               - Any potentially excessive charges

            Format as a clear, organized medical summary suitable for demand letter preparation.
            """,
            request.get("medicalProviders"),
            request.get("injuryType"),
            request.get("accidentDate")
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
                log.error("Error analyzing medical records with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to analyze: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);

        return deferredResult;
    }

    /**
     * Analyze settlement negotiation and provide strategy
     */
    @PostMapping("/analyze-settlement")
    public DeferredResult<ResponseEntity<Map<String, Object>>> analyzeSettlement(@RequestBody Map<String, Object> request) {
        log.info("Analyzing settlement with Claude AI");

        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);

        String prompt = String.format("""
            You are an experienced Massachusetts personal injury settlement negotiator.

            CASE DETAILS:
            Injury Type: %s
            Total Medical Expenses: %s
            Policy Limits: %s

            NEGOTIATION HISTORY:
            Initial Demand: %s
            Insurance Offer: %s
            Our Counter: %s

            NOTES:
            %s

            Please provide:

            1. NEGOTIATION ANALYSIS
               - Evaluate current offer against case value
               - Assess insurance company's likely reserve
               - Identify their negotiation strategy

            2. RECOMMENDED RESPONSE
               - Suggested counter-offer amount
               - Key points to emphasize
               - Concessions to consider

            3. SETTLEMENT RANGE
               - Minimum acceptable settlement
               - Target settlement
               - Maximum realistic recovery

            4. LEVERAGE POINTS
               - Strengths to emphasize
               - Weaknesses to address proactively
               - Time pressure factors

            5. NEXT STEPS
               - Recommended actions
               - Timeline for response
               - Escalation triggers

            Provide specific, actionable negotiation strategy.
            """,
            request.get("injuryType"),
            formatCurrency(getDoubleValue(request, "medicalExpenses")),
            formatCurrency(getDoubleValue(request, "policyLimit")),
            formatCurrency(getDoubleValue(request, "demandAmount")),
            formatCurrency(getDoubleValue(request, "offerAmount")),
            formatCurrency(getDoubleValue(request, "counterAmount")),
            request.getOrDefault("notes", "No additional notes")
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
                log.error("Error analyzing settlement with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to analyze: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);

        return deferredResult;
    }

    // Helper methods
    private String formatCurrency(Double value) {
        if (value == null || value == 0) {
            return "$0";
        }
        return currencyFormat.format(value);
    }

    private Double getDoubleValue(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) {
            return 0.0;
        }
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }
}
