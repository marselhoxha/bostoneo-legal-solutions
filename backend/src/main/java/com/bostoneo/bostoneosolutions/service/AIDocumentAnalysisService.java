package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AIDocumentAnalysis;
import com.bostoneo.bostoneosolutions.repository.AIDocumentAnalysisRepository;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
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

    public CompletableFuture<AIDocumentAnalysis> analyzeDocument(
            MultipartFile file,
            String analysisType,
            Long userId,
            Long caseId) {

        String analysisId = UUID.randomUUID().toString();
        long startTime = System.currentTimeMillis();

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
            String content = extractTextFromFile(file);
            savedAnalysis.setDocumentContent(content.substring(0, Math.min(content.length(), 5000))); // Store first 5000 chars

            String prompt = buildAnalysisPrompt(content, analysisType, file.getOriginalFilename());

            return claudeService.generateCompletion(prompt, true)
                    .thenApply(response -> {
                        long processingTime = System.currentTimeMillis() - startTime;

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

                        return repository.save(savedAnalysis);
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
        // For text files, read directly
        if (file.getContentType() != null &&
            (file.getContentType().equals("text/plain") ||
             file.getContentType().startsWith("text/"))) {
            return new String(file.getBytes(), StandardCharsets.UTF_8);
        }

        // TODO: Add Apache Tika for PDF and Word document extraction
        // For now, return placeholder for non-text files
        return String.format("""
            [Document Content Placeholder]
            File: %s
            Type: %s
            Size: %d bytes

            Note: Full text extraction for PDF/Word documents will be implemented with Apache Tika.
            """, file.getOriginalFilename(), file.getContentType(), file.getSize());
    }

    private String buildAnalysisPrompt(String content, String analysisType, String fileName) {
        String basePrompt = String.format("""
            You are an expert legal document analyst specializing in Massachusetts law.
            Analyze the following document comprehensively and provide structured insights.

            Document: %s
            Analysis Type: %s

            Document Content:
            %s
            """, fileName, analysisType, content);

        switch (analysisType.toLowerCase()) {
            case "contract":
                return basePrompt + getContractAnalysisPrompt();
            case "legal-brief":
                return basePrompt + getLegalBriefAnalysisPrompt();
            case "compliance":
                return basePrompt + getComplianceAnalysisPrompt();
            case "due-diligence":
                return basePrompt + getDueDiligencePrompt();
            case "risk-assessment":
                return basePrompt + getRiskAssessmentPrompt();
            default:
                return basePrompt + getGeneralAnalysisPrompt();
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

    private String getLegalBriefAnalysisPrompt() {
        return """

            Analyze this legal brief comprehensively:

            1. CASE OVERVIEW
               - Parties and their positions
               - Jurisdiction and court
               - Procedural posture

            2. LEGAL ARGUMENTS
               - Main arguments presented
               - Supporting authorities
               - Strength of each argument
               - Weaknesses and gaps

            3. LEGAL RESEARCH QUALITY
               - Case law citations accuracy
               - Statutory references
               - Secondary sources utilization
               - Missing authorities

            4. WRITING EFFECTIVENESS
               - Clarity and organization
               - Persuasiveness
               - Technical accuracy
               - Compliance with court rules

            5. STRATEGIC ASSESSMENT
               - Overall strengths
               - Vulnerabilities
               - Counter-arguments to anticipate
               - Recommendations for improvement
            """;
    }

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

    private Map<String, Object> parseAnalysisResponse(String response, String analysisType) {
        Map<String, Object> parsed = new HashMap<>();

        // Extract summary
        String summary = extractSection(response, "SUMMARY", "OVERVIEW");
        parsed.put("summary", summary != null ? summary : response.substring(0, Math.min(500, response.length())));

        // Calculate risk score
        int riskScore = calculateRiskScore(response);
        parsed.put("riskScore", riskScore);
        parsed.put("riskLevel", getRiskLevel(riskScore));

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

    private int calculateRiskScore(String analysis) {
        int score = 50; // Base score

        String lowerAnalysis = analysis.toLowerCase();

        // High risk indicators
        if (lowerAnalysis.contains("high risk") || lowerAnalysis.contains("critical")) score += 30;
        if (lowerAnalysis.contains("non-compliant") || lowerAnalysis.contains("violation")) score += 25;
        if (lowerAnalysis.contains("immediate action") || lowerAnalysis.contains("urgent")) score += 20;
        if (lowerAnalysis.contains("liability") || lowerAnalysis.contains("exposure")) score += 15;

        // Low risk indicators
        if (lowerAnalysis.contains("low risk") || lowerAnalysis.contains("minimal risk")) score -= 25;
        if (lowerAnalysis.contains("compliant") || lowerAnalysis.contains("satisfactory")) score -= 20;
        if (lowerAnalysis.contains("standard") || lowerAnalysis.contains("typical")) score -= 15;
        if (lowerAnalysis.contains("well-drafted") || lowerAnalysis.contains("comprehensive")) score -= 10;

        return Math.max(0, Math.min(100, score));
    }

    private String getRiskLevel(int score) {
        if (score >= 70) return "High";
        if (score >= 40) return "Medium";
        return "Low";
    }
}