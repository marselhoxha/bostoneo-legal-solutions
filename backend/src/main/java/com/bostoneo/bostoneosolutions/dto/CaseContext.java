package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.CasePriority;
import com.bostoneo.bostoneosolutions.enumeration.CaseRoleType;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.enumeration.TaskStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Aggregated case context for workflow execution.
 * Contains all relevant case data needed for intelligent workflow processing.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CaseContext {

    // ==================== Case Basic Info ====================
    private Long caseId;
    private String caseNumber;
    private String title;
    private String caseType;
    private CaseStatus status;
    private CasePriority priority;
    private String clientName;
    private String clientEmail;
    private String description;

    // ==================== Court Information ====================
    private String countyName;
    private String judgeName;
    private String jurisdiction;

    // ==================== Timeline & Phase ====================
    private String currentPhase;
    private Integer currentPhaseNumber;
    private Integer totalPhases;
    private Double progressPercentage;
    private LocalDateTime phaseStartedAt;
    private LocalDateTime estimatedPhaseCompletion;

    // ==================== Important Dates ====================
    private LocalDate filingDate;
    private LocalDate nextHearing;
    private LocalDate trialDate;

    // ==================== Deadlines ====================
    @Builder.Default
    private List<DeadlineInfo> upcomingDeadlines = new ArrayList<>();

    @Builder.Default
    private List<DeadlineInfo> overdueDeadlines = new ArrayList<>();

    private DeadlineInfo mostUrgentDeadline;

    // ==================== Tasks Summary ====================
    private Integer totalTasks;
    private Integer pendingTasks;
    private Integer inProgressTasks;
    private Integer completedTasks;
    private Integer overdueTasks;

    @Builder.Default
    private List<TaskSummary> upcomingTasks = new ArrayList<>();

    // ==================== Existing Work ====================
    @Builder.Default
    private List<DraftSummary> existingDrafts = new ArrayList<>();

    @Builder.Default
    private List<ResearchSummary> existingResearch = new ArrayList<>();

    @Builder.Default
    private List<WorkflowHistorySummary> completedWorkflows = new ArrayList<>();

    // ==================== Case Team ====================
    @Builder.Default
    private List<TeamMember> caseTeam = new ArrayList<>();

    private TeamMember leadAttorney;
    private TeamMember primaryParalegal;

    // ==================== Metadata ====================
    private LocalDateTime contextLoadedAt;
    private Long organizationId;

    // ==================== Nested DTOs ====================

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TaskSummary {
        private Long id;
        private String title;
        private String description;
        private TaskStatus status;
        private String priority;
        private LocalDateTime dueDate;
        private Long daysUntilDue;
        private String assigneeName;
        private boolean isOverdue;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DraftSummary {
        private Long sessionId;
        private String title;
        private String documentType;
        private String status;
        private LocalDateTime createdAt;
        private LocalDateTime lastModified;
        private String createdByName;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ResearchSummary {
        private Long sessionId;
        private String topic;
        private Integer totalSearches;
        private Integer totalDocumentsViewed;
        private LocalDateTime createdAt;
        private LocalDateTime lastAccessed;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkflowHistorySummary {
        private Long executionId;
        private String workflowName;
        private String templateType;
        private LocalDateTime completedAt;
        private String completedByName;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeamMember {
        private Long userId;
        private String name;
        private String email;
        private String imageUrl;
        private CaseRoleType roleType;
        private String roleLabel;
        private boolean isActive;
    }

    // ==================== Helper Methods ====================

    /**
     * Check if the case has any urgent deadlines (within 3 days)
     */
    public boolean hasUrgentDeadlines() {
        return mostUrgentDeadline != null &&
               mostUrgentDeadline.getDaysUntil() <= 3 &&
               mostUrgentDeadline.getDaysUntil() >= 0;
    }

    /**
     * Check if the case has overdue items (tasks or deadlines)
     */
    public boolean hasOverdueItems() {
        return (overdueTasks != null && overdueTasks > 0) ||
               (overdueDeadlines != null && !overdueDeadlines.isEmpty());
    }

    /**
     * Get the lead attorney name (convenience method)
     */
    public String getLeadAttorneyName() {
        return leadAttorney != null ? leadAttorney.getName() : null;
    }

    /**
     * Get days until most urgent deadline
     */
    public Long getDaysUntilMostUrgentDeadline() {
        return mostUrgentDeadline != null ? mostUrgentDeadline.getDaysUntil() : null;
    }

    /**
     * Convert to a Map for JSON serialization in workflow inputData
     */
    public java.util.Map<String, Object> toMap() {
        java.util.Map<String, Object> map = new java.util.HashMap<>();

        // Basic info
        map.put("caseId", caseId);
        map.put("caseNumber", caseNumber);
        map.put("title", title);
        map.put("caseType", caseType);
        map.put("status", status != null ? status.name() : null);
        map.put("priority", priority != null ? priority.name() : null);
        map.put("clientName", clientName);

        // Phase info
        map.put("currentPhase", currentPhase);
        map.put("currentPhaseNumber", currentPhaseNumber);
        map.put("totalPhases", totalPhases);
        map.put("progressPercentage", progressPercentage);

        // Dates
        map.put("filingDate", filingDate != null ? filingDate.toString() : null);
        map.put("nextHearing", nextHearing != null ? nextHearing.toString() : null);
        map.put("trialDate", trialDate != null ? trialDate.toString() : null);

        // Deadlines summary
        map.put("upcomingDeadlinesCount", upcomingDeadlines != null ? upcomingDeadlines.size() : 0);
        map.put("overdueDeadlinesCount", overdueDeadlines != null ? overdueDeadlines.size() : 0);
        map.put("hasUrgentDeadlines", hasUrgentDeadlines());
        map.put("daysUntilMostUrgentDeadline", getDaysUntilMostUrgentDeadline());

        // Tasks summary
        map.put("totalTasks", totalTasks);
        map.put("pendingTasks", pendingTasks);
        map.put("completedTasks", completedTasks);
        map.put("overdueTasks", overdueTasks);

        // Team
        map.put("leadAttorneyName", getLeadAttorneyName());
        map.put("teamSize", caseTeam != null ? caseTeam.size() : 0);

        // Existing work
        map.put("existingDraftsCount", existingDrafts != null ? existingDrafts.size() : 0);
        map.put("existingResearchCount", existingResearch != null ? existingResearch.size() : 0);
        map.put("completedWorkflowsCount", completedWorkflows != null ? completedWorkflows.size() : 0);

        // Court info
        map.put("jurisdiction", jurisdiction);
        map.put("countyName", countyName);
        map.put("judgeName", judgeName);

        return map;
    }
}
