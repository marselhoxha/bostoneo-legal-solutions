package com.bostoneo.bostoneosolutions.service.ai.importing;

import com.bostoneo.bostoneosolutions.dto.ai.ImportSessionResponse;
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
            // Same invariant as the sweeper: never remove a session whose files are still being
            // processed. The async analysis lambda would otherwise find no session and silently
            // discard the in-flight Claude result.
            if (hasNonTerminalFile(s)) {
                return Optional.of(s);
            }
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
            ImportSession s = entry.getValue();
            if (!s.isExpired(now)) return false;
            // Don't sweep a session whose files are still being processed — analysis can legitimately
            // run past the 5-min TTL (Claude calls for big templates take 7–10 min). The DB-backed
            // ai_template_import_jobs row is the durable record once analysis terminates.
            if (hasNonTerminalFile(s)) {
                log.debug("Skipping sweep of session {} — still has non-terminal files", entry.getKey());
                return false;
            }
            log.debug("Sweeping expired import session {}", entry.getKey());
            return true;
        });
    }

    private boolean hasNonTerminalFile(ImportSession s) {
        if (s.getFiles() == null) return false;
        return s.getFiles().values().stream().anyMatch(f ->
            f.getStatus() == ImportSessionResponse.FileStatus.Status.QUEUED
            || f.getStatus() == ImportSessionResponse.FileStatus.Status.EXTRACTING
            || f.getStatus() == ImportSessionResponse.FileStatus.Status.ANALYZING);
    }
}
