package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Entity for document collections - groups of related document analyses.
 * Collections can optionally be linked to a legal case.
 */
@Entity
@Table(name = "document_collections")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentCollection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "case_id")
    private Long caseId;  // Optional link to legal case

    @Column(name = "color")
    private String color;  // For UI display (e.g., "#405189")

    @Column(name = "icon")
    private String icon;   // For UI display (e.g., "ri-folder-line")

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "is_archived", nullable = false)
    private Boolean isArchived = false;

    // One-to-many relationship with collection documents
    @OneToMany(mappedBy = "collection", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CollectionDocument> documents = new ArrayList<>();

    // Helper method to get document count
    public int getDocumentCount() {
        return documents != null ? documents.size() : 0;
    }
}
