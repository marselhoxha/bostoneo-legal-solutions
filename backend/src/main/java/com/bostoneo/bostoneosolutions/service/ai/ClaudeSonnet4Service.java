package com.bostoneo.bostoneosolutions.service.ai;

import com.bostoneo.bostoneosolutions.config.AIConfig;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.dto.ai.*;
import com.bostoneo.bostoneosolutions.enumeration.QuestionType;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.service.AiAuditLogService;
import com.bostoneo.bostoneosolutions.service.tools.LegalResearchTools;
import com.bostoneo.bostoneosolutions.service.ResearchProgressPublisher;
import com.bostoneo.bostoneosolutions.service.GenerationCancellationService;
import com.bostoneo.bostoneosolutions.utils.PiiDetector;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import reactor.core.publisher.Mono;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeAsyncClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelWithResponseStreamRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelWithResponseStreamResponseHandler;

import java.util.concurrent.CompletableFuture;
import java.util.*;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClaudeSonnet4Service implements AIService {

    private final BedrockRuntimeClient bedrockClient;
    private final BedrockRuntimeAsyncClient bedrockAsyncClient;
    private final AIConfig aiConfig;
    private final LegalResearchTools legalResearchTools;
    private final ResearchProgressPublisher progressPublisher;
    private final GenerationCancellationService cancellationService;
    private final AiAuditLogService aiAuditLogService;
    private final TenantService tenantService;
    
    @Override
    public CompletableFuture<String> generateCompletion(String prompt, boolean useDeepThinking) {
        return generateCompletion(prompt, null, useDeepThinking, null);
    }

    /**
     * Generate completion with optional system message for high-priority instructions
     */
    public CompletableFuture<String> generateCompletion(String prompt, String systemMessage, boolean useDeepThinking) {
        return generateCompletion(prompt, systemMessage, useDeepThinking, null);
    }

    /**
     * Generate completion with cancellation support (using sessionId)
     */
    public CompletableFuture<String> generateCompletion(String prompt, String systemMessage, boolean useDeepThinking, Long sessionId) {
        return generateCompletion(prompt, systemMessage, useDeepThinking, sessionId, null);
    }

    /**
     * Generate completion with cancellation support and temperature control.
     * @param temperature Use 0.0 for deterministic responses (e.g., classification).
     *                    Use null for default temperature.
     */
    public CompletableFuture<String> generateCompletion(String prompt, String systemMessage, boolean useDeepThinking, Long sessionId, Double temperature) {
        return generateCompletionWithModel(prompt, systemMessage, useDeepThinking, sessionId, temperature, null);
    }

    /**
     * Generate completion with explicit model selection. Used by AIRequestRouter for smart model routing.
     * If model is null, defaults to Opus 4.5 (via createRequest).
     */
    public CompletableFuture<String> generateCompletionWithModel(String prompt, String systemMessage, boolean useDeepThinking, Long sessionId, Double temperature, String model) {
        // Check if generation has been cancelled BEFORE making expensive API call
        if (sessionId != null && cancellationService.isCancelled(sessionId)) {
            log.warn("AI generation cancelled before API call for session {}", sessionId);
            cancellationService.clearCancellation(sessionId);
            return CompletableFuture.failedFuture(new IllegalStateException("AI generation cancelled by user"));
        }
        // Redact PII before sending to external API
        String piiTypes = PiiDetector.detectPiiTypes(prompt);
        if (!piiTypes.isEmpty()) {
            log.warn("PII detected in prompt before API call: {}", piiTypes);
        }
        String redactedPrompt = PiiDetector.redact(prompt);
        String redactedSystemMessage = PiiDetector.redact(systemMessage);

        AIRequest request = createRequest(redactedPrompt, redactedSystemMessage, useDeepThinking, temperature, model);

        // Resolve model to Bedrock model ID
        String bedrockModelId = aiConfig.resolveBedrockModelId(request.getModel());
        log.info("Sending request to Bedrock: model={}, maxTokens={}, promptLen={}",
                bedrockModelId, request.getMax_tokens(), redactedPrompt.length());

        // Capture user context from request thread BEFORE going async
        AuditContext auditCtx = captureAuditContext();

        return CompletableFuture.supplyAsync(() -> {
            try {
                // Build Bedrock-compatible JSON body
                String requestBody = buildBedrockRequestBody(request);

                InvokeModelRequest invokeRequest = InvokeModelRequest.builder()
                        .modelId(bedrockModelId)
                        .contentType("application/json")
                        .accept("application/json")
                        .body(SdkBytes.fromUtf8String(requestBody))
                        .build();

                // Retry logic: up to 3 attempts with exponential backoff
                InvokeModelResponse response = null;
                int maxRetries = 3;
                for (int attempt = 0; attempt <= maxRetries; attempt++) {
                    // Check cancellation before each attempt
                    if (sessionId != null && cancellationService.isCancelled(sessionId)) {
                        cancellationService.clearCancellation(sessionId);
                        throw new IllegalStateException("AI generation cancelled by user");
                    }
                    try {
                        response = bedrockClient.invokeModel(invokeRequest);
                        break; // Success
                    } catch (SdkClientException e) {
                        if (attempt < maxRetries && isRetryable(e)) {
                            long backoffMs = (long) (Math.pow(2, attempt) * 2000);
                            log.warn("Transient Bedrock error (attempt {}/{}), retrying in {}ms: {}",
                                    attempt + 1, maxRetries, backoffMs, e.getMessage());
                            Thread.sleep(backoffMs);
                        } else {
                            throw e;
                        }
                    }
                }

                // Parse response (same format as Anthropic API)
                String responseJson = response.body().asUtf8String();
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                AIResponse aiResponse = mapper.readValue(responseJson, AIResponse.class);
                String result = extractTextFromResponse(aiResponse);

                log.info("AI request completed for session {}", sessionId);
                if (sessionId != null) {
                    cancellationService.clearCancellation(sessionId);
                }

                // Audit log: success (use redacted prompt to protect PII)
                aiAuditLogService.logAiCall(
                        auditCtx.userId, auditCtx.userEmail, auditCtx.userRole,
                        auditCtx.organizationId, "AI_COMPLETION", "AI_QUERY",
                        sessionId, auditCtx.ipAddress, auditCtx.userAgent,
                        redactedPrompt, result, true, null);

                return result;

            } catch (Exception e) {
                log.error("AI request failed for session {}: {}", sessionId, e.getMessage());
                if (sessionId != null) {
                    cancellationService.clearCancellation(sessionId);
                }
                // Audit log: failure (use redacted prompt to protect PII)
                aiAuditLogService.logAiCall(
                        auditCtx.userId, auditCtx.userEmail, auditCtx.userRole,
                        auditCtx.organizationId, "AI_COMPLETION", "AI_QUERY",
                        sessionId, auditCtx.ipAddress, auditCtx.userAgent,
                        redactedPrompt, null, false, e.getMessage());
                throw new RuntimeException("AI service unavailable: " + e.getMessage(), e);
            }
        });
    }

    /**
     * Check if an exception is retryable (transient network/connection errors).
     */
    private boolean isRetryable(Exception e) {
        String msg = e.getMessage();
        if (msg == null) return false;
        return msg.contains("Connection reset") ||
                msg.contains("Connection refused") ||
                msg.contains("Connection closed") ||
                msg.contains("Broken pipe") ||
                msg.contains("timed out") ||
                msg.contains("ThrottlingException") ||
                msg.contains("ServiceUnavailableException");
    }

    @Override
    public CompletableFuture<String> summarizeDocument(String content, String documentType) {
        String prompt = String.format("""
            You are a legal AI assistant. Summarize this %s document in a structured format.
            
            Provide:
            1. Overview (2-3 sentences)
            2. Key Terms (bullet points)
            3. Important Dates
            4. Obligations & Rights
            5. Potential Risks
            
            Document:
            %s
            """, documentType, content);
        
        return generateCompletion(prompt, false);
    }

    @Override
    public CompletableFuture<String> analyzeContract(String contractText) {
        String prompt = String.format("""
            Analyze this contract for legal risks and compliance. Provide:
            
            1. Risk Assessment (High/Medium/Low with explanations)
            2. Missing Standard Clauses
            3. Compliance Issues
            4. Key Terms Analysis
            5. Recommended Actions
            
            Contract:
            %s
            """, contractText);
        
        return generateCompletion(prompt, true); // Use deep thinking for complex analysis
    }

    @Override
    public CompletableFuture<String> classifyCase(String caseDescription) {
        String prompt = String.format("""
            Classify this legal case. Provide:
            
            1. Practice Area (e.g., Personal Injury, Corporate, Criminal)
            2. Complexity Level (Low/Medium/High)
            3. Urgency Level (Low/Medium/High)
            4. Estimated Duration
            5. Recommended Attorney Type
            
            Case Description:
            %s
            """, caseDescription);
        
        return generateCompletion(prompt, false);
    }

    @Override
    public CompletableFuture<String> predictCaseOutcome(String caseDetails, String jurisdiction) {
        String prompt = String.format("""
            Analyze this case and provide outcome predictions:
            
            1. Settlement Probability (percentage)
            2. Trial Probability (percentage)
            3. Success Rate Estimate
            4. Timeline Prediction
            5. Key Factors Affecting Outcome
            
            Jurisdiction: %s
            Case Details:
            %s
            """, jurisdiction, caseDetails);
        
        return generateCompletion(prompt, true); // Use deep thinking for predictions
    }
    
    public CompletableFuture<String> draftLegalMemo(String topic, String jurisdiction, String keyFacts) {
        String prompt = String.format("""
            Draft a comprehensive legal memorandum on the following topic:
            
            TOPIC: %s
            JURISDICTION: %s
            KEY FACTS: %s
            
            Structure the memorandum as follows:
            
            MEMORANDUM
            
            TO: [Client/Attorney]
            FROM: Legal Research Assistant (AI)
            DATE: [Current Date]
            RE: %s
            
            I. EXECUTIVE SUMMARY
            [Brief overview of legal conclusions and recommendations]
            
            II. STATEMENT OF FACTS
            [Relevant facts based on provided information]
            
            III. ISSUES PRESENTED
            [Key legal questions to be addressed]
            
            IV. BRIEF ANSWERS
            [Short answers to each issue]
            
            V. DISCUSSION
            A. Legal Standard/Framework
            B. Application of Law to Facts
            C. Analysis of Strengths and Weaknesses
            D. Potential Counterarguments
            E. Recent Developments
            
            VI. CONCLUSION AND RECOMMENDATIONS
            [Summary of legal position and strategic advice]
            
            VII. RESEARCH RECOMMENDATIONS
            [Additional research that may be needed]
            
            Note: This memorandum is generated by AI for research purposes.
            """, topic, jurisdiction, keyFacts, topic);
        
        return generateCompletion(prompt, true);
    }
    
    public CompletableFuture<String> searchCaseLaw(String query, String jurisdiction) {
        String prompt = String.format("""
            Search for relevant case law on: %s
            Jurisdiction: %s
            
            Provide:
            1. Relevant cases with citations
            2. Key holdings
            3. Precedential value
            4. Application to current issue
            """, query, jurisdiction);
        
        return generateCompletion(prompt, true);
    }
    
    public CompletableFuture<String> interpretStatute(String statuteText, String jurisdiction) {
        String prompt = String.format("""
            Interpret this statute from %s:
            
            %s
            
            Provide:
            1. Plain language summary
            2. Key elements
            3. Common interpretations
            4. Practical applications
            """, jurisdiction, statuteText);
        
        return generateCompletion(prompt, true);
    }
    
    public CompletableFuture<String> findPrecedents(String caseDescription, String practiceArea) {
        String prompt = String.format("""
            Find legal precedents for this case:
            Practice Area: %s
            
            Case: %s
            
            Identify:
            1. Similar cases
            2. Applicable precedents
            3. Distinguishing factors
            4. Strategic considerations
            """, practiceArea, caseDescription);
        
        return generateCompletion(prompt, true);
    }

    // ===== AUTONOMOUS LEGAL RESEARCH METHODS =====

    /**
     * Performs lawyer-grade autonomous legal research with impeccable precision,
     * verifiable citations, and professional standards.
     */
    public CompletableFuture<Map<String, Object>> lawyerGradeLegalResearch(
            String query,
            String jurisdiction,
            List<Map<String, Object>> existingResults,
            String effectiveDate) {

        String prompt = String.format("""
            You are a precision-focused legal research system producing LAWYER-GRADE analysis for: "%s"
            Jurisdiction: %s
            Effective Date for Analysis: %s

            === CURRENT SEARCH RESULTS ===
            %s

            === LAWYER-GRADE PRECISION REQUIREMENTS ===

            **ZERO ERROR TOLERANCE STANDARD**:
            You are producing work that will be relied upon by practicing attorneys. Every statement must meet the following standards:

            1. **CITATION PRECISION**:
               - Every legal proposition MUST have a verifiable citation
               - Use FULL Bluebook format (e.g., "Mass. R. Civ. P. 12(b)(6)" not "Rule 12(b)(6)")
               - Include pinpoint citations (e.g., "520 U.S. 681, 694-95 (1997)")
               - Distinguish binding vs. persuasive authority
               - Use proper signals (e.g., "See", "Cf.", "But see", "Accord")

            2. **PRIMARY SOURCE VERIFICATION**:
               - Cite ONLY to primary sources you can verify from search results
               - If primary source unavailable, explicitly state "[Secondary Source - Verification Required]"
               - Never fabricate citations or case names
               - Flag any unverifiable propositions as "[Citation Needed]"

            3. **TEMPORAL ACCURACY**:
               - Include effective dates for all statutes and regulations
               - Note amendments with "as amended [date]" when applicable
               - Flag recent changes with "[Recently Amended - Verify Current Version]"
               - For case law, note if potentially overruled or distinguished

            4. **JURISDICTIONAL PRECISION**:
               - Always specify the exact jurisdiction (e.g., "D. Mass." not "federal court")
               - Note circuit splits explicitly: "[Circuit Split: 1st Cir. vs. 9th Cir.]"
               - Distinguish federal vs. state authority clearly
               - Flag choice of law issues when multiple jurisdictions apply

            5. **PROFESSIONAL CAVEATS**:
               - Include practice notes: "Practice Note: Local rules may vary"
               - Flag strategic considerations: "Strategic Consideration: [issue]"
               - Note ethical obligations where relevant
               - Include malpractice avoidance warnings for critical deadlines

            Conduct comprehensive legal research by analyzing the existing results and providing additional legal information as needed. Your research should focus on:

            🔍 CRITICAL ANALYSIS AREAS:
            1. STATUTORY GAPS: What relevant statutes, regulations, or codes are missing?
            2. CASE LAW GAPS: What important precedents or judicial interpretations are absent?
            3. PROCEDURAL GAPS: What filing requirements, deadlines, or court procedures are not covered?
            4. JURISDICTIONAL CONSIDERATIONS: What state vs federal law distinctions are important?
            5. RECENT DEVELOPMENTS: What current legal trends or recent changes affect this area?
            6. PRACTICAL IMPLEMENTATION: What real-world application issues need addressing?

            🎯 SPECIFIC RESEARCH OBJECTIVES:
            - For Massachusetts law: Identify relevant MGL chapters, court rules, and local practices
            - For Federal law: Identify applicable USC sections, CFR regulations, and federal court procedures
            - For Immigration law: Focus on INA sections, 8 CFR regulations, BIA decisions, AAO precedents, USCIS Policy Manual, and circuit court immigration cases
            - For Immigration Appeals: Identify BIA appeal procedures (30-day deadline), AAO appeal requirements, federal circuit court review standards, and EOIR Practice Manual guidelines
            - For procedural matters: Identify specific deadlines, forms (EOIR-26/29, I-290B), and filing requirements
            - For precedents: Identify controlling cases and persuasive authority, including Matter of [Name] BIA precedents
            - For compliance: Identify regulatory requirements and best practices

            📋 ENHANCED OUTPUT REQUIREMENTS:
            Provide detailed, specific information with exact citations where possible. Include practical guidance that attorneys can immediately implement.

            **Respond in LAWYER-GRADE JSON format:**
            {
              "executiveSummary": {
                "bottomLine": "One-paragraph precise legal answer",
                "criticalDeadlines": ["Date - Action Required - Authority"],
                "jurisdictionSpecific": "Exact court/agency with jurisdiction",
                "asOfDate": "Law current as of [date]"
              },
              "primaryAuthorities": {
                "constitutional": [{"citation": "U.S. Const. art. III, § 2", "relevance": "why applicable"}],
                "statutory": [{"citation": "28 U.S.C. § 1331 (2024)", "relevance": "federal question jurisdiction", "effectiveDate": "current version"}],
                "regulatory": [{"citation": "8 C.F.R. § 1003.38(a) (2024)", "relevance": "BIA appeal deadlines", "lastAmended": "date"}],
                "caselaw": [{
                  "citation": "Twombly, 550 U.S. 544, 570 (2007)",
                  "holding": "exact holding",
                  "bindingIn": "jurisdictions where binding",
                  "distinguishedBy": "any cases limiting it"
                }]
              },
              "proceduralRequirements": {
                "filingDeadlines": [{"action": "File notice of appeal", "deadline": "30 days", "authority": "Fed. R. App. P. 4(a)(1)(A)", "computation": "how calculated"}],
                "requiredForms": [{"form": "EOIR-26", "purpose": "Notice of Appeal to BIA", "source": "where to obtain"}],
                "servicerequirements": [{"mustServe": "opposing counsel", "method": "how", "deadline": "when", "authority": "rule citation"}],
                "localRules": [{"court": "D. Mass.", "rule": "LR 7.1", "requirement": "meet and confer"}]
              },
              "legalAnalysis": {
                "issueStatement": "Precise legal question presented",
                "ruleSynthesis": "Black letter law from authorities",
                "application": "How law applies to these facts",
                "counterarguments": "Opposing positions and responses",
                "conclusion": "Supported legal conclusion"
              },
              "practiceNotes": {
                "strategicConsiderations": ["tactical advice"],
                "commonPitfalls": ["mistakes to avoid"],
                "ethicalConsiderations": ["Model Rule implications"],
                "malpracticeAvoidance": ["critical warnings"]
              },
              "citationVerification": {
                "verifiedCitations": ["citations confirmed from search results"],
                "unverifiedCitations": ["citations needing verification"],
                "secondarySources": ["non-primary sources used"]
              },
              "temporalWarnings": {
                "recentChanges": ["laws changed in last 6 months"],
                "pendingChanges": ["upcoming effective dates"],
                "sunsetProvisions": ["expiring laws"]
              },
              "jurisdictionalNotes": {
                "circuitSplits": ["conflicting authorities"],
                "choiceOfLaw": ["which law applies and why"],
                "conflictOfLaws": ["potential conflicts"]
              },
              "qualityMetrics": {
                "citationAccuracy": "percentage of verified citations",
                "primarySourceRatio": "ratio of primary to secondary sources",
                "confidenceLevel": "High/Medium/Low",
                "verificationRequired": ["specific items needing manual verification"]
              }
            }
            """, query, jurisdiction, effectiveDate != null ? effectiveDate : "Current Date", formatExistingResults(existingResults));

        return generateCompletion(prompt, true)
            .thenApply(this::parseAutonomousResearchResponse);
    }

    /**
     * Original autonomous legal research method - kept for backward compatibility
     */
    public CompletableFuture<Map<String, Object>> autonomousLegalResearch(
            String query,
            String jurisdiction,
            List<Map<String, Object>> existingResults) {
        // Delegate to the new lawyer-grade method with current date
        return lawyerGradeLegalResearch(query, jurisdiction, existingResults, null);
    }

    /**
     * Identifies knowledge gaps in current search results by analyzing what
     * important legal information might be missing.
     */
    public CompletableFuture<List<String>> identifyKnowledgeGaps(
            String query,
            List<Map<String, Object>> searchResults) {

        String prompt = String.format("""
            🎯 LEGAL KNOWLEDGE GAP ANALYSIS

            As an expert legal research analyst, perform a systematic gap analysis for this legal query and current search results.

            **Query:** "%s"

            **Current Search Results:**
            %s

            === GAP ANALYSIS FRAMEWORK ===

            Systematically identify missing critical legal information in these categories:

            🏛️ **STATUTORY/REGULATORY GAPS:**
            - Missing applicable statutes (state/federal/INA sections)
            - Absent regulatory provisions (8 CFR for immigration)
            - Overlooked administrative rules
            - Missing USCIS Policy Manual guidance

            ⚖️ **CASE LAW GAPS:**
            - Missing controlling precedents
            - Absent interpretive cases
            - Missing circuit splits or jurisdictional variations
            - Missing BIA precedent decisions (Matter of [Name])
            - Absent AAO non-precedent decisions

            📋 **PROCEDURAL GAPS:**
            - Missing court rules or procedures
            - Absent filing requirements/deadlines
            - Missing forms or administrative processes
            - Immigration-specific: EOIR Practice Manual procedures, BIA appeal deadlines (30 days), Circuit court petition deadlines (30 days)
            - Missing USCIS form requirements (I-290B, EOIR-26, EOIR-29)

            🌍 **JURISDICTIONAL GAPS:**
            - State vs federal law considerations
            - Multi-jurisdictional issues
            - Choice of law problems
            - Immigration court vs federal court jurisdiction
            - AAO vs BIA appellate jurisdiction

            🔄 **TEMPORAL GAPS:**
            - Recent legal developments
            - Pending legislation
            - Recent court decisions

            🎯 **PRACTICAL GAPS:**
            - Implementation challenges
            - Compliance requirements
            - Industry-specific considerations

            **Instructions:**
            - Be specific about what legal authorities are missing
            - Focus on gaps that would significantly impact legal advice
            - Prioritize gaps based on importance to the query
            - Include specific citation types needed (e.g., "MGL Chapter 93A cases on unfair practices")

            **Return a JSON array of specific, actionable knowledge gaps:**
            ["Specific statutory gap with citation format", "Specific case law gap", "Specific procedural requirement gap", ...]
            """, query, formatExistingResults(searchResults));

        return generateCompletion(prompt, false)
            .thenApply(this::parseKnowledgeGaps);
    }

    /**
     * Generates enhanced search queries for deeper research based on identified knowledge gaps.
     */
    public CompletableFuture<List<String>> generateDeepSearchQueries(
            String originalQuery,
            List<String> knowledgeGaps) {

        String prompt = String.format("""
            Based on the original legal query and identified knowledge gaps, generate specific, targeted search queries for deeper legal research.

            Original Query: "%s"

            Knowledge Gaps:
            %s

            Generate 5-8 specific search queries that would help fill these gaps:
            - Focus on statutory research, case law, and procedural requirements
            - Include jurisdiction-specific searches
            - Target recent developments and current legal trends
            - Consider practical implementation aspects

            Return as JSON array:
            ["search query 1", "search query 2", ...]
            """, originalQuery, String.join("\n- ", knowledgeGaps));

        return generateCompletion(prompt, false)
            .thenApply(this::parseSearchQueries);
    }

    /**
     * Synthesizes comprehensive analysis from multiple sources including autonomous findings.
     */
    public CompletableFuture<String> synthesizeComprehensiveAnalysis(
            String query,
            List<Map<String, Object>> apiResults,
            Map<String, Object> autonomousFindings) {

        String prompt = String.format("""
            📊 COMPREHENSIVE LEGAL ANALYSIS SYNTHESIS

            Synthesize a definitive legal analysis by combining external legal database results with autonomous AI research findings.

            **Legal Query:** "%s"

            === 🔍 EXTERNAL DATABASE RESULTS ===
            %s

            === 🤖 AUTONOMOUS AI RESEARCH FINDINGS ===
            %s

            === 📋 SYNTHESIS REQUIREMENTS ===

            **ACCURACY-FIRST INSTRUCTION**: Provide comprehensive legal analysis based PRIMARILY on the search results and autonomous research findings provided. When information is insufficient, provide GENERAL guidance with clear verification requirements. Avoid specific procedural details, forms, or deadlines unless clearly supported by the sources. Use cautious language and include appropriate disclaimers.

            **For Immigration Law Queries**: Provide general framework understanding:
            - Immigration appeals typically involve multiple levels (Immigration Courts, administrative bodies, federal courts)
            - Appeal deadlines are generally strict - verify current requirements with official sources
            - Different forms may be required depending on case type - consult current EOIR/USCIS guidance
            - Federal immigration law framework includes INA and implementing regulations - cite specific sections only when supported by sources
            - Always recommend verification with current official guidance for procedural details

            Create a comprehensive, attorney-ready legal analysis following this structure:

            ## 📋 EXECUTIVE SUMMARY
            - **Legal Situation:** Clear, concise description of the issue
            - **Primary Findings:** Top 3-5 most critical legal points
            - **Bottom Line:** Direct answer to the legal query with confidence level
            - **Jurisdiction:** Clearly state if this is federal, state, or immigration law

            ## ⚖️ LEGAL FRAMEWORK & AUTHORITIES
            - **Controlling Statutes:** Specific citations with relevant sections (INA sections for immigration)
            - **Binding Precedents:** Key cases with holdings and relevance
            - **Regulatory Requirements:** Administrative rules and compliance requirements (8 CFR for immigration)
            - **Jurisdictional Considerations:** State vs federal law interactions
            - **Immigration-Specific:** BIA precedents, AAO decisions, USCIS Policy Manual references

            ## 🎯 ACTIONABLE GUIDANCE
            - **Immediate Steps:** Prioritized action items with deadlines
            - **Required Procedures:** Step-by-step compliance requirements
            - **Forms & Documentation:** Specific forms needed with filing locations
            - **Timeline Management:** Critical deadlines and time-sensitive actions
            - **Immigration Appeals:** If applicable, specify BIA 30-day deadline, EOIR-26/29 forms, or Circuit Court 30-day petition deadline

            ## 🚨 RISK ASSESSMENT & STRATEGY
            - **Primary Risks:** Legal exposure and potential complications
            - **Mitigation Strategies:** Specific approaches to minimize risks
            - **Alternative Approaches:** Different strategic options with pros/cons
            - **Red Flags:** Warning signs requiring immediate attention

            ## 📞 PRACTICAL IMPLEMENTATION
            - **Client Communications:** How to explain options to clients
            - **Next Research Needed:** Outstanding questions requiring further investigation
            - **Cost-Benefit Analysis:** Economic considerations for different approaches
            - **Success Metrics:** How to measure effectiveness of chosen strategy

            **Format Requirements:**
            - Use specific citations with pinpoint references
            - Include practical deadlines and time estimates
            - Provide exact procedural steps where applicable
            - Highlight any conflicting authorities or unsettled law
            - Rate confidence level for each major conclusion (High/Medium/Low)

            **Deliverable:** Provide attorney-ready analysis that seamlessly combines external legal research with AI autonomous findings into actionable legal guidance.
            """, query, formatExistingResults(apiResults), formatAutonomousFindings(autonomousFindings));

        return generateCompletion(prompt, true);
    }

    /**
     * Performs autonomous web search when existing API sources are insufficient.
     * This method will search the web and synthesize findings into legal research.
     */
    public CompletableFuture<Map<String, Object>> performAutonomousWebSearch(
            String query,
            String jurisdiction,
            List<Map<String, Object>> insufficientResults) {

        String prompt = String.format("""
            🌐 AUTONOMOUS LEGAL WEB SEARCH & RESEARCH

            You are an advanced legal research AI with web search capabilities. The existing legal databases returned insufficient results for this query, so you must conduct autonomous web research to provide comprehensive legal guidance.

            **Legal Query:** "%s"
            **Jurisdiction:** %s

            **Current Database Results (Insufficient):**
            %s

            === 🎯 AUTONOMOUS RESEARCH MISSION ===

            Since the specialized legal databases lack sufficient information, you must actively research this legal question using web search capabilities and your legal knowledge to provide substantive, practice-ready guidance.

            **For Massachusetts Civil Procedure Rules (like Mass. R. Civ. P. 12(b)(6)):**
            - Search Massachusetts court websites, bar association resources, and official rule commentaries
            - Focus on Mass. R. Civ. P. (Massachusetts Rules of Civil Procedure)
            - Look for recent case law interpreting the specific rule
            - Find practice guides and procedural requirements
            - Identify relevant Massachusetts Superior Court, District Court, or SJC precedents

            **For State Law Queries:**
            - Search official state government websites and legal resources
            - Find relevant state statutes, regulations, and court rules
            - Look for state court decisions and interpretations
            - Identify state bar resources and practice guides

            **For Federal Law Queries:**
            - Search federal court websites, agency regulations, and official guidance
            - Find relevant USC sections, CFR regulations, and federal court procedures
            - Look for circuit court decisions and federal district court cases

            **For Immigration Law:**
            - Search USCIS official guidance, EOIR resources, and BIA decisions
            - Find INA sections, 8 CFR regulations, and Policy Manual updates
            - Look for recent circuit court immigration decisions
            - Identify forms, deadlines, and procedural requirements

            === 📋 RESEARCH DELIVERABLES ===

            Provide comprehensive legal research including:

            1. **Relevant Legal Authorities**: Specific statutes, regulations, court rules with exact citations
            2. **Controlling Case Law**: Key decisions with holdings and relevance to the query
            3. **Procedural Requirements**: Filing deadlines, required forms, and court procedures
            4. **Practice Guidance**: Step-by-step implementation advice for attorneys
            5. **Recent Developments**: Current legal trends and recent changes
            6. **Risk Assessment**: Potential complications and strategic considerations

            **Response Format (JSON):**
            {
              "searchStrategy": "Description of research approach used",
              "legalAuthorities": {
                "primaryStatutes": "Specific statutes with citations (e.g., Mass. R. Civ. P. 12(b)(6))",
                "regulations": "Applicable regulations and administrative rules",
                "courtRules": "Relevant procedural rules with specific citations"
              },
              "caseLaw": {
                "controllingCases": "Key precedents with citations and holdings",
                "persuasiveAuthority": "Supporting decisions from other jurisdictions",
                "recentDecisions": "Current case law developments"
              },
              "proceduralGuidance": {
                "filingRequirements": "Specific deadlines and procedural steps",
                "requiredForms": "Forms needed with filing locations",
                "practicalSteps": "Step-by-step implementation guidance"
              },
              "comprehensiveAnalysis": "Detailed legal analysis synthesizing all research findings",
              "practiceRecommendations": ["Immediate action items", "Strategic considerations", "Client advisements"],
              "confidenceLevel": "High/Medium/Low with explanation of research basis",
              "sourcesConsulted": "Summary of research methodology and sources reviewed"
            }

            **CRITICAL INSTRUCTION:** Provide substantive, specific legal guidance based on active research. Do not default to generic disclaimers. Attorneys need actionable information with proper citations and procedural details.
            """, query, jurisdiction, formatExistingResults(insufficientResults));

        return generateCompletion(prompt, true)
            .thenApply(this::parseWebSearchResponse);
    }

    /**
     * Determines if current search results are insufficient and web search is needed.
     */
    public boolean needsAutonomousWebSearch(List<Map<String, Object>> searchResults, String query) {
        // Check if results are empty or very limited
        if (searchResults == null || searchResults.isEmpty()) {
            log.info("Web search needed: No results found for query: {}", query);
            return true;
        }

        // Check if results are too few for complex legal queries
        if (searchResults.size() < 3) {
            log.info("Web search needed: Only {} results found for query: {}", searchResults.size(), query);
            return true;
        }

        // Check for state law queries that may not be well-covered by federal databases
        String queryLower = query.toLowerCase();
        if (queryLower.contains("mass.") || queryLower.contains("massachusetts") ||
            queryLower.contains("r. civ. p.") || queryLower.contains("state court") ||
            queryLower.contains("state law") || queryLower.contains("civil procedure")) {
            log.info("Web search needed: State law query may need additional research: {}", query);
            return true;
        }

        // Check if results lack procedural or practical guidance
        boolean hasProceduralInfo = searchResults.stream().anyMatch(result -> {
            String title = (String) result.get("title");
            String summary = (String) result.get("summary");
            if (title != null && summary != null) {
                String combined = (title + " " + summary).toLowerCase();
                return combined.contains("procedure") || combined.contains("filing") ||
                       combined.contains("deadline") || combined.contains("form") ||
                       combined.contains("motion") || combined.contains("rule");
            }
            return false;
        });

        if (!hasProceduralInfo && (queryLower.contains("motion") || queryLower.contains("procedure") ||
                                   queryLower.contains("filing") || queryLower.contains("rule"))) {
            log.info("Web search needed: Procedural query lacks procedural guidance: {}", query);
            return true;
        }

        return false;
    }

    /**
     * Enhances search results with autonomous web research when needed.
     */
    public CompletableFuture<List<Map<String, Object>>> enhanceWithWebSearch(
            String query,
            String jurisdiction,
            List<Map<String, Object>> existingResults) {

        if (!needsAutonomousWebSearch(existingResults, query)) {
            return CompletableFuture.completedFuture(existingResults);
        }

        log.info("Performing autonomous web search to enhance results for query: {}", query);

        return performAutonomousWebSearch(query, jurisdiction, existingResults)
            .thenApply(webFindings -> {
                List<Map<String, Object>> enhancedResults = new ArrayList<>(existingResults);

                // Create a synthetic result from web search findings
                Map<String, Object> webSearchResult = new HashMap<>();
                webSearchResult.put("id", "web-search-" + System.currentTimeMillis());
                webSearchResult.put("title", "Autonomous Legal Research: " + query);
                webSearchResult.put("source", "AI Web Research");
                webSearchResult.put("type", "Comprehensive Legal Analysis");
                webSearchResult.put("summary", (String) webFindings.get("comprehensiveAnalysis"));
                webSearchResult.put("webFindings", webFindings);
                webSearchResult.put("confidenceLevel", webFindings.get("confidenceLevel"));

                // Add web search result at the beginning for priority
                enhancedResults.add(0, webSearchResult);

                log.info("Enhanced results with autonomous web search. Total results: {}", enhancedResults.size());
                return enhancedResults;
            });
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseWebSearchResponse(String response) {
        try {
            // Try to parse as JSON first
            String cleanResponse = response.replaceAll("```json", "").replaceAll("```", "").trim();
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.readValue(cleanResponse, Map.class);
        } catch (Exception e) {
            log.debug("Web search returned markdown format (not JSON), using fallback parser");
            // Fallback to structured text response
            return parseWebSearchTextResponse(response);
        }
    }

    private Map<String, Object> parseWebSearchTextResponse(String response) {
        Map<String, Object> result = new HashMap<>();

        // Check if response is in new counsel-ready markdown format
        if (response.startsWith("#") || response.contains("## Controlling Legal Authority")) {
            log.info("Web search returned counsel-ready markdown format, using as comprehensive analysis");

            // Extract the main content
            result.put("comprehensiveAnalysis", response);
            result.put("searchStrategy", "Counsel-ready research with case law citations");
            result.put("confidenceLevel", "High - Based on controlling precedents");
            result.put("sourcesConsulted", "Legal databases and case law research");

            // Extract case law from Controlling Legal Authority section if present
            String caseLawSection = extractSectionFromText(response, "controlling legal authority", "strategic analysis");
            if (caseLawSection != null && !caseLawSection.isEmpty()) {
                Map<String, String> caseLaw = new HashMap<>();
                caseLaw.put("controllingCases", caseLawSection);
                result.put("caseLaw", caseLaw);
            }

            return result;
        }

        // Original parsing for JSON-like responses
        result.put("searchStrategy", extractSectionFromText(response, "search strategy", "legal authorities"));
        result.put("comprehensiveAnalysis", extractSectionFromText(response, "comprehensive analysis", "practice recommendations"));
        result.put("confidenceLevel", extractSectionFromText(response, "confidence level", "sources consulted"));
        result.put("sourcesConsulted", extractSectionFromText(response, "sources consulted", null));

        // Extract legal authorities
        Map<String, String> legalAuthorities = new HashMap<>();
        legalAuthorities.put("primaryStatutes", extractSectionFromText(response, "primary statutes", "regulations"));
        legalAuthorities.put("regulations", extractSectionFromText(response, "regulations", "court rules"));
        legalAuthorities.put("courtRules", extractSectionFromText(response, "court rules", "case law"));
        result.put("legalAuthorities", legalAuthorities);

        // Extract case law
        Map<String, String> caseLaw = new HashMap<>();
        caseLaw.put("controllingCases", extractSectionFromText(response, "controlling cases", "persuasive authority"));
        caseLaw.put("persuasiveAuthority", extractSectionFromText(response, "persuasive authority", "recent decisions"));
        caseLaw.put("recentDecisions", extractSectionFromText(response, "recent decisions", "procedural guidance"));
        result.put("caseLaw", caseLaw);

        // Extract procedural guidance
        Map<String, String> proceduralGuidance = new HashMap<>();
        proceduralGuidance.put("filingRequirements", extractSectionFromText(response, "filing requirements", "required forms"));
        proceduralGuidance.put("requiredForms", extractSectionFromText(response, "required forms", "practical steps"));
        proceduralGuidance.put("practicalSteps", extractSectionFromText(response, "practical steps", "comprehensive analysis"));
        result.put("proceduralGuidance", proceduralGuidance);

        // Extract recommendations
        result.put("practiceRecommendations", extractListFromText(response, "practice recommendations", "confidence level"));

        return result;
    }

    // Helper methods for autonomous research
    private String formatExistingResults(List<Map<String, Object>> results) {
        if (results == null || results.isEmpty()) {
            return "No results available";
        }

        StringBuilder formatted = new StringBuilder();
        int count = Math.min(results.size(), 10); // Limit to top 10 results for prompt efficiency

        for (int i = 0; i < count; i++) {
            Map<String, Object> result = results.get(i);
            formatted.append(String.format("%d. %s\n", i + 1, result.get("title")));
            formatted.append(String.format("   Type: %s\n", result.get("type")));
            formatted.append(String.format("   Source: %s\n", result.get("source")));

            String summary = (String) result.get("summary");
            if (summary != null && !summary.isEmpty()) {
                formatted.append(String.format("   Summary: %s\n",
                    summary.length() > 200 ? summary.substring(0, 200) + "..." : summary));
            }
            formatted.append("\n");
        }

        return formatted.toString();
    }

    private String formatAutonomousFindings(Map<String, Object> findings) {
        if (findings == null || findings.isEmpty()) {
            return "No autonomous findings available";
        }

        StringBuilder formatted = new StringBuilder();
        findings.forEach((key, value) -> {
            formatted.append(String.format("%s: %s\n", key, value));
        });

        return formatted.toString();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseAutonomousResearchResponse(String response) {
        try {
            // Try to parse as JSON first
            return parseJsonResponse(response);
        } catch (Exception e) {
            // Fallback to structured text parsing
            return parseStructuredTextResponse(response);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJsonResponse(String response) {
        // Remove any markdown formatting
        String cleanResponse = response.replaceAll("```json", "").replaceAll("```", "").trim();

        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.readValue(cleanResponse, Map.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse JSON response", e);
        }
    }

    private Map<String, Object> parseStructuredTextResponse(String response) {
        Map<String, Object> result = new HashMap<>();

        // Extract sections from structured text response
        result.put("knowledgeGaps", extractListFromText(response, "knowledge gaps?", "autonomous findings"));
        result.put("enhancedGuidance", extractSectionFromText(response, "enhanced guidance", "recommendations"));
        result.put("recommendations", extractListFromText(response, "recommendations", "citations"));
        result.put("citations", extractListFromText(response, "citations", "risk factors"));
        result.put("riskFactors", extractListFromText(response, "risk factors", null));

        // Create autonomous findings object
        Map<String, Object> autonomousFindings = new HashMap<>();
        autonomousFindings.put("relevantStatutes", extractSectionFromText(response, "relevant statutes", "case precedents"));
        autonomousFindings.put("casePrecedents", extractSectionFromText(response, "case precedents", "procedural requirements"));
        autonomousFindings.put("proceduralRequirements", extractSectionFromText(response, "procedural requirements", "recent developments"));
        autonomousFindings.put("recentDevelopments", extractSectionFromText(response, "recent developments", "practical considerations"));
        autonomousFindings.put("practicalConsiderations", extractSectionFromText(response, "practical considerations", "enhanced guidance"));
        result.put("autonomousFindings", autonomousFindings);

        return result;
    }

    private List<String> parseKnowledgeGaps(String response) {
        try {
            String cleanResponse = response.replaceAll("```json", "").replaceAll("```", "").trim();
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.readValue(cleanResponse, List.class);
        } catch (Exception e) {
            return extractListFromText(response, "gaps", null);
        }
    }

    private List<String> parseSearchQueries(String response) {
        try {
            String cleanResponse = response.replaceAll("```json", "").replaceAll("```", "").trim();
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.readValue(cleanResponse, List.class);
        } catch (Exception e) {
            return extractListFromText(response, "quer", null);
        }
    }

    private List<String> extractListFromText(String text, String startMarker, String endMarker) {
        List<String> items = new ArrayList<>();

        String lowerText = text.toLowerCase();
        int start = lowerText.indexOf(startMarker.toLowerCase());
        if (start == -1) return items;

        int end = endMarker != null ? lowerText.indexOf(endMarker.toLowerCase(), start) : text.length();
        if (end == -1) end = text.length();

        String section = text.substring(start, end);

        // Extract bullet points or numbered items
        String[] lines = section.split("\n");
        for (String line : lines) {
            line = line.trim();
            if (line.startsWith("-") || line.startsWith("•") || line.matches("^\\d+\\..*")) {
                String item = line.replaceAll("^[-•\\d\\.\\s]+", "").trim();
                if (!item.isEmpty() && item.length() > 10) { // Filter out headers and short text
                    items.add(item);
                }
            }
        }

        return items;
    }

    private String extractSectionFromText(String text, String startMarker, String endMarker) {
        String lowerText = text.toLowerCase();
        int start = lowerText.indexOf(startMarker.toLowerCase());
        if (start == -1) return "";

        int end = endMarker != null ? lowerText.indexOf(endMarker.toLowerCase(), start) : text.length();
        if (end == -1) end = text.length();

        String section = text.substring(start, end);

        // Clean up the section
        section = section.replaceAll("^[^:]*:", "").trim(); // Remove the header
        section = section.replaceAll("\n+", " ").trim(); // Normalize whitespace

        return section;
    }

    /**
     * Agentic mode: Claude can use tools iteratively to research.
     * Delegates to the QuestionType-aware overload with INITIAL_STRATEGY (full tools).
     */
    public CompletableFuture<String> generateWithTools(String prompt, String systemMessage, boolean useDeepThinking, String sessionId) {
        return generateWithTools(prompt, systemMessage, useDeepThinking, sessionId, QuestionType.INITIAL_STRATEGY);
    }

    /**
     * Agentic mode with question-type-aware tool filtering.
     * Only provides tools relevant to the question type, reducing API rounds and cost.
     */
    public CompletableFuture<String> generateWithTools(String prompt, String systemMessage, boolean useDeepThinking, String sessionId, QuestionType questionType) {
        log.info("Starting agentic research with tools (session: {}, questionType: {})", sessionId, questionType);

        // Capture contexts from caller's thread before going async
        Long caseId = legalResearchTools.getCurrentCaseId();
        Long orgId = legalResearchTools.getCurrentOrgId();
        AuditContext auditCtx = captureAuditContext();

        // Redact PII before sending to external API
        String piiTypesTools = PiiDetector.detectPiiTypes(prompt);
        if (!piiTypesTools.isEmpty()) {
            log.warn("PII detected in agentic prompt before API call: {}", piiTypesTools);
        }
        String redactedPromptTools = PiiDetector.redact(prompt);

        List<ToolDefinition> toolDefs = legalResearchTools.getToolDefinitions(questionType);
        log.info("Tool definitions loaded: {} tools (filtered for {})", toolDefs.size(), questionType);

        AIRequest request = createRequest(redactedPromptTools, systemMessage, useDeepThinking);
        request.setTools(toolDefs);

        List<AIRequest.Message> messageHistory = new ArrayList<>();
        messageHistory.add(request.getMessages()[0]);

        return executeAgenticLoop(messageHistory, systemMessage, 0, sessionId, caseId, orgId, questionType).toFuture()
                .whenComplete((result, error) -> {
                    // Audit log the agentic research call (use redacted prompt to protect PII)
                    aiAuditLogService.logAiCall(
                            auditCtx.userId, auditCtx.userEmail, auditCtx.userRole,
                            auditCtx.organizationId, "AI_AGENTIC_RESEARCH", "AI_RESEARCH",
                            caseId, auditCtx.ipAddress, auditCtx.userAgent,
                            redactedPromptTools, result, error == null, error != null ? error.getMessage() : null);
                });
    }

    /**
     * Recursive tool-calling loop (backward-compatible, uses full tools)
     */
    private Mono<String> executeAgenticLoop(List<AIRequest.Message> messageHistory, String systemMessage, int iteration, String sessionId, Long caseId, Long orgId) {
        return executeAgenticLoop(messageHistory, systemMessage, iteration, sessionId, caseId, orgId, QuestionType.INITIAL_STRATEGY);
    }

    /**
     * Recursive tool-calling loop with question-type-aware tool filtering
     */
    private Mono<String> executeAgenticLoop(List<AIRequest.Message> messageHistory, String systemMessage, int iteration, String sessionId, Long caseId, Long orgId, QuestionType questionType) {
        final int MAX_ITERATIONS = 10;  // Complex queries may need 7-8 rounds (search + verify + follow-up + synthesize)

        if (iteration >= MAX_ITERATIONS) {
            log.warn("⚠️ MAX ITERATIONS REACHED ({}). Forcing final response with accumulated data.", MAX_ITERATIONS);
            // Extract whatever text Claude has generated so far from message history
            StringBuilder accumulated = new StringBuilder();
            for (AIRequest.Message msg : messageHistory) {
                if ("assistant".equals(msg.getRole()) && msg.getContent() != null) {
                    accumulated.append(msg.getContent()).append("\n\n");
                }
            }
            String result = accumulated.toString().trim();
            if (result.isEmpty()) {
                return Mono.just("Research reached the maximum analysis depth. Please try a more specific query for better results.");
            }
            return Mono.just(result);
        }

        log.info("🔄 Agentic iteration {}/{}", iteration + 1, MAX_ITERATIONS);

        AIRequest request = new AIRequest();
        request.setModel("claude-sonnet-4-6");
        request.setMax_tokens(4096); // Target 800-1200 words (~2K tokens), 4096 gives headroom

        if (systemMessage != null && !systemMessage.isEmpty()) {
            String currentDate = java.time.LocalDate.now().toString();
            request.setSystem("**CRITICAL: TODAY'S DATE IS " + currentDate + "**\n" +
                "Use this date for all deadline calculations.\n\n" + systemMessage);
        }

        List<ToolDefinition> tools = legalResearchTools.getToolDefinitions(questionType);
        log.info("🔧 Setting {} tools on request (questionType: {})", tools.size(), questionType);
        request.setTools(tools);

        request.setMessages(messageHistory.toArray(new AIRequest.Message[0]));
        log.info("📤 Sending request with {} messages, tools: {}",
            messageHistory.size(),
            request.getTools() != null ? request.getTools().size() + " tools" : "null");

        // Log request details for debugging
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            String requestJson = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(request);
            log.debug("📋 Request JSON:\n{}", requestJson);
        } catch (Exception e) {
            log.warn("Could not serialize request for logging: {}", e.getMessage());
        }

        String bedrockModelId = aiConfig.resolveBedrockModelId(request.getModel());

        // Use Mono.fromCallable to bridge Bedrock sync SDK into Reactor chain
        return reactor.core.publisher.Mono.<AIResponse>fromCallable(() -> {
                    String requestBody = buildBedrockRequestBody(request);
                    InvokeModelRequest invokeRequest = InvokeModelRequest.builder()
                            .modelId(bedrockModelId)
                            .contentType("application/json")
                            .accept("application/json")
                            .body(SdkBytes.fromUtf8String(requestBody))
                            .build();
                    InvokeModelResponse invokeResponse = bedrockClient.invokeModel(invokeRequest);
                    String responseJson = invokeResponse.body().asUtf8String();
                    com.fasterxml.jackson.databind.ObjectMapper mapper2 = new com.fasterxml.jackson.databind.ObjectMapper();
                    return mapper2.readValue(responseJson, AIResponse.class);
                })
                .subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic())
                .retryWhen(reactor.util.retry.Retry.backoff(2, java.time.Duration.ofSeconds(2))
                        .filter(throwable -> {
                            String msg = throwable.getMessage();
                            boolean shouldRetry = msg != null &&
                                (msg.contains("Connection") ||
                                 msg.contains("ThrottlingException") ||
                                 msg.contains("ServiceUnavailable"));
                            if (shouldRetry) {
                                log.warn("Bedrock error, will retry: {}", msg);
                            }
                            return shouldRetry;
                        })
                        .onRetryExhaustedThrow((retryBackoffSpec, retrySignal) -> {
                            log.error("Max retries exhausted for Bedrock error");
                            return new RuntimeException("Bedrock connection failed after retries: " + retrySignal.failure().getMessage());
                        }))
                .flatMap(response -> {
                    log.info("📡 Response stop reason: {}", response.getStopReason());

                    if (response.hasToolUse()) {
                        // Claude wants to use tools (could be multiple)
                        List<AIResponse.Content> toolUses = new ArrayList<>();
                        for (AIResponse.Content c : response.getContent()) {
                            if ("tool_use".equals(c.getType())) {
                                toolUses.add(c);
                            }
                        }

                        log.info("🔧 Claude requests {} tools", toolUses.size());

                        // Add assistant's tool use to history
                        // Convert response content to clean format for request
                        List<Map<String, Object>> assistantContent = new ArrayList<>();
                        for (AIResponse.Content c : response.getContent()) {
                            Map<String, Object> contentBlock = new java.util.HashMap<>();
                            contentBlock.put("type", c.getType());

                            if ("text".equals(c.getType())) {
                                contentBlock.put("text", c.getText());
                            } else if ("tool_use".equals(c.getType())) {
                                contentBlock.put("id", c.getId());
                                contentBlock.put("name", c.getName());
                                contentBlock.put("input", c.getInput());
                            }
                            assistantContent.add(contentBlock);
                        }

                        AIRequest.Message assistantMsg = new AIRequest.Message();
                        assistantMsg.setRole("assistant");
                        assistantMsg.setContent(assistantContent);
                        messageHistory.add(assistantMsg);

                        // Execute ALL tools in PARALLEL and collect results
                        log.info("🚀 Executing {} tools in parallel", toolUses.size());
                        long toolStartTime = System.currentTimeMillis();

                        List<CompletableFuture<Map<String, Object>>> toolFutures = new ArrayList<>();

                        for (AIResponse.Content toolUse : toolUses) {
                            log.info("  🔧 Queuing tool: {}", toolUse.getName());

                            // Publish progress to frontend
                            if (sessionId != null && !sessionId.isEmpty()) {
                                String progressMessage = getToolProgressMessage(toolUse.getName(), toolUse.getInput());
                                String icon = getToolIcon(toolUse.getName());
                                progressPublisher.publishStep(sessionId, "tool_execution", progressMessage, "", icon, (iteration + 1) * 15);
                            }

                            // Execute each tool asynchronously
                            CompletableFuture<Map<String, Object>> toolFuture = CompletableFuture.supplyAsync(() -> {
                                // Propagate research context to this worker thread
                                if (caseId != null && orgId != null) {
                                    legalResearchTools.setResearchContext(caseId, orgId);
                                }
                                Object toolResult;
                                try {
                                    toolResult = legalResearchTools.executeTool(
                                            toolUse.getName(),
                                            toolUse.getInput()
                                    );
                                    log.info("  ✅ Tool '{}' executed successfully", toolUse.getName());
                                } catch (Exception e) {
                                    log.error("  ❌ Tool '{}' execution failed: {}", toolUse.getName(), e.getMessage());
                                    toolResult = "Error: " + e.getMessage();
                                } finally {
                                    // Clean up ThreadLocal on worker thread
                                    legalResearchTools.clearResearchContext();
                                }

                                return Map.of(
                                    "type", "tool_result",
                                    "tool_use_id", toolUse.getId(),
                                    "content", toolResult.toString()
                                );
                            });

                            toolFutures.add(toolFuture);
                        }

                        // Wait for all tools to complete
                        CompletableFuture<Void> allTools = CompletableFuture.allOf(
                            toolFutures.toArray(new CompletableFuture[0])
                        );

                        List<Map<String, Object>> toolResults = new ArrayList<>();
                        try {
                            allTools.join(); // Wait for all to complete

                            // Collect results in order
                            for (CompletableFuture<Map<String, Object>> future : toolFutures) {
                                toolResults.add(future.get());
                            }

                            long toolDuration = System.currentTimeMillis() - toolStartTime;
                            log.info("⚡ All {} tools completed in {}ms (parallel execution)", toolUses.size(), toolDuration);

                        } catch (Exception e) {
                            log.error("❌ Error waiting for parallel tool execution: {}", e.getMessage());
                            // Fallback: collect whatever completed
                            for (CompletableFuture<Map<String, Object>> future : toolFutures) {
                                try {
                                    if (future.isDone()) {
                                        toolResults.add(future.get());
                                    }
                                } catch (Exception ignored) {}
                            }
                        }

                        // Add ALL tool results in one user message
                        AIRequest.Message toolResultMsg = new AIRequest.Message();
                        toolResultMsg.setRole("user");
                        toolResultMsg.setContent(toolResults);
                        messageHistory.add(toolResultMsg);

                        // Continue loop (pass caseId/orgId/questionType through for document access)
                        return executeAgenticLoop(messageHistory, systemMessage, iteration + 1, sessionId, caseId, orgId, questionType);

                    } else {
                        // Claude is done - return final answer
                        String finalText = extractTextFromResponse(response);
                        log.info("✨ Agentic research complete after {} iterations - Final response length: {} chars",
                                iteration + 1, finalText.length());
                        return Mono.just(finalText);
                    }
                })
                .onErrorResume(e -> {
                    log.error("💥 Agentic loop error: {}", e.getMessage(), e);
                    return Mono.just(sanitizeApiError(e.getMessage()));
                });
    }

    private AIRequest createRequest(String prompt, boolean useDeepThinking) {
        return createRequest(prompt, null, useDeepThinking, null, null);
    }

    private AIRequest createRequest(String prompt, String systemMessage, boolean useDeepThinking) {
        return createRequest(prompt, systemMessage, useDeepThinking, null, null);
    }

    private AIRequest createRequest(String prompt, String systemMessage, boolean useDeepThinking, Double temperature) {
        return createRequest(prompt, systemMessage, useDeepThinking, temperature, null);
    }

    /**
     * Create request with explicit model selection. Used by AIRequestRouter for smart model routing.
     * If model is null, defaults to Opus 4.5.
     */
    private AIRequest createRequest(String prompt, String systemMessage, boolean useDeepThinking, Double temperature, String model) {
        AIRequest request = new AIRequest();
        request.setModel(model != null ? model : "claude-opus-4-6");

        // Set temperature for deterministic responses when needed (e.g., classification)
        if (temperature != null) {
            request.setTemperature(temperature);
            log.info("🌡️ Using temperature={} for deterministic response", temperature);
        }

        // Smart token allocation based on query complexity
        int maxTokens;
        String lowerPrompt = prompt.toLowerCase();

        // Detect strategic document analysis - needs 12000 tokens for complete strategic response
        // Strategic prompts include comprehensive sections: executive summary, weaknesses, timeline,
        // evidence checklists, and strategic recommendations that require ~8000-12000 tokens
        boolean isStrategicDocumentAnalysis =
            prompt.contains("You are an expert legal strategist and document analyst") ||
            prompt.contains("ASSUME YOU ARE DEFENSE COUNSEL") ||
            prompt.contains("ASSUME YOU ARE BUSINESS COUNSEL") ||
            prompt.contains("ASSUME YOU ARE EMPLOYEE'S COUNSEL") ||
            prompt.contains("ASSUME YOU ARE COMPLIANCE COUNSEL") ||
            prompt.contains("ASSUME YOU ARE RESPONDING COUNSEL") ||
            prompt.contains("ASSUME YOU ARE OPPOSING COUNSEL") ||
            prompt.contains("ASSUME YOU ARE TENANT'S COUNSEL") ||
            lowerPrompt.contains("strategic document analysis");

        // Detect THOROUGH mode legal research - needs highest token limit for comprehensive analysis with citations
        boolean isThoroughModeResearch = prompt.contains("Expert legal research assistant") ||
                                         lowerPrompt.contains("**tool usage requirements** (citation verification mandatory)");

        // Detect draft generation - needs higher token limit for complete documents
        // Includes workflow-generated drafts (e.g., "Draft an ANSWER to the complaint")
        // Also includes demand letter generation which needs comprehensive output
        boolean isDraftGeneration = lowerPrompt.contains("generate a professional legal") ||
                                   lowerPrompt.contains("generate a complete, properly formatted legal document") ||
                                   lowerPrompt.contains("generate an answer") ||
                                   lowerPrompt.contains("generate a response") ||
                                   lowerPrompt.contains("generate a professional demand letter") ||
                                   lowerPrompt.contains("generate a demand letter") ||
                                   lowerPrompt.contains("draft a motion") ||
                                   lowerPrompt.contains("draft an answer") ||
                                   lowerPrompt.contains("draft a response") ||
                                   lowerPrompt.contains("draft a brief") ||
                                   lowerPrompt.contains("draft a complaint") ||
                                   lowerPrompt.contains("draft interrogatories") ||
                                   lowerPrompt.contains("draft discovery") ||
                                   lowerPrompt.contains("draft pleading") ||
                                   lowerPrompt.contains("draft a demand letter") ||
                                   lowerPrompt.contains("draft a legal document");

        // Detect workflow-specific generation/synthesis patterns that need high token allocation
        // These are typically complex outputs from case workflow steps (GENERATION, SYNTHESIS)
        boolean isWorkflowGeneration = lowerPrompt.contains("opposition brief") ||
                                       lowerPrompt.contains("due diligence report") ||
                                       lowerPrompt.contains("due diligence review") ||
                                       lowerPrompt.contains("contract redlines") ||
                                       lowerPrompt.contains("redline analysis") ||
                                       lowerPrompt.contains("evidence checklist") ||
                                       lowerPrompt.contains("risk matrix") ||
                                       lowerPrompt.contains("risk assessment") ||
                                       lowerPrompt.contains("legal research on") ||
                                       lowerPrompt.contains("case law research") ||
                                       lowerPrompt.contains("synthesize the following") ||
                                       lowerPrompt.contains("generate comprehensive") ||
                                       lowerPrompt.contains("create a detailed report") ||
                                       lowerPrompt.contains("create action items") ||
                                       lowerPrompt.contains("create timeline") ||
                                       lowerPrompt.contains("litigation strategy") ||
                                       lowerPrompt.contains("case assessment") ||
                                       lowerPrompt.contains("opposing party") ||
                                       lowerPrompt.contains("counterclaim") ||
                                       lowerPrompt.contains("affirmative defense");

        // Detect document transformation/revision - needs enough tokens to return full revised document
        boolean isDocumentTransformation = lowerPrompt.contains("you are an expert legal document editor") ||
                                           lowerPrompt.contains("complete revised document") ||
                                           lowerPrompt.contains("return the complete modified document");

        // Detect THOROUGH mode in draft generation
        boolean isThoroughModeDraft = isDraftGeneration &&
                                     (prompt.contains("**tool usage requirements** (citation verification mandatory)") ||
                                      lowerPrompt.contains("verified citations"));

        if (isStrategicDocumentAnalysis) {
            // Strategic document analysis: 12000 tokens for complete response
            // Prevents truncation of evidence checklists, timelines, strategic recommendations
            // Covers all document types: Complaints, Contracts, Leases, Employment, NDA, Discovery, etc.
            maxTokens = 12000;
            log.info("📄⚖️ Strategic document analysis detected - allocating {} tokens for comprehensive analysis", maxTokens);
        } else if (isThoroughModeResearch) {
            // THOROUGH mode: 12000 tokens for comprehensive analysis with verified citations
            maxTokens = 12000;
            log.info("🔍 THOROUGH mode research detected - allocating {} tokens for comprehensive citation-verified analysis", maxTokens);
        } else if (isThoroughModeDraft) {
            // THOROUGH mode drafts: 24000 tokens for complete documents with verified citations
            maxTokens = 24000;
            log.info("📄🔍 THOROUGH mode draft detected - allocating {} tokens for complete document with verified citations", maxTokens);
        } else if (isDraftGeneration) {
            // Legal documents need 16000-20000 tokens to avoid incomplete lists/sections
            // Increased from 8000-10000 to prevent mid-list truncation
            maxTokens = lowerPrompt.contains("comprehensive") || lowerPrompt.contains("detailed") ? 20000 : 16000;
            log.info("📄 Draft generation detected - allocating {} tokens for complete document", maxTokens);
        } else if (isWorkflowGeneration) {
            // Workflow synthesis/generation steps need 16000-20000 tokens for complete outputs
            // Prevents truncation of opposition briefs, due diligence reports, risk matrices, etc.
            maxTokens = lowerPrompt.contains("comprehensive") || lowerPrompt.contains("detailed") ||
                       lowerPrompt.contains("complete") || lowerPrompt.contains("thorough") ? 20000 : 16000;
            log.info("⚙️ Workflow generation/synthesis detected - allocating {} tokens for complete output", maxTokens);
        } else if (isDocumentTransformation) {
            // Allocate based on transformation type — REDRAFT and EXPAND need more tokens
            if (lowerPrompt.contains("completely redraft") || lowerPrompt.contains("fresh approach")) {
                maxTokens = 24000;
            } else if (lowerPrompt.contains("expand") || lowerPrompt.contains("elaborate") || lowerPrompt.contains("add detail")) {
                maxTokens = 20000;
            } else if (lowerPrompt.contains("strengthen") || lowerPrompt.contains("counter-argument") || lowerPrompt.contains("rebuttal")) {
                maxTokens = 20000;
            } else {
                maxTokens = 16000;
            }
            log.info("✏️ Document transformation detected - allocating {} tokens for revised document", maxTokens);
        } else if (useDeepThinking) {
            // Detect if query needs extra-long response
            boolean isComplexQuery = lowerPrompt.contains("comprehensive analysis") ||
                                   lowerPrompt.contains("detailed explanation") ||
                                   lowerPrompt.contains("thorough review") ||
                                   lowerPrompt.contains("step-by-step") ||
                                   lowerPrompt.contains("in-depth") ||
                                   (lowerPrompt.contains("explain") && lowerPrompt.contains("detail"));

            // Complex: 5000, Standard: 4000 (reduced to encourage conciseness while meeting counsel-ready standards)
            maxTokens = isComplexQuery ? 5000 : 4000;
        } else {
            // FAST mode: 4000 max (covers 95th percentile)
            maxTokens = 4000;
        }

        request.setMax_tokens(maxTokens);

        // Set system message if provided (high-priority instructions)
        if (systemMessage != null && !systemMessage.isEmpty()) {
            String currentDate = java.time.LocalDate.now().toString();
            String dateAwareSystemMessage = "**CRITICAL: TODAY'S DATE IS " + currentDate + "**\n" +
                    "Use this date for all deadline calculations and time-sensitive analysis.\n\n" +
                    systemMessage;
            request.setSystem(dateAwareSystemMessage);
        }

        // User message contains the actual query and context
        String userPrompt = prompt;
        // If no system message, include date in user message (backwards compatibility)
        if (systemMessage == null || systemMessage.isEmpty()) {
            String currentDate = java.time.LocalDate.now().toString();
            userPrompt = "**CRITICAL: TODAY'S DATE IS " + currentDate + "**\n" +
                    "Use this date for all deadline calculations and time-sensitive analysis.\n\n" +
                    prompt;
        }

        AIRequest.Message message = new AIRequest.Message();
        message.setRole("user");
        message.setContent(userPrompt);

        request.setMessages(new AIRequest.Message[]{message});
        return request;
    }

    /**
     * Convert AIRequest to Bedrock-compatible JSON body.
     * Bedrock requires `anthropic_version` in the body, and the model ID is passed separately.
     */
    private String buildBedrockRequestBody(AIRequest request) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            mapper.setSerializationInclusion(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL);

            // Serialize the AIRequest to a JsonNode, then modify for Bedrock format
            com.fasterxml.jackson.databind.node.ObjectNode body = mapper.valueToTree(request);

            // Add Bedrock-required field
            body.put("anthropic_version", "bedrock-2023-05-31");

            // Remove fields that Bedrock doesn't expect in the body
            body.remove("model");   // Model ID is in the InvokeModel request params
            body.remove("stream");  // Streaming is controlled by the SDK method

            return mapper.writeValueAsString(body);
        } catch (Exception e) {
            throw new RuntimeException("Failed to build Bedrock request body", e);
        }
    }

    private String extractTextFromResponse(AIResponse response) {
        if (response.getContent() != null && response.getContent().length > 0) {
            return response.getContent()[0].getText();
        }
        return "No response generated";
    }

    /**
     * Sanitize raw API error messages into user-friendly text.
     * Prefixed with "[ERROR]" so downstream code can detect it's an error, not a real response.
     */
    private String sanitizeApiError(String rawMessage) {
        if (rawMessage == null) {
            return "[ERROR] An unexpected error occurred while processing your request. Please try again.";
        }
        String lower = rawMessage.toLowerCase();
        if (lower.contains("overloaded") || lower.contains("529")) {
            return "[ERROR] Our AI research service is temporarily at capacity due to high demand. Please try again in a moment.";
        }
        if (lower.contains("rate_limit") || lower.contains("429")) {
            return "[ERROR] Too many requests — please wait a moment before trying again.";
        }
        if (lower.contains("invalid_api_key") || lower.contains("authentication")) {
            return "[ERROR] A configuration issue occurred. Please contact support.";
        }
        if (lower.contains("timeout") || lower.contains("timed out")) {
            return "[ERROR] The research request took too long to complete. Please try a simpler question or try again.";
        }
        // Generic fallback — don't leak raw API error JSON
        return "[ERROR] An error occurred during legal research. Please try again.";
    }

    /**
     * Generate user-friendly progress message for tool execution
     */
    private String getToolProgressMessage(String toolName, Map<String, Object> input) {
        return switch (toolName) {
            case "get_current_date" -> "Verifying current date for temporal analysis";
            case "check_deadline_status" -> {
                String eventName = (String) input.get("event_name");
                yield "Checking deadline status: " + (eventName != null ? eventName : "event");
            }
            case "validate_case_timeline" -> "Validating case timeline and deadlines";
            case "search_case_law" -> {
                String query = (String) input.get("query");
                if (query != null && query.length() > 50) {
                    query = query.substring(0, 47) + "...";
                }
                yield "Searching case law: " + (query != null ? query : "relevant precedents");
            }
            case "get_cfr_text" -> {
                String title = (String) input.get("title");
                String part = (String) input.get("part");
                String section = (String) input.get("section");
                yield "Retrieving CFR " + title + " § " + part + "." + section;
            }
            case "verify_citation" -> {
                String citation = (String) input.get("citation");
                yield "Verifying citation: " + (citation != null ? citation : "case");
            }
            case "web_search" -> {
                String query = (String) input.get("query");
                if (query != null && query.length() > 50) {
                    query = query.substring(0, 47) + "...";
                }
                yield "Searching web for real-time information: " + (query != null ? query : "legal resources");
            }
            default -> "Executing tool: " + toolName;
        };
    }

    /**
     * Get icon for tool execution
     */
    private String getToolIcon(String toolName) {
        return switch (toolName) {
            case "get_current_date" -> "ri-calendar-check-line";
            case "check_deadline_status", "validate_case_timeline" -> "ri-timer-line";
            case "search_case_law" -> "ri-search-line";
            case "get_cfr_text" -> "ri-book-line";
            case "verify_citation" -> "ri-checkbox-circle-line";
            case "web_search" -> "ri-global-line";
            default -> "ri-tools-line";
        };
    }

    // ===== STREAMING API =====

    /**
     * Generate completion via Bedrock streaming API.
     * Tokens are relayed to tokenConsumer as they arrive.
     * onComplete fires when the stream ends successfully.
     * onError fires on any failure.
     */
    public void generateCompletionStreaming(
            String prompt,
            String systemMessage,
            Long sessionId,
            java.util.function.Consumer<String> tokenConsumer,
            Runnable onComplete,
            java.util.function.Consumer<Throwable> onError
    ) {
        generateCompletionStreamingWithModel(prompt, systemMessage, sessionId, tokenConsumer, onComplete, onError, null);
    }

    /**
     * Streaming completion with explicit model selection. Used by AIRequestRouter.
     * If model is null, defaults to Opus.
     */
    public void generateCompletionStreamingWithModel(
            String prompt,
            String systemMessage,
            Long sessionId,
            java.util.function.Consumer<String> tokenConsumer,
            Runnable onComplete,
            java.util.function.Consumer<Throwable> onError,
            String model
    ) {
        // Check cancellation before starting
        if (sessionId != null && cancellationService.isCancelled(sessionId)) {
            log.warn("Streaming generation cancelled before API call for session {}", sessionId);
            cancellationService.clearCancellation(sessionId);
            onError.accept(new IllegalStateException("AI generation cancelled by user"));
            return;
        }

        // PII redaction
        String piiTypes = PiiDetector.detectPiiTypes(prompt);
        if (!piiTypes.isEmpty()) {
            log.warn("PII detected in streaming prompt: {}", piiTypes);
        }
        String redactedPrompt = PiiDetector.redact(prompt);
        String redactedSystemMessage = PiiDetector.redact(systemMessage);

        // Build request (no stream flag needed — Bedrock handles streaming via the method)
        AIRequest request = createRequest(redactedPrompt, redactedSystemMessage, false, null, model);

        String bedrockModelId = aiConfig.resolveBedrockModelId(request.getModel());
        AuditContext auditCtx = captureAuditContext();

        log.info("Starting streaming request: model={}, maxTokens={}, sessionId={}",
                bedrockModelId, request.getMax_tokens(), sessionId);

        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();

        try {
            String requestBody = buildBedrockRequestBody(request);

            InvokeModelWithResponseStreamRequest streamRequest = InvokeModelWithResponseStreamRequest.builder()
                    .modelId(bedrockModelId)
                    .contentType("application/json")
                    .body(SdkBytes.fromUtf8String(requestBody))
                    .build();

            var responseHandler = InvokeModelWithResponseStreamResponseHandler.builder()
                    .subscriber(InvokeModelWithResponseStreamResponseHandler.Visitor.builder()
                            .onChunk(chunk -> {
                                // Check cancellation mid-stream
                                if (sessionId != null && cancellationService.isCancelled(sessionId)) {
                                    throw new RuntimeException("AI generation cancelled by user");
                                }

                                String data = chunk.bytes().asUtf8String();
                                if (data == null || data.isEmpty()) return;

                                try {
                                    com.fasterxml.jackson.databind.JsonNode node = mapper.readTree(data);
                                    String type = node.has("type") ? node.get("type").asText() : "";

                                    if ("content_block_delta".equals(type)) {
                                        com.fasterxml.jackson.databind.JsonNode delta = node.get("delta");
                                        if (delta != null && delta.has("text")) {
                                            String text = delta.get("text").asText();
                                            tokenConsumer.accept(text);
                                        }
                                    }
                                } catch (Exception e) {
                                    log.trace("Skipping non-parseable stream chunk: {}", data);
                                }
                            })
                            .build())
                    .onComplete(() -> {
                        log.info("Streaming completed for session {}", sessionId);
                        if (sessionId != null) {
                            cancellationService.clearCancellation(sessionId);
                        }
                        aiAuditLogService.logAiCall(
                                auditCtx.userId, auditCtx.userEmail, auditCtx.userRole,
                                auditCtx.organizationId, "AI_COMPLETION_STREAM", "AI_QUERY",
                                sessionId, auditCtx.ipAddress, auditCtx.userAgent,
                                redactedPrompt, "(streamed)", true, null);
                        onComplete.run();
                    })
                    .onError(error -> {
                        log.error("Streaming failed for session {}: {}", sessionId, error.getMessage());
                        if (sessionId != null) {
                            cancellationService.clearCancellation(sessionId);
                        }
                        aiAuditLogService.logAiCall(
                                auditCtx.userId, auditCtx.userEmail, auditCtx.userRole,
                                auditCtx.organizationId, "AI_COMPLETION_STREAM", "AI_QUERY",
                                sessionId, auditCtx.ipAddress, auditCtx.userAgent,
                                redactedPrompt, null, false, error.getMessage());
                        onError.accept(error);
                    })
                    .build();

            // Fire async — the callbacks handle completion/error
            bedrockAsyncClient.invokeModelWithResponseStream(streamRequest, responseHandler);

        } catch (Exception e) {
            log.error("Failed to start streaming for session {}: {}", sessionId, e.getMessage());
            onError.accept(e);
        }
    }

    // ===== AUDIT LOGGING HELPERS =====

    /**
     * Simple record to hold user context captured from the request thread.
     * Must be captured BEFORE going async, since ThreadLocals are not available in async threads.
     */
    private record AuditContext(Long userId, String userEmail, String userRole,
                                Long organizationId, String ipAddress, String userAgent) {}

    private AuditContext captureAuditContext() {
        Long userId = null;
        String userEmail = "unknown";
        String userRole = "unknown";
        Long organizationId = TenantContext.getCurrentTenant();
        String ipAddress = "";
        String userAgent = "";

        try {
            Optional<UserDTO> user = tenantService.getCurrentUserDTO();
            if (user.isPresent()) {
                userId = user.get().getId();
                userEmail = user.get().getEmail();
                userRole = user.get().getRoleName();
            }
        } catch (Exception e) {
            log.debug("Could not capture user context for audit: {}", e.getMessage());
        }

        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest request = attrs.getRequest();
                String xff = request.getHeader("X-Forwarded-For");
                ipAddress = (xff != null && !xff.isEmpty()) ? xff.split(",")[0].trim() : request.getRemoteAddr();
                userAgent = request.getHeader("User-Agent");
            }
        } catch (Exception e) {
            log.debug("Could not capture request context for audit: {}", e.getMessage());
        }

        return new AuditContext(userId, userEmail, userRole, organizationId, ipAddress, userAgent != null ? userAgent : "");
    }
}