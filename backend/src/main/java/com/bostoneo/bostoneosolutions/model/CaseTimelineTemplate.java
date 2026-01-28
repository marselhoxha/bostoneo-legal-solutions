package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "case_timeline_templates")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CaseTimelineTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_type", nullable = false)
    private String caseType;

    @Column(name = "phase_order", nullable = false)
    private Integer phaseOrder;

    @Column(name = "phase_name", nullable = false)
    private String phaseName;

    @Column(name = "phase_description", columnDefinition = "TEXT")
    private String phaseDescription;

    @Column(name = "estimated_duration_days")
    private Integer estimatedDurationDays;

    @Column(name = "icon")
    private String icon;

    @Column(name = "color")
    private String color;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
