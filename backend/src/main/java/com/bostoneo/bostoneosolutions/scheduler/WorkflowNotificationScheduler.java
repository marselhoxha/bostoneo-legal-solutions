package com.bostoneo.bostoneosolutions.scheduler;

import com.bostoneo.bostoneosolutions.dto.WorkflowRecommendation;
import com.bostoneo.bostoneosolutions.model.CaseAssignment;
import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.repository.CaseAssignmentRepository;
import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.service.WorkflowRecommendationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Scheduler for sending proactive workflow recommendation notifications.
 * Checks for upcoming deadlines and notifies case team members.
 *
 * Notification triggers:
 * - 7 days before deadline (first reminder)
 * - 3 days before deadline (urgent reminder)
 * - 1 day before deadline (critical reminder)
 * - On deadline day (final notice)
 */
@Component
@Slf4j
public class WorkflowNotificationScheduler {

    @Autowired
    private WorkflowRecommendationService recommendationService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private CaseAssignmentRepository caseAssignmentRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Value("${app.workflow.notifications.enabled:true}")
    private boolean notificationsEnabled;

    // Days before deadline to trigger notifications
    private static final Set<Integer> NOTIFICATION_TRIGGERS = Set.of(7, 3, 1, 0);

    /**
     * Run workflow recommendation check every day at 8 AM
     * SECURITY: Iterates through each organization with proper tenant isolation
     */
    @Scheduled(cron = "${app.workflow.notifications.cron:0 0 8 * * MON-FRI}")
    public void checkWorkflowRecommendations() {
        if (!notificationsEnabled) {
            log.debug("Workflow notifications are disabled");
            return;
        }

        log.info("Starting workflow recommendation notification check");

        try {
            List<Organization> organizations = organizationRepository.findAll();

            int totalNotificationsSent = 0;

            for (Organization org : organizations) {
                try {
                    // SECURITY: Set tenant context for this organization
                    TenantContext.setCurrentTenant(org.getId());
                    log.debug("Checking workflow recommendations for organization: {} (ID: {})", org.getName(), org.getId());

                    int orgNotifications = processOrganizationRecommendations(org.getId());
                    totalNotificationsSent += orgNotifications;

                } catch (Exception e) {
                    log.error("Error processing workflow recommendations for organization {}: {}", org.getId(), e.getMessage());
                } finally {
                    // SECURITY: Always clear tenant context after processing
                    TenantContext.clear();
                }
            }

            log.info("Workflow recommendation check completed. Total notifications sent: {}", totalNotificationsSent);

        } catch (Exception e) {
            log.error("Error in workflow recommendation scheduler: {}", e.getMessage(), e);
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * Process recommendations for a single organization
     * Returns the number of notifications sent
     */
    private int processOrganizationRecommendations(Long orgId) {
        int notificationsSent = 0;

        try {
            // Get all recommendations for the organization
            List<WorkflowRecommendation> recommendations = recommendationService.getRecommendationsForAllCases();

            // Filter to only actionable recommendations (matching trigger days)
            List<WorkflowRecommendation> actionableRecs = recommendations.stream()
                    .filter(this::shouldNotify)
                    .collect(Collectors.toList());

            if (actionableRecs.isEmpty()) {
                log.debug("No actionable workflow recommendations for org {}", orgId);
                return 0;
            }

            log.info("Found {} actionable workflow recommendations for org {}", actionableRecs.size(), orgId);

            // Group recommendations by case to avoid duplicate notifications
            Map<Long, List<WorkflowRecommendation>> recsByCaseId = actionableRecs.stream()
                    .collect(Collectors.groupingBy(WorkflowRecommendation::getCaseId));

            // Send notifications for each case
            for (Map.Entry<Long, List<WorkflowRecommendation>> entry : recsByCaseId.entrySet()) {
                Long caseId = entry.getKey();
                List<WorkflowRecommendation> caseRecs = entry.getValue();

                notificationsSent += sendCaseNotifications(caseId, caseRecs, orgId);
            }

        } catch (Exception e) {
            log.error("Error processing recommendations for org {}: {}", orgId, e.getMessage());
        }

        return notificationsSent;
    }

    /**
     * Determine if a recommendation should trigger a notification
     */
    private boolean shouldNotify(WorkflowRecommendation rec) {
        if (rec.getDaysUntilDeadline() == null) {
            return false;  // Phase-based recommendations don't trigger notifications
        }

        int daysUntil = rec.getDaysUntilDeadline();

        // Notify for overdue items
        if (daysUntil < 0) {
            return true;
        }

        // Notify on trigger days
        return NOTIFICATION_TRIGGERS.contains(daysUntil);
    }

    /**
     * Send notifications for a case's recommendations to all team members
     */
    private int sendCaseNotifications(Long caseId, List<WorkflowRecommendation> recommendations, Long orgId) {
        int notificationsSent = 0;

        try {
            // Get case team members
            List<CaseAssignment> assignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(caseId, orgId);

            if (assignments.isEmpty()) {
                log.debug("No team members assigned to case {} for notification", caseId);
                return 0;
            }

            // Build notification content
            WorkflowRecommendation mostUrgent = recommendations.stream()
                    .min(Comparator.comparing(r -> r.getDaysUntilDeadline() != null ? r.getDaysUntilDeadline() : Integer.MAX_VALUE))
                    .orElse(recommendations.get(0));

            String title = buildNotificationTitle(mostUrgent);
            String body = buildNotificationBody(recommendations, mostUrgent);

            Map<String, Object> notificationData = new HashMap<>();
            notificationData.put("caseId", caseId);
            notificationData.put("caseNumber", mostUrgent.getCaseNumber());
            notificationData.put("templateType", mostUrgent.getTemplateType());
            notificationData.put("templateId", mostUrgent.getTemplateId());
            notificationData.put("urgency", mostUrgent.getUrgency().name());
            notificationData.put("daysUntilDeadline", mostUrgent.getDaysUntilDeadline());
            notificationData.put("recommendationCount", recommendations.size());
            notificationData.put("actionUrl", "/ai-workspace?caseId=" + caseId + "&suggestedWorkflow=" + mostUrgent.getTemplateType());

            // Send to each team member
            for (CaseAssignment assignment : assignments) {
                Long userId = assignment.getAssignedTo().getId();

                try {
                    notificationService.sendCrmNotification(
                            title,
                            body,
                            userId,
                            "WORKFLOW_SUGGESTION",
                            notificationData
                    );
                    notificationsSent++;
                    log.debug("Sent workflow notification to user {} for case {}", userId, caseId);
                } catch (Exception e) {
                    log.error("Failed to send notification to user {}: {}", userId, e.getMessage());
                }
            }

        } catch (Exception e) {
            log.error("Error sending notifications for case {}: {}", caseId, e.getMessage());
        }

        return notificationsSent;
    }

    /**
     * Build notification title based on urgency
     */
    private String buildNotificationTitle(WorkflowRecommendation rec) {
        String caseRef = rec.getCaseNumber() != null ? rec.getCaseNumber() : "Case";

        if (rec.getDaysUntilDeadline() != null) {
            int days = rec.getDaysUntilDeadline();
            if (days < 0) {
                return "OVERDUE: Workflow Action Required - " + caseRef;
            } else if (days == 0) {
                return "DUE TODAY: Workflow Action Required - " + caseRef;
            } else if (days == 1) {
                return "Due Tomorrow: Workflow Suggestion - " + caseRef;
            } else if (days <= 3) {
                return "Urgent: Workflow Suggestion - " + caseRef;
            }
        }

        return "Workflow Suggestion - " + caseRef;
    }

    /**
     * Build notification body with recommendation details
     */
    private String buildNotificationBody(List<WorkflowRecommendation> recommendations, WorkflowRecommendation mostUrgent) {
        StringBuilder body = new StringBuilder();

        body.append(mostUrgent.getReason());

        if (mostUrgent.getDaysUntilDeadline() != null) {
            int days = mostUrgent.getDaysUntilDeadline();
            if (days < 0) {
                body.append(" (").append(Math.abs(days)).append(" days overdue)");
            } else if (days == 0) {
                body.append(" (due today)");
            } else if (days == 1) {
                body.append(" (due tomorrow)");
            } else {
                body.append(" (").append(days).append(" days remaining)");
            }
        }

        body.append("\n\nSuggested workflow: ").append(mostUrgent.getTemplateName());

        if (recommendations.size() > 1) {
            body.append("\n\n").append(recommendations.size() - 1).append(" additional workflow suggestion(s) available.");
        }

        return body.toString();
    }
}
