package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
@Table(name = "lead_activities")
public class LeadActivity {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id", columnDefinition = "BIGINT UNSIGNED")
    private Long id;

    @Column(name = "lead_id", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private Long leadId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_id", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Lead lead;

    @Column(name = "activity_type", nullable = false, length = 50)
    private String activityType;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "activity_date")
    private Timestamp activityDate;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(name = "outcome", length = 100)
    private String outcome;

    @Column(name = "follow_up_date")
    private Timestamp followUpDate;

    @Column(name = "is_billable")
    private Boolean isBillable = false;

    @Column(name = "billable_rate", precision = 10, scale = 2)
    private BigDecimal billableRate;

    @Column(name = "related_document_id", columnDefinition = "BIGINT UNSIGNED")
    private Long relatedDocumentId;

    @Column(name = "external_id", length = 100)
    private String externalId;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;

    @Column(name = "created_by", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private Long createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User creator;

    @Column(name = "created_at")
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @PrePersist
    protected void onCreate() {
        Timestamp now = new Timestamp(System.currentTimeMillis());
        createdAt = now;
        updatedAt = now;
        if (activityDate == null) {
            activityDate = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }
}