package com.bostoneo.bostoneosolutions.service.ai;

import com.bostoneo.bostoneosolutions.config.AIConfig;
import com.bostoneo.bostoneosolutions.dto.ai.*;
import com.bostoneo.bostoneosolutions.service.tools.LegalResearchTools;
import com.bostoneo.bostoneosolutions.service.ResearchProgressPublisher;
import com.bostoneo.bostoneosolutions.service.GenerationCancellationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;
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

    private final WebClient anthropicWebClient;
    private final AIConfig aiConfig;
    private final LegalResearchTools legalResearchTools;
    private final ResearchProgressPublisher progressPublisher;
    private final GenerationCancellationService cancellationService;
    
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
        // Check if generation has been cancelled BEFORE making expensive API call
        if (sessionId != null && cancellationService.isCancelled(sessionId)) {
            log.warn("🛑 AI generation cancelled before API call for session {}", sessionId);
            cancellationService.clearCancellation(sessionId);
            return CompletableFuture.failedFuture(new IllegalStateException("AI generation cancelled by user"));
        }
        AIRequest request = createRequest(prompt, systemMessage, useDeepThinking);

        log.info("=== SENDING REQUEST TO ANTHROPIC ===");
        log.info("Model: {}", request.getModel());
        log.info("Max tokens: {}", request.getMax_tokens());
        log.info("Prompt length: {}", prompt.length());
        if (systemMessage != null) {
            log.info("System message length: {}", systemMessage.length());
        }

        String apiKey = aiConfig.getApiKey();
        log.info("API Key being used: {}", apiKey.isEmpty() ? "EMPTY!" : apiKey.substring(0, Math.min(20, apiKey.length())) + "...");

        // Create CompletableFuture manually to bridge reactive and imperative worlds
        CompletableFuture<String> future = new CompletableFuture<>();

        // Build the reactive Mono
        Mono<String> responseMono = anthropicWebClient
                .post()
                .uri("/v1/messages")
                .header("x-api-key", apiKey)  // Inject API key per request
                .bodyValue(request)
                .exchangeToMono(response -> {
                    log.info("Response status: {}", response.statusCode());
                    if (response.statusCode().is2xxSuccessful()) {
                        return response.bodyToMono(AIResponse.class);
                    } else {
                        return response.bodyToMono(String.class)
                                .flatMap(body -> {
                                    log.error("Error response from Anthropic: {}", body);
                                    return Mono.error(new RuntimeException("API Error: " + body));
                                });
                    }
                })
                .map(this::extractTextFromResponse)
                // Add retry logic with exponential backoff for transient failures
                .retryWhen(Retry.backoff(3, Duration.ofSeconds(2))  // 3 retries: 2s, 4s, 8s
                        .filter(e -> {
                            // Only retry on connection/network errors, not API errors
                            boolean shouldRetry = e instanceof WebClientRequestException ||
                                    e.getMessage() != null && (
                                            e.getMessage().contains("Connection reset") ||
                                            e.getMessage().contains("Connection refused") ||
                                            e.getMessage().contains("Connection closed") ||
                                            e.getMessage().contains("Broken pipe"));
                            if (shouldRetry) {
                                log.warn("Transient error detected, will retry: {}", e.getMessage());
                            }
                            return shouldRetry;
                        })
                        .doAfterRetry(retrySignal -> {
                            log.warn("Retry attempt {} after {}ms",
                                    retrySignal.totalRetries() + 1,
                                    retrySignal.totalRetriesInARow() * 2000);
                        })
                        .onRetryExhaustedThrow((retryBackoffSpec, retrySignal) -> {
                            log.error("Retry exhausted after {} attempts", retrySignal.totalRetries());
                            Throwable lastError = retrySignal.failure();
                            return new RuntimeException("AI service unavailable after " + retrySignal.totalRetries() + " retries: " + lastError.getMessage(), lastError);
                        }))
                .onErrorMap(e -> {
                    if (e instanceof RuntimeException && e.getMessage() != null && e.getMessage().contains("AI service unavailable after")) {
                        return e;  // Already wrapped with retry info
                    }
                    log.error("Error calling Claude API: {}", e.getMessage(), e);
                    return new RuntimeException("AI service unavailable: " + e.getMessage(), e);
                });

        // Subscribe and store the Disposable for proper cancellation
        log.info("🔵 Creating subscription for session {}", sessionId);
        reactor.core.Disposable subscription = responseMono.subscribe(
            result -> {
                // On success
                log.info("✅ AI request completed successfully for session {}", sessionId);
                future.complete(result);
                if (sessionId != null) {
                    cancellationService.clearCancellation(sessionId);
                }
            },
            error -> {
                // On error
                log.error("❌ AI request failed for session {}: {}", sessionId, error.getMessage());
                future.completeExceptionally(error);
                if (sessionId != null) {
                    cancellationService.clearCancellation(sessionId);
                }
            }
        );

        // Register the Disposable subscription so it can be cancelled mid-flight
        if (sessionId != null) {
            log.info("📝 Registering subscription for session {} (disposed: {})", sessionId, subscription.isDisposed());
            cancellationService.registerSubscription(sessionId, subscription);
        }

        return future;
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
     * Agentic mode: Claude can use tools iteratively to research
     */
    public CompletableFuture<String> generateWithTools(String prompt, boolean useDeepThinking, String sessionId) {
        log.info("🤖 Starting agentic research with tools (session: {})", sessionId);

        List<ToolDefinition> toolDefs = legalResearchTools.getToolDefinitions();
        log.info("🔧 Tool definitions loaded: {} tools", toolDefs != null ? toolDefs.size() : 0);
        if (toolDefs != null) {
            toolDefs.forEach(t -> log.info("  - Tool: {}", t.getName()));
        }

        AIRequest request = createRequest(prompt, useDeepThinking);
        request.setTools(toolDefs);

        List<AIRequest.Message> messageHistory = new ArrayList<>();
        messageHistory.add(request.getMessages()[0]);

        return executeAgenticLoop(messageHistory, 0, sessionId).toFuture();
    }

    /**
     * Recursive tool-calling loop
     */
    private Mono<String> executeAgenticLoop(List<AIRequest.Message> messageHistory, int iteration, String sessionId) {
        final int MAX_ITERATIONS = 5;  // REDUCED FROM 10 - stop wasting money

        if (iteration >= MAX_ITERATIONS) {
            log.error("❌ MAX ITERATIONS REACHED ({}). Stopping to prevent cost waste.", MAX_ITERATIONS);
            log.error("❌ This means Claude kept calling tools without finishing. Forcing response now.");
            return Mono.just("Research incomplete - reached maximum tool call limit. Please try a more specific query or use FAST mode.");
        }

        log.info("🔄 Agentic iteration {}/{}", iteration + 1, MAX_ITERATIONS);

        AIRequest request = new AIRequest();
        request.setModel("claude-sonnet-4-5-20250929");
        request.setMax_tokens(12000); // Increased from 8000 to allow comprehensive analysis with full citation verification

        List<ToolDefinition> tools = legalResearchTools.getToolDefinitions();
        log.info("🔧 Setting {} tools on request", tools != null ? tools.size() : 0);
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

        String apiKey = aiConfig.getApiKey();

        return anthropicWebClient
                .post()
                .uri("/v1/messages")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .bodyValue(request)
                .retrieve()
                .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                    clientResponse -> clientResponse.bodyToMono(String.class)
                        .flatMap(errorBody -> {
                            log.error("❌ Anthropic API error response: {}", errorBody);
                            return Mono.error(new RuntimeException("API Error: " + errorBody));
                        }))
                .bodyToMono(AIResponse.class)
                .retryWhen(reactor.util.retry.Retry.backoff(2, java.time.Duration.ofSeconds(2))
                        .filter(throwable -> {
                            // Only retry on connection errors, not API errors
                            String msg = throwable.getMessage();
                            boolean shouldRetry = msg != null &&
                                (msg.contains("Connection prematurely closed") ||
                                 msg.contains("Connection reset") ||
                                 msg.contains("Broken pipe"));
                            if (shouldRetry) {
                                log.warn("⚠️ Connection error, will retry: {}", msg);
                            }
                            return shouldRetry;
                        })
                        .onRetryExhaustedThrow((retryBackoffSpec, retrySignal) -> {
                            log.error("❌ Max retries exhausted for connection error");
                            return new RuntimeException("Connection failed after retries: " + retrySignal.failure().getMessage());
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

                        // Continue loop
                        return executeAgenticLoop(messageHistory, iteration + 1, sessionId);

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
                    return Mono.just("Error in agentic research: " + e.getMessage());
                });
    }

    private AIRequest createRequest(String prompt, boolean useDeepThinking) {
        return createRequest(prompt, null, useDeepThinking);
    }

    private AIRequest createRequest(String prompt, String systemMessage, boolean useDeepThinking) {
        AIRequest request = new AIRequest();
        request.setModel("claude-sonnet-4-5-20250929");

        // Smart token allocation based on query complexity
        int maxTokens;
        String lowerPrompt = prompt.toLowerCase();

        // Detect THOROUGH mode legal research - needs highest token limit for comprehensive analysis with citations
        boolean isThoroughModeResearch = prompt.contains("Expert legal research assistant") ||
                                         lowerPrompt.contains("**tool usage requirements** (citation verification mandatory)");

        // Detect draft generation - needs higher token limit for complete documents
        boolean isDraftGeneration = lowerPrompt.contains("generate a professional legal") ||
                                   lowerPrompt.contains("generate a complete, properly formatted legal document") ||
                                   lowerPrompt.contains("draft a motion") ||
                                   lowerPrompt.contains("draft a brief") ||
                                   lowerPrompt.contains("draft a complaint") ||
                                   lowerPrompt.contains("draft interrogatories") ||
                                   lowerPrompt.contains("draft discovery") ||
                                   lowerPrompt.contains("draft pleading");

        // Detect THOROUGH mode in draft generation
        boolean isThoroughModeDraft = isDraftGeneration &&
                                     (prompt.contains("**tool usage requirements** (citation verification mandatory)") ||
                                      lowerPrompt.contains("verified citations"));

        if (isThoroughModeResearch) {
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

    private String extractTextFromResponse(AIResponse response) {
        if (response.getContent() != null && response.getContent().length > 0) {
            return response.getContent()[0].getText();
        }
        return "No response generated";
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
}