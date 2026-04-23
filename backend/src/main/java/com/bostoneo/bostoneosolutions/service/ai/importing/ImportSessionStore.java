package com.bostoneo.bostoneosolutions.service.ai.importing;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * In-memory store of active template-import sessions.
 *
 * <p>Sessions are short-lived (5 min TTL). The store sweeps expired sessions every 60 seconds
 * so abandoned imports don't accumulate. For a multi-pod deployment this should be promoted
 * to Redis; for MVP the single-pod dev/staging deploy is fine.
 */
@Component
@Slf4j
public class ImportSessionStore {

    public static final int SESSION_TTL_MINUTES = 5;
    private static final int SWEEP_INTERVAL_SECONDS = 60;

    private final ConcurrentHashMap<UUID, ImportSession> sessions = new ConcurrentHashMap<>();
    private final ScheduledExecutorService sweeper = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "template-import-session-sweeper");
        t.setDaemon(true);
        return t;
    });

    @PostConstruct
    void start() {
        sweeper.scheduleAtFixedRate(this::sweepExpired, SWEEP_INTERVAL_SECONDS, SWEEP_INTERVAL_SECONDS, TimeUnit.SECONDS);
    }

    @PreDestroy
    void stop() {
        sweeper.shutdownNow();
    }

    public ImportSession create(Long organizationId, Long userId) {
        UUID id = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now();
        ImportSession session = ImportSession.builder()
            .sessionId(id)
            .organizationId(organizationId)
            .userId(userId)
            .createdAt(now)
            .expiresAt(now.plusMinutes(SESSION_TTL_MINUTES))
            .files(new ConcurrentHashMap<>())
            .build();
        sessions.put(id, session);
        return session;
    }

    public Optional<ImportSession> get(UUID sessionId) {
        ImportSession s = sessions.get(sessionId);
        if (s == null) return Optional.empty();
        if (s.isExpired(LocalDateTime.now())) {
            sessions.remove(sessionId);
            return Optional.empty();
        }
        return Optional.of(s);
    }

    /**
     * Extend the TTL whenever the attorney interacts with the session so long reviews don't time out mid-click.
     */
    public void touch(UUID sessionId) {
        get(sessionId).ifPresent(s -> s.setExpiresAt(LocalDateTime.now().plusMinutes(SESSION_TTL_MINUTES)));
    }

    public void remove(UUID sessionId) {
        sessions.remove(sessionId);
    }

    private void sweepExpired() {
        LocalDateTime now = LocalDateTime.now();
        sessions.entrySet().removeIf(entry -> {
            boolean expired = entry.getValue().isExpired(now);
            if (expired) {
                log.debug("Sweeping expired import session {}", entry.getKey());
            }
            return expired;
        });
    }
}
