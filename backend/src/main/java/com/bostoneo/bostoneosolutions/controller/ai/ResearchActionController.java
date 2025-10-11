package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.dto.ai.ActionSuggestionRequest;
import com.bostoneo.bostoneosolutions.model.ResearchActionItem;
import com.bostoneo.bostoneosolutions.service.ResearchActionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ai/research/actions")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "http://localhost:4200")
public class ResearchActionController {

    private final ResearchActionService actionService;

    @PostMapping("/suggest")
    public ResponseEntity<List<ResearchActionItem>> suggestActions(
            @RequestParam Long sessionId,
            @RequestParam Long userId,
            @RequestParam(required = false) Long caseId,
            @RequestBody ActionSuggestionRequest request) {

        log.info("Suggesting actions for session: {}, case: {}, finding: {}",
            sessionId, caseId, request.getFinding().substring(0, Math.min(50, request.getFinding().length())));

        List<ResearchActionItem> suggestions = actionService.suggestActions(
            sessionId,
            userId,
            caseId,
            request.getFinding(),
            request.getCitation()
        );

        return ResponseEntity.ok(suggestions);
    }

    @GetMapping("/user/{userId}/pending")
    public ResponseEntity<List<ResearchActionItem>> getPendingActions(@PathVariable Long userId) {
        List<ResearchActionItem> actions = actionService.getPendingActions(userId);
        return ResponseEntity.ok(actions);
    }

    @GetMapping("/session/{sessionId}")
    public ResponseEntity<List<ResearchActionItem>> getSessionActions(@PathVariable Long sessionId) {
        List<ResearchActionItem> actions = actionService.getSessionActions(sessionId);
        return ResponseEntity.ok(actions);
    }

    @PostMapping("/{actionId}/dismiss")
    public ResponseEntity<Void> dismissAction(@PathVariable Long actionId) {
        actionService.dismissAction(actionId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{actionId}/complete")
    public ResponseEntity<Void> completeAction(@PathVariable Long actionId) {
        actionService.completeAction(actionId);
        return ResponseEntity.ok().build();
    }
}
