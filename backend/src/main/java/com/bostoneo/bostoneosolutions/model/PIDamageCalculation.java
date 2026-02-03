package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * Entity for overall damage calculation summary in Personal Injury cases.
 * Stores totals by category, value ranges, and AI comparable analysis.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "pi_damage_calculations")
public class PIDamageCalculation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_id", nullable = false, unique = true)
    private Long caseId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    // Damage Totals by Category
    @Column(name = "past_medical_total", precision = 12, scale = 2)
    private BigDecimal pastMedicalTotal;

    @Column(name = "future_medical_total", precision = 12, scale = 2)
    private BigDecimal futureMedicalTotal;

    @Column(name = "lost_wages_total", precision = 12, scale = 2)
    private BigDecimal lostWagesTotal;

    @Column(name = "earning_capacity_total", precision = 12, scale = 2)
    private BigDecimal earningCapacityTotal;

    @Column(name = "household_services_total", precision = 12, scale = 2)
    private BigDecimal householdServicesTotal;

    @Column(name = "pain_suffering_total", precision = 12, scale = 2)
    private BigDecimal painSufferingTotal;

    @Column(name = "mileage_total", precision = 12, scale = 2)
    private BigDecimal mileageTotal;

    @Column(name = "other_damages_total", precision = 12, scale = 2)
    private BigDecimal otherDamagesTotal;

    // Summary Amounts
    @Column(name = "economic_damages_total", precision = 12, scale = 2)
    private BigDecimal economicDamagesTotal;

    @Column(name = "non_economic_damages_total", precision = 12, scale = 2)
    private BigDecimal nonEconomicDamagesTotal;

    @Column(name = "gross_damages_total", precision = 12, scale = 2)
    private BigDecimal grossDamagesTotal;

    // Adjustments
    @Column(name = "comparative_negligence_percent")
    private Integer comparativeNegligencePercent;

    @Column(name = "adjusted_damages_total", precision = 12, scale = 2)
    private BigDecimal adjustedDamagesTotal;

    // Value Range
    @Column(name = "low_value", precision = 12, scale = 2)
    private BigDecimal lowValue;

    @Column(name = "mid_value", precision = 12, scale = 2)
    private BigDecimal midValue;

    @Column(name = "high_value", precision = 12, scale = 2)
    private BigDecimal highValue;

    // AI Comparable Analysis
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "comparable_analysis", columnDefinition = "jsonb")
    private Map<String, Object> comparableAnalysis;

    // AI Settlement Analysis (from case value calculation)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "settlement_analysis", columnDefinition = "jsonb")
    private Map<String, Object> settlementAnalysis;

    // Calculation Info
    @Column(name = "calculated_at")
    private LocalDateTime calculatedAt;

    @Column(name = "calculation_notes", columnDefinition = "TEXT")
    private String calculationNotes;

    // Metadata
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
