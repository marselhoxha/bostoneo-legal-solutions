package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Junction table entity linking document analyses to collections.
 */
@Entity
@Table(name = "collection_documents", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"collection_id", "analysis_id"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CollectionDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collection_id", nullable = false)
    private DocumentCollection collection;

    @Column(name = "analysis_id", nullable = false)
    private Long analysisId;  // References ai_document_analysis.id

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;  // Optional notes about why this doc is in collection

    @CreationTimestamp
    @Column(name = "added_at", updatable = false)
    private LocalDateTime addedAt;

    @Column(name = "added_by")
    private Long addedBy;  // User who added the document

    // Constructor for easy creation
    public CollectionDocument(DocumentCollection collection, Long analysisId) {
        this.collection = collection;
        this.analysisId = analysisId;
    }
}
