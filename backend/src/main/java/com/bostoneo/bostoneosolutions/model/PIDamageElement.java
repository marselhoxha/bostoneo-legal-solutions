package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * Entity for structured damage calculations in Personal Injury cases.
 * Stores individual damage elements with calculation details and supporting documentation.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "pi_damage_elements")
public class PIDamageElement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_id", nullable = false)
    private Long caseId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    // Damage Category
    @Column(name = "element_type", nullable = false, length = 50)
    private String elementType; // PAST_MEDICAL, FUTURE_MEDICAL, LOST_WAGES, EARNING_CAPACITY, HOUSEHOLD_SERVICES, PAIN_SUFFERING, MILEAGE, OTHER

    @Column(name = "element_name", nullable = false)
    private String elementName; // Descriptive name (e.g., "Boston Medical ER", "2024 Lost Wages")

    // Calculation Details
    @Column(name = "calculation_method", length = 100)
    private String calculationMethod; // Multiplier, Per Diem, Actual, Projection

    @Column(name = "base_amount", precision = 12, scale = 2)
    private BigDecimal baseAmount;

    @Column(name = "multiplier", precision = 6, scale = 2)
    private BigDecimal multiplier;

    @Column(name = "duration_value", precision = 10, scale = 2)
    private BigDecimal durationValue; // For per diem or duration-based calcs

    @Column(name = "duration_unit", length = 20)
    private String durationUnit; // Days, Weeks, Months, Years

    @Column(name = "calculated_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal calculatedAmount;

    // Confidence & Documentation
    @Column(name = "confidence_level", length = 20)
    private String confidenceLevel; // HIGH, MEDIUM, LOW

    @Column(name = "confidence_notes", columnDefinition = "TEXT")
    private String confidenceNotes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "supporting_documents", columnDefinition = "jsonb")
    private List<String> supportingDocuments; // Array of document IDs or descriptions

    // Source Information
    @Column(name = "source_provider")
    private String sourceProvider; // For medical expenses

    @Column(name = "source_employer")
    private String sourceEmployer; // For wage loss

    @Column(name = "source_date")
    private LocalDate sourceDate;

    // Notes
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "legal_authority", columnDefinition = "TEXT")
    private String legalAuthority; // Case law or statutory support

    // Display Order
    @Column(name = "display_order")
    private Integer displayOrder;

    // Metadata
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "created_by")
    private Long createdBy;
}
