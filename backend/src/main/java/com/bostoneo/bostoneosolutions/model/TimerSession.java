package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.Date;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "timer_sessions")
@JsonIgnoreProperties(ignoreUnknown = true)
public class TimerSession {
    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "legal_case_id", nullable = false)
    private Long legalCaseId;

    @Column(name = "start_time", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date startTime;

    @Column(name = "end_time")
    @Temporal(TemporalType.TIMESTAMP)
    private Date endTime;

    @Column(name = "duration", nullable = false)
    @Builder.Default
    private Integer duration = 0; // total duration in seconds

    @Column(name = "paused_duration", nullable = false)
    @Builder.Default
    private Integer pausedDuration = 0; // seconds paused

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "converted_to_time_entry", nullable = false)
    @Builder.Default
    private Boolean convertedToTimeEntry = false;

    @Column(name = "time_entry_id")
    private Long timeEntryId;

    @Column(name = "created_at", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date updatedAt;

    // Transient fields for display purposes - no entity relationships
    @Transient
    private String userName;

    @Transient
    private String userEmail;

    @Transient
    private String caseName;

    @Transient
    private String caseNumber;

    // Calculated fields
    @Transient
    private Double durationHours;

    public Double getDurationHours() {
        if (duration != null) {
            return duration / 3600.0; // convert seconds to hours
        }
        return 0.0;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
        if (convertedToTimeEntry == null) {
            convertedToTimeEntry = false;
        }
        if (duration == null) {
            duration = 0;
        }
        if (pausedDuration == null) {
            pausedDuration = 0;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
    }

    // Helper method to calculate actual working duration
    public Integer getWorkingDuration() {
        return duration - (pausedDuration != null ? pausedDuration : 0);
    }
} 
 
 
 
 
 
 