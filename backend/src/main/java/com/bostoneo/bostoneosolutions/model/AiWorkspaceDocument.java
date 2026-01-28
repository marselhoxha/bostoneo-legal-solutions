package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ai_workspace_documents")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiWorkspaceDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * SECURITY: Organization ID for multi-tenant isolation
     */
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "session_id")
    private Long sessionId;

    @Column(name = "case_id")
    private Long caseId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(name = "current_version")
    @Builder.Default
    private Integer currentVersion = 1;

    @Column(name = "document_type", length = 100)
    private String documentType;

    @Column(length = 100)
    private String jurisdiction;

    @Column(length = 50)
    @Builder.Default
    private String status = "DRAFT";

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    // Relationships
    @OneToMany(mappedBy = "document", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<AiWorkspaceDocumentVersion> versions = new ArrayList<>();

    @OneToMany(mappedBy = "document", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<AiWorkspaceDocumentCitation> citations = new ArrayList<>();

    // Helper methods
    public void addVersion(AiWorkspaceDocumentVersion version) {
        versions.add(version);
        version.setDocument(this);
    }

    public void addCitation(AiWorkspaceDocumentCitation citation) {
        citations.add(citation);
        citation.setDocument(this);
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
