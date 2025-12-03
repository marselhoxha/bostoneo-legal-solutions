package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.config.AIConfig;
import com.bostoneo.bostoneosolutions.dto.ai.AIRequest;
import com.bostoneo.bostoneosolutions.dto.ai.AIResponse;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for generating AI-powered personalized briefings for attorneys.
 * Uses Claude Haiku for fast, cost-effective responses.
 * Caches briefings for 30 minutes to avoid redundant API calls.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiBriefingService {

    private final WebClient anthropicWebClient;
    private final AIConfig aiConfig;

    // Simple in-memory cache: userId -> (briefing, timestamp)
    private final ConcurrentHashMap<Long, CachedBriefing> briefingCache = new ConcurrentHashMap<>();
    private static final long CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

    private record CachedBriefing(String briefing, long timestamp) {}

    /**
     * Generate a personalized briefing for the attorney.
     * Returns cached version if available and fresh.
     */
    public CompletableFuture<String> generateBriefing(
            UserDTO user,
            int todayEventsCount,
            int urgentItemsCount,
            int activeCasesCount,
            String nextEventTitle,
            String nextEventTime,
            boolean hasCourtAppearance,
            String courtCaseName,
            String courtTime,
            List<String> recentTeamActivity
    ) {
        Long userId = user.getId();

        // Check cache first
        CachedBriefing cached = briefingCache.get(userId);
        if (cached != null && (System.currentTimeMillis() - cached.timestamp) < CACHE_DURATION_MS) {
            log.debug("Returning cached briefing for user {}", userId);
            return CompletableFuture.completedFuture(cached.briefing);
        }

        // Build context for AI
        String context = buildContext(
                user.getFirstName(),
                todayEventsCount,
                urgentItemsCount,
                activeCasesCount,
                nextEventTitle,
                nextEventTime,
                hasCourtAppearance,
                courtCaseName,
                courtTime,
                recentTeamActivity
        );

        String prompt = buildPrompt(context);

        return callHaiku(prompt)
                .thenApply(briefing -> {
                    // Cache the result
                    briefingCache.put(userId, new CachedBriefing(briefing, System.currentTimeMillis()));
                    return briefing;
                })
                .exceptionally(e -> {
                    log.error("Failed to generate AI briefing: {}", e.getMessage());
                    // Return fallback static briefing
                    return generateFallbackBriefing(
                            todayEventsCount,
                            urgentItemsCount,
                            activeCasesCount,
                            hasCourtAppearance,
                            courtTime
                    );
                });
    }

    private String buildContext(
            String firstName,
            int todayEventsCount,
            int urgentItemsCount,
            int activeCasesCount,
            String nextEventTitle,
            String nextEventTime,
            boolean hasCourtAppearance,
            String courtCaseName,
            String courtTime,
            List<String> recentTeamActivity
    ) {
        // Get current time in Eastern timezone
        ZoneId easternZone = ZoneId.of("America/New_York");
        LocalDateTime nowEastern = LocalDateTime.now(easternZone);
        LocalTime currentTime = nowEastern.toLocalTime();
        int hour = currentTime.getHour();

        String timeOfDay;
        if (hour < 12) {
            timeOfDay = "morning";
        } else if (hour < 17) {
            timeOfDay = "afternoon";
        } else {
            timeOfDay = "evening";
        }

        StringBuilder context = new StringBuilder();
        context.append("Attorney: ").append(firstName).append("\n");
        context.append("Date: ").append(nowEastern.format(DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy"))).append("\n");
        context.append("Current time: ").append(currentTime.format(DateTimeFormatter.ofPattern("h:mm a"))).append(" (").append(timeOfDay).append(")\n");
        context.append("Today's events: ").append(todayEventsCount).append("\n");
        context.append("Urgent items: ").append(urgentItemsCount).append("\n");
        context.append("Active cases: ").append(activeCasesCount).append("\n");

        if (hasCourtAppearance) {
            context.append("COURT APPEARANCE TODAY: ").append(courtCaseName).append(" at ").append(courtTime).append("\n");
        }

        if (nextEventTitle != null && !nextEventTitle.isEmpty()) {
            context.append("Next event: ").append(nextEventTitle).append(" at ").append(nextEventTime).append("\n");
        }

        if (recentTeamActivity != null && !recentTeamActivity.isEmpty()) {
            context.append("Recent team activity:\n");
            for (String activity : recentTeamActivity) {
                context.append("- ").append(activity).append("\n");
            }
        }

        return context.toString();
    }

    private String buildPrompt(String context) {
        return """
            Write a daily briefing for an attorney dashboard. Exactly 3 sentences, 45-60 words.

            Rules:
            - Professional tone
            - BE TIME-AWARE: Check the current time and write appropriately
              - Morning: Focus on today's upcoming events and priorities
              - Afternoon: Focus on remaining tasks and any completed items
              - Evening: Summarize completed day, mention any remaining urgent items, preview tomorrow
            - Don't mention past events as if they're upcoming
            - Prioritize: court appearances > urgent deadlines > client meetings > general tasks
            - Mention specific times for important events
            - No greetings, no sign-offs

            Example (morning): "You have a Motion for Summary Judgment hearing at 2:00 PM today. Three urgent items require your attention before the afternoon court appearance. Your morning schedule allows time for document preparation."

            Example (evening): "Today's court appearance and client consultations are complete. Six urgent items remain for review before tomorrow. Your schedule tomorrow includes two depositions in the morning."

            Context:
            %s

            Briefing (3 sentences, 45-60 words):
            """.formatted(context);
    }

    private CompletableFuture<String> callHaiku(String prompt) {
        AIRequest request = new AIRequest();
        request.setModel("claude-haiku-4-5-20251001"); // Fast, cheap model
        request.setMax_tokens(250); // Allow for more descriptive briefings

        AIRequest.Message message = new AIRequest.Message();
        message.setRole("user");
        message.setContent(prompt);
        request.setMessages(new AIRequest.Message[]{message});

        String apiKey = aiConfig.getApiKey();

        CompletableFuture<String> future = new CompletableFuture<>();

        anthropicWebClient
                .post()
                .uri("/v1/messages")
                .header("x-api-key", apiKey)
                .bodyValue(request)
                .exchangeToMono(response -> {
                    if (response.statusCode().is2xxSuccessful()) {
                        return response.bodyToMono(AIResponse.class);
                    } else {
                        return response.bodyToMono(String.class)
                                .flatMap(body -> {
                                    log.error("Haiku API error: {}", body);
                                    return Mono.error(new RuntimeException("API Error: " + body));
                                });
                    }
                })
                .map(this::extractTextFromResponse)
                .subscribe(
                        future::complete,
                        future::completeExceptionally
                );

        return future;
    }

    private String extractTextFromResponse(AIResponse response) {
        if (response.getContent() != null && response.getContent().length > 0) {
            return response.getContent()[0].getText().trim();
        }
        return "Your schedule is ready for review.";
    }

    private String generateFallbackBriefing(
            int todayEventsCount,
            int urgentItemsCount,
            int activeCasesCount,
            boolean hasCourtAppearance,
            String courtTime
    ) {
        if (hasCourtAppearance) {
            return "You have a court appearance at " + courtTime + " today. " +
                   urgentItemsCount + " urgent items require attention.";
        }

        if (urgentItemsCount > 0) {
            return "You have " + todayEventsCount + " events scheduled today with " +
                   urgentItemsCount + " urgent items requiring attention.";
        }

        if (todayEventsCount > 0) {
            return "You have " + todayEventsCount + " events on your calendar today. " +
                   "All urgent matters are addressed.";
        }

        return "Your schedule is clear today. " + activeCasesCount + " active cases await your attention.";
    }

    /**
     * Clear cache for a specific user (e.g., when significant changes occur)
     */
    public void invalidateCache(Long userId) {
        briefingCache.remove(userId);
    }

    /**
     * Clear all cached briefings
     */
    public void clearAllCache() {
        briefingCache.clear();
    }
}
