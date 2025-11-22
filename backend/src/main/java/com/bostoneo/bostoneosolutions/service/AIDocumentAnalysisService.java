package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AIDocumentAnalysis;
import com.bostoneo.bostoneosolutions.repository.AIDocumentAnalysisRepository;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.apache.tika.exception.TikaException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AIDocumentAnalysisService {

    private final AIDocumentAnalysisRepository repository;
    private final ClaudeSonnet4Service claudeService;
    private final ObjectMapper objectMapper;
    private final DocumentMetadataExtractor metadataExtractor;
    private final ActionItemExtractionService extractionService;
    private final Tika tika = new Tika();

    public CompletableFuture<AIDocumentAnalysis> analyzeDocument(
            MultipartFile file,
            String analysisType,
            Long userId,
            Long caseId,
            Long sessionId) {

        String analysisId = UUID.randomUUID().toString();
        long startTime = System.currentTimeMillis();

        log.info("Starting document analysis: analysisId={}, fileName={}, sessionId={}",
                analysisId, file.getOriginalFilename(), sessionId);

        // Create initial analysis record
        AIDocumentAnalysis analysis = new AIDocumentAnalysis();
        analysis.setAnalysisId(analysisId);
        analysis.setFileName(file.getOriginalFilename());
        analysis.setFileType(file.getContentType());
        analysis.setFileSize(file.getSize());
        analysis.setAnalysisType(analysisType);
        analysis.setUserId(userId);
        analysis.setCaseId(caseId);
        analysis.setStatus("processing");
        analysis.setIsArchived(false);

        // Save initial record
        analysis = repository.save(analysis);
        AIDocumentAnalysis savedAnalysis = analysis;

        try {
            // Extract text using Tika
            String content = extractTextFromFile(file);
            savedAnalysis.setDocumentContent(content.substring(0, Math.min(content.length(), 5000))); // Store first 5000 chars

            // Detect document type
            String detectedType = metadataExtractor.detectDocumentType(content, file.getOriginalFilename());
            savedAnalysis.setDetectedType(detectedType);

            // Extract metadata
            String extractedMetadata = metadataExtractor.extractMetadata(content, file.getOriginalFilename());
            savedAnalysis.setExtractedMetadata(extractedMetadata);

            // Check if OCR is needed
            boolean requiresOcr = metadataExtractor.requiresOCR(content, file.getSize());
            savedAnalysis.setRequiresOcr(requiresOcr);

            // Use detected type for strategic analysis (ignore user-selected analysisType)
            String prompt = buildAnalysisPrompt(content, detectedType, file.getOriginalFilename());

            // Pass sessionId to enable cancellation support (like LegalResearchConversationService)
            return claudeService.generateCompletion(prompt, null, true, sessionId)
                    .thenApply(response -> {
                        long processingTime = System.currentTimeMillis() - startTime;

                        // Estimate token usage for monitoring (rough: 1 token ≈ 4 characters)
                        int estimatedResponseTokens = response.length() / 4;
                        int estimatedPromptTokens = (content.length() + prompt.length()) / 4;
                        log.info("✅ Document analysis complete: type={}, responseTokens≈{}, promptTokens≈{}, time={}ms, file={}",
                                detectedType, estimatedResponseTokens, estimatedPromptTokens, processingTime, file.getOriginalFilename());

                        savedAnalysis.setAnalysisResult(response);
                        savedAnalysis.setStatus("completed");
                        savedAnalysis.setProcessingTimeMs(processingTime);

                        // Parse and store structured data
                        Map<String, Object> parsedAnalysis = parseAnalysisResponse(response, analysisType);
                        savedAnalysis.setSummary((String) parsedAnalysis.get("summary"));
                        savedAnalysis.setRiskScore((Integer) parsedAnalysis.get("riskScore"));
                        savedAnalysis.setRiskLevel((String) parsedAnalysis.get("riskLevel"));

                        try {
                            savedAnalysis.setKeyFindings(objectMapper.writeValueAsString(parsedAnalysis.get("keyFindings")));
                            savedAnalysis.setRecommendations(objectMapper.writeValueAsString(parsedAnalysis.get("recommendations")));
                            savedAnalysis.setComplianceIssues(objectMapper.writeValueAsString(parsedAnalysis.get("complianceIssues")));
                        } catch (Exception e) {
                            log.error("Error serializing analysis data", e);
                        }

                        // Estimate tokens and cost (rough estimation)
                        int estimatedTokens = (prompt.length() + response.length()) / 4;
                        savedAnalysis.setTokensUsed(estimatedTokens);
                        savedAnalysis.setCostEstimate(estimatedTokens * 0.00003); // Rough estimate

                        AIDocumentAnalysis finalAnalysis = repository.save(savedAnalysis);

                        // Extract action items and timeline events synchronously
                        // Uses hybrid approach: tries embedded JSON first, falls back to separate AI calls
                        // Returns cleaned text with JSON block removed
                        String cleanedAnalysisText = extractionService.extractAndSaveStructuredData(finalAnalysis.getId(), response);

                        // Update analysis with cleaned text (JSON block removed)
                        if (!cleanedAnalysisText.equals(response)) {
                            finalAnalysis.setAnalysisResult(cleanedAnalysisText);
                            finalAnalysis = repository.save(finalAnalysis);
                            log.info("Updated analysis {} with cleaned text (removed JSON block)", finalAnalysis.getId());
                        }

                        return finalAnalysis;
                    })
                    .exceptionally(ex -> {
                        log.error("Error analyzing document: {}", ex.getMessage(), ex);
                        savedAnalysis.setStatus("failed");
                        savedAnalysis.setErrorMessage(ex.getMessage());
                        savedAnalysis.setProcessingTimeMs(System.currentTimeMillis() - startTime);
                        return repository.save(savedAnalysis);
                    });

        } catch (Exception e) {
            log.error("Error processing file: {}", e.getMessage(), e);
            savedAnalysis.setStatus("failed");
            savedAnalysis.setErrorMessage("Failed to process file: " + e.getMessage());
            savedAnalysis.setProcessingTimeMs(System.currentTimeMillis() - startTime);
            repository.save(savedAnalysis);

            CompletableFuture<AIDocumentAnalysis> failedFuture = new CompletableFuture<>();
            failedFuture.completeExceptionally(e);
            return failedFuture;
        }
    }

    public List<AIDocumentAnalysis> getAnalysisHistory(Long userId) {
        return repository.findTop10ByUserIdAndIsArchivedFalseOrderByCreatedAtDesc(userId);
    }

    public Optional<AIDocumentAnalysis> getAnalysisById(String analysisId) {
        return repository.findByAnalysisId(analysisId);
    }

    public List<AIDocumentAnalysis> getHighRiskDocuments(Integer minScore) {
        return repository.findHighRiskDocuments(minScore != null ? minScore : 70);
    }

    public Map<String, Object> getAnalysisStats(Long userId) {
        Map<String, Object> stats = new HashMap<>();

        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);

        stats.put("totalAnalyses", repository.countRecentAnalysesByUser(userId, thirtyDaysAgo));
        stats.put("tokensUsed", repository.getTotalTokensUsedByUser(userId, thirtyDaysAgo));
        stats.put("recentAnalyses", repository.findTop10ByUserIdAndIsArchivedFalseOrderByCreatedAtDesc(userId));

        return stats;
    }

    private String extractTextFromFile(MultipartFile file) throws IOException {
        try (InputStream inputStream = file.getInputStream()) {
            // Use Apache Tika to extract text from any document type
            String content = tika.parseToString(inputStream);

            // Validate extraction
            if (content == null || content.trim().isEmpty()) {
                log.warn("No text extracted from file: {}", file.getOriginalFilename());
                return String.format("""
                    [Empty Document]
                    File: %s
                    Type: %s
                    Size: %d bytes

                    Note: No text could be extracted. File may be empty, corrupted, or require OCR.
                    """, file.getOriginalFilename(), file.getContentType(), file.getSize());
            }

            return content.trim();

        } catch (TikaException e) {
            log.error("Tika extraction error for file {}: {}", file.getOriginalFilename(), e.getMessage());
            throw new IOException("Failed to extract text from document: " + e.getMessage(), e);
        }
    }

    private String buildAnalysisPrompt(String content, String detectedType, String fileName) {
        String basePrompt = String.format("""
            You are an expert legal strategist and document analyst.

            Document: %s
            Detected Type: %s

            Document Content:
            %s
            """, fileName, detectedType, content);

        // Route to strategic analysis based on detected document type
        String lowerType = detectedType.toLowerCase();

        // Litigation Documents
        if (lowerType.contains("complaint") || lowerType.contains("petition")) {
            return basePrompt + getComplaintStrategicPrompt();
        } else if (lowerType.contains("motion")) {
            return basePrompt + getMotionAnalysisPrompt();
        } else if (lowerType.contains("brief") || lowerType.contains("memorandum")) {
            return basePrompt + getLegalBriefAnalysisPrompt();
        } else if (lowerType.contains("discovery") || lowerType.contains("interrogator") ||
                   lowerType.contains("request for production") || lowerType.contains("admission")) {
            return basePrompt + getDiscoveryRequestPrompt();
        }
        // Contract Documents
        else if (lowerType.contains("employment") && (lowerType.contains("agreement") || lowerType.contains("contract"))) {
            return basePrompt + getEmploymentAgreementPrompt();
        } else if (lowerType.contains("nda") || lowerType.contains("non-disclosure") ||
                   lowerType.contains("confidentiality agreement")) {
            return basePrompt + getNDAPrompt();
        } else if (lowerType.contains("settlement") && lowerType.contains("agreement")) {
            return basePrompt + getSettlementAgreementPrompt();
        } else if (lowerType.contains("lease")) {
            return basePrompt + getLeaseStrategicPrompt();
        } else if (lowerType.contains("contract") || lowerType.contains("agreement")) {
            return basePrompt + getContractStrategicPrompt();
        }
        // Regulatory
        else if (lowerType.contains("regulatory") || lowerType.contains("compliance") ||
                 lowerType.contains("notice") || lowerType.contains("demand letter")) {
            return basePrompt + getRegulatoryNoticePrompt();
        }
        // Default
        else {
            return basePrompt + getStrategicGeneralAnalysisPrompt();
        }
    }

    private String getContractAnalysisPrompt() {
        return """

            Perform a comprehensive contract analysis:

            1. CONTRACT OVERVIEW
               - Type and nature of contract
               - Parties and their roles
               - Governing law and jurisdiction

            2. KEY TERMS ANALYSIS
               - Payment terms and conditions
               - Deliverables and milestones
               - Duration and renewal provisions
               - Termination clauses

            3. RISK ASSESSMENT
               - High-risk provisions
               - Liability and indemnification
               - Missing standard protections
               - Ambiguous language requiring clarification

            4. COMPLIANCE REVIEW
               - Regulatory compliance issues
               - Industry standard compliance
               - Massachusetts-specific requirements

            5. NEGOTIATION POINTS
               - Unfavorable terms to renegotiate
               - Missing clauses to add
               - Areas for clarification

            6. RECOMMENDATIONS
               - Immediate action items
               - Suggested revisions
               - Risk mitigation strategies
            """;
    }

    // Old prompts removed - replaced with strategic versions

    private String getComplianceAnalysisPrompt() {
        return """

            Conduct a thorough compliance analysis:

            1. REGULATORY LANDSCAPE
               - Applicable federal regulations
               - Massachusetts state requirements
               - Industry-specific standards
               - Local ordinances

            2. COMPLIANCE STATUS
               - Areas of full compliance
               - Areas of non-compliance
               - Gray areas requiring interpretation
               - Documentation gaps

            3. RISK EXPOSURE
               - Potential violations identified
               - Penalty exposure assessment
               - Reputational risk factors
               - Litigation risk

            4. REMEDIATION PLAN
               - Immediate corrective actions
               - Short-term improvements (30 days)
               - Long-term enhancements (90+ days)
               - Documentation requirements

            5. MONITORING RECOMMENDATIONS
               - Compliance monitoring procedures
               - Audit schedule suggestions
               - Key performance indicators
               - Reporting mechanisms
            """;
    }

    private String getDueDiligencePrompt() {
        return """

            Perform comprehensive due diligence review:

            1. DOCUMENT ASSESSMENT
               - Documents reviewed
               - Missing critical documents
               - Document authenticity/validity
               - Version control issues

            2. LEGAL RISK ANALYSIS
               - Litigation exposure
               - Regulatory compliance status
               - Intellectual property issues
               - Employment law concerns

            3. FINANCIAL IMPLICATIONS
               - Financial obligations identified
               - Contingent liabilities
               - Revenue impact analysis
               - Hidden costs discovered

            4. OPERATIONAL CONSIDERATIONS
               - Business continuity risks
               - Key dependencies
               - Integration challenges
               - Change management needs

            5. DEAL IMPACT ASSESSMENT
               - Deal breakers identified
               - Valuation adjustments needed
               - Warranty/indemnity requirements
               - Go/No-go recommendation
            """;
    }

    private String getRiskAssessmentPrompt() {
        return """

            Conduct detailed risk assessment:

            1. RISK IDENTIFICATION
               - Legal risks
               - Financial risks
               - Operational risks
               - Reputational risks

            2. RISK QUANTIFICATION
               - Probability assessment (High/Medium/Low)
               - Impact assessment (High/Medium/Low)
               - Risk score calculation
               - Time sensitivity

            3. RISK PRIORITIZATION
               - Critical risks requiring immediate attention
               - High priority risks
               - Medium priority risks
               - Low priority/acceptable risks

            4. MITIGATION STRATEGIES
               - Risk avoidance options
               - Risk reduction measures
               - Risk transfer mechanisms
               - Risk acceptance criteria

            5. MONITORING PLAN
               - Key risk indicators
               - Monitoring frequency
               - Escalation procedures
               - Review schedule
            """;
    }

    private String getGeneralAnalysisPrompt() {
        return """

            Provide comprehensive document analysis:

            1. DOCUMENT SUMMARY
               - Type and purpose
               - Key parties involved
               - Effective dates and deadlines
               - Core obligations

            2. KEY FINDINGS
               - Critical provisions
               - Important terms and conditions
               - Notable observations
               - Unusual elements

            3. LEGAL IMPLICATIONS
               - Rights and obligations
               - Potential liabilities
               - Compliance requirements
               - Enforcement mechanisms

            4. RISK FACTORS
               - Identified risks
               - Risk severity assessment
               - Mitigation recommendations
               - Timeline considerations

            5. RECOMMENDATIONS
               - Immediate actions required
               - Suggested improvements
               - Further review needed
               - Next steps
            """;
    }

    // ===== STRATEGIC ANALYSIS PROMPTS =====

    private String getComplaintStrategicPrompt() {
        return """

            ASSUME YOU ARE DEFENSE COUNSEL analyzing this complaint to develop winning strategy.

            ## ⚡ EXECUTIVE BRIEF (3 sentences)
            - What plaintiff alleges
            - PRIMARY WEAKNESS in their case
            - IMMEDIATE ACTION required (with deadline)

            ## 🎯 CRITICAL WEAKNESSES IN PLAINTIFF'S CASE
            For each weakness:
            ⚠️ [MAJOR/HIGH/MEDIUM]: [Title]
            - Description: [What's wrong]
            - Impact: [Why it matters]
            - STRATEGY: [How to exploit]

            Find 3-5 weaknesses minimum.

            ## 📊 UNSUPPORTED FACTUAL CLAIMS
            - Claim: [Quote allegation]
            - Problem: [Why lacks support]
            - Defense: [How to challenge]

            ## ⚖️ GAPS IN LEGAL AUTHORITY
            - Authority Cited: [Statute/case]
            - Plaintiff's Theory: [How using it]
            - Gap/Problem: [Why doesn't support claim]
            - Challenge: [How to attack]

            ## 🛡️ AFFIRMATIVE DEFENSES
            List all applicable:
            1. Statute of Limitations
            2. Good Faith Reliance
            3. Failure to State Claim
            4. [Others relevant to this case]

            ## 📝 EVIDENCE COLLECTION CHECKLIST
            ☐ DAY 1-7 (URGENT):
              ☐ [Specific item with location]
            ☐ DAY 8-14 (HIGH):
              ☐ [Specific item]
            ☐ DAY 15-30 (MEDIUM):
              ☐ [Specific item]

            ## ⏱️ ACTION TIMELINE
            📅 DAY 1: [Action] - [Why urgent]
            📅 DAY 7: [Action]
            📅 DAY 14: [Action]
            📅 DAY 21: Answer deadline typically

            ## 💡 STRATEGIC RECOMMENDATIONS
            🎯 PRIMARY STRATEGY: [Main approach]
            - Why this works: [Reason]
            - Expected outcome: [Result]

            🎯 FALLBACK STRATEGY: [Alternative]
            - When to use: [Conditions]

            🎯 SETTLEMENT LEVERAGE: [Weak points to exploit]

            Be specific. Focus on ACTIONABILITY.
            """;
    }

    private String getContractStrategicPrompt() {
        return """

            ASSUME YOU ARE BUSINESS COUNSEL reviewing this contract for your client BEFORE signing.
            Identify risks, unfavorable terms, and negotiation points.

            ## ⚡ EXECUTIVE RISK SUMMARY (3 sentences)
            - Contract type and purpose
            - RECOMMENDATION (Sign / Negotiate / Walk away)

            ## 💰 FINANCIAL TERMS ANALYSIS
            Extract ALL financial terms:
            - Base payments: [amounts, frequency]
            - Variable costs: [overage, escalations]
            - Termination penalties: [amount]
            - Liability exposure: [caps or UNLIMITED ⚠️]
            - TOTAL EXPOSURE: $X over contract term

            ## 🚨 UNFAVORABLE CLAUSES
            For each unfavorable clause:
            ⚠️ [CRITICAL/HIGH/MEDIUM]: [Clause Title] (Section X)
            - Current Language: [Quote]
            - Why Unfavorable: [Problem]
            - Business Impact: [Financial/Operational]
            - REDLINE: [Exact replacement language]

            Find 5-8 unfavorable provisions.

            ## 🛡️ MISSING STANDARD PROTECTIONS
            - [Protection Name]: Why normally included, risk created by absence

            ## 🚪 TERMINATION & EXIT STRATEGY
            - Termination for convenience: [Available/NONE ⚠️]
            - Early termination penalty: $X
            - Assignment rights: [Restrictions]
            - How to get out: [Analysis]

            ## 🎯 NEGOTIATION PRIORITIES
            Priority 1 (Must-Fix):
            1. [Clause] - [Change needed] - [Justification]

            Priority 2 (Important):
            [Items]

            Priority 3 (Nice-to-Have):
            [Items]

            ## 🏆 RECOMMENDATION
            [Sign / Negotiate / Walk Away] + justification
            Must achieve: [Non-negotiable items]

            Quantify all dollar amounts. Be specific on redline language.
            """;
    }

    private String getLeaseStrategicPrompt() {
        return """

            ASSUME YOU ARE TENANT'S COUNSEL reviewing this lease for unfavorable terms and total cost.

            ## ⚡ EXECUTIVE LEASE SUMMARY (3 sentences)
            - Lease type and term
            - TRUE TOTAL COST over lease term (all-in)
            - RISK SCORE + RECOMMENDATION

            ## 💰 COMPREHENSIVE FINANCIAL ANALYSIS
            - Base Rent: [breakdown by year]
            - CAM Charges: $X/year (capped? [Y% / NONE ⚠️])
            - Property Taxes: tenant share
            - Insurance: tenant share
            - Utilities & Maintenance: $X
            - TI Allowance vs Need: [shortfall $X]
            - TOTAL 10-YEAR COST: $X.XX million
            - Effective Rate: $X/SF vs Market: $Y/SF

            ## 🚨 UNFAVORABLE LEASE TERMS
            ⚠️ [CRITICAL]: [Provision] (Section X)
            - Problem: [Landlord advantage]
            - Impact: [Financial/operational burden]
            - REDLINE: [Proposed fix]

            Focus on: repairs, CAM, assignment, termination

            ## 🚪 TERMINATION & ASSIGNMENT
            - Early termination: [Available/NONE ⚠️]
            - Assignment: [Landlord consent required - discretion type]
            - Sublease: [Restrictions, profit sharing]

            ## 💸 HIDDEN COSTS
            - After-hours HVAC: $X
            - CAM admin fee: X%
            - Capital improvements in CAM: [Yes ⚠️/No]
            - Other surprises: [List]

            ## 📋 NEGOTIATION PRIORITIES
            Tier 1 Must-Fix:
            1. [Item] - [Why]

            ## 🏆 RECOMMENDATION
            [Sign/Negotiate/Walk] + justification
            Must achieve: [Changes]

            Show true all-in cost, not just base rent.
            """;
    }

    private String getMotionAnalysisPrompt() {
        return """

            ASSUME YOU ARE OPPOSING COUNSEL analyzing this motion to develop opposition strategy.

            ## ⚡ EXECUTIVE OPPOSITION BRIEF (3 sentences)
            - What movant seeks
            - STRENGTH ASSESSMENT (Strong/Moderate/Weak)
            - WINNING COUNTER-ARGUMENT

            ## 🎯 WEAKNESSES IN MOVANT'S ARGUMENTS
            ⚠️ [MAJOR/HIGH/MEDIUM]: [Argument weakness]
            - Flaw: [What's wrong]
            - Counter: [How to respond]

            ## ⚖️ MISSING OR MISAPPLIED AUTHORITIES
            - Case cited: [Name]
            - Movant's use: [How they cite it]
            - Problem: [Inapplicable/distinguished/misread]
            - Our argument: [How to challenge]

            ## 📊 FACTUAL DISPUTES
            - Movant's assertion: [Claim]
            - Dispute: [Why factually wrong]
            - Evidence needed: [What to gather]

            ## 💡 OPPOSITION STRATEGY
            🎯 PRIMARY ARGUMENT: [Best response]
            🎯 PROCEDURAL DEFECTS: [Standing, ripeness, etc.]
            🎯 SUPPORTING PRECEDENTS: [Cases movant ignored]

            ## ⏱️ OPPOSITION TIMELINE
            📅 DAY 1-7: [Research, evidence]
            📅 DAY 14-21: Opposition deadline typically

            Focus on counter-arguments, not summary.
            """;
    }

    private String getStrategicGeneralAnalysisPrompt() {
        return """

            Provide strategic document analysis:

            ## ⚡ EXECUTIVE SUMMARY (3 sentences)
            - Document type and purpose
            - KEY RISK or main issue
            - IMMEDIATE ACTION if any

            ## 🎯 CRITICAL ISSUES
            For each major issue:
            ⚠️ [SEVERITY]: [Issue]
            - Description: [What's the problem]
            - Impact: [Why it matters]
            - Action: [What to do]

            ## 💰 FINANCIAL IMPLICATIONS
            - Costs/payments identified: $X
            - Liability exposure: $Y
            - Total financial impact: $Z

            ## 📝 KEY TERMS & OBLIGATIONS
            - Party obligations: [List]
            - Deadlines: [Dates]
            - Conditions: [Requirements]

            ## ⏱️ TIMELINE & DEADLINES
            - Immediate: [Actions within 7 days]
            - Short-term: [Within 30 days]
            - Long-term: [Beyond 30 days]

            ## 🎯 STRATEGIC RECOMMENDATIONS
            1. [Specific action with reasoning]
            2. [Next step]
            3. [Risk mitigation]

            ## ⚖️ LEGAL CONSIDERATIONS
            - Jurisdiction and venue
            - Governing law
            - Compliance requirements
            - Enforcement mechanisms

            Be action-oriented. Quantify financial terms. Prioritize by urgency.
            """;
    }

    private String getEmploymentAgreementPrompt() {
        return """

            ASSUME YOU ARE EMPLOYEE'S COUNSEL reviewing this employment agreement.
            Analyze for compensation value, restrictive covenants, and termination protections.

            ## ⚡ EXECUTIVE COMPENSATION SUMMARY (3 sentences)
            - Position and total compensation (Year 1)
            - COVENANT RISK SCORE (0-100) for enforceability
            - RECOMMENDATION (Sign / Negotiate / Decline)

            ## 💰 TOTAL COMPENSATION BREAKDOWN
            - Base Salary: $X/year
            - Bonus (Target): $Y/year
            - Equity Grant: Z shares (X% of company)
            - Benefits Value: $A/year
            - **YEAR 1 TOTAL: $XXX,XXX**

            ## 🚫 RESTRICTIVE COVENANTS ANALYSIS
            ⚠️ [SEVERITY]: Non-Compete Clause
            - Duration: [X months/years]
            - Geographic Scope: [Area]
            - Enforceability: [High/Medium/Low - state law analysis]
            - REDLINE: [Proposed narrower language]

            ⚠️ [SEVERITY]: Non-Solicitation (Customers)
            - Duration: [X months]
            - Scope: [All customers / Narrow]
            - Assessment: [Reasonable / Overbroad]

            ⚠️ [SEVERITY]: IP Assignment
            - Scope: [Work-related / All inventions including off-duty ⚠️]
            - REDLINE: Add carve-outs for personal projects

            ## 💼 TERMINATION PROVISIONS
            - Termination for Cause: [Definition - too broad? ⚠️]
            - Severance on Termination Without Cause: [None ⚠️ / X months]
            - Change of Control Acceleration: [None ⚠️ / Single-trigger / Double-trigger]
            - MUST NEGOTIATE: Add [12-month severance + equity acceleration]

            ## 📊 EQUITY VALUE ANALYSIS
            - Grant Value: $X (at current FMV)
            - Vesting: [4 years with 1-year cliff ⚠️]
            - Exit Scenario (Base Case): $Y potential value
            - Post-Termination Exercise Window: [30 days ⚠️ / 90 days / 10 years]

            ## 🎯 NEGOTIATION PRIORITIES
            **Tier 1 (Must-Fix):**
            1. Non-compete removal/limitation
            2. Severance protection (12 months)
            3. Double-trigger acceleration

            **Tier 2 (Important):**
            4. Exercise window extension
            5. IP carve-outs for side projects

            ## 🏆 RECOMMENDATION
            [Sign / Negotiate / Decline] + justification
            Must achieve: [List non-negotiables]

            Quantify all compensation. Focus on enforceability and downside protection.
            """;
    }

    private String getNDAPrompt() {
        return """

            ASSUME YOU ARE BUSINESS COUNSEL reviewing this NDA before signing.
            Analyze scope, duration, carve-outs, and business risks.

            ## ⚡ EXECUTIVE SUMMARY (3 sentences)
            - NDA type (Mutual / One-way)
            - SCOPE ASSESSMENT (Reasonable / Overbroad)
            - RECOMMENDATION (Sign / Negotiate / Decline)

            ## 🚨 PROBLEMATIC PROVISIONS
            ⚠️ [SEVERITY]: Confidentiality Duration
            - Current: [Perpetual ⚠️ / X years]
            - Market Standard: 3-5 years
            - REDLINE: Limit to 5 years from disclosure

            ⚠️ [SEVERITY]: Scope Definition
            - Current Definition: [Quote]
            - Problem: [Too broad / Includes publicly available info ⚠️]
            - REDLINE: Add standard carve-outs

            ⚠️ [SEVERITY]: Residuals Clause
            - Current: [Missing ⚠️ / Present]
            - ADD: "Receiving party may use residual knowledge retained in memory"

            ## 📋 MISSING STANDARD CARVE-OUTS
            ☐ Publicly available information
            ☐ Already known information
            ☐ Independently developed
            ☐ Rightfully received from third party
            ☐ Required by law to disclose

            ## 🎯 KEY TERMS ANALYSIS
            - Definition of Confidential Information: [Assessment]
            - Return/Destruction Obligation: [Assessment]
            - No Obligation to Disclose: [Explicit / Missing ⚠️]
            - No License Granted: [Explicit / Missing ⚠️]

            ## 💡 NEGOTIATION POINTS
            1. Limit duration to 5 years
            2. Add all standard carve-outs
            3. Add residuals clause
            4. Clarify no obligation to share information
            5. Make mutual if currently one-way

            ## 🏆 RECOMMENDATION
            [Sign / Negotiate] + reasoning
            Risk level: [Low/Medium/High]

            Focus on scope limitations and standard protections.
            """;
    }

    private String getDiscoveryRequestPrompt() {
        return """

            ASSUME YOU ARE RESPONDING COUNSEL analyzing discovery requests for objections.
            Identify overbroad requests, privilege issues, and burden.

            ## ⚡ EXECUTIVE ASSESSMENT (3 sentences)
            - Total requests: [X interrogatories, Y document requests, Z admissions]
            - BURDEN LEVEL: [Reasonable / High / Excessive ⚠️]
            - PRIMARY STRATEGY: [Objections to narrow scope]

            ## 🚨 OBJECTIONABLE REQUESTS
            For each problematic request:

            ⚠️ [SEVERITY]: Request No. [X]
            - Request: [Quote]
            - Problems: [Overbroad / Vague / Unduly burdensome / Privileged]
            - Objection: [Specific objection language]
            - Produce Subject to Objection: [What to produce if any]

            ## 🛡️ PRIVILEGE ISSUES
            - Attorney-client privilege: [Requests seeking privileged communications]
            - Work product: [Requests for trial preparation materials]
            - STRATEGY: Assert privilege log for [X] documents

            ## 📊 BURDEN ANALYSIS
            - Time estimate to respond: [X hours]
            - Documents to review: [Estimated volume]
            - Cost estimate: $X (attorney time) + $Y (vendor costs)
            - OBJECTION: Request No. [Y] - burden outweighs likely benefit

            ## ⏱️ RESPONSE TIMELINE
            📅 DAY 7: Initial privilege review
            📅 DAY 14: Draft objections and responses
            📅 DAY 21: Meet and confer with opposing counsel
            📅 DAY 28: Serve responses (typical 30-day deadline)

            ## 🎯 STRATEGIC RESPONSE PLAN
            **Narrow Scope Through Objections:**
            - Limit time period to [reasonable range]
            - Limit to relevant custodians
            - Object to "all documents" language

            **Privilege Assertions:**
            - Prepare privilege log for [X] items
            - Assert work product for trial prep

            **Meet and Confer Strategy:**
            - Propose narrower definitions
            - Agree to rolling productions
            - Seek extensions if needed

            ## 📝 RECOMMENDED OBJECTIONS (Sample)
            "Objection. Overbroad, unduly burdensome, and not reasonably calculated to lead to
            discovery of admissible evidence. Request seeks information beyond scope of claims
            and defenses. Request fails to specify time period. Subject to and without waiving
            objections, responding party will produce..."

            Focus on specific objections and burden quantification.
            """;
    }

    private String getSettlementAgreementPrompt() {
        return """

            ASSUME YOU ARE COUNSEL reviewing settlement agreement for enforceability and loopholes.
            Identify ambiguities, tax implications, and enforcement mechanisms.

            ## ⚡ EXECUTIVE SUMMARY (3 sentences)
            - Settlement amount and payment terms
            - ENFORCEABILITY ASSESSMENT (Strong / Weak)
            - RECOMMENDATION (Sign / Negotiate / Reject)

            ## 💰 FINANCIAL TERMS CLARITY
            - Settlement Amount: $X
            - Payment Schedule: [Lump sum / Installments]
            - Tax Treatment: [Gross / Net of taxes ⚠️]
            - Who Bears Tax Liability: [Clarified / Ambiguous ⚠️]
            - Default Remedy: [Liquidated damages / Judgment ⚠️]

            ## 🚨 PROBLEMATIC PROVISIONS
            ⚠️ [SEVERITY]: Release Scope
            - Current: ["All claims known and unknown" - too broad ⚠️]
            - Problem: [May release unrelated claims]
            - REDLINE: Limit to claims "arising from or related to [specific matter]"

            ⚠️ [SEVERITY]: Confidentiality Clause
            - Current: [Perpetual / Allows disclosure to [list]]
            - Problem: [Prevents disclosure to [accountant/spouse] ⚠️]
            - REDLINE: Add carve-outs for tax advisors, attorneys, spouse

            ⚠️ [SEVERITY]: Non-Disparagement
            - Current: [Mutual / One-way ⚠️]
            - Problem: [Too broad - prevents truthful statements ⚠️]
            - REDLINE: Limit to knowingly false statements

            ## 📋 MISSING STANDARD PROVISIONS
            ☐ Default interest rate (if installment payments)
            ☐ Acceleration clause (all payments due on default)
            ☐ Attorney's fees provision (prevailing party recovers fees)
            ☐ Tax indemnification (who covers unexpected tax liability)
            ☐ Governing law and venue

            ## ⚖️ ENFORCEABILITY ISSUES
            - Mutual consideration: [Present / Questionable]
            - Knowing and voluntary: [Adequate review period / Rushed ⚠️]
            - Duress concerns: [None / Present ⚠️]
            - Severability clause: [Present / Missing ⚠️]

            ## 🎯 TAX IMPLICATIONS
            - Characterization: [Settlement of physical injury / Wage claim / Breach of contract]
            - Tax Treatment: [Excludable under IRC §104 / Taxable as ordinary income]
            - 1099 Requirement: [Yes - allocation needed / No]
            - RECOMMENDATION: Allocate settlement for tax optimization

            ## 💡 NEGOTIATION PRIORITIES
            1. Narrow release to specific claims only
            2. Add confidentiality carve-outs
            3. Make non-disparagement mutual and narrow
            4. Add attorney's fees provision
            5. Clarify tax allocation and liability

            ## 🏆 RECOMMENDATION
            [Sign / Negotiate] + reasoning
            Must fix: [List deal-breakers]

            Quantify tax impact. Ensure enforceability. Close loopholes.
            """;
    }

    private String getRegulatoryNoticePrompt() {
        return """

            ASSUME YOU ARE COMPLIANCE COUNSEL analyzing this regulatory notice/demand.
            Identify obligations, deadlines, penalties, and defense options.

            ## ⚡ EXECUTIVE URGENCY SUMMARY (3 sentences)
            - Issuing Agency: [Name]
            - PRIMARY OBLIGATION: [What's required]
            - CRITICAL DEADLINE: [Date - X days remaining]

            ## 🚨 COMPLIANCE OBLIGATIONS
            ⚠️ [URGENCY]: Immediate Actions Required
            - Obligation: [Specific requirement]
            - Deadline: [Date]
            - Penalty for Non-Compliance: $X per day / [Consequence]
            - ACTION: [Specific steps to comply]

            ## ⏱️ CRITICAL TIMELINE
            📅 DAY 1: Assess notice and preserve evidence
            📅 DAY 3: Engage specialized regulatory counsel
            📅 DAY 7: Submit initial response (if required)
            📅 DAY 14: Complete compliance actions
            📅 DAY [X]: Final deadline per notice

            ## 💰 PENALTY EXPOSURE
            - Civil penalties: $X per violation per day
            - Criminal exposure: [Yes ⚠️ / No]
            - Estimated maximum penalty: $Y
            - Estimated likely penalty (if negotiate): $Z

            ## 🛡️ DEFENSE OPTIONS
            ⚠️ [VIABILITY]: Challenge Agency Jurisdiction
            - Basis: [Jurisdictional defect]
            - Likelihood of Success: [High/Medium/Low]

            ⚠️ [VIABILITY]: Good Faith Defense
            - Basis: [Reasonable reliance on legal advice]
            - Evidence Needed: [Legal memos, compliance efforts]

            ⚠️ [VIABILITY]: Negotiate Settlement
            - Leverage: [Voluntary compliance, cooperation]
            - Likely Reduction: [X% of maximum penalty]

            ## 📝 COMPLIANCE CHECKLIST
            ☐ DAY 1-3 (URGENT):
              ☐ Issue litigation hold (preserve documents)
              ☐ Notify insurance carrier
              ☐ Engage regulatory counsel
              ☐ Identify responsible personnel

            ☐ DAY 3-7 (HIGH):
              ☐ Gather requested documents
              ☐ Draft initial response
              ☐ Assess compliance gaps
              ☐ Implement corrective actions

            ☐ DAY 7-14 (MEDIUM):
              ☐ Submit response to agency
              ☐ Request meeting/negotiation
              ☐ Complete remediation
              ☐ Document compliance efforts

            ## 🎯 STRATEGIC RECOMMENDATIONS
            **PRIMARY STRATEGY:** [Comply / Challenge / Negotiate]
            - Rationale: [Why this approach]
            - Cost: $X (compliance) vs $Y (penalties)
            - Timeline: [X days to resolve]

            **FALLBACK STRATEGY:** [Alternative if primary fails]
            - When to pivot: [Trigger conditions]

            **COOPERATION CREDIT:**
            - Voluntary disclosure: [Reduces penalties by X%]
            - Prompt compliance: [Mitigating factor]
            - Document all cooperation efforts

            ## ⚖️ LEGAL CHALLENGES
            - Notice defects: [Improper service / Vague requirements]
            - Statute of limitations: [Violations time-barred?]
            - Constitutional issues: [Due process / Excessive fines]

            ## 🏆 RECOMMENDATION
            [Comply / Challenge / Negotiate] + justification
            Risk assessment: [Penalty exposure vs defense costs]

            Prioritize by deadline urgency. Quantify penalty exposure. Document everything.
            """;
    }

    private String getLegalBriefAnalysisPrompt() {
        return """

            ⚠️⚠️⚠️ MANDATORY OUTPUT REQUIREMENT ⚠️⚠️⚠️

            YOU MUST INCLUDE A JSON BLOCK AT THE END OF YOUR ANALYSIS.
            Your response is INCOMPLETE without the structured data.

            Expected JSON format (place at the VERY END after all analysis):
            ```json
            {
              "actionItems": [
                {"description": "...", "deadline": "YYYY-MM-DD", "priority": "HIGH|MODERATE|CRITICAL", "relatedSection": "..."}
              ],
              "timelineEvents": [
                {"title": "...", "eventDate": "YYYY-MM-DD", "eventType": "DEADLINE|FILING|MILESTONE", "priority": "...", "description": "..."}
              ]
            }
            ```

            Include ALL deadlines and tasks mentioned in your analysis as structured JSON.

            ⚠️⚠️⚠️ DO NOT FORGET THE JSON BLOCK ⚠️⚠️⚠️

            ---

            ASSUME YOU ARE OPPOSING COUNSEL analyzing this brief to develop counter-arguments.
            Identify weaknesses in legal reasoning, unsupported facts, and missing authorities.

            ## ⚡ EXECUTIVE OPPOSITION BRIEF (3 sentences)
            - Movant's primary argument
            - STRENGTH ASSESSMENT (Strong / Moderate / Weak)
            - WINNING COUNTER-ARGUMENT

            ## 🎯 WEAKNESSES IN LEGAL ARGUMENTS
            ⚠️ [SEVERITY]: Argument Weakness [Title]
            - Movant's Argument: [Summary]
            - Legal Flaw: [Misapplication of law / Inapplicable precedent / Logical gap]
            - Counter-Argument: [How to attack]
            - Supporting Authority: [Case/statute movant ignored]

            ## ⚖️ MISSING OR MISAPPLIED AUTHORITIES
            ⚠️ [SEVERITY]: Case [Name] Misapplied
            - How Cited: [Movant's use]
            - Actual Holding: [What case really says]
            - Distinguishing Facts: [How our facts differ]
            - Counter-Cite: [Use this case against them]

            **Authorities Movant Failed to Address:**
            - [Case Name]: [Directly contradicts movant's position]
            - [Statute]: [Overlooked provision undermining argument]

            ## 📊 UNSUPPORTED FACTUAL ASSERTIONS
            ⚠️ Factual Claim: [Quote from brief]
            - Problem: [No evidence cited / Contradicted by record]
            - Record Citation: [Where record shows otherwise]
            - Objection: "Counsel's assertion unsupported by cited evidence"

            ## 🛡️ PROCEDURAL DEFECTS
            - Standing: [Movant lacks standing because...]
            - Ripeness: [Not ripe for adjudication because...]
            - Mootness: [Issue mooted by...]
            - Waiver: [Argument waived by failure to raise earlier]

            ## 📝 OPPOSITION STRATEGY
            **PRIMARY COUNTER-ARGUMENT:**
            [Clear statement of strongest response]
            - Legal Basis: [Authority]
            - Factual Support: [Record citations]
            - Why It Wins: [Explanation]

            **ALTERNATIVE ARGUMENTS:**
            1. [Second-best argument]
            2. [Fallback position]

            **PROCEDURAL CHALLENGES:**
            - [Standing/ripeness/mootness objection]

            ## ⏱️ OPPOSITION TIMELINE
            📅 DAY 1-5: Legal research on counter-authorities
            📅 DAY 5-10: Draft opposition brief
            📅 DAY 10-14: Finalize and file (typical deadline)

            ## 🎯 KEY COUNTER-AUTHORITIES
            - [Case 1]: [How it undermines movant's argument]
            - [Case 2]: [Distinguishes movant's cited cases]
            - [Statute]: [Overlooked provision]
            - [Legislative History]: [Shows contrary intent]

            ## 💡 RECOMMENDED RESPONSE STRUCTURE
            **I. Procedural Issues**
            - [Jurisdictional/standing challenges]

            **II. Factual Disputes**
            - [Record contradicts brief assertions]

            **III. Legal Arguments**
            A. [Strongest counter-argument]
            B. [Second counter-argument]
            C. [Alternative theory]

            **IV. Conclusion**
            - Motion should be denied

            ## 🏆 WIN PROBABILITY ASSESSMENT
            - Movant's Brief Strength: [X/10]
            - Our Opposition Strength: [Y/10]
            - Predicted Outcome: [Grant/Deny/Partial]
            - Recommended Action: [Oppose / Don't oppose / Seek oral argument]

            Focus on exploiting legal and factual weaknesses. Cite controlling authority movant missed.

            ---

            🚨🚨🚨 CRITICAL REMINDER 🚨🚨🚨

            End your response with the JSON block containing actionItems and timelineEvents.
            Format: ```json { "actionItems": [...], "timelineEvents": [...] } ```

            This is MANDATORY. Your analysis is INCOMPLETE without it.
            """;
    }

    private Map<String, Object> parseAnalysisResponse(String response, String analysisType) {
        Map<String, Object> parsed = new HashMap<>();

        // Extract summary
        String summary = extractSection(response, "SUMMARY", "OVERVIEW");
        parsed.put("summary", summary != null ? summary : response.substring(0, Math.min(500, response.length())));

        // Extract key findings
        List<String> keyFindings = extractBulletPoints(response, "KEY FINDINGS", "FINDINGS");
        parsed.put("keyFindings", keyFindings);

        // Extract recommendations
        List<String> recommendations = extractBulletPoints(response, "RECOMMENDATIONS", "RECOMMENDED");
        parsed.put("recommendations", recommendations);

        // Extract compliance issues
        List<String> complianceIssues = extractBulletPoints(response, "COMPLIANCE", "NON-COMPLIANT");
        parsed.put("complianceIssues", complianceIssues);

        return parsed;
    }

    private String extractSection(String text, String... keywords) {
        for (String keyword : keywords) {
            int start = text.toUpperCase().indexOf(keyword.toUpperCase());
            if (start != -1) {
                int end = text.indexOf("\n\n", start);
                if (end == -1) end = text.length();
                return text.substring(start, end).trim();
            }
        }
        return null;
    }

    private List<String> extractBulletPoints(String text, String... sectionKeywords) {
        List<String> points = new ArrayList<>();
        String section = extractSection(text, sectionKeywords);

        if (section != null) {
            String[] lines = section.split("\n");
            for (String line : lines) {
                line = line.trim();
                if (line.startsWith("-") || line.startsWith("•") || line.startsWith("*") || line.matches("^\\d+\\..*")) {
                    points.add(line.replaceFirst("^[-•*]|^\\d+\\.", "").trim());
                }
            }
        }

        return points;
    }

}