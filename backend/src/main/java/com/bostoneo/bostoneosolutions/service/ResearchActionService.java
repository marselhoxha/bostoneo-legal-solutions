package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.ResearchActionItem;
import com.bostoneo.bostoneosolutions.model.ResearchActionItem.*;
import com.bostoneo.bostoneosolutions.repository.ResearchActionItemRepository;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Service
@RequiredArgsConstructor
@Slf4j
public class ResearchActionService {

    private final ResearchActionItemRepository actionRepository;
    private final ClaudeSonnet4Service claudeService;
    private final ObjectMapper objectMapper;

    /**
     * Generate action suggestions from research findings
     */
    @Transactional
    public List<ResearchActionItem> suggestActions(Long sessionId, Long userId, Long caseId, String finding, String citation) {
        List<ResearchActionItem> suggestions = new ArrayList<>();

        try {
            // Use Claude to analyze the finding and suggest actions
            String prompt = String.format("""
                Analyze this legal research finding and suggest specific actions an attorney should take:

                Finding: %s
                Citation: %s

                Suggest appropriate actions from these types:
                - DRAFT_MOTION: If a motion should be filed (e.g., Motion to Dismiss, Summary Judgment)
                - CREATE_DEADLINE: If there's a time-sensitive requirement (e.g., filing deadline, statute of limitations)
                - CREATE_TASK: If follow-up work is needed (e.g., research related case, contact witness)
                - ADD_NOTE: If this should be documented for the case file

                For each suggestion, provide:
                1. action_type: One of the types above
                2. reason: Why this action is recommended (1 sentence)
                3. priority: LOW, MEDIUM, HIGH, or URGENT
                4. confidence: Your confidence in this recommendation (0-100)

                Return ONLY a valid JSON array with 2-4 suggestions. Example:
                [
                  {
                    "action_type": "CREATE_DEADLINE",
                    "reason": "The statute of limitations expires in 60 days based on this precedent",
                    "priority": "URGENT",
                    "confidence": 85
                  }
                ]
                """, finding, citation);

            String response = claudeService.generateCompletion(prompt, false).get();

            log.info("Claude response for action suggestions: {}", response);

            // Parse the JSON response
            List<Map<String, Object>> parsedSuggestions = parseSuggestions(response);

            for (Map<String, Object> suggestion : parsedSuggestions) {
                ResearchActionItem item = new ResearchActionItem();
                item.setResearchSessionId(sessionId);
                item.setUserId(userId);
                item.setCaseId(caseId);
                item.setActionType(ActionType.valueOf((String) suggestion.get("action_type")));
                item.setSourceFinding(finding);
                item.setSourceCitation(citation);
                item.setActionStatus(ActionStatus.PENDING);

                // Set priority if provided
                if (suggestion.containsKey("priority")) {
                    item.setTaskPriority(TaskPriority.valueOf((String) suggestion.get("priority")));
                }

                // Set confidence score
                if (suggestion.containsKey("confidence")) {
                    Object confValue = suggestion.get("confidence");
                    if (confValue instanceof Number) {
                        item.setAiConfidenceScore(BigDecimal.valueOf(((Number) confValue).doubleValue()));
                    }
                }

                // Set task description from reason
                if (suggestion.containsKey("reason")) {
                    item.setTaskDescription((String) suggestion.get("reason"));
                }

                suggestions.add(actionRepository.save(item));
            }

        } catch (InterruptedException | ExecutionException e) {
            log.error("Error generating action suggestions", e);
            Thread.currentThread().interrupt();
        }

        return suggestions;
    }

    /**
     * Parse Claude's JSON response
     */
    private List<Map<String, Object>> parseSuggestions(String response) {
        try {
            // Extract JSON from response (Claude might add text before/after)
            String jsonPart = response;
            int startIdx = response.indexOf('[');
            int endIdx = response.lastIndexOf(']');

            if (startIdx >= 0 && endIdx > startIdx) {
                jsonPart = response.substring(startIdx, endIdx + 1);
            }

            return objectMapper.readValue(jsonPart, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            log.error("Error parsing suggestions JSON: {}", response, e);
            return new ArrayList<>();
        }
    }

    /**
     * Get pending actions for a user
     */
    public List<ResearchActionItem> getPendingActions(Long userId) {
        return actionRepository.findByUserIdAndActionStatusOrderByCreatedAtDesc(userId, ActionStatus.PENDING);
    }

    /**
     * Get actions for a research session
     */
    public List<ResearchActionItem> getSessionActions(Long sessionId) {
        return actionRepository.findByResearchSessionIdOrderByCreatedAtDesc(sessionId);
    }

    /**
     * Dismiss an action
     */
    @Transactional
    public void dismissAction(Long actionId) {
        ResearchActionItem action = actionRepository.findById(actionId)
            .orElseThrow(() -> new RuntimeException("Action not found: " + actionId));

        action.setActionStatus(ActionStatus.DISMISSED);
        action.setDismissedAt(LocalDateTime.now());
        actionRepository.save(action);
    }

    /**
     * Mark action as completed
     */
    @Transactional
    public void completeAction(Long actionId) {
        ResearchActionItem action = actionRepository.findById(actionId)
            .orElseThrow(() -> new RuntimeException("Action not found: " + actionId));

        action.setActionStatus(ActionStatus.COMPLETED);
        action.setCompletedAt(LocalDateTime.now());
        actionRepository.save(action);
    }
}
