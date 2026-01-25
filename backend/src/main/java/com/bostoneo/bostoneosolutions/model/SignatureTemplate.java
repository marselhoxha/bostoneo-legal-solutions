package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

/**
 * Template for signature requests.
 * Can be organization-specific or global (available to all organizations).
 */
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "signature_templates", indexes = {
        @Index(name = "idx_template_org", columnList = "organization_id"),
        @Index(name = "idx_template_category", columnList = "category"),
        @Index(name = "idx_template_active", columnList = "is_active")
})
public class SignatureTemplate {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "boldsign_template_id", length = 100)
    private String boldsignTemplateId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "category", length = 50)
    private String category;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "file_url", length = 500)
    private String fileUrl;

    @Column(name = "field_config", columnDefinition = "jsonb")
    private String fieldConfig;

    @Column(name = "default_expiry_days")
    @Builder.Default
    private Integer defaultExpiryDays = 30;

    @Column(name = "default_reminder_email")
    @Builder.Default
    private Boolean defaultReminderEmail = true;

    @Column(name = "default_reminder_sms")
    @Builder.Default
    private Boolean defaultReminderSms = true;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "is_global")
    @Builder.Default
    private Boolean isGlobal = false;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // Category constants
    public static final String CATEGORY_RETAINER = "RETAINER";
    public static final String CATEGORY_NDA = "NDA";
    public static final String CATEGORY_SETTLEMENT = "SETTLEMENT";
    public static final String CATEGORY_CONSENT = "CONSENT";
    public static final String CATEGORY_POA = "POA";
    public static final String CATEGORY_FEE = "FEE";
    public static final String CATEGORY_RELEASE = "RELEASE";
    public static final String CATEGORY_REPRESENTATION = "REPRESENTATION";
}
