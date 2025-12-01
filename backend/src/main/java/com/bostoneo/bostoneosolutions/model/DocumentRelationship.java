package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "document_relationships")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentRelationship {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "source_analysis_id", nullable = false)
    private Long sourceAnalysisId;

    @Column(name = "target_analysis_id", nullable = false)
    private Long targetAnalysisId;

    @Column(name = "relationship_type", nullable = false, length = 50)
    private String relationshipType;

    @Column(name = "description")
    private String description;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "created_by")
    private Long createdBy;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    // Relationship type constants
    public static final String RESPONDS_TO = "RESPONDS_TO";      // Answer -> Complaint
    public static final String AMENDS = "AMENDS";                // Amendment -> Original Contract
    public static final String SUPERSEDES = "SUPERSEDES";        // New Agreement -> Old Agreement
    public static final String REFERENCES = "REFERENCES";        // Brief -> Motion
    public static final String EXHIBITS = "EXHIBITS";            // Exhibit A -> Motion
}
