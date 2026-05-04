package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Durable record of a template-import session. Mirrors the in-memory {@code ImportSession} so the
 * wizard can show state past the 5-minute in-memory TTL, across pod restarts, and across browser
 * close. The in-memory store remains the source of truth WHILE analysis is running; the DB row is
 * the source of truth once analysis ends or the in-memory copy expires.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "ai_template_import_jobs")
public class AITemplateImportJob {

    public enum Status { PENDING, IN_PROGRESS, PARTIAL, COMPLETED, FAILED, CANCELLED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false, unique = true)
    private UUID sessionId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private Status status;

    @Column(name = "file_count", nullable = false)
    private Integer fileCount;

    @Column(name = "ready_count", nullable = false)
    private Integer readyCount;

    @Column(name = "failed_count", nullable = false)
    private Integer failedCount;

    @Column(name = "duplicate_count", nullable = false)
    private Integer duplicateCount;

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    /**
     * Per-file mini-summary surfaced to the wizard when the in-memory session is gone.
     * List of maps, each with: filename, status, errorCode, suggestedName, suggestedDescription.
     * Kept as Map (not a strongly-typed POJO) to evolve the shape without a schema migration.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "files_summary", columnDefinition = "jsonb")
    private List<Map<String, Object>> filesSummary;

    @Column(name = "started_at", nullable = false)
    private OffsetDateTime startedAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;
}
