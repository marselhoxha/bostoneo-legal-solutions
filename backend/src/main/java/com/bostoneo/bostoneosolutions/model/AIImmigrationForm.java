package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.FormCategory;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
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
@Table(name = "ai_immigration_forms")
public class AIImmigrationForm {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "form_number", nullable = false, length = 20, unique = true)
    private String formNumber;

    @Column(name = "form_title", nullable = false, length = 200)
    private String formTitle;

    @Enumerated(EnumType.STRING)
    @Column(name = "form_category", nullable = false)
    private FormCategory formCategory;

    @Column(name = "form_template", columnDefinition = "TEXT")
    private String formTemplate;

    @Column(name = "required_documents", columnDefinition = "TEXT")
    private String requiredDocuments;

    @Column(name = "filing_requirements", columnDefinition = "TEXT")
    private String filingRequirements;

    @Column(name = "processing_time_range", length = 50)
    private String processingTimeRange;

    @Column(name = "filing_fee", precision = 10, scale = 2)
    private BigDecimal filingFee;

    @Column(name = "form_instructions", columnDefinition = "TEXT")
    private String formInstructions;

    @Column(name = "ai_assistance_prompts", columnDefinition = "TEXT")
    private String aiAssistancePrompts;

    @Builder.Default
    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "last_updated")
    private LocalDate lastUpdated;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}