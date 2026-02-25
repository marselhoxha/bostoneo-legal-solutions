package com.bostoneo.bostoneosolutions.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class DraftStreamingPublisher {

    // Active SSE connections keyed by conversationId
    private final Map<Long, SseEmitter> emitters = new ConcurrentHashMap<>();

    /**
     * Create SSE emitter for a draft streaming session.
     * 15-minute timeout to handle long drafts with THOROUGH research + post-processing.
     */
    public SseEmitter createEmitter(Long conversationId) {
        // Complete any existing emitter to prevent stale connections
        SseEmitter existing = emitters.remove(conversationId);
        if (existing != null) {
            try { existing.complete(); } catch (Exception ignored) {}
        }

        SseEmitter emitter = new SseEmitter(900_000L); // 15 minutes

        emitter.onCompletion(() -> {
            log.info("Draft SSE completed for conversation: {}", conversationId);
            emitters.remove(conversationId);
        });

        emitter.onTimeout(() -> {
            log.warn("Draft SSE timeout for conversation: {}", conversationId);
            emitters.remove(conversationId);
        });

        emitter.onError(ex -> {
            log.error("Draft SSE error for conversation: {}", conversationId, ex);
            emitters.remove(conversationId);
        });

        emitters.put(conversationId, emitter);
        log.info("Created draft SSE emitter for conversation: {}", conversationId);
        return emitter;
    }

    /**
     * Send a token chunk to the client.
     */
    public void sendToken(Long conversationId, String text) {
        SseEmitter emitter = emitters.get(conversationId);
        if (emitter != null) {
            try {
                emitter.send(SseEmitter.event()
                    .name("token")
                    .data(Map.of("text", text)));
            } catch (IOException e) {
                log.debug("Failed to send token for conversation {}: {}", conversationId, e.getMessage());
                emitters.remove(conversationId);
            }
        }
    }

    /**
     * Send a post-processing status update.
     */
    public void sendPostProcessing(Long conversationId, String message) {
        SseEmitter emitter = emitters.get(conversationId);
        if (emitter != null) {
            try {
                emitter.send(SseEmitter.event()
                    .name("post_processing")
                    .data(Map.of("message", message)));
            } catch (IOException e) {
                log.debug("Failed to send post_processing for conversation {}: {}", conversationId, e.getMessage());
                emitters.remove(conversationId);
            }
        }
    }

    /**
     * Send the final complete event with document metadata, then close the SSE connection.
     */
    public void sendComplete(Long conversationId, Map<String, Object> payload) {
        SseEmitter emitter = emitters.get(conversationId);
        if (emitter != null) {
            try {
                emitter.send(SseEmitter.event()
                    .name("complete")
                    .data(payload));
                emitter.complete();
                log.info("Draft SSE completed for conversation: {}", conversationId);
            } catch (IOException e) {
                log.debug("Failed to send complete for conversation {}: {}", conversationId, e.getMessage());
            } finally {
                emitters.remove(conversationId);
            }
        }
    }

    /**
     * Send an error event and close the SSE connection.
     */
    public void sendError(Long conversationId, String message) {
        SseEmitter emitter = emitters.get(conversationId);
        if (emitter != null) {
            try {
                emitter.send(SseEmitter.event()
                    .name("error")
                    .data(Map.of("message", message)));
                emitter.complete();
            } catch (IOException e) {
                log.debug("Failed to send error for conversation {}: {}", conversationId, e.getMessage());
            } finally {
                emitters.remove(conversationId);
            }
        }
    }

    /**
     * Check if an emitter exists for the given conversation (client is connected).
     */
    public boolean hasEmitter(Long conversationId) {
        return emitters.containsKey(conversationId);
    }
}
