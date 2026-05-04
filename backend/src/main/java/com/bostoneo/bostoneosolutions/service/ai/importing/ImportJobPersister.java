package com.bostoneo.bostoneosolutions.service.ai.importing;

import com.bostoneo.bostoneosolutions.dto.ai.ImportSessionResponse;
import com.bostoneo.bostoneosolutions.dto.ai.TemplateAnalysisResult;
import com.bostoneo.bostoneosolutions.model.AITemplateImportJob;
import com.bostoneo.bostoneosolutions.model.AITemplateImportJob.Status;
import com.bostoneo.bostoneosolutions.repository.AITemplateImportJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Mirrors {@link ImportSession} state into the {@code ai_template_import_jobs} table so the wizard
 * can show what's running across pod restarts, browser closes, and past the 5-min in-memory TTL.
 *
 * <p>Hot path stays in-memory — DB writes happen exactly twice per file: once on session creation,
 * once on per-file termination. {@link Propagation#REQUIRES_NEW} so the writes don't get rolled
 * back if the surrounding async lambda throws.
 *
 * <p>Never throws: persistence failures are logged and swallowed. The in-memory store remains
 * authoritative during analysis.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ImportJobPersister {

    private final AITemplateImportJobRepository repository;

    /**
     * Insert (or no-op upsert) a PENDING row when a session is created. file_count starts at the
     * number of files already registered when this is called; subsequent registrations increment
     * it via {@link #onFileCountChanged}.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onCreate(ImportSession session) {
        try {
            if (repository.findBySessionId(session.getSessionId()).isPresent()) {
                return;
            }
            OffsetDateTime now = OffsetDateTime.now();
            AITemplateImportJob job = AITemplateImportJob.builder()
                .sessionId(session.getSessionId())
                .organizationId(session.getOrganizationId())
                .userId(session.getUserId())
                .status(Status.PENDING)
                .fileCount(session.getFiles() == null ? 0 : session.getFiles().size())
                .readyCount(0)
                .failedCount(0)
                .duplicateCount(0)
                .startedAt(now)
                .updatedAt(now)
                .build();
            repository.save(job);
        } catch (Exception e) {
            log.warn("Failed to persist initial import-job row for session {}: {}",
                session.getSessionId(), e.getMessage());
        }
    }

    /**
     * Refresh file_count after files are registered against an existing session (the controller
     * registers files one-by-one after createSession).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onFileCountChanged(ImportSession session) {
        try {
            repository.findBySessionId(session.getSessionId()).ifPresent(job -> {
                int total = session.getFiles() == null ? 0 : session.getFiles().size();
                if (total != job.getFileCount()) {
                    job.setFileCount(total);
                    job.setUpdatedAt(OffsetDateTime.now());
                    repository.save(job);
                }
            });
        } catch (Exception e) {
            log.warn("Failed to update file_count for session {}: {}",
                session.getSessionId(), e.getMessage());
        }
    }

    /**
     * Persist a snapshot after a per-file status transition. Computes counts and roll-up status
     * from the live in-memory session.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onSnapshot(ImportSession session) {
        try {
            AITemplateImportJob job = repository.findBySessionId(session.getSessionId())
                .orElse(null);
            if (job == null) {
                onCreate(session);
                job = repository.findBySessionId(session.getSessionId()).orElse(null);
                if (job == null) return;
            }
            int ready = 0, failed = 0, dup = 0, total = 0, finalized = 0;
            List<Map<String, Object>> summary = new java.util.ArrayList<>();
            if (session.getFiles() != null) {
                for (ImportSession.SessionFile sf : session.getFiles().values()) {
                    total++;
                    ImportSessionResponse.FileStatus.Status st = sf.getStatus();
                    if (st == ImportSessionResponse.FileStatus.Status.READY)        { ready++;     finalized++; }
                    else if (st == ImportSessionResponse.FileStatus.Status.ERROR)    { failed++;    finalized++; }
                    else if (st == ImportSessionResponse.FileStatus.Status.DUPLICATE){ dup++;       finalized++; }
                    summary.add(buildFileSummary(sf));
                }
            }
            Status rollup;
            if (total == 0)                       rollup = Status.PENDING;
            else if (finalized < total)            rollup = Status.IN_PROGRESS;
            else if (failed == total)              rollup = Status.FAILED;
            else if (failed > 0)                   rollup = Status.PARTIAL;
            else                                   rollup = Status.COMPLETED;

            job.setFileCount(total);
            job.setReadyCount(ready);
            job.setFailedCount(failed);
            job.setDuplicateCount(dup);
            job.setStatus(rollup);
            job.setFilesSummary(summary);
            job.setUpdatedAt(OffsetDateTime.now());
            if (rollup == Status.COMPLETED || rollup == Status.PARTIAL || rollup == Status.FAILED) {
                if (job.getCompletedAt() == null) {
                    job.setCompletedAt(OffsetDateTime.now());
                }
            }
            repository.save(job);
        } catch (Exception e) {
            log.warn("Failed to persist snapshot for session {}: {}",
                session.getSessionId(), e.getMessage());
        }
    }

    /** Mark a session COMPLETED in place when the user finishes the commit step. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onCommitted(ImportSession session) {
        onSnapshot(session);
    }

    private Map<String, Object> buildFileSummary(ImportSession.SessionFile sf) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("fileId", sf.getFileId());
        row.put("filename", sf.getFilename());
        row.put("status", sf.getStatus() == null ? null : sf.getStatus().name());
        row.put("errorCode", sf.getErrorCode());
        row.put("errorMessage", sf.getErrorMessage());
        row.put("contentHash", sf.getContentHash());
        TemplateAnalysisResult a = sf.getAnalysis();
        if (a != null) {
            row.put("suggestedName", a.getSuggestedName());
            row.put("suggestedDescription", a.getSuggestedDescription());
            if (a.getClassification() != null) {
                Map<String, Object> cls = new HashMap<>();
                cls.put("documentType", a.getClassification().getDocumentType());
                cls.put("practiceArea", a.getClassification().getPracticeArea());
                cls.put("category", a.getClassification().getCategory());
                row.put("classification", cls);
            }
        }
        return row;
    }
}
