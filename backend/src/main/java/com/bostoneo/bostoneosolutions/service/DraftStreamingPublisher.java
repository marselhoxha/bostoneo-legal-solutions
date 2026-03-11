package com.bostoneo.bostoneosolutions.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.*;

@Service
@Slf4j
public class DraftStreamingPublisher {

    // Active SSE connections keyed by conversationId
    private final Map<Long, SseEmitter> emitters = new ConcurrentHashMap<>();

    // Scheduled heartbeat tasks — one per active emitter.
    // Each fires ": ping" every 20s to reset the AWS ALB idle timeout (default 60s).
    // This covers both the "Analyzing" phase (DB queries) and the Claude API thinking phase.
    private final Map<Long, ScheduledFuture<?>> heartbeatTasks = new ConcurrentHashMap<>();
    private final ScheduledExecutorService heartbeatScheduler =
            Executors.newScheduledThreadPool(2, r -> {
                Thread t = new Thread(r, "sse-heartbeat");
                t.setDaemon(true);
                return t;
            });

    /**
     * Create SSE emitter for a draft streaming session.
     * Automatically starts a 20-second heartbeat to keep the AWS ALB connection alive.
     */
    public SseEmitter createEmitter(Long conversationId) {
        // Cancel any existing heartbeat first
        cancelHeartbeat(conversationId);

        // Complete any existing emitter to prevent stale connections
        SseEmitter existing = emitters.remove(conversationId);
        if (existing != null) {
            try { existing.complete(); } catch (Exception ignored) {}
        }

        SseEmitter emitter = new SseEmitter(900_000L); // 15 minutes

        emitter.onCompletion(() -> {
            log.info("Draft SSE completed for conversation: {}", conversationId);
            emitters.remove(conversationId);
            cancelHeartbeat(conversationId);
        });

        emitter.onTimeout(() -> {
            log.warn("Draft SSE timeout for conversation: {}", conversationId);
            emitters.remove(conversationId);
            cancelHeartbeat(conversationId);
        });

        emitter.onError(ex -> {
            log.error("Draft SSE error for conversation: {}", conversationId, ex);
            emitters.remove(conversationId);
            cancelHeartbeat(conversationId);
        });

        emitters.put(conversationId, emitter);

        // Start periodic heartbeat — fires immediately, then every 20s.
        // Keeps the ALB idle timer from expiring during DB work and Claude API thinking.
        ScheduledFuture<?> task = heartbeatScheduler.scheduleAtFixedRate(
                () -> sendHeartbeat(conversationId),
                0, 20, TimeUnit.SECONDS);
        heartbeatTasks.put(conversationId, task);

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
                // Don't remove emitter here — let onError/onCompletion callbacks handle cleanup.
                log.debug("Failed to send token for conversation {}: {}", conversationId, e.getMessage());
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
            }
        }
    }

    /**
     * Send the final complete event with document metadata, then close the SSE connection.
     */
    public void sendComplete(Long conversationId, Map<String, Object> payload) {
        cancelHeartbeat(conversationId);
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
        cancelHeartbeat(conversationId);
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
     * Send an SSE comment line (": ping") to keep the connection alive through AWS ALB.
     * Comment lines are invisible to the app but reset the ALB idle timer.
     */
    public void sendHeartbeat(Long conversationId) {
        SseEmitter emitter = emitters.get(conversationId);
        if (emitter != null) {
            try {
                emitter.send(SseEmitter.event().comment("ping"));
            } catch (IOException e) {
                log.debug("Failed to send heartbeat for conversation {}: {}", conversationId, e.getMessage());
            }
        }
    }

    /**
     * Check if an emitter exists for the given conversation (client is connected).
     */
    public boolean hasEmitter(Long conversationId) {
        return emitters.containsKey(conversationId);
    }

    private void cancelHeartbeat(Long conversationId) {
        ScheduledFuture<?> task = heartbeatTasks.remove(conversationId);
        if (task != null) {
            task.cancel(false);
        }
    }

    @PreDestroy
    public void shutdown() {
        heartbeatScheduler.shutdownNow();
    }
}
