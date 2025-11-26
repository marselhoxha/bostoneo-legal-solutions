package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.model.ActionItem;
import com.bostoneo.bostoneosolutions.model.TimelineEvent;
import com.bostoneo.bostoneosolutions.repository.ActionItemRepository;
import com.bostoneo.bostoneosolutions.repository.TimelineEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ai/document-analysis")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ActionItemController {

    private final ActionItemRepository actionItemRepository;
    private final TimelineEventRepository timelineEventRepository;

    @GetMapping("/{analysisId}/action-items")
    public ResponseEntity<List<ActionItem>> getActionItems(@PathVariable Long analysisId) {
        List<ActionItem> items = actionItemRepository.findByAnalysisIdOrderByDeadlineAsc(analysisId);
        return ResponseEntity.ok(items);
    }

    @GetMapping("/{analysisId}/timeline-events")
    public ResponseEntity<List<TimelineEvent>> getTimelineEvents(@PathVariable Long analysisId) {
        List<TimelineEvent> events = timelineEventRepository.findByAnalysisIdOrderByEventDateAsc(analysisId);
        return ResponseEntity.ok(events);
    }

    @PutMapping("/action-items/{id}")
    public ResponseEntity<ActionItem> updateActionItem(
            @PathVariable Long id,
            @RequestBody ActionItem updatedItem) {
        return actionItemRepository.findById(id)
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
        return timelineEventRepository.findById(id)
                .map(event -> {
                    Long calendarEventId = body.get("calendarEventId");
                    event.setCalendarEventId(calendarEventId);
                    TimelineEvent saved = timelineEventRepository.save(event);
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
