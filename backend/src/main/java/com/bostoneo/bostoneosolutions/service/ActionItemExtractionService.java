package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.ActionItem;
import com.bostoneo.bostoneosolutions.model.TimelineEvent;
import com.bostoneo.bostoneosolutions.repository.ActionItemRepository;
import com.bostoneo.bostoneosolutions.repository.TimelineEventRepository;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class ActionItemExtractionService {

    private final ActionItemRepository actionItemRepository;
    private final TimelineEventRepository timelineEventRepository;
    private final ClaudeSonnet4Service claudeService;
    private final ObjectMapper objectMapper;

    /**
     * Hybrid extraction: Try embedded JSON first, skip if not found to save tokens
     * Returns cleaned text with JSON block removed
     *
     * NOTE: Fallback AI calls have been DISABLED to save tokens.
     * The main analysis prompt already requests embedded JSON.
     * If Claude doesn't include it, we skip extraction rather than make expensive extra calls.
     */
    public String extractAndSaveStructuredData(Long analysisId, String analysisText) {
        // Try to parse embedded JSON from analysis
        boolean success = parseEmbeddedStructuredData(analysisId, analysisText);

        if (!success) {
            // DISABLED: Fallback AI calls waste tokens
            // The main analysis prompt already asks for structured data
            // If it's not there, we just skip extraction
            log.warn("No embedded JSON found for analysis {}. Skipping separate extraction to save tokens.", analysisId);
            log.info("Hint: The main analysis should include ```json {{ \"actionItems\": [...], \"timelineEvents\": [...] }} ```");
            return analysisText; // No JSON to remove, no fallback calls
        }

        // Remove JSON block from analysis text
        String cleanedText = removeJsonBlock(analysisText);
        log.info("Removed JSON block from analysis {}, original length: {}, cleaned length: {}",
                 analysisId, analysisText.length(), cleanedText.length());
        return cleanedText;
    }

    /**
     * Remove JSON block from analysis text
     */
    private String removeJsonBlock(String text) {
        // Try to find ```json code block
        int jsonStart = text.indexOf("```json");
        if (jsonStart != -1) {
            int contentStart = jsonStart;
            int jsonEnd = text.indexOf("```", contentStart + 7);
            if (jsonEnd != -1) {
                // Remove the entire ```json...``` block
                return text.substring(0, jsonStart).trim() + "\n\n" + text.substring(jsonEnd + 3).trim();
            }
        }

        // Try to find raw JSON object at end of text
        int objectStart = text.lastIndexOf('{');
        int objectEnd = text.lastIndexOf('}');
        if (objectStart != -1 && objectEnd != -1 && objectEnd > objectStart) {
            String potential = text.substring(objectStart, objectEnd + 1);
            // Quick validation - should contain actionItems or timelineEvents
            if (potential.contains("actionItems") || potential.contains("timelineEvents")) {
                // Remove from the opening brace to end
                return text.substring(0, objectStart).trim();
            }
        }

        return text; // No JSON block found, return as-is
    }

    /**
     * Parse embedded JSON from main analysis (saves 2 AI calls)
     */
    private boolean parseEmbeddedStructuredData(Long analysisId, String analysisText) {
        try {
            // Look for JSON block in analysis
            String jsonBlock = extractJsonBlock(analysisText);
            if (jsonBlock == null) {
                return false;
            }

            Map<String, Object> data = objectMapper.readValue(jsonBlock, new TypeReference<>() {});

            // Extract action items
            Object actionItemsObj = data.get("actionItems");
            if (actionItemsObj instanceof List) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> items = (List<Map<String, Object>>) actionItemsObj;
                saveActionItems(analysisId, items);
            }

            // Extract timeline events
            Object timelineEventsObj = data.get("timelineEvents");
            if (timelineEventsObj instanceof List) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> events = (List<Map<String, Object>>) timelineEventsObj;
                saveTimelineEvents(analysisId, events);
            }

            log.info("✅ Successfully parsed embedded structured data for analysis {}", analysisId);
            return true;
        } catch (Exception e) {
            log.debug("Failed to parse embedded JSON: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Extract JSON block from analysis text (looks for ```json or { })
     */
    private String extractJsonBlock(String text) {
        // Try to find ```json code block
        int jsonStart = text.indexOf("```json");
        if (jsonStart != -1) {
            int contentStart = text.indexOf('\n', jsonStart) + 1;
            int jsonEnd = text.indexOf("```", contentStart);
            if (jsonEnd != -1) {
                return text.substring(contentStart, jsonEnd).trim();
            }
        }

        // Try to find raw JSON object
        int objectStart = text.lastIndexOf('{');
        int objectEnd = text.lastIndexOf('}');
        if (objectStart != -1 && objectEnd != -1 && objectEnd > objectStart) {
            String potential = text.substring(objectStart, objectEnd + 1);
            // Quick validation - should contain actionItems or timelineEvents
            if (potential.contains("actionItems") || potential.contains("timelineEvents")) {
                return potential;
            }
        }

        return null;
    }

    /**
     * Save action items from parsed JSON
     */
    private void saveActionItems(Long analysisId, List<Map<String, Object>> items) {
        for (Map<String, Object> item : items) {
            ActionItem actionItem = new ActionItem();
            actionItem.setAnalysisId(analysisId);
            actionItem.setDescription((String) item.get("description"));
            actionItem.setPriority((String) item.getOrDefault("priority", "MEDIUM"));
            actionItem.setStatus("PENDING");
            actionItem.setRelatedSection((String) item.get("relatedSection"));

            // Parse deadline
            Object deadlineObj = item.get("deadline");
            if (deadlineObj != null && !deadlineObj.toString().equals("null")) {
                try {
                    actionItem.setDeadline(LocalDate.parse(deadlineObj.toString()));
                } catch (DateTimeParseException e) {
                    log.warn("Failed to parse deadline: {}", deadlineObj);
                }
            }

            actionItemRepository.save(actionItem);
        }
        log.info("Saved {} action items for analysis {}", items.size(), analysisId);
    }

    /**
     * Save timeline events from parsed JSON
     */
    private void saveTimelineEvents(Long analysisId, List<Map<String, Object>> events) {
        for (Map<String, Object> event : events) {
            TimelineEvent timelineEvent = new TimelineEvent();
            timelineEvent.setAnalysisId(analysisId);
            timelineEvent.setTitle((String) event.get("title"));
            timelineEvent.setEventType((String) event.getOrDefault("eventType", "DEADLINE"));
            timelineEvent.setPriority((String) event.getOrDefault("priority", "MEDIUM"));
            timelineEvent.setDescription((String) event.get("description"));
            timelineEvent.setRelatedSection((String) event.get("relatedSection"));

            // Parse event date
            Object dateObj = event.get("eventDate");
            if (dateObj != null) {
                try {
                    timelineEvent.setEventDate(LocalDate.parse(dateObj.toString()));
                    timelineEventRepository.save(timelineEvent);
                } catch (DateTimeParseException e) {
                    log.warn("Failed to parse event date: {}", dateObj);
                }
            }
        }
        log.info("Saved {} timeline events for analysis {}", events.size(), analysisId);
    }

    public void extractAndSaveActionItems(Long analysisId, String analysisText) {
        try {
            // Extract action items using Claude
            String extractionPrompt = String.format("""
                Extract all action items from this legal document analysis.
                Return ONLY a JSON array with this exact format (no other text):
                [
                  {
                    "description": "Description of action item",
                    "deadline": "YYYY-MM-DD or null",
                    "priority": "CRITICAL|HIGH|MEDIUM|LOW",
                    "relatedSection": "Section name if mentioned"
                  }
                ]

                Analysis text:
                %s

                Important:
                - Extract ALL action items, deadlines, and tasks mentioned
                - Priority: CRITICAL for immediate/urgent, HIGH for important, MEDIUM for standard, LOW for optional
                - If no deadline mentioned, use null
                - Return valid JSON array only
                """, analysisText);

            String response = claudeService.generateCompletion(extractionPrompt, null, false, null).join();

            // Parse JSON response
            String jsonArray = extractJsonArray(response);
            if (jsonArray != null) {
                List<Map<String, Object>> items = objectMapper.readValue(jsonArray, new TypeReference<>() {});

                // Save each action item
                for (Map<String, Object> item : items) {
                    ActionItem actionItem = new ActionItem();
                    actionItem.setAnalysisId(analysisId);
                    actionItem.setDescription((String) item.get("description"));
                    actionItem.setPriority((String) item.getOrDefault("priority", "MEDIUM"));
                    actionItem.setStatus("PENDING");
                    actionItem.setRelatedSection((String) item.get("relatedSection"));

                    // Parse deadline
                    Object deadlineObj = item.get("deadline");
                    if (deadlineObj != null && !deadlineObj.toString().equals("null")) {
                        try {
                            actionItem.setDeadline(LocalDate.parse(deadlineObj.toString()));
                        } catch (DateTimeParseException e) {
                            log.warn("Failed to parse deadline: {}", deadlineObj);
                        }
                    }

                    actionItemRepository.save(actionItem);
                }

                log.info("Extracted and saved {} action items for analysis {}", items.size(), analysisId);
            }
        } catch (Exception e) {
            log.error("Error extracting action items for analysis {}: {}", analysisId, e.getMessage(), e);
        }
    }

    public void extractAndSaveTimelineEvents(Long analysisId, String analysisText) {
        try {
            // Extract timeline events using Claude
            String extractionPrompt = String.format("""
                Extract CALENDAR EVENTS (not tasks) from this legal document analysis.

                INCLUDE (calendar dates to track):
                - Court hearings, trials, oral arguments, status conferences
                - Filing deadlines (court-imposed due dates)
                - Depositions, mediations, scheduled proceedings
                - Statutory deadlines

                EXCLUDE (these go to Action Items, not Timeline):
                - Tasks with verbs: "draft X", "research Y", "review Z", "prepare W"
                - Work items: "complete analysis", "finish brief"

                Return ONLY JSON array:
                [{"title": "Motion Hearing", "eventDate": "YYYY-MM-DD", "eventType": "HEARING|DEADLINE|FILING|DEPOSITION", "priority": "CRITICAL|HIGH|MEDIUM|LOW", "description": "Brief desc"}]

                Analysis text:
                %s
                """, analysisText);

            String response = claudeService.generateCompletion(extractionPrompt, null, false, null).join();

            // Parse JSON response
            String jsonArray = extractJsonArray(response);
            if (jsonArray != null) {
                List<Map<String, Object>> events = objectMapper.readValue(jsonArray, new TypeReference<>() {});

                // Save each timeline event
                for (Map<String, Object> event : events) {
                    TimelineEvent timelineEvent = new TimelineEvent();
                    timelineEvent.setAnalysisId(analysisId);
                    timelineEvent.setTitle((String) event.get("title"));
                    timelineEvent.setEventType((String) event.getOrDefault("eventType", "DEADLINE"));
                    timelineEvent.setPriority((String) event.getOrDefault("priority", "MEDIUM"));
                    timelineEvent.setDescription((String) event.get("description"));
                    timelineEvent.setRelatedSection((String) event.get("relatedSection"));

                    // Parse event date
                    Object dateObj = event.get("eventDate");
                    if (dateObj != null) {
                        try {
                            timelineEvent.setEventDate(LocalDate.parse(dateObj.toString()));
                            timelineEventRepository.save(timelineEvent);
                        } catch (DateTimeParseException e) {
                            log.warn("Failed to parse event date: {}", dateObj);
                        }
                    }
                }

                log.info("Extracted and saved {} timeline events for analysis {}", events.size(), analysisId);
            }
        } catch (Exception e) {
            log.error("Error extracting timeline events for analysis {}: {}", analysisId, e.getMessage(), e);
        }
    }

    private String extractJsonArray(String response) {
        // Try to find JSON array in response
        int startIdx = response.indexOf('[');
        int endIdx = response.lastIndexOf(']');

        if (startIdx != -1 && endIdx != -1 && endIdx > startIdx) {
            return response.substring(startIdx, endIdx + 1);
        }

        return null;
    }
}
