package com.bostoneo.bostoneosolutions.service.ai;

import com.bostoneo.bostoneosolutions.dto.ai.ConversationMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Prunes conversation history using a sliding window approach.
 * Keeps the last N messages verbatim and summarizes older messages
 * into a compact context paragraph to reduce token usage.
 */
@Service
@Slf4j
public class ConversationHistoryPruner {

    private static final int WINDOW_SIZE = 10;

    /** Cache of generated summaries: sessionId → CachedSummary */
    private final ConcurrentHashMap<String, CachedSummary> summaryCache = new ConcurrentHashMap<>();

    /**
     * Prune conversation history to reduce token count.
     *
     * If history has <= WINDOW_SIZE messages, returns as-is.
     * If > WINDOW_SIZE, keeps last WINDOW_SIZE verbatim and creates
     * a compact summary of older messages.
     *
     * @param history the full conversation history
     * @param sessionId optional session ID for caching summaries
     * @return pruned history with summary prepended if needed
     */
    public List<ConversationMessage> prune(List<ConversationMessage> history, String sessionId) {
        if (history == null || history.size() <= WINDOW_SIZE) {
            return history;
        }

        int totalMessages = history.size();
        int olderCount = totalMessages - WINDOW_SIZE;

        log.info("Pruning conversation history: {} total messages, keeping last {}, summarizing {} older",
                totalMessages, WINDOW_SIZE, olderCount);

        // Get the older messages that need summarizing
        List<ConversationMessage> olderMessages = history.subList(0, olderCount);

        // Check if we have a cached summary for this session
        String summary = getCachedSummary(sessionId, olderCount);
        if (summary == null) {
            summary = buildSummary(olderMessages);
            cacheSummary(sessionId, olderCount, summary);
        } else {
            log.debug("Using cached conversation summary for session {}", sessionId);
        }

        // Build the pruned history: summary context + last N messages
        List<ConversationMessage> pruned = new ArrayList<>();

        // Add summary as a system-level context message
        ConversationMessage summaryMessage = new ConversationMessage();
        summaryMessage.setRole("assistant");
        summaryMessage.setContent("[Earlier conversation summary: " + summary + "]");
        summaryMessage.setTimestamp(olderMessages.get(olderMessages.size() - 1).getTimestamp());
        pruned.add(summaryMessage);

        // Add the recent messages verbatim
        pruned.addAll(history.subList(olderCount, totalMessages));

        log.info("Pruned history: {} messages → {} (1 summary + {} recent)",
                totalMessages, pruned.size(), WINDOW_SIZE);

        return pruned;
    }

    /**
     * Build a compact summary from older messages without calling AI.
     * Extracts key topics and conclusions discussed to preserve context.
     */
    private String buildSummary(List<ConversationMessage> olderMessages) {
        StringBuilder summary = new StringBuilder();
        List<String> topics = new ArrayList<>();

        for (ConversationMessage msg : olderMessages) {
            if (msg.getContent() == null) continue;

            String content = msg.getContent();
            if ("user".equals(msg.getRole())) {
                // Extract user's question topics (first 100 chars)
                String topic = content.length() > 100 ? content.substring(0, 100) + "..." : content;
                topics.add("Q: " + topic);
            } else if ("assistant".equals(msg.getRole()) && content.length() > 200) {
                // Extract key conclusion from assistant (first sentence or 150 chars)
                int firstPeriod = content.indexOf(". ");
                String conclusion;
                if (firstPeriod > 0 && firstPeriod < 200) {
                    conclusion = content.substring(0, firstPeriod + 1);
                } else {
                    conclusion = content.substring(0, Math.min(150, content.length())) + "...";
                }
                topics.add("A: " + conclusion);
            }
        }

        // Build compact summary
        summary.append("Previously discussed (").append(olderMessages.size()).append(" messages): ");
        int topicCount = 0;
        for (String topic : topics) {
            if (topicCount >= 6) { // Limit to 6 topic extracts
                summary.append(" [+").append(topics.size() - 6).append(" more exchanges]");
                break;
            }
            if (topicCount > 0) summary.append(" | ");
            summary.append(topic);
            topicCount++;
        }

        return summary.toString();
    }

    private String getCachedSummary(String sessionId, int messageCount) {
        if (sessionId == null) return null;
        CachedSummary cached = summaryCache.get(sessionId);
        if (cached != null && cached.messageCount == messageCount) {
            return cached.summary;
        }
        return null;
    }

    private void cacheSummary(String sessionId, int messageCount, String summary) {
        if (sessionId == null) return;
        summaryCache.put(sessionId, new CachedSummary(summary, messageCount, LocalDateTime.now()));
    }

    /**
     * Clear cached summary for a session (e.g., when session is deleted).
     */
    public void clearCache(String sessionId) {
        if (sessionId != null) {
            summaryCache.remove(sessionId);
        }
    }

    /**
     * Clear all cached summaries older than 24 hours. Runs every 2 hours.
     */
    @Scheduled(fixedRate = 7200000) // 2 hours
    public void cleanupExpiredSummaries() {
        int before = summaryCache.size();
        LocalDateTime cutoff = LocalDateTime.now().minusHours(24);
        summaryCache.entrySet().removeIf(entry -> entry.getValue().createdAt.isBefore(cutoff));
        int removed = before - summaryCache.size();
        if (removed > 0) {
            log.info("Summary cache cleanup: removed {} expired entries ({} remaining)", removed, summaryCache.size());
        }
    }

    private record CachedSummary(String summary, int messageCount, LocalDateTime createdAt) {}
}
