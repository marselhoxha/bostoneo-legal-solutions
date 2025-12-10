package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.model.ActionItem;
import com.bostoneo.bostoneosolutions.model.AIAnalysisMessage;
import com.bostoneo.bostoneosolutions.model.AIDocumentAnalysis;
import com.bostoneo.bostoneosolutions.model.TimelineEvent;
import com.bostoneo.bostoneosolutions.repository.ActionItemRepository;
import com.bostoneo.bostoneosolutions.repository.AIAnalysisMessageRepository;
import com.bostoneo.bostoneosolutions.repository.TimelineEventRepository;
import com.bostoneo.bostoneosolutions.service.AIDocumentAnalysisService;
import com.bostoneo.bostoneosolutions.util.CloudStorageUrlConverter;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.async.DeferredResult;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai/document-analyzer")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "http://localhost:4200", allowCredentials = "true")
public class AIDocumentAnalyzerController {

    private final AIDocumentAnalysisService documentAnalysisService;
    private final ActionItemRepository actionItemRepository;
    private final TimelineEventRepository timelineEventRepository;
    private final AIAnalysisMessageRepository analysisMessageRepository;
    private final CloudStorageUrlConverter urlConverter;
    private final RestTemplate restTemplate = new RestTemplate();

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

        // Use default user ID if not provided (for testing)
        Long effectiveUserId = userId != null ? userId : 1L;

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
    public ResponseEntity<Map<String, Object>> getAnalysisStats(
            @RequestParam(value = "userId", required = false) Long userId) {

        // Use default user ID if not provided (for testing)
        Long effectiveUserId = userId != null ? userId : 1L;

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

            // Set up request headers
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            headers.setAccept(java.util.List.of(MediaType.APPLICATION_OCTET_STREAM, MediaType.ALL));

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
        log.info("Fetching action items for analysis ID: {}", analysisId);
        List<ActionItem> items = actionItemRepository.findByAnalysisIdOrderByDeadlineAsc(analysisId);
        log.info("Found {} action items", items.size());
        return ResponseEntity.ok(items);
    }

    @PutMapping("/action-items/{id}")
    public ResponseEntity<ActionItem> updateActionItem(
            @PathVariable Long id,
            @RequestBody ActionItem updates) {
        log.info("Updating action item {}: {}", id, updates);
        return actionItemRepository.findById(id)
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
        log.info("Fetching timeline events for analysis ID: {}", analysisId);
        List<TimelineEvent> events = timelineEventRepository.findByAnalysisIdOrderByEventDateAsc(analysisId);
        log.info("Found {} timeline events", events.size());
        return ResponseEntity.ok(events);
    }

    // ==========================================
    // Ask AI Message Endpoints
    // ==========================================

    /**
     * Get all messages for a specific document analysis (Ask AI tab history)
     */
    @GetMapping("/analysis/{analysisId}/messages")
    public ResponseEntity<Map<String, Object>> getAnalysisMessages(@PathVariable Long analysisId) {
        log.info("Fetching Ask AI messages for analysis ID: {}", analysisId);
        List<AIAnalysisMessage> messages = analysisMessageRepository.findByAnalysisIdOrderByCreatedAtAsc(analysisId);
        log.info("Found {} messages", messages.size());

        Map<String, Object> response = new HashMap<>();
        response.put("messages", messages);
        response.put("count", messages.size());
        response.put("analysisId", analysisId);

        return ResponseEntity.ok(response);
    }

    /**
     * Add a new message to a document analysis (Ask AI tab)
     */
    @PostMapping("/analysis/{analysisId}/messages")
    public ResponseEntity<AIAnalysisMessage> addAnalysisMessage(
            @PathVariable Long analysisId,
            @RequestBody Map<String, Object> request) {

        String role = (String) request.get("role");
        String content = (String) request.get("content");
        Long userId = request.get("userId") != null ? ((Number) request.get("userId")).longValue() : 1L;

        if (role == null || content == null) {
            log.warn("Invalid message request: role and content are required");
            return ResponseEntity.badRequest().build();
        }

        log.info("Adding {} message to analysis {}", role, analysisId);

        AIAnalysisMessage message = new AIAnalysisMessage();
        message.setAnalysisId(analysisId);
        message.setRole(role);
        message.setContent(content);
        message.setUserId(userId);

        AIAnalysisMessage saved = analysisMessageRepository.save(message);
        log.info("Saved message with ID: {}", saved.getId());

        return ResponseEntity.ok(saved);
    }

    /**
     * Get message count for a specific analysis (for sidebar indicator)
     */
    @GetMapping("/analysis/{analysisId}/messages/count")
    public ResponseEntity<Map<String, Object>> getMessageCount(@PathVariable Long analysisId) {
        long count = analysisMessageRepository.countByAnalysisId(analysisId);

        Map<String, Object> response = new HashMap<>();
        response.put("count", count);
        response.put("analysisId", analysisId);

        return ResponseEntity.ok(response);
    }

    /**
     * Delete all messages for a specific analysis
     */
    @DeleteMapping("/analysis/{analysisId}/messages")
    public ResponseEntity<Map<String, Object>> deleteAnalysisMessages(@PathVariable Long analysisId) {
        log.info("Deleting all messages for analysis ID: {}", analysisId);
        analysisMessageRepository.deleteByAnalysisId(analysisId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("analysisId", analysisId);

        return ResponseEntity.ok(response);
    }

    /**
     * Delete a document analysis and all related data (messages, action items, timeline events)
     */
    @DeleteMapping("/analysis/{analysisId}")
    public ResponseEntity<Map<String, Object>> deleteAnalysis(@PathVariable Long analysisId) {
        log.info("🗑️ Deleting analysis ID: {}", analysisId);

        try {
            // Delete related data first
            analysisMessageRepository.deleteByAnalysisId(analysisId);
            actionItemRepository.deleteByAnalysisId(analysisId);
            timelineEventRepository.deleteByAnalysisId(analysisId);

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
     * Ask AI a question about a specific document analysis
     * This endpoint calls Claude with the full document context
     */
    @PostMapping("/analysis/{analysisId}/ask")
    public ResponseEntity<Map<String, Object>> askAboutDocument(
            @PathVariable Long analysisId,
            @RequestBody Map<String, Object> request) {

        String question = (String) request.get("question");
        Long userId = request.get("userId") != null ? ((Number) request.get("userId")).longValue() : 1L;

        if (question == null || question.trim().isEmpty()) {
            log.warn("Invalid ask request: question is required");
            return ResponseEntity.badRequest().body(Map.of("error", "Question is required"));
        }

        log.info("🤖 Ask AI request for analysis {}: {}", analysisId, question.substring(0, Math.min(50, question.length())));

        try {
            // Get the AI response from the service
            String aiResponse = documentAnalysisService.askAboutDocument(analysisId, question, userId);

            // Save user message
            AIAnalysisMessage userMessage = new AIAnalysisMessage();
            userMessage.setAnalysisId(analysisId);
            userMessage.setRole("user");
            userMessage.setContent(question);
            userMessage.setUserId(userId);
            analysisMessageRepository.save(userMessage);

            // Save AI response
            AIAnalysisMessage assistantMessage = new AIAnalysisMessage();
            assistantMessage.setAnalysisId(analysisId);
            assistantMessage.setRole("assistant");
            assistantMessage.setContent(aiResponse);
            assistantMessage.setUserId(userId);
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