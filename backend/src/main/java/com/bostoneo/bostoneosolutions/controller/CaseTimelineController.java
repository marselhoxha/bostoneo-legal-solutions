package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.CaseTimelineDTO;
import com.bostoneo.bostoneosolutions.model.CaseTimelineTemplate;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.service.CaseTimelineService;
import com.bostoneo.bostoneosolutions.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/case-timeline")
@RequiredArgsConstructor
@Slf4j
public class CaseTimelineController {

    private final CaseTimelineService timelineService;
    private final UserService userService;

    /**
     * Get timeline for a specific case
     */
    @GetMapping("/cases/{caseId}")
    public ResponseEntity<Map<String, Object>> getCaseTimeline(@PathVariable Long caseId) {
        log.info("Getting timeline for case: {}", caseId);
        CaseTimelineDTO timeline = timelineService.getCaseTimeline(caseId);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Timeline retrieved successfully");
        response.put("data", Map.of("timeline", timeline));

        return ResponseEntity.ok(response);
    }

    /**
     * Initialize timeline for a case
     */
    @PostMapping("/cases/{caseId}/initialize")
    public ResponseEntity<Map<String, Object>> initializeTimeline(@PathVariable Long caseId) {
        log.info("Initializing timeline for case: {}", caseId);
        timelineService.initializeTimeline(caseId);
        CaseTimelineDTO timeline = timelineService.getCaseTimeline(caseId);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Timeline initialized successfully");
        response.put("data", Map.of("timeline", timeline));

        return ResponseEntity.ok(response);
    }

    /**
     * Update current phase of a case
     */
    @PutMapping("/cases/{caseId}/phase/{phaseOrder}")
    public ResponseEntity<Map<String, Object>> updateCurrentPhase(
            @PathVariable Long caseId,
            @PathVariable Integer phaseOrder,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication) {

        log.info("Updating case {} to phase {}", caseId, phaseOrder);

        String notes = body != null ? body.get("notes") : null;
        Long userId = getCurrentUserId(authentication);

        CaseTimelineDTO timeline = timelineService.updateCurrentPhase(caseId, phaseOrder, notes, userId);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Phase updated successfully");
        response.put("data", Map.of("timeline", timeline));

        return ResponseEntity.ok(response);
    }

    /**
     * Mark a phase as completed
     */
    @PostMapping("/cases/{caseId}/phase/{phaseOrder}/complete")
    public ResponseEntity<Map<String, Object>> completePhase(
            @PathVariable Long caseId,
            @PathVariable Integer phaseOrder,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication) {

        log.info("Completing phase {} for case {}", phaseOrder, caseId);

        String notes = body != null ? body.get("notes") : null;
        Long userId = getCurrentUserId(authentication);

        CaseTimelineDTO timeline = timelineService.completePhase(caseId, phaseOrder, notes, userId);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Phase completed successfully");
        response.put("data", Map.of("timeline", timeline));

        return ResponseEntity.ok(response);
    }

    /**
     * Skip a phase
     */
    @PostMapping("/cases/{caseId}/phase/{phaseOrder}/skip")
    public ResponseEntity<Map<String, Object>> skipPhase(
            @PathVariable Long caseId,
            @PathVariable Integer phaseOrder,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication) {

        log.info("Skipping phase {} for case {}", phaseOrder, caseId);

        String reason = body != null ? body.get("reason") : null;
        Long userId = getCurrentUserId(authentication);

        CaseTimelineDTO timeline = timelineService.skipPhase(caseId, phaseOrder, reason, userId);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Phase skipped");
        response.put("data", Map.of("timeline", timeline));

        return ResponseEntity.ok(response);
    }

    /**
     * Get available case types for timeline templates
     */
    @GetMapping("/templates/types")
    public ResponseEntity<Map<String, Object>> getAvailableCaseTypes() {
        List<String> types = timelineService.getAvailableCaseTypes();

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Case types retrieved successfully");
        response.put("data", Map.of("caseTypes", types));

        return ResponseEntity.ok(response);
    }

    /**
     * Get timeline template for a specific case type
     */
    @GetMapping("/templates/{caseType}")
    public ResponseEntity<Map<String, Object>> getTemplateForCaseType(@PathVariable String caseType) {
        List<CaseTimelineTemplate> templates = timelineService.getTemplateForCaseType(caseType);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Template retrieved successfully");
        response.put("data", Map.of("template", templates));

        return ResponseEntity.ok(response);
    }

    private Long getCurrentUserId(Authentication authentication) {
        if (authentication == null) return null;
        try {
            UserDTO user = userService.getUserByEmail(authentication.getName());
            return user != null ? user.getId() : null;
        } catch (Exception e) {
            log.warn("Could not get current user ID: {}", e.getMessage());
            return null;
        }
    }
}
