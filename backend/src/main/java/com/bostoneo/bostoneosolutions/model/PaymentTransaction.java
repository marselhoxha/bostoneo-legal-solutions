package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.converter.EncryptedStringConverter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
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
@Table(name = "payment_transactions")
public class PaymentTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "invoice_id", nullable = false)
    private Long invoiceId;
    
    @Column(name = "transaction_type", nullable = false)
    private String transactionType; // ACH, WIRE, CHECK, CREDIT_CARD, etc.
    
    @Column(name = "transaction_status")
    private String transactionStatus; // PENDING, PROCESSING, COMPLETED, FAILED
    
    @Column(name = "amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal amount;
    
    @Column(name = "routing_number")
    @Convert(converter = EncryptedStringConverter.class)
    private String routingNumber; // For ACH - encrypted
    
    @Column(name = "account_number_last4")
    private String accountNumberLast4; // For ACH/Wire - only last 4 stored
    
    @Column(name = "wire_reference")
    private String wireReference; // For Wire transfers
    
    @Column(name = "bank_name")
    private String bankName;
    
    @Column(name = "processing_date")
    private LocalDate processingDate;
    
    @Column(name = "completion_date")
    private LocalDate completionDate;
    
    @Column(name = "reference_number")
    private String referenceNumber;
    
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
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    // Relations
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", insertable = false, updatable = false)
    @JsonIgnore
    private Invoice invoice;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", insertable = false, updatable = false)
    private User createdByUser;
}