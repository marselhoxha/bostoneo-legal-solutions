package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.model.ActionItem;
import com.bostoneo.bostoneosolutions.model.TimelineEvent;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.ActionItemRepository;
import com.bostoneo.bostoneosolutions.repository.TimelineEventRepository;
import com.bostoneo.bostoneosolutions.repository.AIDocumentAnalysisRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ai/document-analysis")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class ActionItemController {

    private final ActionItemRepository actionItemRepository;
    private final TimelineEventRepository timelineEventRepository;
    private final AIDocumentAnalysisRepository analysisRepository;
    private final TenantService tenantService;

    /**
     * Helper method to get the current organization ID (required for tenant isolation)
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    /**
     * Verify that an analysis belongs to the current organization
     */
    private boolean verifyAnalysisAccess(Long analysisId) {
        Long orgId = getRequiredOrganizationId();
        return analysisRepository.findByIdAndOrganizationId(analysisId, orgId).isPresent();
    }

    @GetMapping("/{analysisId}/action-items")
    public ResponseEntity<List<ActionItem>> getActionItems(@PathVariable Long analysisId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting action items for analysis {} in org {}", analysisId, orgId);

        // SECURITY: Verify analysis belongs to this organization
        if (!verifyAnalysisAccess(analysisId)) {
            log.warn("Unauthorized access attempt to analysis {} by org {}", analysisId, orgId);
            return ResponseEntity.notFound().build();
        }

        List<ActionItem> items = actionItemRepository.findByOrganizationIdAndAnalysisIdOrderByDeadlineAsc(orgId, analysisId);
        return ResponseEntity.ok(items);
    }

    @GetMapping("/{analysisId}/timeline-events")
    public ResponseEntity<List<TimelineEvent>> getTimelineEvents(@PathVariable Long analysisId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting timeline events for analysis {} in org {}", analysisId, orgId);

        // SECURITY: Verify analysis belongs to this organization
        if (!verifyAnalysisAccess(analysisId)) {
            log.warn("Unauthorized access attempt to analysis {} by org {}", analysisId, orgId);
            return ResponseEntity.notFound().build();
        }

        List<TimelineEvent> events = timelineEventRepository.findByOrganizationIdAndAnalysisIdOrderByEventDateAsc(orgId, analysisId);
        return ResponseEntity.ok(events);
    }

    @PutMapping("/action-items/{id}")
    public ResponseEntity<ActionItem> updateActionItem(
            @PathVariable Long id,
            @RequestBody ActionItem updatedItem) {
        Long orgId = getRequiredOrganizationId();
        log.info("Updating action item {} in org {}", id, orgId);

        // SECURITY: Use tenant-filtered query
        return actionItemRepository.findByIdAndOrganizationId(id, orgId)
                .map(item -> {
                    if (updatedItem.getStatus() != null) {
                        item.setStatus(updatedItem.getStatus());
                    }
                    if (updatedItem.getDeadline() != null) {
                        item.setDeadline(updatedItem.getDeadline());
                    }
                    if (updatedItem.getPriority() != null) {
                        item.setPriority(updatedItem.getPriority());
                    }
                    ActionItem saved = actionItemRepository.save(item);
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/timeline-events/{id}/calendar")
    public ResponseEntity<TimelineEvent> linkTimelineEventToCalendar(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, Long> body) {
        Long orgId = getRequiredOrganizationId();
        log.info("Linking timeline event {} to calendar in org {}", id, orgId);

        // SECURITY: Use tenant-filtered query
        return timelineEventRepository.findByIdAndOrganizationId(id, orgId)
                .map(event -> {
                    Long calendarEventId = body.get("calendarEventId");
                    event.setCalendarEventId(calendarEventId);
                    TimelineEvent saved = timelineEventRepository.save(event);
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
