package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.ai.ResearchProgressEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class ResearchProgressPublisher {

    // Store active SSE connections by session ID
    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    /**
     * Register a new SSE emitter for a session
     */
    public SseEmitter createEmitter(String sessionId) {
        SseEmitter emitter = new SseEmitter(300000L); // 5 minute timeout

        emitter.onCompletion(() -> {
            log.info("SSE completed for session: {}", sessionId);
            emitters.remove(sessionId);
        });

        emitter.onTimeout(() -> {
            log.warn("SSE timeout for session: {}", sessionId);
            emitters.remove(sessionId);
        });

        emitter.onError((ex) -> {
            log.error("SSE error for session: {}", sessionId, ex);
            emitters.remove(sessionId);
        });

        emitters.put(sessionId, emitter);
        log.info("Created SSE emitter for session: {}", sessionId);

        return emitter;
    }

    /**
     * Publish a progress event to a specific session
     */
    public void publishProgress(String sessionId, ResearchProgressEvent event) {
        SseEmitter emitter = emitters.get(sessionId);
        if (emitter != null) {
            try {
                event.setTimestamp(System.currentTimeMillis());
                emitter.send(SseEmitter.event()
                    .name(event.getEventType())
                    .data(event));
                log.debug("Published event to session {}: {}", sessionId, event.getMessage());
            } catch (IOException e) {
                log.error("Failed to send SSE event to session: {}", sessionId, e);
                emitters.remove(sessionId);
            }
        } else {
            log.warn("No emitter found for session: {}", sessionId);
        }
    }

    /**
     * Complete and close the SSE connection
     */
    public void complete(String sessionId) {
        SseEmitter emitter = emitters.get(sessionId);
        if (emitter != null) {
            try {
                emitter.complete();
                log.info("Completed SSE for session: {}", sessionId);
            } catch (Exception e) {
                log.error("Error completing SSE for session: {}", sessionId, e);
            } finally {
                emitters.remove(sessionId);
            }
        }
    }

    /**
     * Helper method to publish a step progress
     */
    public void publishStep(String sessionId, String stepType, String message, String detail, String icon, int progress) {
        ResearchProgressEvent event = ResearchProgressEvent.builder()
            .eventType("progress")
            .stepType(stepType)
            .message(message)
            .detail(detail)
            .icon(icon)
            .progress(progress)
            .build();

        publishProgress(sessionId, event);
    }

    /**
     * Helper method to publish completion
     */
    public void publishComplete(String sessionId, String message) {
        ResearchProgressEvent event = ResearchProgressEvent.builder()
            .eventType("complete")
            .message(message)
            .progress(100)
            .build();

        publishProgress(sessionId, event);
        complete(sessionId);
    }

    /**
     * Helper method to publish error
     */
    public void publishError(String sessionId, String message) {
        ResearchProgressEvent event = ResearchProgressEvent.builder()
            .eventType("error")
            .message(message)
            .icon("ri-error-warning-line")
            .build();

        publishProgress(sessionId, event);
        complete(sessionId);
    }
}
