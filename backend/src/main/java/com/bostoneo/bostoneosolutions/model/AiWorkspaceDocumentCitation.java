package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ai_workspace_document_citations")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiWorkspaceDocumentCitation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private AiWorkspaceDocument document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "version_id")
    private AiWorkspaceDocumentVersion version;

    @Column(name = "citation_text", nullable = false, length = 500)
    private String citationText;

    @Column(name = "case_id")
    private Long caseId;

    @Column(name = "position_start")
    private Integer positionStart;

    @Column(name = "position_end")
    private Integer positionEnd;

    @Column(name = "citation_format", length = 50)
    private String citationFormat;

    @Column(name = "is_verified")
    @Builder.Default
    private Boolean isVerified = false;

    @Column(name = "verification_result", columnDefinition = "TEXT")
    private String verificationResult;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
