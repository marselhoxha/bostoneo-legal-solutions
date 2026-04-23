package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.TemplateCategory;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

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

    @Column(name = "template_content", columnDefinition = "TEXT")
    private String templateContent;

    @Column(name = "template_type", length = 20)
    @Builder.Default
    private String templateType = "TEXT"; // TEXT, PDF_FORM, HYBRID

    @Column(name = "pdf_form_url", length = 500)
    private String pdfFormUrl; // URL to the official PDF form

    @Column(name = "pdf_field_mappings", columnDefinition = "TEXT")
    private String pdfFieldMappings; // JSON mapping of form fields to case data

    @Column(name = "pdf_form_hash", length = 64)
    private String pdfFormHash; // SHA-256 hash for form validation

    @Column(name = "ai_prompt_structure", columnDefinition = "TEXT")
    private String aiPromptStructure;

    @Column(name = "variable_mappings", columnDefinition = "TEXT")
    private String variableMappings;

    @Column(name = "formatting_rules", columnDefinition = "TEXT")
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

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "created_by")
    private Long createdBy;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // ==================== Sprint 1.5: Import Metadata ====================

    @Column(name = "source_type", length = 20)
    @Builder.Default
    private String sourceType = "MANUAL"; // MANUAL | IMPORTED_DOCX | IMPORTED_PDF | IMPORTED_PDF_OCR | IMPORTED_DOC

    @Column(name = "source_filename", length = 512)
    private String sourceFilename;

    @Column(name = "import_batch_id", columnDefinition = "uuid")
    private UUID importBatchId;

    @Column(name = "import_confidence", precision = 3, scale = 2)
    private BigDecimal importConfidence;

    @Builder.Default
    @Column(name = "is_private", nullable = false)
    private Boolean isPrivate = false;

    @Column(name = "imported_by_user_id")
    private Long importedByUserId;

    @Column(name = "imported_at")
    private LocalDateTime importedAt;

    @Column(name = "content_hash", length = 64)
    private String contentHash;

    // ==================== Sprint 1.6: Binary (visual-fidelity) template ====================

    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "template_binary", columnDefinition = "bytea")
    @JsonIgnore // prevent Jackson from pulling multi-MB bytes into every JSON response
    private byte[] templateBinary;

    @Column(name = "template_binary_format", length = 10)
    private String templateBinaryFormat; // DOCX | PDF

    @Builder.Default
    @Column(name = "has_binary_template", nullable = false)
    private Boolean hasBinaryTemplate = false;

    @Column(name = "binary_sha256", length = 64)
    private String binarySha256;

    @Column(name = "binary_size_bytes")
    private Integer binarySizeBytes;
}