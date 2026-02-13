package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AiAuditLog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Repository for ai_audit_logs table using NamedParameterJdbcTemplate.
 * Follows existing codebase pattern (EventRepositoryImpl, etc.).
 */
@Repository
@RequiredArgsConstructor
@Slf4j
public class AiAuditLogRepository {

    private final NamedParameterJdbcTemplate jdbc;

    private static final String INSERT_AUDIT_LOG = """
            INSERT INTO ai_audit_logs (
                user_id, user_email, user_role, organization_id,
                action, resource_type, resource_id,
                ip_address, user_agent,
                request_payload, response_summary,
                was_successful, error_details,
                contains_pii, data_classification, created_at
            ) VALUES (
                :userId, :userEmail, :userRole, :organizationId,
                :action, :resourceType, :resourceId,
                :ipAddress, :userAgent,
                CAST(:requestPayload AS jsonb), :responseSummary,
                :wasSuccessful, :errorDetails,
                :containsPii, :dataClassification, :createdAt
            )
            """;

    private static final String DELETE_OLD_LOGS = """
            DELETE FROM ai_audit_logs
            WHERE created_at < :cutoffDate
            """;

    private static final String COUNT_DELETED = """
            SELECT COUNT(*) FROM ai_audit_logs
            WHERE created_at < :cutoffDate
            """;

    public void save(AiAuditLog auditLog) {
        try {
            jdbc.update(INSERT_AUDIT_LOG, Map.ofEntries(
                    Map.entry("userId", auditLog.getUserId() != null ? auditLog.getUserId() : 0L),
                    Map.entry("userEmail", auditLog.getUserEmail() != null ? auditLog.getUserEmail() : "unknown"),
                    Map.entry("userRole", auditLog.getUserRole() != null ? auditLog.getUserRole() : "unknown"),
                    Map.entry("organizationId", auditLog.getOrganizationId() != null ? auditLog.getOrganizationId() : 0L),
                    Map.entry("action", auditLog.getAction() != null ? auditLog.getAction() : "AI_QUERY"),
                    Map.entry("resourceType", auditLog.getResourceType() != null ? auditLog.getResourceType() : "AI_COMPLETION"),
                    Map.entry("resourceId", auditLog.getResourceId() != null ? auditLog.getResourceId() : 0L),
                    Map.entry("ipAddress", auditLog.getIpAddress() != null ? auditLog.getIpAddress() : ""),
                    Map.entry("userAgent", auditLog.getUserAgent() != null ? auditLog.getUserAgent() : ""),
                    Map.entry("requestPayload", auditLog.getRequestPayload() != null ? auditLog.getRequestPayload() : "{}"),
                    Map.entry("responseSummary", auditLog.getResponseSummary() != null ? auditLog.getResponseSummary() : ""),
                    Map.entry("wasSuccessful", auditLog.getWasSuccessful() != null ? auditLog.getWasSuccessful() : false),
                    Map.entry("errorDetails", auditLog.getErrorDetails() != null ? auditLog.getErrorDetails() : ""),
                    Map.entry("containsPii", auditLog.getContainsPii() != null ? auditLog.getContainsPii() : false),
                    Map.entry("dataClassification", auditLog.getDataClassification() != null ? auditLog.getDataClassification() : "confidential"),
                    Map.entry("createdAt", auditLog.getCreatedAt() != null ? auditLog.getCreatedAt() : LocalDateTime.now())
            ));
        } catch (Exception e) {
            // Never let audit logging break the main operation
            log.error("Failed to save AI audit log: {}", e.getMessage());
        }
    }

    /**
     * Delete audit logs older than the cutoff date. Returns count of deleted rows.
     */
    public int deleteOlderThan(LocalDateTime cutoffDate) {
        return jdbc.update(DELETE_OLD_LOGS, Map.of("cutoffDate", cutoffDate));
    }

    /**
     * Count logs older than cutoff (for pre-delete reporting).
     */
    public int countOlderThan(LocalDateTime cutoffDate) {
        Integer count = jdbc.queryForObject(COUNT_DELETED, Map.of("cutoffDate", cutoffDate), Integer.class);
        return count != null ? count : 0;
    }
}
