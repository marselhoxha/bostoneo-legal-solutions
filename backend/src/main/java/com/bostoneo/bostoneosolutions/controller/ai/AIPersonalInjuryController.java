package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.dto.LegalCaseDTO;
import com.bostoneo.bostoneosolutions.dto.OrganizationDTO;
import com.bostoneo.bostoneosolutions.dto.PIDamageCalculationDTO;
import com.bostoneo.bostoneosolutions.dto.PIMedicalRecordDTO;
import com.bostoneo.bostoneosolutions.dto.PIMedicalSummaryDTO;
import com.bostoneo.bostoneosolutions.dto.ai.DraftGenerationResponse;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.service.AiWorkspaceDocumentService;
import com.bostoneo.bostoneosolutions.service.LegalCaseService;
import com.bostoneo.bostoneosolutions.service.OrganizationService;
import com.bostoneo.bostoneosolutions.service.PIDamageCalculationService;
import com.bostoneo.bostoneosolutions.service.PIMedicalRecordService;
import com.bostoneo.bostoneosolutions.service.PIMedicalSummaryService;
import com.bostoneo.bostoneosolutions.service.JurisdictionResolver;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.async.DeferredResult;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * AI-powered Personal Injury practice area endpoints.
 * Provides case value analysis, demand letter generation, and settlement intelligence.
 */
@PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_SYSADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_ATTORNEY', 'ROLE_PARALEGAL', 'ROLE_ASSOCIATE')")
@RestController
@RequestMapping("/api/ai/personal-injury")
@RequiredArgsConstructor
@Slf4j
public class AIPersonalInjuryController {

    private final ClaudeSonnet4Service claudeService;
    private final AiWorkspaceDocumentService documentService;
    private final LegalCaseService legalCaseService;
    private final PIMedicalRecordService medicalRecordService;
    private final PIDamageCalculationService damageCalculationService;
    private final PIMedicalSummaryService medicalSummaryService;
    private final TenantService tenantService;
    private final OrganizationService organizationService;
    private final JurisdictionResolver jurisdictionResolver;
    private final NumberFormat currencyFormat = NumberFormat.getCurrencyInstance(Locale.US);
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MM/dd/yyyy");

    /** Resolve the current org's state name for use in AI prompts */
    private String resolveState() {
        return jurisdictionResolver.resolveStateName(tenantService.requireCurrentOrganizationId());
    }

    /**
     * AI-powered case value calculation
     * Returns structured calculation with AI-determined values
     */
    @PostMapping("/calculate-case-value")
    public DeferredResult<ResponseEntity<Map<String, Object>>> calculateCaseValue(@RequestBody Map<String, Object> request) {
        log.info("AI calculating PI case value");

        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(90000L);
        String stateName = resolveState();

        String prompt = String.format("""
            You are an experienced %s personal injury attorney. Calculate the realistic case value.

            CASE INFORMATION:
            Injury Type: %s
            Injury Description: %s
            Liability Assessment: %s
            Comparative Negligence: %s%%

            ECONOMIC DAMAGES:
            Medical Expenses: %s
            Lost Wages: %s
            Future Medical Estimate: %s

            INSURANCE:
            Policy Limit: %s

            Based on your expertise in %s personal injury law, provide a REALISTIC case valuation.
            Consider:
            - Typical jury verdicts in %s for this injury type
            - The policy limit as a practical cap on recovery
            - The strength of liability
            - Comparative negligence reduction
            - Settlement vs. trial value
            - IMPORTANT: If medical expenses exceed 60%% of policy limit, this severely limits pain & suffering recovery
            - When medicals are high relative to policy, focus settlement strategy on policy limits demand

            IMPORTANT: You MUST respond in this EXACT JSON format (no other text):
            {
                "economicDamages": <number>,
                "recommendedMultiplier": <number between 1.5 and 5>,
                "multiplierReasoning": "<brief explanation>",
                "nonEconomicDamages": <number>,
                "totalCaseValue": <number>,
                "realisticRecovery": <number - considering policy limit>,
                "settlementRangeLow": <number>,
                "settlementRangeHigh": <number>,
                "caseStrength": <number 1-10>,
                "keyFactors": ["<factor1>", "<factor2>", "<factor3>"],
                "recommendations": "<brief strategy recommendation>",
                "medicalToLimitRatio": <percentage as number>,
                "isUnderinsured": <true if medical > 60%% of policy limit, false otherwise>
            }

            Return ONLY the JSON, no explanatory text before or after.
            """,
            stateName,
            request.getOrDefault("injuryType", "soft_tissue"),
            request.getOrDefault("injuryDescription", ""),
            request.getOrDefault("liabilityAssessment", "CLEAR"),
            request.getOrDefault("comparativeNegligence", 0),
            formatCurrency(getDoubleValue(request, "medicalExpenses")),
            formatCurrency(getDoubleValue(request, "lostWages")),
            formatCurrency(getDoubleValue(request, "futureMedical")),
            formatCurrency(getDoubleValue(request, "policyLimit")),
            stateName,
            stateName
        );

        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                try {
                    // Parse the JSON response from Claude
                    String jsonStr = claudeResponse.trim();
                    // Remove markdown code blocks if present
                    if (jsonStr.startsWith("```json")) {
                        jsonStr = jsonStr.substring(7);
                    }
                    if (jsonStr.startsWith("```")) {
                        jsonStr = jsonStr.substring(3);
                    }
                    if (jsonStr.endsWith("```")) {
                        jsonStr = jsonStr.substring(0, jsonStr.length() - 3);
                    }
                    jsonStr = jsonStr.trim();

                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    @SuppressWarnings("unchecked")
                    Map<String, Object> calculation = mapper.readValue(jsonStr, Map.class);

                    response.put("success", true);
                    response.put("calculation", calculation);
                    response.put("rawInput", request);
                    response.put("generatedAt", System.currentTimeMillis());
                } catch (Exception e) {
                    log.error("Error parsing AI response: {}", claudeResponse, e);
                    response.put("success", false);
                    response.put("error", "Failed to parse AI calculation");
                    response.put("rawResponse", claudeResponse);
                }
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error calculating case value with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to calculate: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);

        return deferredResult;
    }

    /**
     * Analyze case value with AI insights
     */
    @PostMapping("/analyze-case-value")
    @AuditLog(action = "VIEW", entityType = "LEGAL_CASE", description = "AI case value analysis")
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

        String stateName = resolveState();
        String prompt = String.format("""
            You are an experienced %s personal injury attorney analyzing case value.
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
               - Compare to typical jury verdicts in this state for similar injuries
               - Suggest if economic damages calculations are reasonable

            3. SETTLEMENT STRATEGY
               - Recommended initial demand range
               - Expected settlement range based on similar cases in this state
               - Key factors that could increase or decrease value

            4. LITIGATION CONSIDERATIONS
               - Potential issues if case goes to trial
               - Jury appeal factors
               - Expert witness recommendations

            5. NEGOTIATION TALKING POINTS
               - Key arguments to emphasize in demand letter
               - Counter-arguments to anticipate from insurance
               - Documentary evidence to strengthen the case

            Provide specific, actionable advice based on %s personal injury law.
            """,
            stateName,
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
            formatCurrency(getDoubleValue(calculatedValue, "adjustedCaseValue")),
            stateName
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
     * Generate AI-powered demand letter using the same comprehensive generation flow as AI Workspace.
     * Uses AiWorkspaceDocumentService.generateDraftWithConversation() for consistent quality.
     * When caseId is provided, fetches all case data (medical records, damages, summary) to enhance the letter.
     */
    @PostMapping("/generate-demand-letter")
    @AuditLog(action = "CREATE", entityType = "DEMAND_LETTER", description = "Generated demand letter")
    public ResponseEntity<Map<String, Object>> generateDemandLetter(
            @RequestBody Map<String, Object> request,
            @RequestParam(required = false) Long userId) {
        log.info("Generating PI demand letter with Claude AI using AI Workspace generation flow");

        // Always use detailed mode for thorough, comprehensive demand letters
        String mode = "detailed";
        boolean isDetailed = true;
        Long caseId = request.get("caseId") != null ? Long.valueOf(request.get("caseId").toString()) : null;
        // Optional documentId — when provided, fetches exhibits attached to this workspace document
        Long documentId = request.get("documentId") != null ? Long.valueOf(request.get("documentId").toString()) : null;

        // Validate medical records and summary exist before generating demand letter
        if (caseId != null) {
            List<PIMedicalRecordDTO> records = medicalRecordService.getRecordsByCaseId(caseId);
            if (records == null || records.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "MEDICAL_RECORDS_REQUIRED");
                error.put("message", "Medical records must be scanned before generating a demand letter. Go to the Medical Records tab and scan your case documents first.");
                return ResponseEntity.badRequest().body(error);
            }
            try {
                PIMedicalSummaryDTO summary = medicalSummaryService.getMedicalSummary(caseId);
                if (summary == null) {
                    Map<String, Object> error = new HashMap<>();
                    error.put("success", false);
                    error.put("error", "MEDICAL_SUMMARY_REQUIRED");
                    error.put("message", "A medical summary must be generated before creating a demand letter. Go to the Medical Summary tab and click Generate Summary.");
                    return ResponseEntity.badRequest().body(error);
                }
            } catch (Exception e) {
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "MEDICAL_SUMMARY_REQUIRED");
                error.put("message", "A medical summary must be generated before creating a demand letter. Go to the Medical Summary tab and click Generate Summary.");
                return ResponseEntity.badRequest().body(error);
            }
        }

        // Build the user prompt with all the form data
        String clientName = (String) request.getOrDefault("clientName", "");
        String defendantName = (String) request.getOrDefault("defendantName", "");

        // Fetch case data if caseId is provided
        String caseDataSection = "";
        if (caseId != null) {
            caseDataSection = fetchCaseDataForDemandLetter(caseId);
            log.info("Case data fetched for demand letter, caseId={}", caseId);
        }

        // Build comprehensive user prompt modeled on professional demand package format
        String userPrompt = buildDemandLetterPrompt(
            clientName,
            request,
            caseDataSection,
            isDetailed
        );

        String title = String.format("Demand Letter - %s v. %s", clientName, defendantName);

        try {
            // Use the same generation flow as AI Workspace for consistent quality
            // This handles: proper prompt building, citation policy, post-processing
            DraftGenerationResponse draftResponse = documentService.generateDraftWithConversation(
                userId,
                caseId,
                userPrompt,
                "demand_letter",
                resolveState(),
                title,
                null, // conversationId - create new
                isDetailed ? "THOROUGH" : "FAST", // research mode
                documentId,  // when provided, includes exhibits attached to this document
                null, // stationeryTemplateId - PI controller doesn't pass stationery
                null, // stationeryAttorneyId
                null, // courtLevel - PI demand letters don't use court-level formatting
                "pi", // practiceArea - PI demand letters are always personal injury
                null  // documentOptions - demand letters don't use option branching
            );

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("demandLetter", draftResponse.getDocument().getContent());
            response.put("mode", mode);
            response.put("generatedAt", System.currentTimeMillis());
            response.put("documentId", draftResponse.getDocumentId());
            response.put("conversationId", draftResponse.getConversationId());
            response.put("wordCount", draftResponse.getDocument().getWordCount());
            response.put("tokensUsed", draftResponse.getDocument().getTokensUsed());

            log.info("Generated demand letter using AI Workspace flow: documentId={}, conversationId={}",
                    draftResponse.getDocumentId(), draftResponse.getConversationId());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error generating demand letter: ", e);
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", "Failed to generate demand letter: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Get the latest demand letter for a case.
     * Used to restore the preview when returning to the Demand Letter tab.
     */
    @GetMapping("/demand-letter/case/{caseId}")
    public ResponseEntity<Map<String, Object>> getLatestDemandLetter(
            @PathVariable Long caseId,
            @RequestParam(required = false) Long userId) {
        log.info("Getting latest demand letter for case {}", caseId);

        try {
            Map<String, Object> latestDemandLetter = documentService.getLatestDemandLetterForCase(caseId, userId);

            if (latestDemandLetter != null) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("demandLetter", latestDemandLetter.get("content"));
                response.put("documentId", latestDemandLetter.get("documentId"));
                response.put("conversationId", latestDemandLetter.get("conversationId"));
                response.put("title", latestDemandLetter.get("title"));
                response.put("generatedAt", latestDemandLetter.get("generatedAt"));
                return ResponseEntity.ok(response);
            } else {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "No demand letter found for this case");
                return ResponseEntity.ok(response);
            }
        } catch (Exception e) {
            log.error("Error getting demand letter for case {}: {}", caseId, e.getMessage());
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    // The /generate-brief endpoint that briefly lived here (P9d) was removed
    // when the Negotiation tab cards switched to redirecting attorneys to
    // LegiDraft (the AI Workspace's drafting feature). LegiDraft owns the
    // legal_memo template that drives strategy briefs — see
    // backend/src/main/resources/templates/document-types/legal_memo.json.
    // No callers need a PI-specific wrapper anymore.

    // Helper methods for token/cost estimation (simplified)
    private int estimateTokens(String text) {
        if (text == null) return 0;
        // Rough estimation: ~4 characters per token
        return text.length() / 4;
    }

    private BigDecimal calculateCost(int tokens) {
        // Rough estimation: $0.003 per 1K tokens for Claude
        return BigDecimal.valueOf(tokens * 0.000003);
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
        String stateName = resolveState();

        String prompt = String.format("""
            You are an experienced %s personal injury settlement negotiator.

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
            stateName,
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

    /**
     * Validates that all medical record treatment dates are after the accident date.
     * Returns a warning section to include in the prompt if issues are found.
     * This prevents generating demand letters with impossible timelines (treatment before accident).
     */
    private String validateMedicalRecordDates(List<PIMedicalRecordDTO> records, LocalDate accidentDate) {
        if (accidentDate == null || records == null || records.isEmpty()) {
            return "";
        }

        List<String> issues = new ArrayList<>();
        for (PIMedicalRecordDTO record : records) {
            if (record.getTreatmentDate() != null && record.getTreatmentDate().isBefore(accidentDate)) {
                issues.add(String.format("- %s: treatment date %s is BEFORE accident date %s",
                    record.getProviderName() != null ? record.getProviderName() : "Unknown Provider",
                    record.getTreatmentDate().format(DATE_FORMATTER),
                    accidentDate.format(DATE_FORMATTER)));
            }
        }

        if (!issues.isEmpty()) {
            StringBuilder warning = new StringBuilder();
            warning.append("\n\n⚠️ DATA VALIDATION WARNING ⚠️\n");
            warning.append("The following medical records have treatment dates BEFORE the accident date:\n");
            for (String issue : issues) {
                warning.append(issue).append("\n");
            }
            warning.append("\nATTORNEY: Please verify these dates before sending this letter.\n");
            warning.append("DO NOT send this demand letter until the date discrepancies are resolved.\n");
            return warning.toString();
        }

        return "";
    }

    /**
     * Fetches all case data (medical records, damage calculation, medical summary) and formats it for the AI prompt.
     * Uses verbose text format to provide complete details for high-quality demand letter generation.
     */
    private String fetchCaseDataForDemandLetter(Long caseId) {
        StringBuilder sb = new StringBuilder();

        try {
            // Fetch legal case to get accident/injury date for validation
            LocalDate accidentDate = null;
            try {
                LegalCaseDTO legalCase = legalCaseService.getCase(caseId);
                if (legalCase != null && legalCase.getInjuryDate() != null) {
                    accidentDate = legalCase.getInjuryDate();
                    log.debug("Accident date for case {}: {}", caseId, accidentDate);
                }
            } catch (Exception e) {
                log.warn("Could not fetch legal case {} for date validation: {}", caseId, e.getMessage());
            }

            // Fetch medical records with full details
            List<PIMedicalRecordDTO> medicalRecords = medicalRecordService.getRecordsByCaseId(caseId);
            if (medicalRecords != null && !medicalRecords.isEmpty()) {
                sb.append("\n\n=== MEDICAL TREATMENT RECORDS ===\n");

                BigDecimal totalBilled = BigDecimal.ZERO;
                BigDecimal totalAdjusted = BigDecimal.ZERO;
                BigDecimal totalPaid = BigDecimal.ZERO;

                for (PIMedicalRecordDTO record : medicalRecords) {
                    sb.append("\n--- MEDICAL PROVIDER ---\n");
                    sb.append(String.format("Provider: %s\n", record.getProviderName() != null ? record.getProviderName() : "Unknown"));
                    sb.append(String.format("Record Type: %s\n", record.getRecordType() != null ? record.getRecordType() : "N/A"));
                    sb.append(String.format("Treatment Date: %s\n", record.getTreatmentDate() != null ? record.getTreatmentDate().format(DATE_FORMATTER) : "N/A"));

                    // Full key findings without truncation
                    if (record.getKeyFindings() != null && !record.getKeyFindings().isEmpty()) {
                        sb.append(String.format("Key Findings: %s\n", record.getKeyFindings()));
                    }

                    // Full treatment details without truncation
                    if (record.getTreatmentProvided() != null && !record.getTreatmentProvided().isEmpty()) {
                        sb.append(String.format("Treatment Provided: %s\n", record.getTreatmentProvided()));
                    }

                    // Diagnoses with ICD codes
                    if (record.getDiagnoses() != null && !record.getDiagnoses().isEmpty()) {
                        sb.append(String.format("Diagnoses: %s\n", formatDiagnoses(record.getDiagnoses())));
                    }

                    // Procedures with CPT codes
                    if (record.getProcedures() != null && !record.getProcedures().isEmpty()) {
                        sb.append(String.format("Procedures: %s\n", formatProcedures(record.getProcedures())));
                    }

                    // Prognosis
                    if (record.getPrognosisNotes() != null && !record.getPrognosisNotes().isEmpty()) {
                        sb.append(String.format("Prognosis: %s\n", record.getPrognosisNotes()));
                    }

                    // Work restrictions
                    if (record.getWorkRestrictions() != null && !record.getWorkRestrictions().isEmpty()) {
                        sb.append(String.format("Work Restrictions: %s\n", record.getWorkRestrictions()));
                    }

                    // Billing details
                    if (record.getBilledAmount() != null) {
                        sb.append(String.format("Billed Amount: %s\n", formatCurrency(record.getBilledAmount().doubleValue())));
                        totalBilled = totalBilled.add(record.getBilledAmount());
                    }
                    if (record.getAdjustedAmount() != null && record.getAdjustedAmount().compareTo(BigDecimal.ZERO) > 0) {
                        sb.append(String.format("Adjusted Amount: %s\n", formatCurrency(record.getAdjustedAmount().doubleValue())));
                        totalAdjusted = totalAdjusted.add(record.getAdjustedAmount());
                    }
                    if (record.getPaidAmount() != null && record.getPaidAmount().compareTo(BigDecimal.ZERO) > 0) {
                        sb.append(String.format("Paid Amount: %s\n", formatCurrency(record.getPaidAmount().doubleValue())));
                        totalPaid = totalPaid.add(record.getPaidAmount());
                    }
                }

                // Medical expenses summary
                sb.append("\n--- MEDICAL EXPENSES SUMMARY ---\n");
                sb.append(String.format("Total Billed: %s\n", formatCurrency(totalBilled.doubleValue())));
                if (totalAdjusted.compareTo(BigDecimal.ZERO) > 0) {
                    sb.append(String.format("Total Adjusted: %s\n", formatCurrency(totalAdjusted.doubleValue())));
                }
                if (totalPaid.compareTo(BigDecimal.ZERO) > 0) {
                    sb.append(String.format("Total Paid: %s\n", formatCurrency(totalPaid.doubleValue())));
                }

                // Validate medical record dates against accident date
                String dateValidationWarning = validateMedicalRecordDates(medicalRecords, accidentDate);
                if (!dateValidationWarning.isEmpty()) {
                    sb.append(dateValidationWarning);
                    log.warn("Date validation issues found for case {}", caseId);
                }
            }

            // Fetch damage calculation with itemized elements
            PIDamageCalculationDTO damageCalc = damageCalculationService.getDamageCalculation(caseId);
            if (damageCalc != null) {
                sb.append("\n\n=== DAMAGES CALCULATION ===\n");

                // Economic damages breakdown
                sb.append("\n--- ECONOMIC DAMAGES ---\n");
                sb.append(String.format("Past Medical Expenses: %s\n",
                    damageCalc.getPastMedicalTotal() != null ? formatCurrency(damageCalc.getPastMedicalTotal().doubleValue()) : "$0"));
                sb.append(String.format("Future Medical Expenses: %s\n",
                    damageCalc.getFutureMedicalTotal() != null ? formatCurrency(damageCalc.getFutureMedicalTotal().doubleValue()) : "$0"));
                sb.append(String.format("Lost Wages: %s\n",
                    damageCalc.getLostWagesTotal() != null ? formatCurrency(damageCalc.getLostWagesTotal().doubleValue()) : "$0"));

                if (damageCalc.getEarningCapacityTotal() != null && damageCalc.getEarningCapacityTotal().compareTo(BigDecimal.ZERO) > 0) {
                    sb.append(String.format("Loss of Earning Capacity: %s\n", formatCurrency(damageCalc.getEarningCapacityTotal().doubleValue())));
                }
                if (damageCalc.getHouseholdServicesTotal() != null && damageCalc.getHouseholdServicesTotal().compareTo(BigDecimal.ZERO) > 0) {
                    sb.append(String.format("Household Services: %s\n", formatCurrency(damageCalc.getHouseholdServicesTotal().doubleValue())));
                }
                if (damageCalc.getMileageTotal() != null && damageCalc.getMileageTotal().compareTo(BigDecimal.ZERO) > 0) {
                    sb.append(String.format("Mileage/Transportation: %s\n", formatCurrency(damageCalc.getMileageTotal().doubleValue())));
                }
                if (damageCalc.getOtherDamagesTotal() != null && damageCalc.getOtherDamagesTotal().compareTo(BigDecimal.ZERO) > 0) {
                    sb.append(String.format("Other Economic Damages: %s\n", formatCurrency(damageCalc.getOtherDamagesTotal().doubleValue())));
                }

                sb.append(String.format("TOTAL ECONOMIC DAMAGES: %s\n",
                    damageCalc.getEconomicDamagesTotal() != null ? formatCurrency(damageCalc.getEconomicDamagesTotal().doubleValue()) : "$0"));

                // Non-economic damages
                sb.append("\n--- NON-ECONOMIC DAMAGES ---\n");
                sb.append(String.format("Pain and Suffering: %s\n",
                    damageCalc.getPainSufferingTotal() != null ? formatCurrency(damageCalc.getPainSufferingTotal().doubleValue()) : "$0"));
                sb.append(String.format("TOTAL NON-ECONOMIC DAMAGES: %s\n",
                    damageCalc.getNonEconomicDamagesTotal() != null ? formatCurrency(damageCalc.getNonEconomicDamagesTotal().doubleValue()) : "$0"));

                // Totals and adjustments
                sb.append("\n--- DAMAGES SUMMARY ---\n");
                sb.append(String.format("Gross Total Damages: %s\n",
                    damageCalc.getGrossDamagesTotal() != null ? formatCurrency(damageCalc.getGrossDamagesTotal().doubleValue()) : "$0"));

                Integer compNeg = damageCalc.getComparativeNegligencePercent() != null ? damageCalc.getComparativeNegligencePercent() : 0;
                if (compNeg > 0) {
                    sb.append(String.format("Comparative Negligence: %d%%\n", compNeg));
                }
                sb.append(String.format("Adjusted Total Damages: %s\n",
                    damageCalc.getAdjustedDamagesTotal() != null ? formatCurrency(damageCalc.getAdjustedDamagesTotal().doubleValue()) : "$0"));

                // Case value range
                if (damageCalc.getLowValue() != null || damageCalc.getMidValue() != null || damageCalc.getHighValue() != null) {
                    sb.append("\n--- CASE VALUE RANGE ---\n");
                    if (damageCalc.getLowValue() != null) {
                        sb.append(String.format("Low Value Estimate: %s\n", formatCurrency(damageCalc.getLowValue().doubleValue())));
                    }
                    if (damageCalc.getMidValue() != null) {
                        sb.append(String.format("Mid Value Estimate: %s\n", formatCurrency(damageCalc.getMidValue().doubleValue())));
                    }
                    if (damageCalc.getHighValue() != null) {
                        sb.append(String.format("High Value Estimate: %s\n", formatCurrency(damageCalc.getHighValue().doubleValue())));
                    }
                }
            }

            // Fetch medical summary for treatment chronology and prognosis
            PIMedicalSummaryDTO medicalSummary = medicalSummaryService.getMedicalSummary(caseId);
            if (medicalSummary != null) {
                sb.append("\n\n=== MEDICAL SUMMARY ===\n");

                // Treatment overview
                sb.append("\n--- TREATMENT OVERVIEW ---\n");
                if (medicalSummary.getTreatmentDurationDays() != null) {
                    sb.append(String.format("Treatment Duration: %d days\n", medicalSummary.getTreatmentDurationDays()));
                }
                if (medicalSummary.getTotalProviders() != null) {
                    sb.append(String.format("Total Providers: %d\n", medicalSummary.getTotalProviders()));
                }
                if (medicalSummary.getTotalVisits() != null) {
                    sb.append(String.format("Total Visits: %d\n", medicalSummary.getTotalVisits()));
                }
                if (medicalSummary.getTreatmentGapDays() != null && medicalSummary.getTreatmentGapDays() > 0) {
                    sb.append(String.format("Treatment Gap Days: %d\n", medicalSummary.getTreatmentGapDays()));
                }

                // Treatment chronology (stored as text)
                if (medicalSummary.getTreatmentChronology() != null && !medicalSummary.getTreatmentChronology().isEmpty()) {
                    sb.append("\n--- TREATMENT CHRONOLOGY ---\n");
                    sb.append(medicalSummary.getTreatmentChronology());
                    sb.append("\n");
                }

                // Key highlights (stored as text)
                if (medicalSummary.getKeyHighlights() != null && !medicalSummary.getKeyHighlights().isEmpty()) {
                    sb.append("\n--- KEY MEDICAL HIGHLIGHTS ---\n");
                    sb.append(medicalSummary.getKeyHighlights());
                    sb.append("\n");
                }

                // Prognosis assessment
                if (medicalSummary.getPrognosisAssessment() != null && !medicalSummary.getPrognosisAssessment().equals("Not available")) {
                    sb.append(String.format("\n--- PROGNOSIS ---\n%s\n", medicalSummary.getPrognosisAssessment()));
                }

                // Diagnoses list
                if (medicalSummary.getDiagnosisList() != null && !medicalSummary.getDiagnosisList().isEmpty()) {
                    sb.append("\n--- DIAGNOSES ---\n");
                    for (Map<String, Object> diagnosis : medicalSummary.getDiagnosisList()) {
                        String name = (String) diagnosis.getOrDefault("name", "Unknown");
                        String icdCode = (String) diagnosis.getOrDefault("icdCode", null);
                        String status = (String) diagnosis.getOrDefault("status", null);
                        StringBuilder diagLine = new StringBuilder();
                        diagLine.append("- ").append(name);
                        if (icdCode != null && !icdCode.equals("N/A")) {
                            diagLine.append(" (ICD: ").append(icdCode).append(")");
                        }
                        if (status != null) {
                            diagLine.append(" - ").append(status);
                        }
                        sb.append(diagLine).append("\n");
                    }
                }

                // Red flags / case considerations
                if (medicalSummary.getRedFlags() != null && !medicalSummary.getRedFlags().isEmpty()) {
                    sb.append("\n--- CASE CONSIDERATIONS ---\n");
                    for (Map<String, Object> flag : medicalSummary.getRedFlags()) {
                        sb.append(String.format("- %s: %s\n",
                            flag.getOrDefault("type", "Note"),
                            flag.getOrDefault("description", "")
                        ));
                    }
                }
            }

        } catch (Exception e) {
            log.error("Error fetching case data for demand letter, caseId={}: {}", caseId, e.getMessage());
            // Don't fail the entire request, just log the error and continue without case data
        }

        return sb.toString();
    }

    /**
     * Formats diagnoses list for prompt
     */
    private String formatDiagnoses(List<Map<String, Object>> diagnoses) {
        if (diagnoses == null || diagnoses.isEmpty()) {
            return "N/A";
        }
        return diagnoses.stream()
            .map(d -> String.format("%s (ICD: %s)",
                d.getOrDefault("name", d.getOrDefault("description", "Unknown")),
                d.getOrDefault("icdCode", d.getOrDefault("code", "N/A"))))
            .collect(Collectors.joining("; "));
    }

    /**
     * Formats procedures list for prompt
     */
    private String formatProcedures(List<Map<String, Object>> procedures) {
        if (procedures == null || procedures.isEmpty()) {
            return "N/A";
        }
        return procedures.stream()
            .map(p -> String.format("%s (CPT: %s)",
                p.getOrDefault("name", p.getOrDefault("description", "Unknown")),
                p.getOrDefault("cptCode", p.getOrDefault("code", "N/A"))))
            .collect(Collectors.joining("; "));
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

    /**
     * Build letterhead section from organization data.
     * Returns formatted firm information for the AI to use in the demand letter header.
     */
    private String buildLetterheadSection() {
        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            if (orgId == null) {
                log.debug("No organization context available for letterhead");
                return getDefaultLetterhead();
            }

            OrganizationDTO org = organizationService.getOrganizationById(orgId).orElse(null);
            if (org == null) {
                log.debug("Organization {} not found for letterhead", orgId);
                return getDefaultLetterhead();
            }

            StringBuilder sb = new StringBuilder();
            sb.append("Firm Name: ").append(org.getName() != null ? org.getName() : "Law Offices").append("\n");

            if (org.getAddress() != null && !org.getAddress().isEmpty()) {
                sb.append("Address: ").append(org.getAddress()).append("\n");
            }

            if (org.getPhone() != null && !org.getPhone().isEmpty()) {
                sb.append("Phone: ").append(org.getPhone()).append("\n");
            }

            if (org.getEmail() != null && !org.getEmail().isEmpty()) {
                sb.append("Email: ").append(org.getEmail()).append("\n");
            }

            if (org.getWebsite() != null && !org.getWebsite().isEmpty()) {
                sb.append("Website: ").append(org.getWebsite()).append("\n");
            }

            log.debug("Built letterhead for organization: {}", org.getName());
            return sb.toString();

        } catch (Exception e) {
            log.warn("Error building letterhead section: {}", e.getMessage());
            return getDefaultLetterhead();
        }
    }

    /**
     * Returns empty string — firm stationery is now applied externally.
     * Kept as a safety net for any remaining callers.
     */
    private String getDefaultLetterhead() {
        return "";
    }

    /**
     * Build demand letter prompt modeled on professional demand package format.
     * Structure follows the EvenUp demand package standard:
     * 1. Facts & Liability (narrative), 2. Injuries & Treatments (ICD table + provider summaries),
     * 3. Damages (itemized tables per category + per diem analysis), 4. Demand to Settle, 5. Exhibit List.
     */
    private String buildDemandLetterPrompt(
            String clientName,
            Map<String, Object> request,
            String caseDataSection,
            boolean isDetailed
    ) {
        String letterDate = LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy"));
        String stateName = resolveState();

        return String.format("""
            JURISDICTION: %s
            Generate a professional demand package for a personal injury case in the above jurisdiction.
            This must read as a polished, attorney-ready demand letter — NOT a template or outline.

            ============================================================
            CASE DATA (USE THESE VALUES — DO NOT INVENT OR USE BRACKETS)
            ============================================================

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

            LIABILITY NARRATIVE:
            %s

            DAMAGE VALUES (starting values — recalculate totals from itemized medical records below):
            Medical Expenses: %s
            Lost Wages: %s
            Future Medical Expenses: %s
            Pain & Suffering (calculated): %s

            %s

            ============================================================
            ABSOLUTE RULES (VIOLATION = FAILURE)
            ============================================================

            1. ZERO PLACEHOLDERS: The letter must contain ZERO square brackets. Never write $[amount], [Date], [Name], [N], [Provider], [ATTORNEY TO INSERT], or ANY text inside square brackets. Every value must be a real number, real name, or real date from the CASE DATA above. If a value is truly missing, write $0.00 for amounts or "N/A" for text — never brackets.

            2. REAL DATA ONLY: Every provider name, diagnosis, ICD code, dollar amount, and date in the letter MUST come from the MEDICAL TREATMENT RECORDS, DAMAGES CALCULATION, or MEDICAL SUMMARY sections in the CASE DATA above. Read those sections carefully and extract the actual values.

            3. MATH MUST ADD UP: Every table total must exactly equal the sum of its line items. The total demand must equal Economic + Non-Economic damages. Double-check all arithmetic.

            4. NARRATIVE PROSE: Write the Facts & Liability and Pain & Suffering sections as compelling narrative paragraphs, not bullet points.

            5. PRECISE DOLLARS: Use exact dollar amounts with cents (e.g., $5,234.50).

            6. TABLE FORMAT: Use standard markdown pipe tables. Every table needs: header row, separator row (|---|---|), data rows, and a bold Total row at the bottom.

            7. HEADING FORMAT: Number main section headings with Roman numerals: "I. Facts and Liability", "II. Injuries and Medical Treatment", "III. Damages", etc. Use Arabic numbers for subsections (1, 2, 3). Do NOT use "Section 1:", "Section 2:" — the "SECTION N:" labels below are internal prompt directives only, not heading formats.

            ============================================================
            SECTION 1: SALUTATION & INTRODUCTION
            ============================================================
            IMPORTANT: Do NOT generate a firm name header, logo placeholder, or letterhead block.
            The document already has firm stationery applied externally (letterhead with logo and contact info).
            NEVER write [LAW FIRM NAME], [Attorney Name, Esq.], [Firm Address], [Phone] | [Fax] | [Email] — firm stationery is applied externally.
            Start the document body directly with the date and salutation.

            - Date: %s
            - "Via Certified Mail, Return Receipt Requested"
            - Addressee: Use the actual Adjuster Name and Insurance Company from the CASE DATA
            - RE: line with the actual Claimant name, Defendant name, Date of Loss, and Claim Number
            - "Dear [actual adjuster name from CASE DATA]:" — use their real name, not a bracket
            - Brief representation statement (1-2 paragraphs):
              * State that this office represents the claimant
              * Attorney lien notice
              * Direct all communications to this office
              * State this is a good-faith attempt to resolve the claim

            ============================================================
            SECTION 2: FACTS & LIABILITY
            ============================================================
            Write this as a COMPELLING NARRATIVE (like telling a story to a jury), NOT as bullet points.

            Structure:
            - Opening paragraph: Set the scene. Describe the client's day before the accident in human terms.
            - Accident narrative: Describe what happened in vivid, chronological detail. Use the actual accident location and date from CASE DATA.
            - Defendant's negligence: Explain clearly how the defendant was at fault.
            - Legal standard for liability:
              * For rear-end collisions: Reference the applicable state statute creating a presumption of negligence on the following driver. Use the correct citation for the jurisdiction.
              * IMPORTANT: Use "presumption of negligence" — NEVER "negligence per se" for rear-end cases.
              * For other collisions: State the applicable duty of care and how it was breached using correct state law citations.
            - Conclude with a strong statement that liability is clear and undisputed.

            ============================================================
            SECTION 3: INJURIES & TREATMENTS
            ============================================================

            ### 3.1 Summary of Injuries
            Create a table listing every diagnosis found in the MEDICAL TREATMENT RECORDS. Extract the actual diagnosis names and ICD-10 codes from the records. The table columns are: Injury/Diagnosis and ICD Code.

            ### 3.2 Treatment by Provider
            For EACH medical provider found in the MEDICAL TREATMENT RECORDS, create a structured summary:

            Start with the provider's actual name in bold, then a small table with Treatment Timeline (actual first date to last date from records) and Number of Visits (actual count from records).

            Then write 1-3 narrative paragraphs describing the treatment chronologically. Include: presenting complaints, examination findings, diagnoses, treatment plan, procedures performed, medications prescribed, and prognosis/recommendations. Use the actual ICD-10 and CPT codes from the medical records.

            End with "Supporting Documents: Exhibit N — [actual provider name] Medical Records" where N is the exhibit number.

            Order providers chronologically by first treatment date.

            ============================================================
            SECTION 4: DAMAGES
            ============================================================

            ### 4.1 Total Projected Claim Value
            Present a summary table with columns: Elements of Damages and Amount.
            Include rows for: Past Medical Expenses, Future Medical Expenses, Loss of Income, Loss of Household Services (if applicable), and Past and Future Pain and Suffering. Use the actual dollar amounts from the DAMAGES CALCULATION in CASE DATA. Include a bold Total Damages row that sums everything.

            ### 4.2 Past Medical Expenses
            Create an itemized table with columns: Provider, Date of Service, Amount Charged, Supporting Document.
            List every medical provider from the MEDICAL TREATMENT RECORDS with their actual billed amounts and treatment dates. The Total row must match the Past Medical Expenses total from the DAMAGES CALCULATION.

            After the table, include: "If you claim any of the medical treatment above was unnecessary, or that any of the bills associated with such treatment were unreasonable, then please identify in writing which bills you dispute and the factual basis for such dispute."

            PIP/NO-FAULT COORDINATION: If the jurisdiction has PIP or no-fault insurance requirements, include a coordination statement referencing the applicable state PIP statute. State that PIP benefits have been exhausted/coordinated, entitling recovery of the full medical special damages from the bodily injury coverage. Use the correct statutory citation for this jurisdiction.

            ### 4.3 Future Medical Expenses (if applicable)
            If future medical expense data exists in the DAMAGES CALCULATION, create a table with columns: Procedure, Years, Frequency/Year, Cost Each, Total. Use actual projected treatment data. Include a bold Total Future Medical row.
            Use the phrase "within a reasonable degree of medical certainty" for all future medical projections.

            ### 4.4 Loss of Income (if applicable)
            If lost wages data exists in the DAMAGES CALCULATION, present a Loss of Income Schedule table with columns: Start of Loss Date, End of Loss Date, Lost Income. Use actual dates and amounts. Include a bold Total row.
            If no lost wages are claimed, briefly note work impact without claiming economic loss.

            ### 4.5 Past and Future Pain and Suffering
            Write a COMPELLING NARRATIVE (not bullet points) describing:
            - How the injuries changed the client's daily life (sleep, work, family, hobbies, independence)
            - The duration of suffering: calculate the exact number of days from the accident date to today (%s)
            - Specific concrete examples of activities the client can no longer perform
            - Emotional and psychological impact

            CRITICAL VALUATION RULES:
            * NEVER state a specific multiplier (e.g., "1.0x", "2.0x multiplier") in the letter
            * NEVER show the insurer how you calculated pain and suffering
            * For disc herniation/structural injuries: value at LEAST 2.5-3.0x medical specials
            * For cases with permanency/chronic symptoms: use 3.0-4.0x
            * Simply state the pain and suffering amount confidently using the actual value from CASE DATA

            Per Diem Analysis: Include a per diem calculation table to justify the pain and suffering amount. Calculate days from accident to a medical milestone, multiply by 16 waking hours per day, multiply by a reasonable hourly rate. Show the math with actual numbers — no brackets. Split into Initial and Subsequent periods if the case spans years.

            State confidently that the calculated amount is fair and equitable compensation for the client's pain and suffering.

            ============================================================
            SECTION 5: BAD FAITH NOTICE & DEMAND TO SETTLE
            ============================================================

            Statutory Bad Faith Notice:
            Include a bad faith / unfair claim settlement practices notice citing the applicable state statutes for this jurisdiction. Reference the state's unfair insurance practices act and consumer protection statute with correct citations. Warn that failure to tender policy limits may constitute a violation of these statutes and that all rights are reserved.

            Demand:
            - State the total demand amount using the actual Total Damages calculated in Section 4.1
            - If damages exceed policy limits: Make a STRONG, UNCONDITIONAL policy limits demand.
              Use assertive language: "Tender of the policy limits is the only reasonable course of action to protect your insured from personal exposure."
              Do NOT use weak language like "we will consider" or "we may accept."
            - 30-day response deadline from date of letter
            - Consequences of non-response: State that failure to respond will result in filing a civil action seeking all available damages including those under the applicable state consumer protection or bad faith statute. Use the correct citation for this jurisdiction.

            Closing:
            - "Please do not hesitate to contact me if you have any additional questions or concerns."
            - End with "Respectfully submitted," — do NOT add attorney name, firm name, or signature block after this (the document stationery handles the signature block externally)

            ============================================================
            SECTION 6: EXHIBIT LIST
            ============================================================
            Create a numbered exhibit list table (Exhibit No. and Description columns) referencing all supporting documents mentioned throughout the letter. Use actual provider names and document types — no brackets.

            ============================================================
            FINAL SELF-CHECK BEFORE RESPONDING
            ============================================================
            Before you submit, scan your entire response for the characters [ and ]. If you find ANY square brackets (except in statute citations), you have FAILED. Replace them with actual data from the CASE DATA sections above.

            %s
            """,
            stateName,
            clientName,
            request.getOrDefault("defendantName", "Unknown Defendant"),
            request.getOrDefault("insuranceCompany", "Unknown Insurance Company"),
            request.getOrDefault("adjusterName", "Claims Department"),
            request.getOrDefault("claimNumber", "See Policy Number"),
            formatCurrency(getDoubleValue(request, "policyLimit")),
            request.getOrDefault("accidentDate", "Date Unknown"),
            request.getOrDefault("accidentLocation", "Location Unknown"),
            request.getOrDefault("injuryType", "Personal Injury"),
            request.getOrDefault("injuryDescription", ""),
            request.getOrDefault("liabilityDetails", ""),
            formatCurrency(getDoubleValue(request, "medicalExpenses")),
            formatCurrency(getDoubleValue(request, "lostWages")),
            formatCurrency(getDoubleValue(request, "futureMedical")),
            formatCurrency(getDoubleValue(request, "painSufferingAmount")),
            caseDataSection,
            letterDate,
            letterDate, // also used for pain & suffering days calculation reference
            isDetailed
                ? "Make the letter thorough and compelling, suitable for policy limits demands. This is a serious injury case warranting detailed documentation."
                : "Keep the letter focused and professional while including all required jurisdiction-specific elements."
        );
    }
}
