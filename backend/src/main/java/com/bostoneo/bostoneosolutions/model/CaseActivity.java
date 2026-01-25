package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;
import java.util.Map;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "case_activities")
public class CaseActivity {
    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "case_id", nullable = false)
    private Long caseId;

    @Column(name = "user_id")
    private Long userId;

    /**
     * Activity types using VARCHAR(50) values:
     * NOTE_ADDED, DOCUMENT_UPLOADED, DOCUMENT_UPDATED, STATUS_CHANGED,
     * HEARING_SCHEDULED, HEARING_UPDATED, HEARING_CANCELLED,
     * PAYMENT_RECEIVED, CLIENT_CONTACTED, TASK_CREATED,
     * TASK_COMPLETED, CUSTOM
     */
    @Column(name = "activity_type", nullable = false)
    private String activityType;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "reference_type")
    private String referenceType;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadataJson;

    @Transient
    private Map<String, Object> metadata;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
} 