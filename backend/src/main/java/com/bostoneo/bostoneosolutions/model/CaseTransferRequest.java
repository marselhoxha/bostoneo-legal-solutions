package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.TransferStatus;
import com.bostoneo.bostoneosolutions.enumeration.TransferUrgency;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Entity
@Table(name = "case_transfer_requests")
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class CaseTransferRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private LegalCase legalCase;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_user_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User fromUser;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_user_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User toUser;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User requestedBy;
    
    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransferUrgency urgency = TransferUrgency.MEDIUM;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransferStatus status = TransferStatus.PENDING;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User approvedBy;
    
    @Column(name = "approval_notes", columnDefinition = "TEXT")
    private String approvalNotes;
    
    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;
    
    @Column(name = "processed_at")
    private LocalDateTime processedAt;
    
    @PrePersist
    protected void onCreate() {
        requestedAt = LocalDateTime.now();
    }
    
    /**
     * Check if request is pending
     */
    public boolean isPending() {
        return status == TransferStatus.PENDING;
    }
    
    /**
     * Check if request is approved
     */
    public boolean isApproved() {
        return status == TransferStatus.APPROVED;
    }
    
    /**
     * Process the request
     */
    public void process(User processor, TransferStatus newStatus, String notes) {
        this.status = newStatus;
        this.approvedBy = processor;
        this.approvalNotes = notes;
        this.processedAt = LocalDateTime.now();
    }
}