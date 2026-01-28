package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AIDocumentAnalysis;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.AIDocumentAnalysisRepository;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.apache.tika.exception.TikaException;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.ocr.TesseractOCRConfig;
import org.apache.tika.parser.pdf.PDFParserConfig;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.xml.sax.SAXException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
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
    private final AnalysisTextParser analysisTextParser;
    private final TenantService tenantService;
    private final Tika tika = new Tika();

    /**
     * Helper method to get the current organization ID (optional, for setting on new entities)
     */
    private Long getOptionalOrganizationId() {
        return tenantService.getCurrentOrganizationId().orElse(null);
    }

    /**
     * Helper method to get the current organization ID (required for queries)
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Value("${app.documents.output-path:uploads/documents}")
    private String documentsOutputPath;

    public CompletableFuture<AIDocumentAnalysis> analyzeDocument(
            MultipartFile file,
            String analysisType,
            Long userId,
            Long caseId,
            Long sessionId,
            String analysisContext) {

        String analysisId = UUID.randomUUID().toString();
        long startTime = System.currentTimeMillis();

        // Default to 'general' if analysisContext is null or empty
        String effectiveContext = (analysisContext == null || analysisContext.isEmpty()) ? "general" : analysisContext;

        log.info("Starting document analysis: analysisId={}, fileName={}, context={}, sessionId={}",
                analysisId, file.getOriginalFilename(), effectiveContext, sessionId);

        // Save uploaded file to disk
        String savedFileName = null;
        try {
            savedFileName = saveFileToDisk(file);
            log.info("File saved to disk: {}", savedFileName);
        } catch (IOException e) {
            log.error("Failed to save file to disk: {}", e.getMessage());
            // Continue with analysis even if file save fails
        }

        // Create initial analysis record
        AIDocumentAnalysis analysis = new AIDocumentAnalysis();
        analysis.setAnalysisId(analysisId);
        analysis.setFileName(savedFileName != null ? savedFileName : file.getOriginalFilename());
        analysis.setFileType(file.getContentType());
        analysis.setFileSize(file.getSize());
        analysis.setAnalysisType(analysisType);
        analysis.setAnalysisContext(effectiveContext);  // Store user's analysis goal
        analysis.setUserId(userId);
        analysis.setOrganizationId(getOptionalOrganizationId()); // SECURITY: Set organization ID for tenant isolation
        analysis.setCaseId(caseId);
        analysis.setStatus("processing");
        analysis.setIsArchived(false);

        // Save initial record
        analysis = repository.save(analysis);
        AIDocumentAnalysis savedAnalysis = analysis;

        try {
            // Extract text using Tika
            String content = extractTextFromFile(file);
            // Store full document content for semantic search (up to 500KB)
            savedAnalysis.setDocumentContent(content.substring(0, Math.min(content.length(), 500000)));

            // Detect document type AND extract parties using AI (single cheap call)
            DocumentClassification classification = classifyDocumentAndExtractParties(content, file.getOriginalFilename());
            savedAnalysis.setDetectedType(classification.documentType);
            log.info("AI classified document as: {}, parties: {} vs {}",
                     classification.documentType, classification.plaintiff, classification.defendant);

            // Extract metadata and merge with AI-extracted parties
            String extractedMetadata = metadataExtractor.extractMetadata(content, file.getOriginalFilename());
            // Merge AI-extracted parties into metadata JSON
            extractedMetadata = mergePartiesToMetadata(extractedMetadata, classification);
            savedAnalysis.setExtractedMetadata(extractedMetadata);

            // Check if OCR is needed
            boolean requiresOcr = metadataExtractor.requiresOCR(content, file.getSize());
            savedAnalysis.setRequiresOcr(requiresOcr);

            // Use detected type for strategic analysis with context awareness
            String prompt = buildAnalysisPrompt(content, classification.documentType, file.getOriginalFilename(), effectiveContext);

            // Pass sessionId to enable cancellation support (like LegalResearchConversationService)
            return claudeService.generateCompletion(prompt, null, true, sessionId)
                    .thenApply(response -> {
                        long processingTime = System.currentTimeMillis() - startTime;

                        // Estimate token usage for monitoring (rough: 1 token ≈ 4 characters)
                        int estimatedResponseTokens = response.length() / 4;
                        int estimatedPromptTokens = (content.length() + prompt.length()) / 4;
                        log.info("✅ Document analysis complete: type={}, responseTokens≈{}, promptTokens≈{}, time={}ms, file={}",
                                classification.documentType, estimatedResponseTokens, estimatedPromptTokens, processingTime, file.getOriginalFilename());

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

                        // Extract action items and timeline events using hybrid parsing
                        // (tries JSON first, then regex patterns)
                        // Skip for contract-type documents - they don't have actionItems/timelineEvents
                        if (!isContractType(classification.documentType)) {
                            try {
                                analysisTextParser.parseAndSaveStructuredData(finalAnalysis.getId(), response);
                            } catch (Exception e) {
                                log.warn("Failed to extract structured data from analysis {}: {}",
                                         finalAnalysis.getId(), e.getMessage());
                            }
                        } else {
                            log.info("Skipping structured data extraction for contract-type document: {}", classification.documentType);
                        }

                        // Strip JSON block from stored analysis for cleaner display
                        String cleanedAnalysis = stripJsonBlock(response);
                        if (!cleanedAnalysis.equals(response)) {
                            finalAnalysis.setAnalysisResult(cleanedAnalysis);
                            finalAnalysis = repository.save(finalAnalysis);
                            log.info("Stripped JSON block from analysis {} ({}->{}chars)",
                                     finalAnalysis.getId(), response.length(), cleanedAnalysis.length());
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
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return repository.findByOrganizationIdAndUserIdOrderByCreatedAtDesc(orgId, userId);
    }

    public List<AIDocumentAnalysis> getAnalysesByCaseId(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return repository.findByOrganizationIdAndCaseIdOrderByCreatedAtDesc(orgId, caseId);
    }

    public Optional<AIDocumentAnalysis> getAnalysisById(String analysisId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return repository.findByAnalysisIdAndOrganizationId(analysisId, orgId);
    }

    public Optional<AIDocumentAnalysis> getAnalysisByDatabaseId(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return repository.findByIdAndOrganizationId(id, orgId);
    }

    public List<AIDocumentAnalysis> getHighRiskDocuments(Integer minScore) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query - need to add method to repository
        return repository.findByOrganizationIdOrderByCreatedAtDesc(orgId).stream()
                .filter(a -> a.getRiskScore() != null && a.getRiskScore() >= (minScore != null ? minScore : 70))
                .toList();
    }

    public Map<String, Object> getAnalysisStats(Long userId) {
        Long orgId = getRequiredOrganizationId();
        Map<String, Object> stats = new HashMap<>();

        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);

        // SECURITY: Use tenant-filtered queries
        stats.put("totalAnalyses", repository.countRecentAnalysesByOrganization(orgId, thirtyDaysAgo));
        stats.put("tokensUsed", repository.getTotalTokensUsedByUser(userId, thirtyDaysAgo)); // Keep user-level for now
        stats.put("recentAnalyses", repository.findTop10ByOrganizationIdAndIsArchivedFalseOrderByCreatedAtDesc(orgId));

        return stats;
    }

    /**
     * Check if document type is a contract/agreement type (not litigation)
     * Contract types don't need actionItems/timelineEvents extraction
     */
    private boolean isContractType(String docType) {
        if (docType == null) return false;
        String lower = docType.toLowerCase();
        return lower.contains("contract") || lower.contains("agreement") ||
               lower.contains("lease") || lower.contains("nda") ||
               lower.contains("non-disclosure") || lower.contains("employment") ||
               lower.contains("settlement") || lower.contains("confidentiality");
    }

    /**
     * Strip JSON block from analysis text for cleaner storage/display
     */
    private String stripJsonBlock(String text) {
        if (text == null) return null;

        // Remove ```json ... ``` code blocks
        String cleaned = text.replaceAll("```json\\s*[\\s\\S]*?```", "");

        // Remove standalone JSON objects at end (actionItems/timelineEvents)
        int jsonObjStart = cleaned.lastIndexOf('{');
        if (jsonObjStart > 0) {
            String potential = cleaned.substring(jsonObjStart);
            if (potential.contains("actionItems") || potential.contains("timelineEvents")) {
                cleaned = cleaned.substring(0, jsonObjStart);
            }
        }

        return cleaned.trim();
    }

    /**
     * Save uploaded file to disk for later retrieval
     */
    private String saveFileToDisk(MultipartFile file) throws IOException {
        // Create upload directory if it doesn't exist
        Path uploadDir = Paths.get(documentsOutputPath);
        if (!Files.exists(uploadDir)) {
            Files.createDirectories(uploadDir);
            log.info("Created upload directory: {}", uploadDir);
        }

        // Keep original filename but add timestamp prefix to avoid collisions
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isEmpty()) {
            originalFilename = "document.pdf";
        }

        // Sanitize filename: remove path separators and other unsafe characters
        String sanitizedFilename = originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");

        // Add timestamp prefix to ensure uniqueness while keeping original name readable
        String uniqueFilename = System.currentTimeMillis() + "_" + sanitizedFilename;
        Path filePath = uploadDir.resolve(uniqueFilename);

        // Save file
        Files.write(filePath, file.getBytes());
        log.info("File saved: {} -> {}", originalFilename, uniqueFilename);

        return uniqueFilename;
    }

    private String extractTextFromFile(MultipartFile file) throws IOException {
        try (InputStream inputStream = file.getInputStream()) {
            // Use Apache Tika to extract text from any document type
            String content = tika.parseToString(inputStream);

            // If content extracted successfully, return it
            if (content != null && !content.trim().isEmpty()) {
                log.info("Text extracted successfully from {}: {} chars", file.getOriginalFilename(), content.length());
                return content.trim();
            }

            // Try OCR extraction for scanned documents
            log.info("No text found, attempting OCR extraction for: {}", file.getOriginalFilename());
            return extractTextWithOCR(file);

        } catch (TikaException e) {
            log.error("Tika extraction error for file {}: {}", file.getOriginalFilename(), e.getMessage());
            // Try OCR as fallback
            log.info("Attempting OCR fallback for: {}", file.getOriginalFilename());
            return extractTextWithOCR(file);
        }
    }

    /**
     * Extract text using OCR for scanned documents.
     * Requires Tesseract to be installed on the system:
     * - macOS: brew install tesseract
     * - Ubuntu: sudo apt-get install tesseract-ocr
     * - Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
     */
    private String extractTextWithOCR(MultipartFile file) throws IOException {
        try (InputStream inputStream = file.getInputStream()) {
            // Configure Tesseract OCR
            TesseractOCRConfig ocrConfig = new TesseractOCRConfig();
            ocrConfig.setLanguage("eng");

            // Configure PDF parser for OCR
            PDFParserConfig pdfConfig = new PDFParserConfig();
            pdfConfig.setExtractInlineImages(true);
            pdfConfig.setOcrStrategy(PDFParserConfig.OCR_STRATEGY.OCR_AND_TEXT_EXTRACTION);

            // Set up parse context
            ParseContext context = new ParseContext();
            context.set(TesseractOCRConfig.class, ocrConfig);
            context.set(PDFParserConfig.class, pdfConfig);

            // Parse with OCR
            AutoDetectParser parser = new AutoDetectParser();
            BodyContentHandler handler = new BodyContentHandler(-1); // No limit
            Metadata metadata = new Metadata();

            parser.parse(inputStream, handler, metadata, context);
            String content = handler.toString().trim();

            if (content.isEmpty()) {
                log.warn("OCR extraction also returned empty for: {}", file.getOriginalFilename());
                return String.format("""
                    [Document Analysis Failed]
                    File: %s
                    Type: %s
                    Size: %d bytes

                    Unable to extract text. Possible causes:
                    - Document is a scanned image and Tesseract OCR is not installed
                    - PDF is encrypted or protected
                    - Document contains only graphics/charts

                    To enable OCR: Install Tesseract (brew install tesseract on macOS)
                    """, file.getOriginalFilename(), file.getContentType(), file.getSize());
            }

            log.info("OCR extraction successful for {}: {} chars", file.getOriginalFilename(), content.length());
            return content;

        } catch (TikaException | SAXException e) {
            log.error("OCR extraction failed for {}: {}", file.getOriginalFilename(), e.getMessage());
            return String.format("""
                [OCR Extraction Failed]
                File: %s
                Error: %s

                Ensure Tesseract OCR is installed:
                - macOS: brew install tesseract
                - Ubuntu: sudo apt-get install tesseract-ocr
                """, file.getOriginalFilename(), e.getMessage());
        }
    }

    /**
     * Result class for document classification with parties
     */
    private static class DocumentClassification {
        String documentType = "Document";
        String plaintiff = "";
        String defendant = "";
        String caseNumber = "";
        String court = "";
    }

    /**
     * Use AI to classify document type AND extract parties (single cheap call)
     */
    private DocumentClassification classifyDocumentAndExtractParties(String content, String fileName) {
        // Use first 3000 chars for classification (enough context, saves tokens)
        String sample = content.substring(0, Math.min(content.length(), 3000));

        String classificationPrompt = String.format("""
            Analyze this legal document and extract:

            1. Document Type - Choose the MOST SPECIFIC match from this list:

               PLEADINGS: Complaint, Petition, Answer, Counterclaim
               MOTIONS: Motion to Dismiss, Motion for Summary Judgment, Motion to Compel, Motion to Suppress, Protective Order, Motion
               DISCOVERY: Interrogatories, Request for Production, Request for Admission, Deposition Notice, Subpoena
               BRIEFS: Legal Brief, Appellate Brief, Reply Brief, Memorandum
               CORRESPONDENCE: Demand Letter, Settlement Offer, Opinion Letter, Cease and Desist, Letter, Notice
               CONTRACTS: Employment Agreement, Non-Disclosure Agreement, NDA, Purchase Agreement, Service Agreement, Lease, Contract Amendment, Settlement Agreement, Contract
               COURT DOCUMENTS: Order, Judgment, Decree, Stipulation
               FAMILY LAW: Divorce Petition, Custody Agreement
               OTHER: Legal Memo, Affidavit, Document

            2. Parties (from caption/header):
               - Plaintiff/Petitioner name(s)
               - Defendant/Respondent name(s)

            3. Case number (if visible)
            4. Court name (if visible)

            Filename: %s

            Content:
            %s

            Reply in this EXACT JSON format only:
            {"documentType":"Motion to Dismiss","plaintiff":"John Smith","defendant":"ABC Corp","caseNumber":"1:24-cv-12345","court":"US District Court"}

            If party not found, use empty string. Use "et al." for multiple parties.
            """, fileName, sample);

        DocumentClassification result = new DocumentClassification();

        try {
            // Synchronous call for classification with temperature=0 for DETERMINISTIC results
            // This ensures the same document always gets the same classification
            String response = claudeService.generateCompletion(classificationPrompt, null, false, null, 0.0)
                .get(30, java.util.concurrent.TimeUnit.SECONDS);

            // Parse JSON response
            String jsonStr = extractJsonFromResponse(response);
            if (jsonStr != null) {
                com.fasterxml.jackson.databind.JsonNode json = new com.fasterxml.jackson.databind.ObjectMapper().readTree(jsonStr);
                result.documentType = json.has("documentType") ? json.get("documentType").asText("Document") : "Document";
                result.plaintiff = json.has("plaintiff") ? json.get("plaintiff").asText("") : "";
                result.defendant = json.has("defendant") ? json.get("defendant").asText("") : "";
                result.caseNumber = json.has("caseNumber") ? json.get("caseNumber").asText("") : "";
                result.court = json.has("court") ? json.get("court").asText("") : "";
            }

            // Validate document type
            if (result.documentType.length() > 50 || result.documentType.contains(" is ")) {
                log.warn("AI returned unexpected classification: {}, using 'Document'", result.documentType);
                result.documentType = "Document";
            }

            log.info("AI classified document as '{}', parties: {} vs {}", result.documentType, result.plaintiff, result.defendant);
            return result;

        } catch (Exception e) {
            log.error("AI classification failed, falling back to filename-based: {}", e.getMessage());
            // Simple fallback based on filename
            String lower = fileName.toLowerCase();
            if (lower.contains("demand")) result.documentType = "Demand Letter";
            else if (lower.contains("complaint")) result.documentType = "Complaint";
            else if (lower.contains("contract")) result.documentType = "Contract";
            else if (lower.contains("agreement")) result.documentType = "Agreement";
            else if (lower.contains("motion")) result.documentType = "Motion";
            else result.documentType = "Document";
            return result;
        }
    }

    /**
     * Extract JSON string from AI response (may be wrapped in markdown code blocks)
     */
    private String extractJsonFromResponse(String response) {
        if (response == null) return null;

        // Try to find JSON in code block first
        int jsonStart = response.indexOf("```json");
        if (jsonStart != -1) {
            int contentStart = response.indexOf('\n', jsonStart) + 1;
            int jsonEnd = response.indexOf("```", contentStart);
            if (jsonEnd != -1) {
                return response.substring(contentStart, jsonEnd).trim();
            }
        }

        // Try plain code block
        jsonStart = response.indexOf("```");
        if (jsonStart != -1) {
            int contentStart = response.indexOf('\n', jsonStart) + 1;
            int jsonEnd = response.indexOf("```", contentStart);
            if (jsonEnd != -1) {
                String content = response.substring(contentStart, jsonEnd).trim();
                if (content.startsWith("{")) return content;
            }
        }

        // Try to find raw JSON object
        int braceStart = response.indexOf('{');
        int braceEnd = response.lastIndexOf('}');
        if (braceStart != -1 && braceEnd > braceStart) {
            return response.substring(braceStart, braceEnd + 1);
        }

        return null;
    }

    /**
     * Merge AI-extracted party information into metadata JSON.
     * If parties were extracted by AI, they override regex-based extraction.
     */
    private String mergePartiesToMetadata(String existingMetadata, DocumentClassification classification) {
        try {
            com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(existingMetadata);
            com.fasterxml.jackson.databind.node.ObjectNode mutableNode =
                (com.fasterxml.jackson.databind.node.ObjectNode) node;

            // Only override if AI extracted non-empty values
            if (classification.plaintiff != null && !classification.plaintiff.isEmpty()) {
                mutableNode.put("plaintiff", classification.plaintiff);
            }
            if (classification.defendant != null && !classification.defendant.isEmpty()) {
                mutableNode.put("defendant", classification.defendant);
            }
            if (classification.caseNumber != null && !classification.caseNumber.isEmpty()) {
                mutableNode.put("caseNumber", classification.caseNumber);
            }
            if (classification.court != null && !classification.court.isEmpty()) {
                mutableNode.put("court", classification.court);
            }

            return objectMapper.writeValueAsString(mutableNode);
        } catch (Exception e) {
            log.warn("Failed to merge parties into metadata: {}", e.getMessage());
            return existingMetadata;
        }
    }

    private String buildAnalysisPrompt(String content, String detectedType, String fileName, String analysisContext) {
        // Build context-specific role instruction that will be prepended to document-type prompts
        String contextRole = getContextRole(analysisContext);
        String contextFocus = getContextFocus(analysisContext);

        String basePrompt = String.format("""
            You are an expert legal strategist and document analyst.
            %s

            Document: %s
            Detected Type: %s

            Document Content:
            %s
            """, contextRole, fileName, detectedType, content);

        // Route to strategic analysis based on detected document type
        // Pass analysisContext so prompts can adapt their perspective
        String lowerType = detectedType.toLowerCase();

        // Litigation Documents
        if (lowerType.contains("complaint") || lowerType.contains("petition")) {
            return basePrompt + getComplaintStrategicPrompt(analysisContext, contextFocus);
        } else if (lowerType.contains("answer") && !lowerType.contains("interrogator")) {
            return basePrompt + getAnswerStrategicPrompt(analysisContext, contextFocus);
        } else if (lowerType.contains("motion")) {
            return basePrompt + getMotionAnalysisPrompt(analysisContext, contextFocus);
        } else if (lowerType.contains("brief") || lowerType.contains("memorandum")) {
            return basePrompt + getLegalBriefAnalysisPrompt(analysisContext, contextFocus);
        } else if (lowerType.contains("discovery") || lowerType.contains("interrogator") ||
                   lowerType.contains("request for production") || lowerType.contains("admission")) {
            return basePrompt + getDiscoveryRequestPrompt(analysisContext, contextFocus);
        } else if (lowerType.contains("order") || lowerType.contains("judgment") || lowerType.contains("decree")) {
            return basePrompt + getCourtOrderAnalysisPrompt(analysisContext, contextFocus);
        }
        // Contract Documents
        else if (lowerType.contains("employment") && (lowerType.contains("agreement") || lowerType.contains("contract"))) {
            return basePrompt + getEmploymentAgreementPrompt(analysisContext, contextFocus);
        } else if (lowerType.contains("nda") || lowerType.contains("non-disclosure") ||
                   lowerType.contains("confidentiality agreement")) {
            return basePrompt + getNDAPrompt(analysisContext, contextFocus);
        } else if (lowerType.contains("settlement") && lowerType.contains("agreement")) {
            return basePrompt + getSettlementAgreementPrompt(analysisContext, contextFocus);
        } else if (lowerType.contains("lease")) {
            return basePrompt + getLeaseStrategicPrompt(analysisContext, contextFocus);
        } else if (lowerType.contains("contract") || lowerType.contains("agreement")) {
            return basePrompt + getContractStrategicPrompt(analysisContext, contextFocus);
        }
        // Correspondence/Notice Documents (check specific types FIRST)
        else if (lowerType.contains("demand letter") || lowerType.equals("demand")) {
            return basePrompt + getDemandLetterPrompt(analysisContext, contextFocus);
        } else if (lowerType.contains("cease") && lowerType.contains("desist")) {
            return basePrompt + getCeaseAndDesistPrompt(analysisContext, contextFocus);
        } else if (lowerType.contains("regulatory") || lowerType.contains("compliance") ||
                   lowerType.contains("violation")) {
            return basePrompt + getRegulatoryNoticePrompt(analysisContext, contextFocus);
        } else if (lowerType.contains("notice")) {
            return basePrompt + getNoticePrompt(analysisContext, contextFocus);
        }
        // Default
        else {
            return basePrompt + getStrategicGeneralAnalysisPrompt(analysisContext, contextFocus);
        }
    }

    /**
     * Get context-specific ROLE instruction based on user's analysis goal.
     * This sets up the AI's perspective for analyzing the document.
     */
    private String getContextRole(String analysisContext) {
        return switch (analysisContext) {
            case "respond" -> """

            ANALYSIS CONTEXT: You received this document from opposing counsel and need to prepare a response.
            Analyze from the perspective of counsel who must draft a response to this document.
            """;

            case "negotiate" -> """

            ANALYSIS CONTEXT: You are negotiating this document on behalf of your client.
            Analyze from the perspective of counsel preparing to negotiate better terms.
            """;

            case "client_review" -> """

            ANALYSIS CONTEXT: You are reviewing this document to explain it to your client.
            Analyze from the perspective of counsel who needs to communicate clearly with a non-lawyer.
            """;

            case "due_diligence" -> """

            ANALYSIS CONTEXT: You are conducting due diligence for a transaction (M&A, investment, etc.).
            Analyze from the perspective of counsel reviewing documents for a deal evaluation.
            """;

            default -> ""; // No additional context for 'general' analysis
        };
    }

    /**
     * Get context-specific FOCUS areas based on user's analysis goal.
     * This is appended to document-type prompts to guide the analysis focus.
     */
    private String getContextFocus(String analysisContext) {
        return switch (analysisContext) {
            case "respond" -> """

            CONTEXT-SPECIFIC FOCUS (Preparing Response):
            - Response deadline and timeline requirements
            - Weaknesses and vulnerabilities to exploit in your response
            - Arguments and defenses you should raise
            - Evidence and documentation you need to gather
            - Strategic considerations for drafting your response
            - Potential counter-arguments and how to address them
            """;

            case "negotiate" -> """

            CONTEXT-SPECIFIC FOCUS (Negotiating Terms):
            - Terms that are unfavorable to your client and should be redlined
            - Negotiation priorities (must-have vs nice-to-have changes)
            - Alternative language suggestions for problematic clauses
            - Industry-standard terms that are missing
            - Hidden risks and landmines in the current language
            - Leverage points for negotiation
            """;

            case "client_review" -> """

            CONTEXT-SPECIFIC FOCUS (Client Communication):
            - Plain-language summary a non-lawyer can understand
            - Key obligations and commitments for your client
            - Important deadlines and dates they need to know
            - Risks and potential consequences in simple terms
            - Recommended actions and next steps
            - Questions the client should consider before proceeding
            """;

            case "due_diligence" -> """

            CONTEXT-SPECIFIC FOCUS (Due Diligence Review):
            - Risk matrix with severity ratings
            - Issues organized by category (legal, financial, operational, compliance)
            - Missing documents or information needed
            - Red flags that require further investigation
            - Deal-breaker issues vs manageable risks
            - Recommended conditions or protections for the transaction
            """;

            default -> ""; // No additional focus for 'general' analysis
        };
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

    private String getComplaintStrategicPrompt(String analysisContext, String contextFocus) {
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You are DEFENSE COUNSEL who received this complaint and must prepare an Answer. Focus on response deadlines, affirmative defenses, and immediate actions required.";
            case "client_review" -> "You are reviewing this complaint to EXPLAIN TO YOUR CLIENT what they've been sued for, what it means, and what happens next. Use plain language.";
            case "due_diligence" -> "You are reviewing this complaint as part of LITIGATION DUE DILIGENCE for a transaction. Assess the exposure, merits, and potential impact on the deal.";
            default -> "You are DEFENSE COUNSEL analyzing this complaint to develop a winning defense strategy.";
        };

        return String.format("""

            %s
            %s

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

            ## 📑 UNSUPPORTED FACTUAL CLAIMS
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
            """, roleIntro, contextFocus);
    }

    private String getContractStrategicPrompt(String analysisContext, String contextFocus) {
        // Dynamic role based on analysis context
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You received this contract from the other party and need to prepare a response or counter-proposal.";
            case "negotiate" -> "You are actively negotiating this contract on behalf of your client.";
            case "client_review" -> "You are reviewing this contract to explain it clearly to your client before they sign.";
            case "due_diligence" -> "You are reviewing this contract as part of due diligence for a transaction.";
            default -> "You are reviewing this contract for your client to identify risks and negotiation points.";
        };

        return String.format("""

            %s
            %s

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
            """, roleIntro, contextFocus);
    }

    private String getLeaseStrategicPrompt(String analysisContext, String contextFocus) {
        // Dynamic role based on analysis context
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You received this lease from the landlord and need to prepare a response with your client's concerns.";
            case "negotiate" -> "You are actively negotiating this lease on behalf of your client (tenant).";
            case "client_review" -> "You are reviewing this lease to explain the terms and costs clearly to your client.";
            case "due_diligence" -> "You are reviewing this lease as part of due diligence for a transaction or acquisition.";
            default -> "You are reviewing this lease for your client to identify unfavorable terms and total cost exposure.";
        };

        return String.format("""

            %s
            %s

            ## ⚡ EXECUTIVE LEASE SUMMARY (3 sentences)
            - Lease type and term
            - TRUE TOTAL COST over lease term (all-in)
            - RISK SCORE + RECOMMENDATION

            ## 💰 COMPREHENSIVE FINANCIAL ANALYSIS
            - Base Rent: [breakdown by year]
            - CAM Charges: $X/year (capped? [Y%% / NONE ⚠️])
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
            - CAM admin fee: X%%
            - Capital improvements in CAM: [Yes ⚠️/No]
            - Other surprises: [List]

            ## 📋 NEGOTIATION PRIORITIES
            Tier 1 Must-Fix:
            1. [Item] - [Why]

            ## 🏆 RECOMMENDATION
            [Sign/Negotiate/Walk] + justification
            Must achieve: [Changes]

            Show true all-in cost, not just base rent.
            """, roleIntro, contextFocus);
    }

    private String getMotionAnalysisPrompt(String analysisContext, String contextFocus) {
        // Dynamic role based on analysis context
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You received this motion and need to prepare an opposition.";
            case "client_review" -> "You are reviewing this motion to explain the implications to your client.";
            case "due_diligence" -> "You are reviewing this motion as part of litigation due diligence.";
            default -> "You are analyzing this motion to develop an opposition strategy.";
        };

        return String.format("""

            %s
            %s

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

            ## 📑 FACTUAL DISPUTES
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
            """, roleIntro, contextFocus);
    }

    private String getStrategicGeneralAnalysisPrompt(String analysisContext, String contextFocus) {
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You received this document and need to prepare a response. Focus on response requirements, deadlines, and strategy.";
            case "negotiate" -> "You are negotiating this document on behalf of your client. Identify unfavorable terms and suggest changes.";
            case "client_review" -> "You are reviewing this document to EXPLAIN IT TO YOUR CLIENT in plain language. Focus on what they need to understand and do.";
            case "due_diligence" -> "You are reviewing this document as part of DUE DILIGENCE for a transaction. Identify risks, red flags, and deal implications.";
            default -> "Provide comprehensive strategic analysis of this document.";
        };

        return String.format("""

            %s
            %s

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
            """, roleIntro, contextFocus);
    }

    private String getEmploymentAgreementPrompt(String analysisContext, String contextFocus) {
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You received this employment agreement and need to respond with concerns/counterproposal.";
            case "negotiate" -> "You are negotiating this employment agreement on behalf of the employee. Focus on compensation, covenants, and protections.";
            case "client_review" -> "You are reviewing this employment agreement to EXPLAIN IT TO YOUR CLIENT (the employee) in plain language.";
            case "due_diligence" -> "You are reviewing this employment agreement as part of DUE DILIGENCE (e.g., key-employee review in M&A).";
            default -> "You are EMPLOYEE'S COUNSEL reviewing this employment agreement for compensation, covenants, and protections.";
        };

        return String.format("""

            %s
            %s

            ## ⚡ EXECUTIVE COMPENSATION SUMMARY (3 sentences)
            - Position and total compensation (Year 1)
            - COVENANT RISK SCORE (0-100) for enforceability
            - RECOMMENDATION (Sign / Negotiate / Decline)

            ## 💰 TOTAL COMPENSATION BREAKDOWN
            - Base Salary: $X/year
            - Bonus (Target): $Y/year
            - Equity Grant: Z shares (X%% of company)
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

            ## 📑 EQUITY VALUE ANALYSIS
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
            """, roleIntro, contextFocus);
    }

    private String getNDAPrompt(String analysisContext, String contextFocus) {
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You received this NDA and need to respond with concerns/redlines.";
            case "negotiate" -> "You are negotiating this NDA on behalf of your client. Focus on scope, carve-outs, and duration.";
            case "client_review" -> "You are reviewing this NDA to EXPLAIN IT TO YOUR CLIENT in plain language before they sign.";
            case "due_diligence" -> "You are reviewing this NDA as part of DUE DILIGENCE to assess business restrictions and risks.";
            default -> "You are BUSINESS COUNSEL reviewing this NDA before signing.";
        };

        return String.format("""

            %s
            %s

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
            """, roleIntro, contextFocus);
    }

    private String getDiscoveryRequestPrompt(String analysisContext, String contextFocus) {
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You received these discovery requests and must prepare responses/objections.";
            case "client_review" -> "You are reviewing these discovery requests to EXPLAIN TO YOUR CLIENT what information is being sought and what they need to gather.";
            case "due_diligence" -> "You are reviewing these discovery requests as part of LITIGATION DUE DILIGENCE to assess discovery burden and exposure.";
            default -> "You are RESPONDING COUNSEL analyzing these discovery requests for objections and responses.";
        };

        return String.format("""

            %s
            %s

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

            ## 📑 BURDEN ANALYSIS
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
            """, roleIntro, contextFocus);
    }

    private String getSettlementAgreementPrompt(String analysisContext, String contextFocus) {
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You received this settlement proposal and need to respond with counterterms.";
            case "negotiate" -> "You are negotiating this settlement agreement on behalf of your client. Focus on favorable terms.";
            case "client_review" -> "You are reviewing this settlement to EXPLAIN IT TO YOUR CLIENT in plain language so they can make an informed decision.";
            case "due_diligence" -> "You are reviewing this settlement as part of DUE DILIGENCE to assess resolved claims and remaining exposure.";
            default -> "You are COUNSEL reviewing this settlement agreement for enforceability and favorable terms.";
        };

        return String.format("""

            %s
            %s

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
            """, roleIntro, contextFocus);
    }

    private String getRegulatoryNoticePrompt(String analysisContext, String contextFocus) {
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You received this regulatory notice and must prepare a response. Focus on deadlines, compliance requirements, and response strategy.";
            case "client_review" -> "You are reviewing this regulatory notice to EXPLAIN IT TO YOUR CLIENT what the agency is requiring, the consequences, and next steps.";
            case "due_diligence" -> "You are reviewing this regulatory notice as part of DUE DILIGENCE to assess compliance exposure and risk.";
            default -> "You are COMPLIANCE COUNSEL analyzing this regulatory notice for obligations, deadlines, and defense options.";
        };

        return String.format("""

            %s
            %s

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
            - Likely Reduction: [X%% of maximum penalty]

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
            """, roleIntro, contextFocus);
    }

    private String getDemandLetterPrompt(String analysisContext, String contextFocus) {
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You received this demand letter and must prepare a response. Focus on response deadline, defenses, and counter-arguments.";
            case "negotiate" -> "You are negotiating in response to this demand letter. Focus on leverage points and settlement strategy.";
            case "client_review" -> "You are reviewing this demand letter to EXPLAIN IT TO YOUR CLIENT what is being demanded, the exposure, and their options.";
            case "due_diligence" -> "You are reviewing this demand letter as part of DUE DILIGENCE to assess threatened claims and exposure.";
            default -> "You are RECIPIENT'S COUNSEL analyzing this demand letter for validity, exposure, and response strategy.";
        };

        return String.format("""

            %s
            %s

            ## ⚡ EXECUTIVE SUMMARY (3 sentences)
            - Who is demanding what (and for how much)
            - VALIDITY ASSESSMENT: Are the claims legally supportable?
            - CRITICAL DEADLINE: Response required by [date]

            ## 💰 DEMAND ANALYSIS
            - Amount Demanded: $X
            - Basis for Demand: [Contract breach / Tort / Statutory violation]
            - Supporting Evidence Cited: [What they claim to have]
            - Validity Assessment: [Strong / Moderate / Weak] + reasoning

            ## 🎯 CLAIMS EVALUATION
            For each claim made:
            ⚠️ [VALIDITY - HIGH/MEDIUM/LOW]: Claim Description
            - Their Allegation: [What they're claiming]
            - Legal Basis: [Applicable law/contract provision]
            - Weaknesses: [Holes in their argument]
            - Our Defense: [How to counter]

            ## ⚖️ LIABILITY EXPOSURE
            - Maximum Exposure: $X (if all claims succeed)
            - Likely Exposure: $Y (realistic assessment)
            - Statutory Damages/Penalties: [If applicable]
            - Attorney's Fees: [Are they recoverable?]

            ## 🛡️ DEFENSE OPTIONS
            **Strongest Defenses:**
            1. [Defense] - [Why it works]
            2. [Defense] - [Supporting facts]

            **Procedural Issues:**
            - Statute of Limitations: [Analysis]
            - Standing: [Does sender have right to sue?]
            - Jurisdiction: [Proper venue?]

            ## 📝 RESPONSE STRATEGY
            **OPTION 1: Negotiate**
            - Counteroffer: $X (X%% of demand)
            - Leverage Points: [Weaknesses to exploit]
            - Settlement Terms: [What to require]

            **OPTION 2: Reject & Defend**
            - Response Letter: [Key points to make]
            - Preserve Defenses: [What NOT to admit]
            - Prepare for Litigation: [Evidence to gather]

            **OPTION 3: Ignore**
            - Risk Assessment: [Consequences]
            - When Appropriate: [If claims are frivolous]

            ## ⏱️ RESPONSE TIMELINE
            📅 DEADLINE: [X days from letter date]
            📅 DAY 1-3: Gather facts, review contracts
            📅 DAY 3-7: Draft response strategy
            📅 DAY 7-X: Send response before deadline

            ## 🎯 RECOMMENDED APPROACH
            [Negotiate / Reject / Partial Settlement] + detailed reasoning
            Target Settlement: $X (X%% of demand)
            Key Negotiation Points: [What to concede vs. fight]

            Focus on liability assessment and negotiation leverage.
            """, roleIntro, contextFocus);
    }

    private String getCeaseAndDesistPrompt(String analysisContext, String contextFocus) {
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You received this cease and desist and must prepare a response. Focus on validity, compliance options, and defenses.";
            case "negotiate" -> "You are negotiating in response to this cease and desist. Focus on compliance alternatives and license options.";
            case "client_review" -> "You are reviewing this cease and desist to EXPLAIN IT TO YOUR CLIENT what is being demanded and their options.";
            case "due_diligence" -> "You are reviewing this cease and desist as part of DUE DILIGENCE to assess IP/legal exposure.";
            default -> "You are RECIPIENT'S COUNSEL analyzing this cease and desist for validity, exposure, and response options.";
        };

        return String.format("""

            %s
            %s

            ## ⚡ EXECUTIVE SUMMARY (3 sentences)
            - What activity they want stopped
            - VALIDITY: Is their claim legally supportable?
            - URGENCY: Response deadline and consequences

            ## 🚫 DEMAND ANALYSIS
            - Activity to Cease: [Specific conduct]
            - Legal Basis Claimed: [Trademark / Copyright / Contract / Tort]
            - Evidence of Infringement: [What they cite]
            - Validity Assessment: [Strong / Moderate / Weak]

            ## ⚖️ LEGAL EVALUATION
            ⚠️ [STRENGTH]: Their Primary Claim
            - Legal Theory: [IP infringement / Breach / Defamation]
            - Elements Required: [What they must prove]
            - Weaknesses in Claim: [Gaps / Missing elements]
            - Our Position: [Why we may continue / must stop]

            ## 🛡️ DEFENSE OPTIONS
            **If Claim is Weak:**
            - Fair Use Defense: [Applicability]
            - First Amendment: [If speech-related]
            - Prior Rights: [If we have them]
            - Laches/Estoppel: [Delay arguments]

            **If Claim has Merit:**
            - Compliance Cost: [Effort to stop activity]
            - Modification Options: [Can we change approach?]
            - License Negotiation: [Can we pay to continue?]

            ## 💰 RISK ASSESSMENT
            - Statutory Damages: $X-$Y range
            - Actual Damages: [Their provable losses]
            - Attorney's Fees: [Recoverable?]
            - Injunction Risk: [Likelihood]
            - Reputational Risk: [Business impact]

            ## 📝 RESPONSE OPTIONS
            **OPTION 1: Comply Fully**
            - Stop activity immediately
            - Confirm compliance in writing
            - Preserve goodwill

            **OPTION 2: Partial Compliance**
            - Modify activity to address concerns
            - Negotiate acceptable terms
            - Seek license if needed

            **OPTION 3: Reject & Defend**
            - Assert our rights
            - Challenge their claims
            - Prepare for litigation

            ## 🏆 RECOMMENDED APPROACH
            [Comply / Negotiate / Reject] + reasoning
            Risk Level: [Low/Medium/High]
            Next Steps: [Specific actions]

            Focus on balancing legal risk against business needs.
            """, roleIntro, contextFocus);
    }

    private String getNoticePrompt(String analysisContext, String contextFocus) {
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You received this notice and need to determine if a response is required and prepare one.";
            case "client_review" -> "You are reviewing this notice to EXPLAIN IT TO YOUR CLIENT what it means and any required actions.";
            case "due_diligence" -> "You are reviewing this notice as part of DUE DILIGENCE to assess impact on a transaction.";
            default -> "You are COUNSEL analyzing this notice for legal implications and required actions.";
        };

        return String.format("""

            %s
            %s

            ## ⚡ EXECUTIVE SUMMARY (3 sentences)
            - Type and purpose of notice
            - KEY OBLIGATION or information conveyed
            - DEADLINE for any required action

            ## 📋 NOTICE DETAILS
            - From: [Sender and capacity]
            - To: [Recipient]
            - Subject Matter: [What it concerns]
            - Effective Date: [When it takes effect]

            ## 🎯 KEY PROVISIONS
            For each material provision:
            ⚠️ [IMPORTANCE]: Provision
            - Content: [What it says]
            - Implication: [Legal effect]
            - Required Action: [What must be done]

            ## ⏱️ DEADLINES & OBLIGATIONS
            📅 [DATE]: [Required action]
            📅 [DATE]: [Response deadline]

            ## ⚖️ LEGAL IMPLICATIONS
            - Rights Affected: [What rights are triggered/terminated]
            - Obligations Created: [What must be done]
            - Consequences of Inaction: [What happens if ignored]

            ## 📝 RECOMMENDED RESPONSE
            - Acknowledge Receipt: [If required]
            - Required Actions: [Steps to take]
            - Preserve Rights: [Objections to make]

            ## 🎯 NEXT STEPS
            1. [Immediate action]
            2. [Short-term action]
            3. [Long-term consideration]

            Focus on identifying obligations and deadlines.
            """, roleIntro, contextFocus);
    }

    private String getAnswerStrategicPrompt(String analysisContext, String contextFocus) {
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You received this answer and need to plan next steps in the litigation.";
            case "client_review" -> "You are reviewing this answer to EXPLAIN IT TO YOUR CLIENT what defendant is admitting, denying, and what defenses they raise.";
            case "due_diligence" -> "You are reviewing this answer as part of LITIGATION DUE DILIGENCE to assess the defendant's position and case strength.";
            default -> "You are PLAINTIFF'S COUNSEL analyzing defendant's answer to identify weaknesses and develop strategy.";
        };

        return String.format("""

            %s
            %s

            ## ⚡ EXECUTIVE BRIEF (3 sentences)
            - What defendant admits vs denies
            - STRONGEST AFFIRMATIVE DEFENSE to overcome
            - IMMEDIATE ACTION required

            ## 🎯 ADMISSION ANALYSIS
            For each significant admission:
            ✅ [HELPFUL]: Admitted Fact
            - What defendant admitted: [Quote or paraphrase]
            - Why it helps: [Strategic value]
            - How to use: [At trial/settlement/motion]

            ## ⚠️ DENIAL ANALYSIS
            For each critical denial:
            ❌ [SEVERITY]: Denied Allegation (Paragraph X)
            - Plaintiff's allegation: [What we claimed]
            - Defendant's denial: [General/Specific]
            - Evidence needed: [To prove our allegation]
            - Strategy: [How to overcome denial]

            ## 🛡️ AFFIRMATIVE DEFENSES ASSESSMENT
            For each affirmative defense raised:
            ⚠️ [THREAT LEVEL - HIGH/MEDIUM/LOW]: Defense Name
            - Defendant's theory: [Their argument]
            - Elements they must prove: [Legal requirements]
            - Our counter: [How to defeat it]
            - Evidence they likely lack: [Weaknesses]

            ## 📑 COUNTERCLAIMS (if any)
            ⚠️ [SEVERITY]: Counterclaim
            - Nature of claim: [What defendant alleges]
            - Exposure: $X potential liability
            - Defenses available: [Our responses]
            - Strategy: [Dismiss/defend/settle]

            ## 📝 DISCOVERY PRIORITIES
            Based on denials and defenses, prioritize discovery:
            ☐ URGENT: [Evidence to obtain for denied facts]
            ☐ HIGH: [Evidence to defeat affirmative defenses]
            ☐ MEDIUM: [Supporting evidence]

            ## ⏱️ ACTION TIMELINE
            📅 DAY 1-7: [Immediate actions based on answer]
            📅 DAY 7-14: [Discovery planning]
            📅 DAY 14-30: [Motion practice if applicable]

            ## 💡 STRATEGIC RECOMMENDATIONS
            🎯 PRIMARY STRATEGY: [Main approach given answer]
            🎯 WEAKEST DEFENSE: [Which affirmative defense to attack first]
            🎯 SETTLEMENT LEVERAGE: [How answer affects negotiation position]

            Focus on actionable insights. Identify what defendant failed to deny.
            """, roleIntro, contextFocus);
    }

    private String getCourtOrderAnalysisPrompt(String analysisContext, String contextFocus) {
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You received this court order and need to determine compliance requirements and potential challenges.";
            case "client_review" -> "You are reviewing this court order to EXPLAIN IT TO YOUR CLIENT what the court ruled, what it means, and what happens next.";
            case "due_diligence" -> "You are reviewing this court order as part of LITIGATION DUE DILIGENCE to assess outcome and implications for a transaction.";
            default -> "You are COUNSEL analyzing this court order for compliance requirements and strategic next steps.";
        };

        return String.format("""

            %s
            %s

            ## ⚡ EXECUTIVE SUMMARY (3 sentences)
            - What the court ordered
            - CRITICAL DEADLINE for compliance
            - IMMEDIATE ACTION required

            ## 📋 ORDER REQUIREMENTS
            For each requirement/directive:
            ⚠️ [URGENCY - IMMEDIATE/HIGH/STANDARD]: Requirement
            - Court's directive: [What must be done]
            - Deadline: [Date/timeframe]
            - Consequence of non-compliance: [Sanctions/contempt/dismissal]
            - Responsible party: [Who must act]

            ## ⏱️ COMPLIANCE TIMELINE
            📅 IMMEDIATE (24-48 hours):
            ☐ [Urgent compliance items]

            📅 SHORT-TERM (7 days):
            ☐ [Near-term requirements]

            📅 STANDARD (30 days):
            ☐ [Longer-term obligations]

            ## 💰 FINANCIAL IMPLICATIONS
            - Monetary awards/sanctions: $X
            - Cost shifting: [Who pays what]
            - Bond requirements: [If any]
            - Fee awards: [Attorney's fees]

            ## ⚖️ LEGAL ANALYSIS
            **Favorable Rulings:**
            ✅ [What court ruled in our favor]
            - Impact: [How it helps]

            **Unfavorable Rulings:**
            ❌ [What court ruled against us]
            - Impact: [How it hurts]
            - Options: [Appeal/reconsideration]

            ## 🔄 APPEAL CONSIDERATIONS
            - Appealable order: [Yes - final/interlocutory / No]
            - Appeal deadline: [X days from entry]
            - Likelihood of success: [Assessment]
            - Stay pending appeal: [Available/advisable?]

            ## 📝 MOTION FOR RECONSIDERATION
            - Grounds available: [Legal basis if any]
            - Deadline: [Usually 10-14 days]
            - Recommended: [Yes/No with reasoning]

            ## 🎯 STRATEGIC NEXT STEPS
            1. [Immediate compliance action]
            2. [Assess appeal/reconsideration]
            3. [Adjust case strategy based on ruling]
            4. [Client communication points]

            ## 📄 COMPLIANCE CHECKLIST
            ☐ Calendar all deadlines immediately
            ☐ Notify client of order
            ☐ Prepare compliance documentation
            ☐ Evaluate appeal options
            ☐ Update case strategy

            Focus on compliance deadlines and strategic implications of ruling.
            """, roleIntro, contextFocus);
    }

    private String getLegalBriefAnalysisPrompt(String analysisContext, String contextFocus) {
        String roleIntro = switch (analysisContext) {
            case "respond" -> "You are OPPOSING COUNSEL who received this brief and must prepare a response/opposition. Focus on weaknesses to exploit and counter-arguments.";
            case "client_review" -> "You are reviewing this brief to EXPLAIN TO YOUR CLIENT the arguments being made, their strength, and what it means for their case. Use plain language.";
            case "due_diligence" -> "You are reviewing this brief as part of LITIGATION DUE DILIGENCE. Assess the strength of arguments, likely outcome, and impact on a transaction.";
            default -> "You are analyzing this brief to develop counter-arguments and identify weaknesses.";
        };

        return String.format("""

            ⚠️⚠️⚠️ MANDATORY OUTPUT REQUIREMENT ⚠️⚠️⚠️

            YOU MUST INCLUDE A JSON BLOCK AT THE END OF YOUR ANALYSIS.
            Your response is INCOMPLETE without the structured data.

            Expected JSON format (place at the VERY END after all analysis):
            ```json
            {
              "actionItems": [
                {"description": "Draft response to motion", "deadline": "YYYY-MM-DD", "priority": "HIGH", "relatedSection": "..."}
              ],
              "timelineEvents": [
                {"title": "Motion Hearing", "eventDate": "YYYY-MM-DD", "eventType": "HEARING|DEADLINE|FILING|DEPOSITION", "priority": "HIGH", "description": "..."}
              ]
            }
            ```

            IMPORTANT DISTINCTION:
            - actionItems = TASKS to do (verbs: draft, research, review, prepare, file)
            - timelineEvents = CALENDAR DATES to track (hearings, court deadlines, depositions)

            ⚠️⚠️⚠️ DO NOT FORGET THE JSON BLOCK ⚠️⚠️⚠️

            ---

            %s
            %s

            ## ⚡ EXECUTIVE BRIEF SUMMARY (3 sentences)
            - Primary argument being made
            - STRENGTH ASSESSMENT (Strong / Moderate / Weak)
            - KEY TAKEAWAY for your analysis context

            ## 🎯 ANALYSIS OF LEGAL ARGUMENTS
            ⚠️ [SEVERITY]: Argument [Title]
            - Argument Summary: [What's being argued]
            - Strength/Weakness: [Assessment]
            - Your Response: [How to address this based on your context]
            - Supporting Authority: [Relevant cases/statutes]

            ## ⚖️ AUTHORITIES ANALYSIS
            ⚠️ [SEVERITY]: Case [Name]
            - How Cited: [How it's used in the brief]
            - Actual Holding: [What case really says]
            - Relevance to Your Position: [How this affects you]

            **Key Authorities to Consider:**
            - [Case Name]: [Why it matters for your situation]
            - [Statute]: [Relevant provision]

            ## 📑 FACTUAL ASSERTIONS
            ⚠️ Factual Claim: [Quote from brief]
            - Evidentiary Support: [Cited / Not cited]
            - Accuracy: [Consistent with record / Disputed]
            - Significance: [Why this matters]

            ## 🛡️ PROCEDURAL CONSIDERATIONS
            - Standing issues
            - Ripeness concerns
            - Waiver implications
            - Jurisdictional matters

            ## 📝 STRATEGIC ANALYSIS
            **KEY STRENGTHS of this brief:**
            - [Strong point 1]
            - [Strong point 2]

            **KEY WEAKNESSES in this brief:**
            - [Weak point 1]
            - [Weak point 2]

            **YOUR RECOMMENDED APPROACH:**
            Based on your context, you should:
            1. [First priority]
            2. [Second priority]
            3. [Third priority]

            ## ⏱️ ACTION TIMELINE
            📅 DAY 1-5: [Actions based on context]
            📅 DAY 5-10: [Follow-up actions]
            📅 DAY 10-14: [Completion actions]

            ## 🏆 ASSESSMENT
            - Brief Strength: [X/10]
            - Likely Outcome: [Grant/Deny/Partial]
            - Recommended Action: [Based on your context]

            ---

            🚨🚨🚨 CRITICAL REMINDER 🚨🚨🚨

            End your response with the JSON block containing actionItems and timelineEvents.
            Format: ```json { "actionItems": [...], "timelineEvents": [...] } ```

            This is MANDATORY. Your analysis is INCOMPLETE without it.
            """, roleIntro, contextFocus);
    }

    private Map<String, Object> parseAnalysisResponse(String response, String analysisType) {
        Map<String, Object> parsed = new HashMap<>();

        // Extract summary - prioritize EXECUTIVE headers used in AI prompts
        String summary = extractExecutiveSummary(response);
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

    /**
     * Extract executive summary from AI response.
     * Looks for ## ⚡ EXECUTIVE headers first (matches AI prompt structure),
     * then falls back to generic SUMMARY/OVERVIEW sections.
     */
    private String extractExecutiveSummary(String text) {
        // First, look for the structured header pattern: ## ⚡ EXECUTIVE
        java.util.regex.Pattern execPattern = java.util.regex.Pattern.compile(
            "##\\s*⚡?\\s*EXECUTIVE[^\\n]*\\n([\\s\\S]*?)(?=\\n##|$)",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Matcher matcher = execPattern.matcher(text);
        if (matcher.find()) {
            String content = matcher.group(1).trim();
            // Take up to the first few lines (the brief section)
            String[] lines = content.split("\n");
            StringBuilder summary = new StringBuilder();
            for (int i = 0; i < Math.min(5, lines.length); i++) {
                String line = lines[i].trim();
                if (!line.isEmpty() && !line.startsWith("##")) {
                    summary.append(line.replaceAll("^[-•*]\\s*", "")).append(" ");
                }
            }
            if (summary.length() > 0) {
                return summary.toString().trim();
            }
        }

        // Fallback: Look for section headers containing SUMMARY or OVERVIEW
        java.util.regex.Pattern sectionPattern = java.util.regex.Pattern.compile(
            "(?:^|\\n)##?\\s*[^\\n]*(SUMMARY|OVERVIEW)[^\\n]*\\n([\\s\\S]*?)(?=\\n##|$)",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        matcher = sectionPattern.matcher(text);
        if (matcher.find()) {
            String content = matcher.group(2).trim();
            String[] lines = content.split("\n");
            StringBuilder summary = new StringBuilder();
            for (int i = 0; i < Math.min(5, lines.length); i++) {
                String line = lines[i].trim();
                if (!line.isEmpty() && !line.startsWith("##")) {
                    summary.append(line.replaceAll("^[-•*]\\s*", "")).append(" ");
                }
            }
            if (summary.length() > 0) {
                return summary.toString().trim();
            }
        }

        return null;
    }

    // ==========================================
    // ASK AI - Document Q&A
    // ==========================================

    /**
     * Delete a document analysis by ID
     */
    public void deleteAnalysis(Long analysisId) {
        Long orgId = getRequiredOrganizationId();
        log.info("🗑️ Deleting analysis with ID: {}", analysisId);

        // SECURITY: Verify analysis belongs to current organization before deletion
        if (!repository.existsByIdAndOrganizationId(analysisId, orgId)) {
            throw new RuntimeException("Analysis not found or access denied: " + analysisId);
        }

        repository.deleteById(analysisId);
    }

    /**
     * Answer a user question about a specific document analysis.
     * Uses the full analysis context to provide accurate, cited responses.
     * NOW: Reads the stored analysisContext to provide context-aware responses.
     */
    public String askAboutDocument(Long analysisId, String question, Long userId) {
        log.info("🤖 Processing Ask AI question for analysis {}", analysisId);
        Long orgId = getRequiredOrganizationId();

        // Load the analysis from database - SECURITY: Use tenant-filtered query
        AIDocumentAnalysis analysis = repository.findByIdAndOrganizationId(analysisId, orgId)
            .orElseThrow(() -> new RuntimeException("Analysis not found or access denied: " + analysisId));

        // Get the stored analysis context to tailor the response
        String analysisContext = analysis.getAnalysisContext();
        String contextInstruction = getContextInstructionForFollowUp(analysisContext);

        // Build context from the analysis
        StringBuilder contextBuilder = new StringBuilder();
        contextBuilder.append("DOCUMENT INFORMATION:\n");
        contextBuilder.append("- File Name: ").append(analysis.getFileName()).append("\n");
        contextBuilder.append("- Document Type: ").append(analysis.getDetectedType()).append("\n");
        if (analysisContext != null && !analysisContext.equals("general")) {
            contextBuilder.append("- Analysis Purpose: ").append(getContextLabel(analysisContext)).append("\n");
        }

        // Add metadata if available
        if (analysis.getExtractedMetadata() != null) {
            try {
                var metadata = objectMapper.readTree(analysis.getExtractedMetadata());
                if (metadata.has("plaintiff")) {
                    contextBuilder.append("- Plaintiff: ").append(metadata.get("plaintiff").asText()).append("\n");
                }
                if (metadata.has("defendant")) {
                    contextBuilder.append("- Defendant: ").append(metadata.get("defendant").asText()).append("\n");
                }
                if (metadata.has("caseNumber")) {
                    contextBuilder.append("- Case Number: ").append(metadata.get("caseNumber").asText()).append("\n");
                }
                if (metadata.has("court")) {
                    contextBuilder.append("- Court: ").append(metadata.get("court").asText()).append("\n");
                }
            } catch (Exception e) {
                log.warn("Failed to parse metadata: {}", e.getMessage());
            }
        }

        // Add the full analysis
        contextBuilder.append("\n\nFULL DOCUMENT ANALYSIS:\n");
        contextBuilder.append(analysis.getAnalysisResult());

        String context = contextBuilder.toString();

        // Build the prompt with context-aware instructions
        String prompt = String.format("""
            You are a legal AI assistant helping an attorney understand a document that has already been analyzed.
            %s

            %s

            ---

            USER QUESTION: %s

            ---

            INSTRUCTIONS:
            1. Answer the question based ONLY on the document analysis provided above
            2. **CITE YOUR SOURCES**: When referencing information, include citations like [See: SECTION NAME]
            3. Use clear formatting: bullet points, bold for emphasis, numbered lists for steps
            4. **BE SPECIFIC**: Always provide actual content, descriptions, and details - never use generic labels like "Action Item" or "Risk" without explaining what the specific action/risk is
            5. If listing action items, always include the specific task description and deadline if available
            6. If the analysis doesn't contain the requested information, say so clearly
            7. Keep responses focused (2-4 paragraphs unless more detail is needed)
            8. End with "📌 Key Takeaway:" followed by the single most important point

            Provide your answer:
            """, contextInstruction, context, question);

        // Call Claude for the response (blocking call)
        String response = claudeService.generateCompletion(prompt, false).join();

        log.info("✅ Ask AI response generated for analysis {}", analysisId);
        return response;
    }

    /**
     * Get human-readable label for analysis context
     */
    private String getContextLabel(String analysisContext) {
        return switch (analysisContext) {
            case "respond" -> "Preparing Response to Opposing Counsel";
            case "negotiate" -> "Negotiating Terms";
            case "client_review" -> "Client Communication";
            case "due_diligence" -> "Due Diligence Review";
            default -> "General Analysis";
        };
    }

    /**
     * Get context-specific instruction for follow-up questions
     */
    private String getContextInstructionForFollowUp(String analysisContext) {
        if (analysisContext == null) return "";

        return switch (analysisContext) {
            case "respond" -> """

                ANALYSIS CONTEXT: The attorney is preparing to respond to this document from opposing counsel.
                Tailor your answers to focus on: response deadlines, counterarguments, weaknesses to exploit, and evidence to gather.
                """;
            case "negotiate" -> """

                ANALYSIS CONTEXT: The attorney is negotiating this document on behalf of their client.
                Tailor your answers to focus on: unfavorable terms, redline suggestions, leverage points, and negotiation priorities.
                """;
            case "client_review" -> """

                ANALYSIS CONTEXT: The attorney needs to explain this document to their client.
                Tailor your answers to be: clear and accessible to non-lawyers, focused on practical implications and next steps.
                """;
            case "due_diligence" -> """

                ANALYSIS CONTEXT: The attorney is conducting due diligence for a transaction.
                Tailor your answers to focus on: risks, red flags, missing information, and deal implications.
                """;
            default -> "";
        };
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