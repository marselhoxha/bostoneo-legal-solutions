package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.RateType;
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
@Table(name = "billing_rates")
@JsonIgnoreProperties(ignoreUnknown = true)
public class BillingRate {
    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "matter_type_id")
    private Long matterTypeId;

    @Column(name = "customer_id")
    private Long clientId;

    @Column(name = "legal_case_id")
    private Long legalCaseId;

    @Column(name = "rate_type", nullable = false)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private RateType rateType = RateType.STANDARD;

    @Column(name = "rate_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal rateAmount;

    @Column(name = "effective_date", nullable = false)
    private LocalDate effectiveDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "is_active", nullable = false, columnDefinition = "BOOLEAN")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "created_at", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date updatedAt;

    // Transient fields for display purposes - no entity relationships
    @Transient
    private String userName;

    @Transient
    private String userEmail;

    @Transient
    private String matterTypeName;

    @Transient
    private String clientName;

    @Transient
    private String caseName;

    @Transient
    private String caseNumber;

    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
        if (rateType == null) {
            rateType = RateType.STANDARD;
        }
        if (isActive == null) {
            isActive = true;
        }
        if (effectiveDate == null) {
            effectiveDate = LocalDate.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
    }

    // Helper method to check if rate is currently effective
    public boolean isCurrentlyEffective() {
        LocalDate now = LocalDate.now();
        return isActive && 
               (effectiveDate == null || !effectiveDate.isAfter(now)) &&
               (endDate == null || !endDate.isBefore(now));
    }
} 
 
 
 
 
 
 