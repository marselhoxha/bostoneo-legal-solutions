package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.TemplateCategory;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "ai_legal_templates")
public class AILegalTemplate {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TemplateCategory category;

    @Column(name = "practice_area", length = 100)
    private String practiceArea;

    @Builder.Default
    @Column(length = 100)
    private String jurisdiction = "Massachusetts";

    @Builder.Default
    @Column(name = "ma_jurisdiction_specific")
    private Boolean maJurisdictionSpecific = false;

    @Column(name = "document_type", length = 100)
    private String documentType;

    @Column(name = "template_content", columnDefinition = "LONGTEXT")
    private String templateContent;

    @Column(name = "template_type", length = 20)
    @Builder.Default
    private String templateType = "TEXT"; // TEXT, PDF_FORM, HYBRID

    @Column(name = "pdf_form_url", length = 500)
    private String pdfFormUrl; // URL to the official PDF form

    @Column(name = "pdf_field_mappings", columnDefinition = "jsonb")
    private String pdfFieldMappings; // JSON mapping of form fields to case data

    @Column(name = "pdf_form_hash", length = 64)
    private String pdfFormHash; // SHA-256 hash for form validation

    @Column(name = "ai_prompt_structure", columnDefinition = "TEXT")
    private String aiPromptStructure;

    @Column(name = "variable_mappings", columnDefinition = "jsonb")
    private String variableMappings;

    @Column(name = "formatting_rules", columnDefinition = "jsonb")
    private String formattingRules;

    @Column(name = "style_guide_id")
    private Long styleGuideId;

    @Builder.Default
    @Column(name = "usage_count")
    private Integer usageCount = 0;

    @Builder.Default
    @Column(name = "success_rate", precision = 5, scale = 2)
    private BigDecimal successRate = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "average_rating", precision = 3, scale = 2)
    private BigDecimal averageRating = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "is_public")
    private Boolean isPublic = false;

    @Builder.Default
    @Column(name = "is_approved")
    private Boolean isApproved = false;

    @Builder.Default
    @Column(name = "is_ma_certified")
    private Boolean isMaCertified = false;

    @Column(name = "firm_id")
    private Long firmId;

    @Column(name = "created_by")
    private Long createdBy;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}