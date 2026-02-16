package com.bostoneo.bostoneosolutions.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Scheduled job that cleans up old AI data per the configured retention period.
 * Tables cleaned: ai_research_cache, ai_conversation_messages, ai_conversation_sessions.
 * Deletions are logged to ai_audit_logs via AiAuditLogService.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiDataRetentionService {

    private final NamedParameterJdbcTemplate jdbc;
    private final AiAuditLogService aiAuditLogService;

    @Value("${ai.data-retention.days:90}")
    private int retentionDays;

    @Value("${app.documents.output-path:uploads/documents}")
    private String documentsOutputPath;

    /**
     * Runs daily at 2:00 AM. Deletes AI data older than the retention period.
     */
    @Scheduled(cron = "0 0 2 * * *")
    public void cleanupExpiredData() {
        log.info("Starting AI data retention cleanup (retention: {} days)", retentionDays);
        LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);

        cleanupResearchCache(cutoff);
        cleanupConversationMessages(cutoff);
        cleanupConversationSessions(cutoff);
        cleanupDocumentAnalyses(cutoff);

        log.info("AI data retention cleanup complete");
    }

    private void cleanupResearchCache(LocalDateTime cutoff) {
        try {
            // ai_research_cache has expires_at — delete expired rows
            int deleted = jdbc.update(
                    "DELETE FROM ai_research_cache WHERE expires_at < :cutoff",
                    Map.of("cutoff", cutoff));
            if (deleted > 0) {
                log.info("Deleted {} expired rows from ai_research_cache", deleted);
                aiAuditLogService.logRetentionDeletion("ai_research_cache", deleted, retentionDays);
            }
        } catch (Exception e) {
            log.error("Failed to clean ai_research_cache: {}", e.getMessage());
        }
    }

    private void cleanupConversationMessages(LocalDateTime cutoff) {
        try {
            // Delete messages belonging to archived sessions older than retention period
            int deleted = jdbc.update("""
                    DELETE FROM ai_conversation_messages
                    WHERE session_id IN (
                        SELECT id FROM ai_conversation_sessions
                        WHERE is_archived = true AND created_at < :cutoff
                    )
                    """, Map.of("cutoff", cutoff));
            if (deleted > 0) {
                log.info("Deleted {} old archived messages from ai_conversation_messages", deleted);
                aiAuditLogService.logRetentionDeletion("ai_conversation_messages", deleted, retentionDays);
            }
        } catch (Exception e) {
            log.error("Failed to clean ai_conversation_messages: {}", e.getMessage());
        }
    }

    private void cleanupConversationSessions(LocalDateTime cutoff) {
        try {
            // Delete archived sessions older than retention period (messages already deleted above)
            int deleted = jdbc.update("""
                    DELETE FROM ai_conversation_sessions
                    WHERE is_archived = true AND created_at < :cutoff
                    """, Map.of("cutoff", cutoff));
            if (deleted > 0) {
                log.info("Deleted {} old archived sessions from ai_conversation_sessions", deleted);
                aiAuditLogService.logRetentionDeletion("ai_conversation_sessions", deleted, retentionDays);
            }
        } catch (Exception e) {
            log.error("Failed to clean ai_conversation_sessions: {}", e.getMessage());
        }
    }

    private void cleanupDocumentAnalyses(LocalDateTime cutoff) {
        try {
            // Find archived analyses older than retention period — get file names for physical deletion
            List<Map<String, Object>> rows = jdbc.queryForList("""
                    SELECT id, file_name FROM ai_document_analysis
                    WHERE is_archived = true AND created_at < :cutoff
                    """, Map.of("cutoff", cutoff));

            if (rows.isEmpty()) {
                return;
            }

            // Delete physical files
            Path uploadDir = Paths.get(documentsOutputPath);
            int filesDeleted = 0;
            for (Map<String, Object> row : rows) {
                String fileName = (String) row.get("file_name");
                if (fileName != null && !fileName.isEmpty()) {
                    try {
                        Path filePath = uploadDir.resolve(fileName);
                        if (Files.deleteIfExists(filePath)) {
                            filesDeleted++;
                        }
                    } catch (Exception e) {
                        log.warn("Failed to delete document file {}: {}", fileName, e.getMessage());
                    }
                }
            }

            // Delete DB records
            int deleted = jdbc.update("""
                    DELETE FROM ai_document_analysis
                    WHERE is_archived = true AND created_at < :cutoff
                    """, Map.of("cutoff", cutoff));

            if (deleted > 0) {
                log.info("Deleted {} old archived document analyses ({} physical files)", deleted, filesDeleted);
                aiAuditLogService.logRetentionDeletion("ai_document_analysis", deleted, retentionDays);
            }
        } catch (Exception e) {
            log.error("Failed to clean ai_document_analysis: {}", e.getMessage());
        }
    }
}
