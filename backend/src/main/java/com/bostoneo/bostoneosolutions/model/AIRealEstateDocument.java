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
@Table(name = "ai_real_estate_documents")
public class AIRealEstateDocument {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "transaction_id", nullable = false)
    private Long transactionId;

    @Column(name = "document_type", nullable = false, length = 100)
    private String documentType;

    @Column(name = "document_category", length = 100)
    private String documentCategory;

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
    @Column(name = "is_signed")
    private Boolean isSigned = false;

    @Builder.Default
    @Column(name = "requires_notarization")
    private Boolean requiresNotarization = false;

    @Builder.Default
    @Column(name = "is_notarized")
    private Boolean isNotarized = false;

    @Column(name = "signing_date")
    private LocalDateTime signingDate;

    @Column(name = "notarization_date")
    private LocalDateTime notarizationDate;

    @Column(name = "expiration_date")
    private LocalDateTime expirationDate;

    @Column(name = "property_address", length = 500)
    private String propertyAddress;

    @Column(name = "parties_involved", columnDefinition = "jsonb")
    private String partiesInvolved;

    @Column(name = "document_content", columnDefinition = "TEXT")
    private String documentContent;

    @Column(name = "review_status", length = 50)
    private String reviewStatus;

    @Column(name = "reviewer_comments", columnDefinition = "TEXT")
    private String reviewerComments;

    @Column(name = "compliance_notes", columnDefinition = "TEXT")
    private String complianceNotes;

    @Column(name = "priority_level", length = 20)
    private String priorityLevel;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}