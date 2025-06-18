package com.***REMOVED***.***REMOVED***solutions.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
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
@Table(name = "case_rate_configurations",
    uniqueConstraints = @UniqueConstraint(
        name = "unique_case_rate", 
        columnNames = {"legal_case_id"}
    )
)
@JsonIgnoreProperties(ignoreUnknown = true)
public class CaseRateConfiguration {
    
    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id", columnDefinition = "BIGINT UNSIGNED")
    private Long id;

    @Column(name = "legal_case_id", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private Long legalCaseId;

    @Column(name = "default_rate", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal defaultRate = new BigDecimal("250.00");

    @Column(name = "allow_multipliers", nullable = false)
    @Builder.Default
    private Boolean allowMultipliers = true;

    @Column(name = "weekend_multiplier", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal weekendMultiplier = new BigDecimal("1.50");

    @Column(name = "after_hours_multiplier", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal afterHoursMultiplier = new BigDecimal("1.25");

    @Column(name = "emergency_multiplier", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal emergencyMultiplier = new BigDecimal("2.00");

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "case_name")
    private String caseName;

    @Column(name = "case_number", length = 100)
    private String caseNumber;

    @Column(name = "created_at", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date updatedAt;

    // Transient fields for calculations
    @Transient
    private BigDecimal currentEffectiveRate;

    @Transient
    private String rateDescription;

    /**
     * Calculate the final rate based on base rate and multipliers
     */
    public BigDecimal calculateFinalRate(BigDecimal baseRate, boolean isWeekend, boolean isAfterHours, boolean isEmergency) {
        if (baseRate == null) {
            baseRate = this.defaultRate;
        }
        
        if (!Boolean.TRUE.equals(this.allowMultipliers)) {
            return baseRate;
        }
        
        BigDecimal finalRate = baseRate;
        
        if (isEmergency && this.emergencyMultiplier != null) {
            // Emergency multiplier overrides others
            finalRate = finalRate.multiply(this.emergencyMultiplier);
        } else {
            // Apply weekend and after-hours multipliers
            if (isWeekend && this.weekendMultiplier != null) {
                finalRate = finalRate.multiply(this.weekendMultiplier);
            }
            
            if (isAfterHours && this.afterHoursMultiplier != null) {
                finalRate = finalRate.multiply(this.afterHoursMultiplier);
            }
        }
        
        return finalRate;
    }

    /**
     * Get a description of the rate configuration
     */
    public String getRateDescription() {
        StringBuilder description = new StringBuilder();
        description.append("$").append(defaultRate).append("/hr");
        
        if (Boolean.TRUE.equals(allowMultipliers)) {
            description.append(" (with multipliers: ");
            description.append("Weekend ").append(weekendMultiplier).append("x, ");
            description.append("After-hours ").append(afterHoursMultiplier).append("x, ");
            description.append("Emergency ").append(emergencyMultiplier).append("x)");
        } else {
            description.append(" (fixed rate)");
        }
        
        return description.toString();
    }

    /**
     * Check if this configuration allows any multipliers
     */
    public boolean hasMultipliers() {
        return Boolean.TRUE.equals(allowMultipliers);
    }

    /**
     * Get the multiplier for a specific scenario
     */
    public BigDecimal getMultiplierForScenario(boolean isWeekend, boolean isAfterHours, boolean isEmergency) {
        if (!Boolean.TRUE.equals(allowMultipliers)) {
            return BigDecimal.ONE;
        }
        
        if (isEmergency) {
            return emergencyMultiplier != null ? emergencyMultiplier : BigDecimal.ONE;
        }
        
        BigDecimal multiplier = BigDecimal.ONE;
        
        if (isWeekend && weekendMultiplier != null) {
            multiplier = multiplier.multiply(weekendMultiplier);
        }
        
        if (isAfterHours && afterHoursMultiplier != null) {
            multiplier = multiplier.multiply(afterHoursMultiplier);
        }
        
        return multiplier;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
        if (isActive == null) {
            isActive = true;
        }
        if (allowMultipliers == null) {
            allowMultipliers = true;
        }
        if (defaultRate == null) {
            defaultRate = new BigDecimal("250.00");
        }
        if (weekendMultiplier == null) {
            weekendMultiplier = new BigDecimal("1.50");
        }
        if (afterHoursMultiplier == null) {
            afterHoursMultiplier = new BigDecimal("1.25");
        }
        if (emergencyMultiplier == null) {
            emergencyMultiplier = new BigDecimal("2.00");
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
    }

    // Convenience methods for validation
    public boolean isValidConfiguration() {
        return defaultRate != null && defaultRate.compareTo(BigDecimal.ZERO) > 0 &&
               weekendMultiplier != null && weekendMultiplier.compareTo(BigDecimal.ONE) >= 0 &&
               afterHoursMultiplier != null && afterHoursMultiplier.compareTo(BigDecimal.ONE) >= 0 &&
               emergencyMultiplier != null && emergencyMultiplier.compareTo(BigDecimal.ONE) >= 0;
    }

    @Override
    public String toString() {
        return "CaseRateConfiguration{" +
                "id=" + id +
                ", legalCaseId=" + legalCaseId +
                ", defaultRate=" + defaultRate +
                ", allowMultipliers=" + allowMultipliers +
                ", isActive=" + isActive +
                ", caseName='" + caseName + '\'' +
                ", caseNumber='" + caseNumber + '\'' +
                '}';
    }
} 