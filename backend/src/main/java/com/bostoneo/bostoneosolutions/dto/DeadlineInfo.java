package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * DTO for deadline metadata with temporal status
 * Used to track case deadlines and their current status (passed/upcoming/today)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeadlineInfo {

    /**
     * The actual deadline date
     */
    private LocalDate date;

    /**
     * Name/description of the event (e.g., "Preliminary Injunction Hearing", "Discovery Cutoff")
     */
    private String eventName;

    /**
     * Type of deadline event (HEARING, FILING, DISCOVERY, TRIAL, etc.)
     */
    private DeadlineType type;

    /**
     * Current status: PASSED, UPCOMING, or TODAY
     */
    private DeadlineStatus status;

    /**
     * Number of days until deadline (negative if passed)
     * Positive = future, Negative = past, 0 = today
     */
    private long daysUntil;

    /**
     * Human-readable status message
     * Examples: "PASSED (236 days ago)", "UPCOMING (30 days)", "TODAY"
     */
    private String statusMessage;

    /**
     * Urgency level based on days until deadline
     */
    private UrgencyLevel urgency;

    public enum DeadlineStatus {
        PASSED,    // Deadline has passed
        TODAY,     // Deadline is today
        UPCOMING   // Deadline is in the future
    }

    public enum DeadlineType {
        HEARING,
        FILING,
        DISCOVERY,
        TRIAL,
        MOTION,
        RESPONSE,
        OTHER
    }

    public enum UrgencyLevel {
        NONE,        // Passed or > 30 days
        LOW,         // 15-30 days
        MEDIUM,      // 7-14 days
        HIGH,        // 3-6 days
        CRITICAL     // 0-2 days
    }

    /**
     * Calculate urgency based on days until deadline
     */
    public static UrgencyLevel calculateUrgency(long daysUntil) {
        if (daysUntil < 0) return UrgencyLevel.NONE;  // Already passed
        if (daysUntil <= 2) return UrgencyLevel.CRITICAL;
        if (daysUntil <= 6) return UrgencyLevel.HIGH;
        if (daysUntil <= 14) return UrgencyLevel.MEDIUM;
        if (daysUntil <= 30) return UrgencyLevel.LOW;
        return UrgencyLevel.NONE;
    }

    /**
     * Create DeadlineInfo from date and event name
     */
    public static DeadlineInfo fromDate(LocalDate deadlineDate, String eventName, DeadlineType type) {
        LocalDate today = LocalDate.now();
        long daysUntil = java.time.temporal.ChronoUnit.DAYS.between(today, deadlineDate);

        DeadlineStatus status;
        String statusMessage;

        if (daysUntil < 0) {
            status = DeadlineStatus.PASSED;
            statusMessage = String.format("PASSED (%d days ago)", Math.abs(daysUntil));
        } else if (daysUntil == 0) {
            status = DeadlineStatus.TODAY;
            statusMessage = "TODAY";
        } else {
            status = DeadlineStatus.UPCOMING;
            statusMessage = String.format("UPCOMING (%d days)", daysUntil);
        }

        return DeadlineInfo.builder()
                .date(deadlineDate)
                .eventName(eventName)
                .type(type)
                .status(status)
                .daysUntil(daysUntil)
                .statusMessage(statusMessage)
                .urgency(calculateUrgency(daysUntil))
                .build();
    }
}
