package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AiAuditLog;
import com.bostoneo.bostoneosolutions.repository.AiAuditLogRepository;
import com.bostoneo.bostoneosolutions.utils.PiiDetector;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Service for logging AI API calls to the ai_audit_logs table.
 * All logging is async (non-blocking) to avoid impacting AI response times.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiAuditLogService {

    private final AiAuditLogRepository aiAuditLogRepository;

    private static final int MAX_PAYLOAD_LENGTH = 500;
    private static final int MAX_RESPONSE_LENGTH = 500;

    /**
     * Log an AI API call asynchronously. Never blocks the caller.
     */
    public void logAiCall(Long userId, String userEmail, String userRole,
                          Long organizationId, String action, String resourceType,
                          Long resourceId, String ipAddress, String userAgent,
                          String requestPayload, String responseSummary,
                          boolean wasSuccessful, String errorDetails) {

        CompletableFuture.runAsync(() -> {
            try {
                boolean containsPii = PiiDetector.containsPii(requestPayload);
                if (containsPii) {
                    String piiTypes = PiiDetector.detectPiiTypes(requestPayload);
                    log.warn("PII detected in AI request (types: {}). User: {}, Action: {}",
                            piiTypes, userEmail, action);
                }

                AiAuditLog auditLog = AiAuditLog.builder()
                        .userId(userId)
                        .userEmail(userEmail)
                        .userRole(userRole)
                        .organizationId(organizationId)
                        .action(action)
                        .resourceType(resourceType)
                        .resourceId(resourceId)
                        .ipAddress(ipAddress)
                        .userAgent(userAgent)
                        .requestPayload(truncateToJson(requestPayload, MAX_PAYLOAD_LENGTH))
                        .responseSummary(truncate(responseSummary, MAX_RESPONSE_LENGTH))
                        .wasSuccessful(wasSuccessful)
                        .errorDetails(errorDetails)
                        .containsPii(containsPii)
                        .dataClassification("confidential")
                        .createdAt(LocalDateTime.now())
                        .build();

                aiAuditLogRepository.save(auditLog);
                log.debug("AI audit log saved: action={}, user={}, pii={}", action, userEmail, containsPii);

            } catch (Exception e) {
                // Never let audit logging propagate errors
                log.error("Failed to log AI call: {}", e.getMessage());
            }
        });
    }

    /**
     * Log a document-generation gating event (watermarked draft, overdue template, disclaimer injection).
     * Unlike {@link #logAiCall}, this emits a structured JSONB payload (no {@code {"summary":...}} wrapper)
     * so ai_audit_logs rows remain queryable by specific fields (templateType, approvalStatus, etc.).
     */
    public void logGenerationEvent(Long userId, String userEmail, String userRole,
                                   Long organizationId, String action,
                                   String resourceType, Long resourceId,
                                   Map<String, Object> structuredPayload,
                                   String responseSummary,
                                   boolean wasSuccessful, String errorDetails) {

        CompletableFuture.runAsync(() -> {
            try {
                AiAuditLog auditLog = AiAuditLog.builder()
                        .userId(userId)
                        .userEmail(userEmail)
                        .userRole(userRole)
                        .organizationId(organizationId)
                        .action(action)
                        .resourceType(resourceType)
                        .resourceId(resourceId)
                        .requestPayload(toJson(structuredPayload))
                        .responseSummary(truncate(responseSummary, MAX_RESPONSE_LENGTH))
                        .wasSuccessful(wasSuccessful)
                        .errorDetails(errorDetails)
                        .containsPii(false)
                        .dataClassification("internal")
                        .createdAt(LocalDateTime.now())
                        .build();

                aiAuditLogRepository.save(auditLog);
                log.debug("AI generation event logged: action={}, user={}, resource={}", action, userEmail, resourceId);

            } catch (Exception e) {
                log.error("Failed to log generation event: {}", e.getMessage());
            }
        });
    }

    /**
     * Log a data retention deletion event.
     */
    public void logRetentionDeletion(String tableName, int deletedCount, int retentionDays) {
        CompletableFuture.runAsync(() -> {
            try {
                AiAuditLog auditLog = AiAuditLog.builder()
                        .userId(0L)
                        .userEmail("system")
                        .userRole("SYSTEM")
                        .organizationId(0L)
                        .action("DATA_RETENTION_CLEANUP")
                        .resourceType(tableName)
                        .requestPayload(String.format(
                                "{\"table\":\"%s\",\"deleted_count\":%d,\"retention_days\":%d}",
                                tableName, deletedCount, retentionDays))
                        .responseSummary("Deleted " + deletedCount + " rows from " + tableName)
                        .wasSuccessful(true)
                        .containsPii(false)
                        .dataClassification("internal")
                        .createdAt(LocalDateTime.now())
                        .build();

                aiAuditLogRepository.save(auditLog);
            } catch (Exception e) {
                log.error("Failed to log retention deletion: {}", e.getMessage());
            }
        });
    }

    private String truncate(String text, int maxLength) {
        if (text == null) return "";
        if (text.length() <= maxLength) return text;
        return text.substring(0, maxLength) + "...[truncated]";
    }

    /**
     * Truncate and wrap in a JSON object for the JSONB column.
     */
    private String truncateToJson(String text, int maxLength) {
        if (text == null) return "{}";
        String truncated = truncate(text, maxLength);
        // Escape for JSON string value
        truncated = truncated.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
        return "{\"summary\":\"" + truncated + "\"}";
    }

    /**
     * Minimal JSON serializer for structured audit payloads. Enough for flat
     * gating events (string/number/boolean scalars). Not a general JSON writer.
     */
    private String toJson(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) return "{}";
        Map<String, Object> ordered = new LinkedHashMap<>(payload);
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> entry : ordered.entrySet()) {
            if (!first) sb.append(",");
            first = false;
            sb.append("\"").append(escapeJson(entry.getKey())).append("\":");
            appendJsonValue(sb, entry.getValue());
        }
        sb.append("}");
        return sb.toString();
    }

    private void appendJsonValue(StringBuilder sb, Object value) {
        if (value == null) {
            sb.append("null");
        } else if (value instanceof Number || value instanceof Boolean) {
            sb.append(value.toString());
        } else {
            sb.append("\"").append(escapeJson(value.toString())).append("\"");
        }
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
