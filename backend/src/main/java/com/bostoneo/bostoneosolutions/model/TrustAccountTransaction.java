package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.converter.EncryptedStringConverter;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "trust_account_transactions")
public class TrustAccountTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "trust_account_id", nullable = false)
    private Long trustAccountId;
    
    @Column(name = "client_id", nullable = false)
    private Long clientId;
    
    @Column(name = "legal_case_id")
    private Long legalCaseId;
    
    @Column(name = "transaction_type", nullable = false)
    private String transactionType; // DEPOSIT, WITHDRAWAL, TRANSFER, FEE, INTEREST
    
    @Column(name = "amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal amount;
    
    @Column(name = "balance_after", precision = 12, scale = 2, nullable = false)
    private BigDecimal balanceAfter;
    
    @Column(name = "transaction_date", nullable = false)
    private LocalDate transactionDate;
    
    @Column(name = "reference_number")
    private String referenceNumber;
    
    @Column(name = "description", nullable = false)
    private String description;
    
    @Column(name = "related_invoice_id")
    private Long relatedInvoiceId;
    
    @Column(name = "check_number")
    @Convert(converter = EncryptedStringConverter.class)
    private String checkNumber; // Encrypted for security
    
    @Column(name = "payee_name")
    private String payeeName;
    
    @Column(name = "is_cleared", nullable = false)
    @Builder.Default
    private Boolean isCleared = false;
    
    @Column(name = "cleared_date")
    private LocalDate clearedDate;
    
    @Column(name = "reconciliation_id")
    private Long reconciliationId;
    
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    
    @Column(name = "created_by")
    private Long createdBy;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (transactionDate == null) {
            transactionDate = LocalDate.now();
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    // Relations
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trust_account_id", insertable = false, updatable = false)
    private TrustAccount trustAccount;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", insertable = false, updatable = false)
    private Client client;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "legal_case_id", insertable = false, updatable = false)
    private LegalCase legalCase;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", insertable = false, updatable = false)
    private User createdByUser;
}