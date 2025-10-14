package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.dto.ai.ActionSuggestionRequest;
import com.bostoneo.bostoneosolutions.dto.ai.ExecuteActionRequest;
import com.bostoneo.bostoneosolutions.model.ResearchActionItem;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.ResearchActionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;

import static java.time.LocalDateTime.now;
import static org.springframework.http.HttpStatus.CREATED;

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

    @PostMapping("/{actionId}/execute")
    public ResponseEntity<HttpResponse> executeAction(
            @PathVariable Long actionId,
            @Valid @RequestBody ExecuteActionRequest request) {

        log.info("Executing action {} of type {}", actionId, request.getActionType());

        Object result = actionService.executeAction(actionId, request);

        return ResponseEntity.status(CREATED).body(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("result", result, "actionId", actionId))
                .message("Action executed and completed successfully")
                .status(CREATED)
                .statusCode(CREATED.value())
                .build()
        );
    }

    @PostMapping("/generate-title")
    public ResponseEntity<Map<String, String>> generateTitle(@RequestBody Map<String, String> request) {
        String description = request.get("description");
        log.info("Generating title for description: {}", description.substring(0, Math.min(50, description.length())));

        String title = actionService.generateSmartTitle(description);

        return ResponseEntity.ok(Map.of("title", title));
    }
}
