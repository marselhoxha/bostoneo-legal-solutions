package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;
import java.time.LocalTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

/**
 * Stores recurring weekly availability slots for attorneys.
 * Each record represents availability for a specific day of the week.
 */
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "attorney_availability")
public class AttorneyAvailability {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "attorney_id", nullable = false)
    private Long attorneyId;

    /**
     * Day of week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
     */
    @Column(name = "day_of_week", nullable = false)
    private Integer dayOfWeek;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "slot_duration_minutes", nullable = false)
    @Builder.Default
    private Integer slotDurationMinutes = 30;

    @Column(name = "buffer_minutes", nullable = false)
    @Builder.Default
    private Integer bufferMinutes = 15;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "created_at", nullable = false)
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

    /**
     * Get the day name for display purposes
     */
    public String getDayName() {
        String[] days = {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};
        return days[dayOfWeek];
    }
}
