package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.ai.ExecuteActionRequest;
import com.bostoneo.bostoneosolutions.dto.CalendarEventDTO;
import com.bostoneo.bostoneosolutions.dto.CaseTaskDTO;
import com.bostoneo.bostoneosolutions.dto.CreateCaseNoteRequest;
import com.bostoneo.bostoneosolutions.dto.CreateTaskRequest;
import com.bostoneo.bostoneosolutions.model.ResearchActionItem;
import com.bostoneo.bostoneosolutions.model.ResearchActionItem.*;
import com.bostoneo.bostoneosolutions.model.ResearchSession;
import com.bostoneo.bostoneosolutions.repository.ResearchActionItemRepository;
import com.bostoneo.bostoneosolutions.repository.ResearchSessionRepository;
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
    private final ResearchSessionRepository sessionRepository;
    private final ClaudeSonnet4Service claudeService;
    private final ObjectMapper objectMapper;
    private final TaskManagementService taskManagementService;
    private final CalendarEventService calendarEventService;
    private final CaseNoteService caseNoteService;

    /**
     * Generate action suggestions from research findings
     */
    @Transactional
    public List<ResearchActionItem> suggestActions(Long sessionId, Long userId, Long caseId, String finding, String citation) {
        List<ResearchActionItem> suggestions = new ArrayList<>();

        // Ensure session exists before creating action items
        ensureSessionExists(sessionId, userId);

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
        log.info("🎯 Completing action with ID: {}", actionId);

        ResearchActionItem action = actionRepository.findById(actionId)
            .orElseThrow(() -> new RuntimeException("Action not found: " + actionId));

        log.info("📋 Found action: {} - Current status: {}", action.getActionType(), action.getActionStatus());

        action.setActionStatus(ActionStatus.COMPLETED);
        action.setCompletedAt(LocalDateTime.now());
        ResearchActionItem saved = actionRepository.save(action);

        log.info("✅ Action {} marked as COMPLETED and saved", saved.getId());
    }

    /**
     * Execute action (create task/deadline/note) AND mark as completed in single transaction
     * This ensures atomicity - both operations succeed or both fail
     */
    @Transactional
    public Object executeAction(Long actionId, ExecuteActionRequest request) {
        log.info("⚡ Executing action {} of type {}", actionId, request.getActionType());

        // Get the action
        ResearchActionItem action = actionRepository.findById(actionId)
            .orElseThrow(() -> new RuntimeException("Action not found: " + actionId));

        Object result = null;

        // Execute based on action type
        switch (request.getActionType()) {
            case "CREATE_TASK":
                result = executeCreateTask(action, request);
                break;
            case "CREATE_DEADLINE":
                result = executeCreateDeadline(action, request);
                break;
            case "ADD_NOTE":
                result = executeCreateNote(action, request);
                break;
            default:
                throw new IllegalArgumentException("Unsupported action type: " + request.getActionType());
        }

        // Mark action as completed (in same transaction)
        action.setActionStatus(ActionStatus.COMPLETED);
        action.setCompletedAt(LocalDateTime.now());
        actionRepository.save(action);

        log.info("✅ Action {} executed and marked as COMPLETED", actionId);

        return result;
    }

    private CaseTaskDTO executeCreateTask(ResearchActionItem action, ExecuteActionRequest request) {
        CreateTaskRequest taskRequest = CreateTaskRequest.builder()
            .caseId(action.getCaseId())
            .title(request.getTitle())
            .description(request.getDescription()) // Use description from request, not sourceFinding
            .taskType(request.getTaskType())
            .priority(request.getPriority())
            .dueDate(request.getDueDate() != null ? request.getDueDate().atStartOfDay() : null)
            .assignedToId(request.getAssignedToId())
            .build();

        return taskManagementService.createTask(taskRequest);
    }

    private Object executeCreateDeadline(ResearchActionItem action, ExecuteActionRequest request) {
        log.info("📅 Creating deadline/event for action: {}", action.getId());

        CalendarEventDTO eventDTO = CalendarEventDTO.builder()
            .title(request.getTitle())
            .description(request.getDescription()) // Use description from request, not sourceFinding
            .startTime(request.getEventDate())
            .eventType(request.getEventType())
            .caseId(action.getCaseId())
            .userId(action.getUserId())
            .status("PENDING")
            .highPriority(true)
            .emailNotification(true)
            .reminderMinutes(60) // 1 hour before
            .build();

        return calendarEventService.createEvent(eventDTO);
    }

    private Object executeCreateNote(ResearchActionItem action, ExecuteActionRequest request) {
        log.info("📝 Creating note for action: {}", action.getId());

        CreateCaseNoteRequest noteRequest = new CreateCaseNoteRequest();
        noteRequest.setCaseId(action.getCaseId());
        noteRequest.setUserId(action.getUserId());
        noteRequest.setTitle(request.getTitle());
        noteRequest.setContent(request.getDescription());
        noteRequest.setPrivateNote(false);

        return caseNoteService.createNote(noteRequest);
    }

    /**
     * Generate a smart, concise title from a description using AI
     */
    public String generateSmartTitle(String description) {
        try {
            String prompt = String.format("""
                Create a concise, professional title (max 60 characters) for this legal task/deadline:

                Description: %s

                Requirements:
                - Use clear, actionable language
                - Start with a verb when possible (Research, Review, File, Draft, etc.)
                - Include key legal terms
                - Professional tone
                - Maximum 60 characters

                Return ONLY the title, nothing else.
                """, description);

            String response = claudeService.generateCompletion(prompt, false).get();

            // Clean up the response
            String title = response.trim()
                .replaceAll("^[\"']|[\"']$", "") // Remove quotes
                .replaceAll("\\n.*", ""); // Take only first line

            // Ensure max length
            if (title.length() > 60) {
                title = title.substring(0, 57) + "...";
            }

            log.info("Generated title: {} from description: {}", title,
                description.substring(0, Math.min(50, description.length())));

            return title;
        } catch (Exception e) {
            log.error("Error generating title: {}", e.getMessage());
            // Fallback to simple extraction
            return extractSimpleTitle(description);
        }
    }

    /**
     * Fallback method for title generation
     */
    private String extractSimpleTitle(String description) {
        // Remove extra whitespace
        String cleaned = description.replaceAll("\\s+", " ").trim();

        // If short enough, return as-is
        if (cleaned.length() <= 60) {
            return cleaned;
        }

        // Try to extract first sentence
        String firstSentence = cleaned.split("[.!?]")[0];
        if (firstSentence.length() <= 60 && firstSentence.length() > 10) {
            return firstSentence;
        }

        // Truncate at word boundary
        String truncated = cleaned.substring(0, 60);
        int lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > 40) {
            return truncated.substring(0, lastSpace) + "...";
        }

        return truncated + "...";
    }

    /**
     * Ensure a conversation session exists for the given session ID
     * Creates one in ai_conversation_sessions table if it doesn't exist
     * This is needed because research_action_items has a foreign key to ai_conversation_sessions
     */
    private void ensureSessionExists(Long sessionId, Long userId) {
        try {
            // Check if session exists in ai_conversation_sessions using native query
            Long count = actionRepository.countSessionsById(sessionId);

            if (count == null || count == 0) {
                log.info("Creating new conversation session with ID: {} for user: {}", sessionId, userId);

                // Insert into ai_conversation_sessions table using native query
                actionRepository.createConversationSession(
                    sessionId,
                    userId,
                    "Legal Research Session",
                    "legal_research"
                );

                log.info("Successfully created conversation session: {}", sessionId);
            } else {
                log.debug("Conversation session already exists: {}", sessionId);
            }
        } catch (Exception e) {
            log.warn("Could not ensure session exists (this may be OK if session already exists): {}", e.getMessage());
            // Continue anyway - if session doesn't exist, the FK constraint will catch it
        }
    }
}
