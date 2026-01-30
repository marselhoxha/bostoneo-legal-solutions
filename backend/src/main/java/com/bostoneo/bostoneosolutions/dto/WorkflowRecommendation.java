package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * DTO for workflow recommendations.
 * Represents a suggested workflow based on case state and deadlines.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WorkflowRecommendation {

    /**
     * Urgency levels for workflow recommendations
     */
    public enum Urgency {
        CRITICAL,   // Overdue or due today
        HIGH,       // 1-3 days until deadline
        MEDIUM,     // 4-7 days until deadline
        LOW         // More than 7 days
    }

    // Workflow template info
    private String templateType;
    private String templateName;
    private Long templateId;

    // Case info
    private Long caseId;
    private String caseNumber;
    private String caseTitle;

    // Recommendation details
    private String reason;
    private Urgency urgency;
    private LocalDate deadlineDate;
    private Integer daysUntilDeadline;

    // Status
    private boolean isDismissed;
    private LocalDateTime dismissedAt;

    // Document availability (for smart document loading)
    private Boolean documentsRequired;
    private Integer availableDocuments;
    private Boolean hasDocuments;

    // Metadata
    private LocalDateTime createdAt;

    /**
     * Create a recommendation from deadline info
     */
    public static WorkflowRecommendation fromDeadline(
            String templateType,
            String templateName,
            Long templateId,
            Long caseId,
            String caseNumber,
            String caseTitle,
            String reason,
            LocalDate deadlineDate,
            int daysUntil
    ) {
        Urgency urgency;
        if (daysUntil <= 0) {
            urgency = Urgency.CRITICAL;
        } else if (daysUntil <= 3) {
            urgency = Urgency.HIGH;
        } else if (daysUntil <= 7) {
            urgency = Urgency.MEDIUM;
        } else {
            urgency = Urgency.LOW;
        }

        return WorkflowRecommendation.builder()
                .templateType(templateType)
                .templateName(templateName)
                .templateId(templateId)
                .caseId(caseId)
                .caseNumber(caseNumber)
                .caseTitle(caseTitle)
                .reason(reason)
                .urgency(urgency)
                .deadlineDate(deadlineDate)
                .daysUntilDeadline(daysUntil)
                .isDismissed(false)
                .createdAt(LocalDateTime.now())
                .build();
    }

    /**
     * Create a recommendation without deadline (phase-based)
     */
    public static WorkflowRecommendation forPhase(
            String templateType,
            String templateName,
            Long templateId,
            Long caseId,
            String caseNumber,
            String caseTitle,
            String reason,
            Urgency urgency
    ) {
        return WorkflowRecommendation.builder()
                .templateType(templateType)
                .templateName(templateName)
                .templateId(templateId)
                .caseId(caseId)
                .caseNumber(caseNumber)
                .caseTitle(caseTitle)
                .reason(reason)
                .urgency(urgency)
                .isDismissed(false)
                .createdAt(LocalDateTime.now())
                .build();
    }

    /**
     * Get badge color for UI display
     */
    public String getBadgeColor() {
        if (urgency == null) return "gray";
        return switch (urgency) {
            case CRITICAL -> "red";
            case HIGH -> "orange";
            case MEDIUM -> "yellow";
            case LOW -> "green";
        };
    }

    /**
     * Get human-readable urgency label
     */
    public String getUrgencyLabel() {
        if (daysUntilDeadline == null) {
            return urgency != null ? urgency.name() : "Unknown";
        }

        if (daysUntilDeadline < 0) {
            return "Overdue by " + Math.abs(daysUntilDeadline) + " day(s)";
        } else if (daysUntilDeadline == 0) {
            return "Due today";
        } else if (daysUntilDeadline == 1) {
            return "Due tomorrow";
        } else {
            return "Due in " + daysUntilDeadline + " days";
        }
    }
}
