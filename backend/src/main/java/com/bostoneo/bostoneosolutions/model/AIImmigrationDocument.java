package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "ai_immigration_documents")
public class AIImmigrationDocument {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "case_id", nullable = false)
    private Long caseId;

    @Column(name = "document_type", nullable = false, length = 100)
    private String documentType;

    @Column(name = "form_number", length = 20)
    private String formNumber;

    @Column(name = "document_name", nullable = false, length = 200)
    private String documentName;

    @Column(name = "file_path", columnDefinition = "TEXT")
    private String filePath;

    @Column(name = "status", nullable = false, length = 50)
    private String status;

    @Builder.Default
    @Column(name = "is_required")
    private Boolean isRequired = false;

    @Builder.Default
    @Column(name = "is_submitted")
    private Boolean isSubmitted = false;

    @Column(name = "submission_date")
    private LocalDateTime submissionDate;

    @Column(name = "expiration_date")
    private LocalDateTime expirationDate;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "priority_level", length = 20)
    private String priorityLevel;

    @Column(name = "review_status", length = 50)
    private String reviewStatus;

    @Column(name = "reviewer_comments", columnDefinition = "TEXT")
    private String reviewerComments;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}