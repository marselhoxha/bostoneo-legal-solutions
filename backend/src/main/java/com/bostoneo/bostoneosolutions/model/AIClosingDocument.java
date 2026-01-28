package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.DocumentType;
import com.bostoneo.bostoneosolutions.enumeration.CompletionStatus;
import com.bostoneo.bostoneosolutions.enumeration.ResponsibleParty;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "ai_closing_documents")
public class AIClosingDocument {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "transaction_id", nullable = false)
    private Long transactionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false)
    private DocumentType documentType;

    @Column(name = "document_name", length = 200)
    private String documentName;

    @Builder.Default
    @Column(name = "is_required")
    private Boolean isRequired = true;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "completion_status")
    private CompletionStatus completionStatus = CompletionStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "responsible_party", nullable = false)
    private ResponsibleParty responsibleParty;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "completion_date")
    private LocalDate completionDate;

    @Column(name = "file_id")
    private Long fileId;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}