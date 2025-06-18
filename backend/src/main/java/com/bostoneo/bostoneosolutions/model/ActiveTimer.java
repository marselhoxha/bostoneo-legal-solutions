package com.***REMOVED***.***REMOVED***solutions.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
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
@Table(name = "active_timers",
    uniqueConstraints = @UniqueConstraint(
        name = "unique_active_timer", 
        columnNames = {"user_id", "legal_case_id", "is_active"}
    )
)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ActiveTimer {
    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id", columnDefinition = "BIGINT UNSIGNED")
    private Long id;

    @Column(name = "user_id", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private Long userId;

    @Column(name = "legal_case_id", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private Long legalCaseId;

    @Column(name = "start_time", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date startTime;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "paused_duration", nullable = false)
    @Builder.Default
    private Integer pausedDuration = 0; // seconds paused

    // Rate configuration fields
    @Column(name = "hourly_rate", precision = 10, scale = 2)
    private BigDecimal hourlyRate;

    @Column(name = "apply_multipliers", nullable = false)
    @Builder.Default
    private Boolean applyMultipliers = true;

    @Column(name = "is_emergency", nullable = false)
    @Builder.Default
    private Boolean isEmergency = false;

    @Column(name = "work_type", length = 100)
    private String workType;

    @Column(name = "tags", length = 500)
    private String tags;

    @Column(name = "created_at", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date updatedAt;

    // Calculated fields - no entity relationships
    @Transient
    private Long currentDurationSeconds;

    @Transient
    private String caseName;

    @Transient
    private String caseNumber;

    @Transient
    private String userName;

    @Transient
    private String userEmail;

    @Transient
    private String formattedDuration;

    /**
     * Calculate current total working time in seconds
     * pausedDuration contains accumulated working time from previous sessions
     * If currently active, add the current session time
     */
    public Long getCurrentDurationSeconds() {
        if (startTime == null) return (long)(pausedDuration != null ? pausedDuration : 0);
        
        long totalWorkingSeconds = pausedDuration != null ? pausedDuration : 0;
        
        if (isActive && startTime != null) {
            // Timer is currently running: add current session working time
            long currentSessionMs = new Date().getTime() - startTime.getTime();
            long currentSessionSeconds = currentSessionMs / 1000;
            totalWorkingSeconds += currentSessionSeconds;
        }
        // If paused, pausedDuration already contains total working time
        
        return totalWorkingSeconds;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
        if (startTime == null) {
            startTime = new Date();
        }
        if (isActive == null) {
            isActive = true;
        }
        if (pausedDuration == null) {
            pausedDuration = 0;
        }
        if (applyMultipliers == null) {
            applyMultipliers = true;
        }
        if (isEmergency == null) {
            isEmergency = false;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
    }

    // Helper method to get working duration in hours
    public Double getWorkingHours() {
        Long seconds = getCurrentDurationSeconds();
        return seconds != null ? seconds / 3600.0 : 0.0;
    }

    // Helper method to calculate estimated billing amount
    public BigDecimal getEstimatedAmount() {
        if (hourlyRate == null) return BigDecimal.ZERO;
        Double hours = getWorkingHours();
        return hourlyRate.multiply(BigDecimal.valueOf(hours));
    }
} 
 
 