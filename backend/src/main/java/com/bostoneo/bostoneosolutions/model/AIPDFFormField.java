package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "ai_pdf_form_fields")
public class AIPDFFormField {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "template_id", nullable = false)
    private Long templateId;

    @Column(name = "pdf_field_name", nullable = false, length = 200)
    private String pdfFieldName; // Name of the field in the PDF form

    @Column(name = "case_data_path", length = 200)
    private String caseDataPath; // Path to case data (e.g., "clientName", "filingDate")

    @Column(name = "default_value", length = 500)
    private String defaultValue; // Default value if case data is not available

    @Column(name = "field_type", length = 50)
    @Builder.Default
    private String fieldType = "TEXT"; // TEXT, CHECKBOX, DATE, CHOICE, SIGNATURE

    @Column(name = "is_required")
    @Builder.Default
    private Boolean isRequired = false;

    @Column(name = "validation_rule", length = 200)
    private String validationRule; // Regex or rule for validation

    @Column(name = "ai_generation_prompt", columnDefinition = "TEXT")
    private String aiGenerationPrompt; // AI prompt for generating field value

    @Column(name = "display_order")
    @Builder.Default
    private Integer displayOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}