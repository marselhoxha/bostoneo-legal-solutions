package com.***REMOVED***.***REMOVED***solutions.model;

import com.***REMOVED***.***REMOVED***solutions.enumeration.BillingCycleStatus;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Date;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "billing_cycles")
@JsonIgnoreProperties(ignoreUnknown = true)
public class BillingCycle {
    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id", columnDefinition = "BIGINT UNSIGNED")
    private Long id;

    @Column(name = "legal_case_id", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private Long legalCaseId;

    @Column(name = "cycle_name", nullable = false, length = 100)
    private String cycleName;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "status", nullable = false)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private BillingCycleStatus status = BillingCycleStatus.DRAFT;

    @Column(name = "total_hours", precision = 6, scale = 2)
    @Builder.Default
    private BigDecimal totalHours = BigDecimal.ZERO;

    @Column(name = "total_amount", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "invoice_id", columnDefinition = "BIGINT UNSIGNED")
    private Long invoiceId;

    @Column(name = "generated_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date generatedAt;

    @Column(name = "created_at", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date updatedAt;

    // Transient fields for display purposes - no entity relationships
    @Transient
    private String caseName;

    @Transient
    private String caseNumber;

    @Transient
    private String invoiceNumber;

    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
        if (status == null) {
            status = BillingCycleStatus.DRAFT;
        }
        if (totalHours == null) {
            totalHours = BigDecimal.ZERO;
        }
        if (totalAmount == null) {
            totalAmount = BigDecimal.ZERO;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
    }

    // Helper methods
    public boolean isCompleted() {
        return status == BillingCycleStatus.COMPLETED;
    }

    public boolean canBeProcessed() {
        return status == BillingCycleStatus.DRAFT || status == BillingCycleStatus.PROCESSING;
    }
} 
 
 
 
 
 
 