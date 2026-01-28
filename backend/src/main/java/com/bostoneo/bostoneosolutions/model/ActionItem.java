package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "action_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ActionItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "analysis_id", nullable = false)
    private Long analysisId;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    private LocalDate deadline;

    @Column(length = 20)
    private String priority; // CRITICAL, HIGH, MEDIUM, LOW

    @Column(length = 20)
    private String status; // PENDING, IN_PROGRESS, COMPLETED

    @Column(name = "related_section")
    private String relatedSection;

    @Column(name = "created_date")
    private LocalDateTime createdDate;

    @Column(name = "updated_date")
    private LocalDateTime updatedDate;

    @PrePersist
    protected void onCreate() {
        createdDate = LocalDateTime.now();
        updatedDate = LocalDateTime.now();
        if (status == null) {
            status = "PENDING";
        }
        if (priority == null) {
            priority = "MEDIUM";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedDate = LocalDateTime.now();
    }
}
