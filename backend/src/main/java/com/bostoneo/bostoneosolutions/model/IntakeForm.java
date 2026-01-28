package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.sql.Timestamp;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "intake_forms")
public class IntakeForm {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "form_type", length = 50)
    private String formType = "GENERAL";

    @Column(name = "status", length = 20)
    private String status = "DRAFT";

    @Column(name = "is_public")
    private Boolean isPublic = false;

    @Column(name = "public_url", unique = true)
    private String publicUrl;

    @Column(name = "form_config", columnDefinition = "TEXT", nullable = false)
    private String formConfig;

    @Column(name = "success_message", columnDefinition = "TEXT")
    private String successMessage;

    @Column(name = "redirect_url")
    private String redirectUrl;

    @Column(name = "email_template_id")
    private Long emailTemplateId;

    @Column(name = "auto_assign_to")
    private Long autoAssignTo;

    @Column(name = "practice_area", length = 100)
    private String practiceArea;

    @Column(name = "version")
    private Integer version = 1;

    @Column(name = "submission_count")
    private Integer submissionCount = 0;

    @Column(name = "conversion_rate", precision = 5, scale = 2)
    private BigDecimal conversionRate = BigDecimal.ZERO;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "created_at")
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @Column(name = "published_at")
    private Timestamp publishedAt;

    @PrePersist
    protected void onCreate() {
        Timestamp now = new Timestamp(System.currentTimeMillis());
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }
}