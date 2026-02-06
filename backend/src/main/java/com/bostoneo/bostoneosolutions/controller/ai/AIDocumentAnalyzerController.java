package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.model.ActionItem;
import com.bostoneo.bostoneosolutions.model.AIAnalysisMessage;
import com.bostoneo.bostoneosolutions.model.AIDocumentAnalysis;
import com.bostoneo.bostoneosolutions.model.TimelineEvent;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.ActionItemRepository;
import com.bostoneo.bostoneosolutions.repository.AIAnalysisMessageRepository;
import com.bostoneo.bostoneosolutions.repository.TimelineEventRepository;
import com.bostoneo.bostoneosolutions.service.AIDocumentAnalysisService;
import com.bostoneo.bostoneosolutions.util.CloudStorageUrlConverter;
import org.springframework.transaction.annotation.Transactional;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.async.DeferredResult;
import org.springframework.web.multipart.MultipartFile;

import javax.net.ssl.*;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.security.cert.X509Certificate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/ai/document-analyzer")
@RequiredArgsConstructor
@Slf4j
public class AIDocumentAnalyzerController {

    private final AIDocumentAnalysisService documentAnalysisService;
    private final ActionItemRepository actionItemRepository;
    private final TimelineEventRepository timelineEventRepository;
    private final AIAnalysisMessageRepository analysisMessageRepository;
    private final CloudStorageUrlConverter urlConverter;
    private final TenantService tenantService;

    /**
     * Helper method to get the current organization ID (required for tenant isolation)
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    /**
     * SECURITY: Get current authenticated user's ID - never use hardcoded defaults
     */
    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof UserDTO) {
                return ((UserDTO) principal).getId();
            } else if (principal instanceof UserPrincipal) {
                return ((UserPrincipal) principal).getUser().getId();
            }
        }
        throw new RuntimeException("Authentication required - could not determine current user");
    }

    // RestTemplate with SSL support for fetching documents from various sources
    private final RestTemplate restTemplate = createRestTemplate();

    // Static initializer to configure SSL trust for HTTPS connections
    static {
        try {
            // Create a trust manager that trusts all certificates
            TrustManager[] trustAllCerts = new TrustManager[]{
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() { return null; }
                    public void checkClientTrusted(X509Certificate[] certs, String authType) { }
                    public void checkServerTrusted(X509Certificate[] certs, String authType) { }
                }
            };

            // Install the all-trusting trust manager
            SSLContext sc = SSLContext.getInstance("TLS");
            sc.init(null, trustAllCerts, new java.security.SecureRandom());
            HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());

            // Create all-trusting host name verifier
            HostnameVerifier allHostsValid = (hostname, session) -> true;
            HttpsURLConnection.setDefaultHostnameVerifier(allHostsValid);
        } catch (Exception e) {
            // Log will not be available in static block, use stderr
            System.err.println("Failed to configure SSL trust: " + e.getMessage());
        }
    }

    private static RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory() {
            @Override
            protected void prepareConnection(HttpURLConnection connection, String httpMethod) throws IOException {
                super.prepareConnection(connection, httpMethod);
                connection.setInstanceFollowRedirects(true);

                // For HTTPS connections, the static initializer already configured SSL trust
                if (connection instanceof HttpsURLConnection) {
                    HttpsURLConnection httpsConnection = (HttpsURLConnection) connection;
                    httpsConnection.setHostnameVerifier((hostname, session) -> true);
                }
            }
        };
        factory.setConnectTimeout(30000); // 30 seconds
        factory.setReadTimeout(60000); // 60 seconds for large documents
        return new RestTemplate(factory);
    }

    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DeferredResult<ResponseEntity<Map<String, Object>>> analyzeDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam("analysisType") String analysisType,
            @RequestParam(value = "userId", required = false) Long userId,
            @RequestParam(value = "caseId", required = false) Long caseId,
            @RequestParam(value = "sessionId", required = false) Long sessionId,
            @RequestParam(value = "analysisContext", required = false, defaultValue = "general") String analysisContext) {

        log.info("Analyzing document: {}, type: {}, analysis: {}, context: {}, sessionId: {}",
                file.getOriginalFilename(), file.getContentType(), analysisType, analysisContext, sessionId);

        // Set timeout to 600 seconds (10 minutes) for Claude Sonnet 4 extended thinking with complex documents
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(600000L);

        // SECURITY: Always use authenticated user - never allow userId parameter override
        Long effectiveUserId = getCurrentUserId();

        documentAnalysisService.analyzeDocument(file, analysisType, effectiveUserId, caseId, sessionId, analysisContext)
                .thenApply(analysis -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("id", analysis.getAnalysisId());
                    result.put("databaseId", analysis.getId()); // Numeric database ID for action items
                    result.put("fileName", analysis.getFileName());
                    result.put("fileSize", analysis.getFileSize());
                    result.put("analysisType", analysis.getAnalysisType());
                    result.put("status", analysis.getStatus());
                    result.put("timestamp", analysis.getCreatedAt().toString());

                    // Add detected type and metadata
                    result.put("detectedType", analysis.getDetectedType());
                    result.put("extractedMetadata", analysis.getExtractedMetadata());
                    result.put("requiresOcr", analysis.getRequiresOcr());

                    if ("completed".equals(analysis.getStatus())) {
                        Map<String, Object> analysisData = new HashMap<>();
                        analysisData.put("fullAnalysis", analysis.getAnalysisResult());
                        analysisData.put("summary", analysis.getSummary());
                        analysisData.put("riskScore", analysis.getRiskScore());
                        analysisData.put("riskLevel", analysis.getRiskLevel());
                        result.put("analysis", analysisData);
                    }

                    return ResponseEntity.ok(result);
                })
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Error analyzing document: {}", ex.getMessage(), ex);
                        Map<String, Object> error = new HashMap<>();
                        error.put("status", "failed");
                        error.put("error", ex.getMessage());
                        deferredResult.setResult(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error));
                    } else {
                        deferredResult.setResult(result);
                    }
                });

        // Set timeout fallback
        deferredResult.onTimeout(() -> {
            log.warn("Document analysis request timed out");
            Map<String, Object> error = new HashMap<>();
            error.put("status", "failed");
            error.put("error", "Analysis request timed out");
            deferredResult.setResult(ResponseEntity.status(HttpStatus.REQUEST_TIMEOUT).body(error));
        });

        return deferredResult;
    }

    @GetMapping("/analysis-history")
    public ResponseEntity<Map<String, Object>> getAnalysisHistory(
            @RequestParam(value = "userId", required = false) Long userId,
            Authentication authentication) {

        // Get user ID from authentication, fall back to request param
        Long effectiveUserId = extractUserId(authentication);
        if (effectiveUserId == null) {
            effectiveUserId = userId;
        }
        if (effectiveUserId == null) {
            log.warn("Could not determine user ID for analysis history - returning empty list");
            Map<String, Object> response = new HashMap<>();
            response.put("analyses", List.of());
            response.put("total", 0);
            return ResponseEntity.ok(response);
        }

        log.info("Fetching analysis history for user: {}", effectiveUserId);
        Map<String, Object> response = new HashMap<>();
        var analyses = documentAnalysisService.getAnalysisHistory(effectiveUserId);
        response.put("analyses", analyses);
        response.put("total", analyses.size());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/analysis/by-case/{caseId}")
    public ResponseEntity<Map<String, Object>> getAnalysesByCase(@PathVariable Long caseId) {
        List<AIDocumentAnalysis> analyses = documentAnalysisService.getAnalysesByCaseId(caseId);

        List<Map<String, Object>> analysesList = analyses.stream().map(analysis -> {
            Map<String, Object> result = new HashMap<>();
            result.put("id", analysis.getAnalysisId());
            result.put("databaseId", analysis.getId());
            result.put("fileName", analysis.getFileName());
            result.put("fileType", analysis.getFileType());
            result.put("fileSize", analysis.getFileSize());
            result.put("analysisType", analysis.getAnalysisType());
            result.put("analysisContext", analysis.getAnalysisContext());
            result.put("status", analysis.getStatus());
            result.put("detectedType", analysis.getDetectedType());
            result.put("riskScore", analysis.getRiskScore());
            result.put("riskLevel", analysis.getRiskLevel());
            result.put("summary", analysis.getSummary());
            result.put("createdAt", analysis.getCreatedAt() != null ? analysis.getCreatedAt().toString() : null);
            return result;
        }).collect(java.util.stream.Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("analyses", analysesList);
        response.put("count", analysesList.size());
        response.put("caseId", caseId);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/analysis/{analysisId}")
    public ResponseEntity<Map<String, Object>> getAnalysisById(@PathVariable String analysisId) {
        return documentAnalysisService.getAnalysisById(analysisId)
                .map(analysis -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("id", analysis.getAnalysisId());
                    result.put("databaseId", analysis.getId()); // Numeric database ID for action items
                    result.put("fileName", analysis.getFileName());
                    result.put("fileSize", analysis.getFileSize());
                    result.put("analysisType", analysis.getAnalysisType());
                    result.put("status", analysis.getStatus());
                    result.put("timestamp", analysis.getCreatedAt().toString());

                    // Add detected type and metadata
                    result.put("detectedType", analysis.getDetectedType());
                    result.put("extractedMetadata", analysis.getExtractedMetadata());
                    result.put("requiresOcr", analysis.getRequiresOcr());

                    if ("completed".equals(analysis.getStatus())) {
                        Map<String, Object> analysisData = new HashMap<>();
                        analysisData.put("fullAnalysis", analysis.getAnalysisResult());
                        analysisData.put("summary", analysis.getSummary());
                        analysisData.put("riskScore", analysis.getRiskScore());
                        analysisData.put("riskLevel", analysis.getRiskLevel());
                        result.put("analysis", analysisData);
                    }

                    return ResponseEntity.ok(result);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/analysis/db/{databaseId}")
    public ResponseEntity<Map<String, Object>> getAnalysisByDatabaseId(@PathVariable Long databaseId) {
        return documentAnalysisService.getAnalysisByDatabaseId(databaseId)
                .map(analysis -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("id", analysis.getAnalysisId());
                    result.put("databaseId", analysis.getId());
                    result.put("fileName", analysis.getFileName());
                    result.put("fileSize", analysis.getFileSize());
                    result.put("analysisType", analysis.getAnalysisType());
                    result.put("status", analysis.getStatus());
                    result.put("timestamp", analysis.getCreatedAt().toString());

                    result.put("detectedType", analysis.getDetectedType());
                    result.put("extractedMetadata", analysis.getExtractedMetadata());
                    result.put("requiresOcr", analysis.getRequiresOcr());

                    if ("completed".equals(analysis.getStatus())) {
                        Map<String, Object> analysisData = new HashMap<>();
                        analysisData.put("fullAnalysis", analysis.getAnalysisResult());
                        analysisData.put("summary", analysis.getSummary());
                        analysisData.put("riskScore", analysis.getRiskScore());
                        analysisData.put("riskLevel", analysis.getRiskLevel());
                        result.put("analysis", analysisData);
                    }

                    return ResponseEntity.ok(result);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getAnalysisStats() {

        // SECURITY: Always use authenticated user - never allow userId parameter override
        Long effectiveUserId = getCurrentUserId();

        return ResponseEntity.ok(documentAnalysisService.getAnalysisStats(effectiveUserId));
    }

    /**
     * Fetches a document from a URL (supports cloud storage URLs and direct URLs).
     * This endpoint acts as a proxy to avoid CORS issues and supports cloud storage URL conversion.
     */
    @PostMapping("/fetch-url")
    public ResponseEntity<?> fetchDocumentFromUrl(@RequestBody Map<String, String> request) {
        String url = request.get("url");

        if (url == null || url.trim().isEmpty()) {
            log.warn("Fetch URL request with empty URL");
            return ResponseEntity.badRequest().body(
                    Map.of("error", "URL is required")
            );
        }

        log.info("Fetching document from URL: {}", url);

        // Validate URL safety (SSRF protection)
        if (!urlConverter.isSafeUrl(url)) {
            log.warn("Blocked unsafe URL: {}", url);
            return ResponseEntity.badRequest().body(
                    Map.of("error", "URL is not allowed (private/internal addresses blocked)")
            );
        }

        try {
            // Convert cloud storage sharing URLs to direct download URLs
            String directUrl = urlConverter.convertToDirectUrl(url);
            String provider = urlConverter.getProviderName(url);
            log.info("Provider: {}, Direct URL: {}", provider, directUrl);

            // Set up request headers - mimic a real browser to avoid 403 errors
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7");
            headers.set("Accept-Language", "en-US,en;q=0.9");
            headers.set("Accept-Encoding", "identity"); // Don't request compressed responses
            headers.set("Connection", "keep-alive");
            headers.set("Upgrade-Insecure-Requests", "1");
            headers.set("Sec-Fetch-Dest", "document");
            headers.set("Sec-Fetch-Mode", "navigate");
            headers.set("Sec-Fetch-Site", "none");
            headers.set("Sec-Fetch-User", "?1");
            headers.set("Cache-Control", "max-age=0");

            HttpEntity<String> entity = new HttpEntity<>(headers);

            // Fetch the document
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    directUrl,
                    HttpMethod.GET,
                    entity,
                    byte[].class
            );

            if (response.getStatusCode() != HttpStatus.OK || response.getBody() == null) {
                log.error("Failed to fetch document: HTTP {}", response.getStatusCode());
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(
                        Map.of("error", "Failed to fetch document from URL")
                );
            }

            byte[] fileBytes = response.getBody();
            log.info("Successfully fetched {} bytes from {}", fileBytes.length, provider);

            // Detect content type
            String contentType = "application/octet-stream";
            if (response.getHeaders().getContentType() != null) {
                contentType = response.getHeaders().getContentType().toString();
            } else {
                // Try to detect from URL
                String lowerUrl = url.toLowerCase();
                if (lowerUrl.endsWith(".pdf")) contentType = "application/pdf";
                else if (lowerUrl.endsWith(".doc")) contentType = "application/msword";
                else if (lowerUrl.endsWith(".docx")) contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                else if (lowerUrl.endsWith(".txt")) contentType = "text/plain";
            }

            // Extract filename from URL
            String filename = extractFilename(url);

            // Return the file bytes with appropriate headers
            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.parseMediaType(contentType));
            responseHeaders.setContentLength(fileBytes.length);
            responseHeaders.setContentDisposition(
                    ContentDisposition.builder("attachment")
                            .filename(filename)
                            .build()
            );

            return ResponseEntity.ok()
                    .headers(responseHeaders)
                    .body(fileBytes);

        } catch (org.springframework.web.client.HttpClientErrorException.Forbidden e) {
            // 403 Forbidden - website is blocking automated access
            log.error("403 Forbidden when fetching document from URL: {}", url);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                    Map.of(
                        "error", "This website blocks automated access. Please download the document manually and upload it instead.",
                        "code", "FORBIDDEN",
                        "suggestion", "Download the file from your browser and use the file upload option."
                    )
            );
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            // Other HTTP client errors (404, 401, etc.)
            log.error("HTTP error {} when fetching document from URL: {}", e.getStatusCode(), url);
            return ResponseEntity.status(e.getStatusCode()).body(
                    Map.of("error", "Failed to fetch document: " + e.getStatusText())
            );
        } catch (Exception e) {
            log.error("Error fetching document from URL: {}", url, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                    Map.of("error", "Failed to fetch document: " + e.getMessage())
            );
        }
    }

    /**
     * Extracts a reasonable filename from a URL.
     */
    private String extractFilename(String url) {
        try {
            // Try to get filename from URL path
            String path = new java.net.URI(url).getPath();
            String[] parts = path.split("/");
            String lastPart = parts[parts.length - 1];

            if (lastPart != null && !lastPart.isEmpty() && lastPart.contains(".")) {
                return lastPart;
            }

            // Fallback to a generic name
            return "document.pdf";

        } catch (Exception e) {
            return "document.pdf";
        }
    }

    @GetMapping("/analysis/{analysisId}/action-items")
    public ResponseEntity<List<ActionItem>> getActionItems(@PathVariable Long analysisId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Fetching action items for analysis ID: {} in org: {}", analysisId, orgId);
        List<ActionItem> items = actionItemRepository.findByOrganizationIdAndAnalysisIdOrderByDeadlineAsc(orgId, analysisId);
        log.info("Found {} action items", items.size());
        return ResponseEntity.ok(items);
    }

    @PutMapping("/action-items/{id}")
    public ResponseEntity<ActionItem> updateActionItem(
            @PathVariable Long id,
            @RequestBody ActionItem updates) {
        Long orgId = getRequiredOrganizationId();
        log.info("Updating action item {} in org {}: {}", id, orgId, updates);
        return actionItemRepository.findByIdAndOrganizationId(id, orgId)
                .map(item -> {
                    if (updates.getStatus() != null) {
                        item.setStatus(updates.getStatus());
                    }
                    if (updates.getPriority() != null) {
                        item.setPriority(updates.getPriority());
                    }
                    ActionItem saved = actionItemRepository.save(item);
                    log.info("Updated action item: {}", saved);
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/analysis/{analysisId}/timeline-events")
    public ResponseEntity<List<TimelineEvent>> getTimelineEvents(@PathVariable Long analysisId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Fetching timeline events for analysis ID: {} in org: {}", analysisId, orgId);
        List<TimelineEvent> events = timelineEventRepository.findByOrganizationIdAndAnalysisIdOrderByEventDateAsc(orgId, analysisId);
        log.info("Found {} timeline events", events.size());
        return ResponseEntity.ok(events);
    }

    // ==========================================
    // Ask AI Message Endpoints
    // ==========================================

    /**
     * Get all messages for a specific document analysis (Ask AI tab history) - TENANT FILTERED
     */
    @GetMapping("/analysis/{analysisId}/messages")
    public ResponseEntity<Map<String, Object>> getAnalysisMessages(@PathVariable Long analysisId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Fetching Ask AI messages for analysis ID: {} in org: {}", analysisId, orgId);
        List<AIAnalysisMessage> messages = analysisMessageRepository.findByOrganizationIdAndAnalysisIdOrderByCreatedAtAsc(orgId, analysisId);
        log.info("Found {} messages", messages.size());

        Map<String, Object> response = new HashMap<>();
        response.put("messages", messages);
        response.put("count", messages.size());
        response.put("analysisId", analysisId);

        return ResponseEntity.ok(response);
    }

    /**
     * Add a new message to a document analysis (Ask AI tab) - TENANT FILTERED
     */
    @PostMapping("/analysis/{analysisId}/messages")
    public ResponseEntity<AIAnalysisMessage> addAnalysisMessage(
            @PathVariable Long analysisId,
            @RequestBody Map<String, Object> request) {

        Long orgId = getRequiredOrganizationId();
        String role = (String) request.get("role");
        String content = (String) request.get("content");
        Long userId = request.get("userId") != null ? ((Number) request.get("userId")).longValue() : 1L;

        if (role == null || content == null) {
            log.warn("Invalid message request: role and content are required");
            return ResponseEntity.badRequest().build();
        }

        log.info("Adding {} message to analysis {} in org {}", role, analysisId, orgId);

        AIAnalysisMessage message = new AIAnalysisMessage();
        message.setAnalysisId(analysisId);
        message.setRole(role);
        message.setContent(content);
        message.setUserId(userId);
        message.setOrganizationId(orgId);

        AIAnalysisMessage saved = analysisMessageRepository.save(message);
        log.info("Saved message with ID: {}", saved.getId());

        return ResponseEntity.ok(saved);
    }

    /**
     * Get message count for a specific analysis (for sidebar indicator) - TENANT FILTERED
     */
    @GetMapping("/analysis/{analysisId}/messages/count")
    public ResponseEntity<Map<String, Object>> getMessageCount(@PathVariable Long analysisId) {
        Long orgId = getRequiredOrganizationId();
        long count = analysisMessageRepository.countByOrganizationIdAndAnalysisId(orgId, analysisId);

        Map<String, Object> response = new HashMap<>();
        response.put("count", count);
        response.put("analysisId", analysisId);

        return ResponseEntity.ok(response);
    }

    /**
     * Delete all messages for a specific analysis - TENANT FILTERED
     */
    @DeleteMapping("/analysis/{analysisId}/messages")
    public ResponseEntity<Map<String, Object>> deleteAnalysisMessages(@PathVariable Long analysisId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting all messages for analysis ID: {} in org: {}", analysisId, orgId);
        analysisMessageRepository.deleteByOrganizationIdAndAnalysisId(orgId, analysisId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("analysisId", analysisId);

        return ResponseEntity.ok(response);
    }

    /**
     * Delete a document analysis and all related data (messages, action items, timeline events)
     */
    @DeleteMapping("/analysis/{analysisId}")
    @Transactional
    public ResponseEntity<Map<String, Object>> deleteAnalysis(@PathVariable Long analysisId) {
        log.info("🗑️ Deleting analysis ID: {}", analysisId);

        try {
            Long orgId = getRequiredOrganizationId();

            // SECURITY: First verify the analysis belongs to the current organization
            // NOTE: Use getAnalysisByDatabaseId (not getAnalysisById which expects UUID analysis_id)
            Optional<AIDocumentAnalysis> analysisOpt = documentAnalysisService.getAnalysisByDatabaseId(analysisId);
            if (analysisOpt.isEmpty() || !orgId.equals(analysisOpt.get().getOrganizationId())) {
                log.warn("Attempted to delete analysis {} that doesn't belong to org {}", analysisId, orgId);
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Analysis not found or access denied"));
            }

            // Delete related data first - SECURITY: Use org-filtered deletes
            analysisMessageRepository.deleteByOrganizationIdAndAnalysisId(orgId, analysisId);
            actionItemRepository.deleteByOrganizationIdAndAnalysisId(orgId, analysisId);
            timelineEventRepository.deleteByOrganizationIdAndAnalysisId(orgId, analysisId);

            // Delete the analysis itself
            documentAnalysisService.deleteAnalysis(analysisId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("analysisId", analysisId);
            response.put("message", "Analysis and all related data deleted successfully");

            log.info("✅ Analysis {} deleted successfully", analysisId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("❌ Failed to delete analysis {}: {}", analysisId, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to delete analysis: " + e.getMessage()));
        }
    }

    /**
     * Extract user ID from authentication principal
     */
    private Long extractUserId(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            return null;
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDTO) {
            return ((UserDTO) principal).getId();
        } else if (principal instanceof UserPrincipal) {
            return ((UserPrincipal) principal).getUser().getId();
        }

        log.warn("Unknown principal type: {}", principal.getClass().getName());
        return null;
    }

    /**
     * Ask AI a question about a specific document analysis - TENANT FILTERED
     * This endpoint calls Claude with the full document context
     */
    @PostMapping("/analysis/{analysisId}/ask")
    public ResponseEntity<Map<String, Object>> askAboutDocument(
            @PathVariable Long analysisId,
            @RequestBody Map<String, Object> request) {

        Long orgId = getRequiredOrganizationId();
        String question = (String) request.get("question");
        Long userId = request.get("userId") != null ? ((Number) request.get("userId")).longValue() : 1L;

        if (question == null || question.trim().isEmpty()) {
            log.warn("Invalid ask request: question is required");
            return ResponseEntity.badRequest().body(Map.of("error", "Question is required"));
        }

        log.info("🤖 Ask AI request for analysis {} in org {}: {}", analysisId, orgId, question.substring(0, Math.min(50, question.length())));

        try {
            // Get the AI response from the service
            String aiResponse = documentAnalysisService.askAboutDocument(analysisId, question, userId);

            // Save user message with organization ID
            AIAnalysisMessage userMessage = new AIAnalysisMessage();
            userMessage.setAnalysisId(analysisId);
            userMessage.setRole("user");
            userMessage.setContent(question);
            userMessage.setUserId(userId);
            userMessage.setOrganizationId(orgId);
            analysisMessageRepository.save(userMessage);

            // Save AI response with organization ID
            AIAnalysisMessage assistantMessage = new AIAnalysisMessage();
            assistantMessage.setAnalysisId(analysisId);
            assistantMessage.setRole("assistant");
            assistantMessage.setContent(aiResponse);
            assistantMessage.setUserId(userId);
            assistantMessage.setOrganizationId(orgId);
            AIAnalysisMessage savedResponse = analysisMessageRepository.save(assistantMessage);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("answer", aiResponse);
            response.put("messageId", savedResponse.getId());
            response.put("analysisId", analysisId);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Failed to process Ask AI request: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to process question: " + e.getMessage(),
                "analysisId", analysisId
            ));
        }
    }

}