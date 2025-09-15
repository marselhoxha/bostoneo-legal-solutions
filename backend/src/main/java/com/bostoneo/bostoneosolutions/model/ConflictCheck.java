package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.sql.Timestamp;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "conflict_checks")
public class ConflictCheck {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id", columnDefinition = "BIGINT UNSIGNED")
    private Long id;

    @Column(name = "entity_type", nullable = false, length = 50)
    private String entityType;

    @Column(name = "entity_id", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private Long entityId;

    @Column(name = "check_type", nullable = false, length = 50)
    private String checkType;

    @Column(name = "search_terms", nullable = false, columnDefinition = "JSON")
    private String searchTerms;

    @Column(name = "search_parameters", columnDefinition = "JSON")
    private String searchParameters;

    @Column(name = "results", columnDefinition = "JSON")
    private String results;

    @Column(name = "status", length = 50)
    private String status = "PENDING";

    @Column(name = "confidence_score", precision = 5, scale = 2)
    private BigDecimal confidenceScore = BigDecimal.ZERO;

    @Column(name = "auto_checked")
    private Boolean autoChecked = true;

    @Column(name = "checked_by", columnDefinition = "BIGINT UNSIGNED")
    private Long checkedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "checked_by", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User checker;

    @Column(name = "checked_at")
    private Timestamp checkedAt;

    @Column(name = "resolution", length = 50)
    private String resolution;

    @Column(name = "resolution_notes", columnDefinition = "TEXT")
    private String resolutionNotes;

    @Column(name = "waiver_document_path")
    private String waiverDocumentPath;

    @Column(name = "resolved_by", columnDefinition = "BIGINT UNSIGNED")
    private Long resolvedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User resolver;

    @Column(name = "resolved_at")
    private Timestamp resolvedAt;

    @Column(name = "expires_at")
    private Timestamp expiresAt;

    @Column(name = "created_at")
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @PrePersist
    protected void onCreate() {
        Timestamp now = new Timestamp(System.currentTimeMillis());
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }
}