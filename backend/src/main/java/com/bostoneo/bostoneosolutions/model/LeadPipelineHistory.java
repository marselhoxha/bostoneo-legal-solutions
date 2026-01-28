package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

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
@Table(name = "lead_pipeline_history")
public class LeadPipelineHistory {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    /**
     * SECURITY: Organization ID for multi-tenant isolation
     */
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "lead_id", nullable = false)
    private Long leadId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_id", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Lead lead;

    @Column(name = "from_stage_id")
    private Long fromStageId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_stage_id", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private PipelineStage fromStage;

    @Column(name = "to_stage_id", nullable = false)
    private Long toStageId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_stage_id", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private PipelineStage toStage;

    @Column(name = "moved_by", nullable = false)
    private Long movedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "moved_by", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User movedByUser;

    @Column(name = "moved_at")
    private Timestamp movedAt;

    @Column(name = "duration_in_previous_stage")
    private Integer durationInPreviousStage;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "automated")
    private Boolean automated = false;

    @PrePersist
    protected void onCreate() {
        if (movedAt == null) {
            movedAt = new Timestamp(System.currentTimeMillis());
        }
    }
}