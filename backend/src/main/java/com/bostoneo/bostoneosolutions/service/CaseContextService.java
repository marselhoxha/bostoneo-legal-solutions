package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.CaseContext;
import com.bostoneo.bostoneosolutions.dto.DeadlineInfo;
import com.bostoneo.bostoneosolutions.enumeration.CaseRoleType;
import com.bostoneo.bostoneosolutions.enumeration.TaskStatus;
import com.bostoneo.bostoneosolutions.enumeration.WorkflowExecutionStatus;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for aggregating case context data for workflow execution.
 * Provides comprehensive case information needed for intelligent workflow processing.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CaseContextService {

    private final LegalCaseRepository legalCaseRepository;
    private final CaseTaskRepository caseTaskRepository;
    private final CaseAssignmentRepository caseAssignmentRepository;
    private final CaseTimelineProgressRepository timelineProgressRepository;
    private final AiConversationSessionRepository conversationSessionRepository;
    private final CaseWorkflowExecutionRepository workflowExecutionRepository;
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new ApiException("Organization context required"));
    }

    /**
     * Load full case context for workflow execution.
     * Aggregates all relevant case data: details, timeline, tasks, team, existing work.
     *
     * @param caseId The case ID to load context for
     * @return CaseContext with all aggregated data
     */
    @Transactional(readOnly = true)
    public CaseContext getCaseContext(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return getCaseContext(caseId, orgId);
    }

    /**
     * Load case context with explicit organization ID (for async operations)
     */
    @Transactional(readOnly = true)
    public CaseContext getCaseContext(Long caseId, Long organizationId) {
        log.info("Loading case context for caseId: {}, orgId: {}", caseId, organizationId);

        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(caseId, organizationId)
                .orElseThrow(() -> new ApiException("Case not found or access denied: " + caseId));

        CaseContext.CaseContextBuilder builder = CaseContext.builder()
                .caseId(caseId)
                .organizationId(organizationId)
                .caseNumber(legalCase.getCaseNumber())
                .title(legalCase.getTitle())
                .caseType(legalCase.getType())
                .status(legalCase.getStatus())
                .priority(legalCase.getPriority())
                .clientName(legalCase.getClientName())
                .clientEmail(legalCase.getClientEmail())
                .description(legalCase.getDescription())
                .countyName(legalCase.getCountyName())
                .judgeName(legalCase.getJudgeName())
                .filingDate(toLocalDate(legalCase.getFilingDate()))
                .nextHearing(toLocalDate(legalCase.getNextHearing()))
                .trialDate(toLocalDate(legalCase.getTrialDate()))
                .contextLoadedAt(LocalDateTime.now());

        // Load all context data
        loadTimelineContext(builder, caseId, organizationId);
        loadTaskContext(builder, caseId, organizationId);
        loadTeamContext(builder, caseId, organizationId);
        loadDraftContext(builder, caseId, organizationId);
        loadWorkflowHistory(builder, caseId, organizationId);

        CaseContext context = builder.build();
        log.info("Case context loaded: caseNumber={}, phase={}, pendingTasks={}, teamSize={}",
                context.getCaseNumber(), context.getCurrentPhase(),
                context.getPendingTasks(), context.getCaseTeam() != null ? context.getCaseTeam().size() : 0);

        return context;
    }

    private LocalDate toLocalDate(java.util.Date date) {
        if (date == null) return null;
        return date.toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDate();
    }

    private void loadTimelineContext(CaseContext.CaseContextBuilder builder, Long caseId, Long orgId) {
        try {
            List<CaseTimelineProgress> phases = timelineProgressRepository
                    .findByOrganizationIdAndCaseIdOrderByPhaseOrderAsc(orgId, caseId);

            if (!phases.isEmpty()) {
                int total = phases.size();
                int completed = (int) phases.stream()
                        .filter(p -> p.getStatus() == CaseTimelineProgress.TimelinePhaseStatus.COMPLETED)
                        .count();
                int skipped = (int) phases.stream()
                        .filter(p -> p.getStatus() == CaseTimelineProgress.TimelinePhaseStatus.SKIPPED)
                        .count();

                builder.totalPhases(total);
                builder.progressPercentage(total > 0 ? ((double) (completed + skipped) / total) * 100 : 0.0);

                // Find current phase (IN_PROGRESS)
                Optional<CaseTimelineProgress> currentPhase = phases.stream()
                        .filter(p -> p.getStatus() == CaseTimelineProgress.TimelinePhaseStatus.IN_PROGRESS)
                        .findFirst();

                if (currentPhase.isPresent()) {
                    CaseTimelineProgress cp = currentPhase.get();
                    builder.currentPhase(cp.getPhaseName());
                    builder.currentPhaseNumber(cp.getPhaseOrder());
                    builder.phaseStartedAt(cp.getStartedAt());
                }
            }
        } catch (Exception e) {
            log.warn("Could not load timeline context for caseId {}: {}", caseId, e.getMessage());
        }
    }

    private void loadTaskContext(CaseContext.CaseContextBuilder builder, Long caseId, Long orgId) {
        try {
            List<CaseTask> tasks = caseTaskRepository.findByOrganizationIdAndCaseId(orgId, caseId);

            if (tasks.isEmpty()) {
                builder.totalTasks(0)
                        .pendingTasks(0)
                        .inProgressTasks(0)
                        .completedTasks(0)
                        .overdueTasks(0);
                return;
            }

            // Calculate task stats
            int total = tasks.size();
            int pending = (int) tasks.stream().filter(t -> t.getStatus() == TaskStatus.TODO).count();
            int inProgress = (int) tasks.stream().filter(t -> t.getStatus() == TaskStatus.IN_PROGRESS).count();
            int completed = (int) tasks.stream().filter(t -> t.getStatus() == TaskStatus.COMPLETED).count();
            int overdue = (int) tasks.stream().filter(CaseTask::isOverdue).count();

            builder.totalTasks(total)
                    .pendingTasks(pending)
                    .inProgressTasks(inProgress)
                    .completedTasks(completed)
                    .overdueTasks(overdue);

            // Extract upcoming deadlines from tasks with due dates
            List<DeadlineInfo> upcomingDeadlines = new ArrayList<>();
            List<DeadlineInfo> overdueDeadlines = new ArrayList<>();

            tasks.stream()
                    .filter(t -> t.getDueDate() != null)
                    .filter(t -> t.getStatus() != TaskStatus.COMPLETED && t.getStatus() != TaskStatus.CANCELLED)
                    .sorted(Comparator.comparing(CaseTask::getDueDate))
                    .forEach(task -> {
                        LocalDate dueDate = task.getDueDate().toLocalDate();
                        DeadlineInfo deadline = DeadlineInfo.fromDate(
                                dueDate,
                                task.getTitle(),
                                DeadlineInfo.DeadlineType.OTHER
                        );

                        if (deadline.getDaysUntil() < 0) {
                            overdueDeadlines.add(deadline);
                        } else {
                            upcomingDeadlines.add(deadline);
                        }
                    });

            builder.upcomingDeadlines(upcomingDeadlines);
            builder.overdueDeadlines(overdueDeadlines);

            // Set most urgent deadline
            if (!upcomingDeadlines.isEmpty()) {
                builder.mostUrgentDeadline(upcomingDeadlines.get(0));
            } else if (!overdueDeadlines.isEmpty()) {
                builder.mostUrgentDeadline(overdueDeadlines.get(0));
            }

            // Get upcoming task summaries (next 5 due tasks)
            List<CaseContext.TaskSummary> upcomingTasks = tasks.stream()
                    .filter(t -> t.getDueDate() != null)
                    .filter(t -> t.getStatus() != TaskStatus.COMPLETED && t.getStatus() != TaskStatus.CANCELLED)
                    .sorted(Comparator.comparing(CaseTask::getDueDate))
                    .limit(5)
                    .map(this::toTaskSummary)
                    .collect(Collectors.toList());

            builder.upcomingTasks(upcomingTasks);

        } catch (Exception e) {
            log.warn("Could not load task context for caseId {}: {}", caseId, e.getMessage());
        }
    }

    private CaseContext.TaskSummary toTaskSummary(CaseTask task) {
        LocalDateTime now = LocalDateTime.now();
        long daysUntil = task.getDueDate() != null ?
                ChronoUnit.DAYS.between(now.toLocalDate(), task.getDueDate().toLocalDate()) : 0;

        return CaseContext.TaskSummary.builder()
                .id(task.getId())
                .title(task.getTitle())
                .description(task.getDescription())
                .status(task.getStatus())
                .priority(task.getPriority() != null ? task.getPriority().name() : "MEDIUM")
                .dueDate(task.getDueDate())
                .daysUntilDue(daysUntil)
                .assigneeName(task.getAssignedTo() != null ?
                        task.getAssignedTo().getFirstName() + " " + task.getAssignedTo().getLastName() : null)
                .isOverdue(task.isOverdue())
                .build();
    }

    private void loadTeamContext(CaseContext.CaseContextBuilder builder, Long caseId, Long orgId) {
        try {
            List<CaseAssignment> assignments = caseAssignmentRepository
                    .findActiveByCaseIdAndOrganizationId(caseId, orgId);

            List<CaseContext.TeamMember> team = assignments.stream()
                    .map(this::toTeamMember)
                    .collect(Collectors.toList());

            builder.caseTeam(team);

            // Find lead attorney
            team.stream()
                    .filter(m -> m.getRoleType() == CaseRoleType.LEAD_ATTORNEY)
                    .findFirst()
                    .ifPresent(builder::leadAttorney);

            // Find primary paralegal
            team.stream()
                    .filter(m -> m.getRoleType() == CaseRoleType.PARALEGAL)
                    .findFirst()
                    .ifPresent(builder::primaryParalegal);

        } catch (Exception e) {
            log.warn("Could not load team context for caseId {}: {}", caseId, e.getMessage());
        }
    }

    private CaseContext.TeamMember toTeamMember(CaseAssignment assignment) {
        User user = assignment.getAssignedTo();
        return CaseContext.TeamMember.builder()
                .userId(user.getId())
                .name(user.getFirstName() + " " + user.getLastName())
                .email(user.getEmail())
                .imageUrl(user.getImageUrl())
                .roleType(assignment.getRoleType())
                .roleLabel(formatRoleLabel(assignment.getRoleType()))
                .isActive(assignment.isActive())
                .build();
    }

    private String formatRoleLabel(CaseRoleType roleType) {
        if (roleType == null) return "Team Member";
        return switch (roleType) {
            case LEAD_ATTORNEY -> "Lead Attorney";
            case SUPPORTING_ATTORNEY -> "Supporting Attorney";
            case CO_COUNSEL -> "Co-Counsel";
            case ASSOCIATE -> "Associate";
            case PARALEGAL -> "Paralegal";
            case LEGAL_ASSISTANT -> "Legal Assistant";
            case SECRETARY -> "Secretary";
            case CONSULTANT -> "Consultant";
            case INTERN -> "Intern";
        };
    }

    private void loadDraftContext(CaseContext.CaseContextBuilder builder, Long caseId, Long orgId) {
        try {
            // Query all sessions linked to this case (both research and drafting)
            List<AiConversationSession> sessions = conversationSessionRepository
                    .findByCaseIdAndOrganizationId(caseId, orgId);

            List<CaseContext.DraftSummary> drafts = sessions.stream()
                    .map(this::toDraftSummary)
                    .collect(Collectors.toList());

            builder.existingDrafts(drafts);

        } catch (Exception e) {
            log.warn("Could not load draft context for caseId {}: {}", caseId, e.getMessage());
        }
    }

    private CaseContext.DraftSummary toDraftSummary(AiConversationSession session) {
        return CaseContext.DraftSummary.builder()
                .sessionId(session.getId())
                .title(session.getSessionName())
                .documentType(session.getDocumentType())
                .status(session.getSessionType())
                .createdAt(session.getCreatedAt())
                .lastModified(session.getLastInteractionAt())
                .build();
    }

    private void loadWorkflowHistory(CaseContext.CaseContextBuilder builder, Long caseId, Long orgId) {
        try {
            List<CaseWorkflowExecution> executions = workflowExecutionRepository
                    .findByOrganizationIdAndLegalCaseId(orgId, caseId);

            List<CaseContext.WorkflowHistorySummary> history = executions.stream()
                    .filter(e -> e.getStatus() == WorkflowExecutionStatus.COMPLETED)
                    .map(this::toWorkflowHistory)
                    .collect(Collectors.toList());

            builder.completedWorkflows(history);

        } catch (Exception e) {
            log.warn("Could not load workflow history for caseId {}: {}", caseId, e.getMessage());
        }
    }

    private CaseContext.WorkflowHistorySummary toWorkflowHistory(CaseWorkflowExecution execution) {
        return CaseContext.WorkflowHistorySummary.builder()
                .executionId(execution.getId())
                .workflowName(execution.getName())
                .templateType(execution.getTemplate() != null ?
                        execution.getTemplate().getTemplateType().name() : null)
                .completedAt(execution.getCompletedAt())
                .completedByName(execution.getCreatedBy() != null ?
                        execution.getCreatedBy().getFirstName() + " " + execution.getCreatedBy().getLastName() : null)
                .build();
    }
}
