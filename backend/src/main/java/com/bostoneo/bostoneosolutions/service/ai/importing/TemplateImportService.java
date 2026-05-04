package com.bostoneo.bostoneosolutions.service.ai.importing;

import com.bostoneo.bostoneosolutions.dto.ai.ImportCommitRequest;
import com.bostoneo.bostoneosolutions.dto.ai.ImportCommitResponse;
import com.bostoneo.bostoneosolutions.dto.ai.ImportSessionResponse;
import com.bostoneo.bostoneosolutions.dto.ai.RetokenizeRequest;
import com.bostoneo.bostoneosolutions.dto.ai.TemplateAnalysisResult;
import com.bostoneo.bostoneosolutions.enumeration.DataSource;
import com.bostoneo.bostoneosolutions.enumeration.TemplateCategory;
import com.bostoneo.bostoneosolutions.enumeration.VariableType;
import com.bostoneo.bostoneosolutions.model.AILegalTemplate;
import com.bostoneo.bostoneosolutions.model.AITemplateImportJob;
import com.bostoneo.bostoneosolutions.model.AITemplateVariable;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.AILegalTemplateRepository;
import com.bostoneo.bostoneosolutions.repository.AITemplateImportJobRepository;
import com.bostoneo.bostoneosolutions.repository.AITemplateVariableRepository;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.bostoneo.bostoneosolutions.util.ByteArrayMultipartFile;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Orchestrates the template-import pipeline:
 *   upload → extract → Claude classify → review → commit.
 *
 * <p>The upload endpoint calls {@link #analyzeFileAsync} per file so extraction + AI run concurrently.
 * Each file's progress lives in a {@link ImportSession} that the frontend polls.
 * Once the attorney submits their decisions, {@link #commit} persists the accepted templates
 * atomically and returns counts.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TemplateImportService {

    /**
     * Default model for initial analysis — Opus for higher reliability on the
     * multi-rule extraction prompt (classify + detect vars + strip letterhead +
     * strip signature + emit HTML body). Templates are imported infrequently
     * (per-firm onboarding, occasional new template additions), so the ~5x cost
     * over Sonnet is acceptable for the consistency gain. Per-template estimate:
     * ~$0.15–0.30 with Opus vs ~$0.03–0.06 with Sonnet, and the JSON output is
     * persisted so re-analysis is rare.
     */
    private static final String MODEL_FIRST_PASS  = "claude-opus-4-6";
    /** Cheap re-analysis when the attorney edits + re-runs. */
    private static final String MODEL_REANALYSIS  = "claude-haiku-4-5";
    // 600 s ceiling for Claude classification. A 32 k-token output streams ~7–10 minutes from Sonnet 4.6;
    // anything larger is rejected up front by the doc-too-large guard, so this is safely the ceiling.
    private static final int CLAUDE_TIMEOUT_SECONDS = 600;
    // Sized to fit estate-planning trusts up to ~40 pages without truncating the suggestedBodyWithPlaceholders
    // HTML. Claude bills per token actually generated, so small docs (typical case) still finish quickly and
    // cheaply — the cap is an upper bound, not a target.
    private static final int CLAUDE_MAX_TOKENS = 32_000;
    private static final BigDecimal LOW_CONFIDENCE_THRESHOLD = new BigDecimal("0.60");

    private final TemplateImportExtractor extractor;
    private final ClaudeSonnet4Service claudeService;
    private final ObjectMapper objectMapper;
    private final ImportSessionStore sessionStore;
    private final AILegalTemplateRepository templateRepository;
    private final AITemplateVariableRepository variableRepository;
    private final TenantService tenantService;
    private final DocxTemplateTransformer docxTemplateTransformer;
    private final PdfTemplateTransformer pdfTemplateTransformer;
    private final ImportJobPersister jobPersister;
    private final AITemplateImportJobRepository jobRepository;

    // ==================== Session Lifecycle ====================

    public UUID createSession() {
        Long orgId  = tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new IllegalStateException("Organization context required"));
        Long userId = tenantService.getCurrentUserId()
                .orElseThrow(() -> new IllegalStateException("User context required"));
        ImportSession session = sessionStore.create(orgId, userId);
        log.info("Created template import session {} for org {}, user {}", session.getSessionId(), orgId, userId);
        jobPersister.onCreate(session);
        return session.getSessionId();
    }

    public ImportSessionResponse getSessionResponse(UUID sessionId) {
        // In-memory session is the primary source of truth while analysis is running. If it has been
        // swept (terminated session past TTL, or pod restart), fall back to the durable DB row so the
        // wizard can hydrate a "view results / dismiss" snapshot when the user returns later.
        ImportSession session = sessionStore.get(sessionId).orElse(null);
        if (session == null) {
            return jobRepository.findBySessionId(sessionId)
                .map(this::synthesizeFromJob)
                .orElseThrow(() -> new IllegalArgumentException("Import session not found: " + sessionId));
        }
        sessionStore.touch(sessionId);
        ImportSessionResponse resp = session.toResponse();
        // DIAGNOSTIC: correlate frontend polls with actual session state
        log.info("Session poll {} → allFinalized={} files=[{}]",
            sessionId,
            resp.isAllFinalized(),
            resp.getFiles().stream()
                .map(f -> f.getFilename() + "=" + f.getStatus())
                .reduce((a, b) -> a + ", " + b)
                .orElse(""));
        return resp;
    }

    /** List the user's most recent import jobs (active + recently terminated) for the indicator UI. */
    public List<Map<String, Object>> listJobsForCurrentUser() {
        Long userId = tenantService.getCurrentUserId()
            .orElseThrow(() -> new IllegalStateException("User context required"));
        Long orgId  = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new IllegalStateException("Organization context required"));
        return jobRepository.findTop20ByUserIdOrderByStartedAtDesc(userId).stream()
            .filter(j -> orgId.equals(j.getOrganizationId()))
            .map(this::toJobSummary)
            .collect(java.util.stream.Collectors.toList());
    }

    /** Just the in-flight jobs (PENDING / IN_PROGRESS) — used to seed the indicator on app boot. */
    public List<Map<String, Object>> listActiveJobsForCurrentUser() {
        Long userId = tenantService.getCurrentUserId()
            .orElseThrow(() -> new IllegalStateException("User context required"));
        Long orgId  = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new IllegalStateException("Organization context required"));
        return jobRepository.findByUserIdAndStatusInOrderByStartedAtDesc(
                userId, java.util.List.of(AITemplateImportJob.Status.PENDING, AITemplateImportJob.Status.IN_PROGRESS))
            .stream()
            .filter(j -> orgId.equals(j.getOrganizationId()))
            .map(this::toJobSummary)
            .collect(java.util.stream.Collectors.toList());
    }

    private Map<String, Object> toJobSummary(AITemplateImportJob j) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("sessionId", j.getSessionId());
        m.put("status", j.getStatus() == null ? null : j.getStatus().name());
        m.put("fileCount", j.getFileCount());
        m.put("readyCount", j.getReadyCount());
        m.put("failedCount", j.getFailedCount());
        m.put("duplicateCount", j.getDuplicateCount());
        m.put("startedAt", j.getStartedAt());
        m.put("updatedAt", j.getUpdatedAt());
        m.put("completedAt", j.getCompletedAt());
        return m;
    }

    /**
     * Build a read-only {@link ImportSessionResponse} from the persisted job row when the in-memory
     * session is gone. The wizard can show terminal status and per-file outcomes; the commit path is
     * a no-op for this read-only view (the in-memory analysis state is required for commit).
     */
    private ImportSessionResponse synthesizeFromJob(AITemplateImportJob j) {
        // Tenant guard: never expose another user's session via the read-only fallback.
        Long currentUserId = tenantService.getCurrentUserId().orElse(null);
        Long currentOrgId  = tenantService.getCurrentOrganizationId().orElse(null);
        if (currentUserId == null || !currentUserId.equals(j.getUserId())
            || currentOrgId == null || !currentOrgId.equals(j.getOrganizationId())) {
            throw new SecurityException("Import session belongs to a different user.");
        }
        List<ImportSessionResponse.FileStatus> files = new java.util.ArrayList<>();
        if (j.getFilesSummary() != null) {
            for (Map<String, Object> row : j.getFilesSummary()) {
                ImportSessionResponse.FileStatus.Status st = parseStatus((String) row.get("status"));
                files.add(ImportSessionResponse.FileStatus.builder()
                    .fileId((String) row.get("fileId"))
                    .filename((String) row.get("filename"))
                    .status(st)
                    .errorCode((String) row.get("errorCode"))
                    .errorMessage((String) row.get("errorMessage"))
                    .contentHash((String) row.get("contentHash"))
                    .build());
            }
        }
        boolean allFinalized = j.getStatus() == AITemplateImportJob.Status.COMPLETED
            || j.getStatus() == AITemplateImportJob.Status.PARTIAL
            || j.getStatus() == AITemplateImportJob.Status.FAILED
            || j.getStatus() == AITemplateImportJob.Status.CANCELLED;
        return ImportSessionResponse.builder()
            .sessionId(j.getSessionId())
            .createdAt(j.getStartedAt() == null ? null : j.getStartedAt().toLocalDateTime())
            .expiresAt(null)
            .files(files)
            .allFinalized(allFinalized)
            .build();
    }

    private ImportSessionResponse.FileStatus.Status parseStatus(String s) {
        if (s == null) return null;
        try { return ImportSessionResponse.FileStatus.Status.valueOf(s); }
        catch (IllegalArgumentException ex) { return null; }
    }

    // ==================== Upload + Analysis ====================

    /**
     * Register a file in the session. Returns immediately; extraction + Claude analysis
     * run asynchronously and update the session state as they progress.
     */
    public String registerFile(UUID sessionId, MultipartFile file) {
        ImportSession session = requireSession(sessionId);
        String fileId = UUID.randomUUID().toString();

        ImportSession.SessionFile sf = ImportSession.SessionFile.builder()
            .fileId(fileId)
            .filename(file.getOriginalFilename() == null ? "unnamed" : file.getOriginalFilename())
            .status(ImportSessionResponse.FileStatus.Status.QUEUED)
            .build();
        session.getFiles().put(fileId, sf);
        sessionStore.touch(sessionId);
        jobPersister.onFileCountChanged(session);
        return fileId;
    }

    /**
     * Async worker: extracts, dedups within batch, calls Claude, stores result in session.
     * The caller should NOT await this future; the session is polled instead.
     *
     * <p><b>Tomcat multipart lifecycle:</b> the bytes are read synchronously on the request
     * thread and wrapped in {@link ByteArrayMultipartFile} before the {@code runAsync} boundary.
     * If we let the lambda touch the original {@code file}, Tomcat would have already deleted
     * the multipart temp file by the time extraction runs, producing
     * {@code NoSuchFileException: .../upload_*.tmp}.
     */
    public CompletableFuture<Void> analyzeFileAsync(UUID sessionId, String fileId, MultipartFile file, boolean reanalysis) {
        final byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ioe) {
            log.error("Failed to read uploaded bytes for {}: {}", file.getOriginalFilename(), ioe.getMessage(), ioe);
            sessionStore.get(sessionId).ifPresent(s -> {
                ImportSession.SessionFile sf = s.getFiles().get(fileId);
                if (sf != null) markError(sf, "EXTRACTION_ERROR", "Could not read uploaded file: " + ioe.getMessage());
            });
            return CompletableFuture.completedFuture(null);
        }
        final MultipartFile detached = new ByteArrayMultipartFile(
            bytes,
            file.getName(),
            file.getOriginalFilename() == null ? "unnamed" : file.getOriginalFilename(),
            file.getContentType()
        );

        return CompletableFuture.runAsync(() -> {
            ImportSession session = sessionStore.get(sessionId).orElse(null);
            if (session == null) {
                log.warn("Session {} expired before file {} could be analyzed", sessionId, fileId);
                return;
            }
            ImportSession.SessionFile sf = session.getFiles().get(fileId);
            if (sf == null) return;

            // OUTER guard: any uncaught throwable below would leave the file stuck on
            // EXTRACTING/ANALYZING forever (CompletableFuture.runAsync swallows uncaught
            // exceptions because we never .get() the future). The finally block enforces
            // the invariant: when this lambda returns, status is one of {READY, ERROR,
            // DUPLICATE} — never EXTRACTING or ANALYZING.
            try {
                processFile(session, sf, fileId, detached, reanalysis);
            } catch (Throwable t) {
                log.error("Unhandled error analyzing {}: {}", sf.getFilename(), t.getMessage(), t);
                markError(sf, "INTERNAL_ERROR", "Unexpected error: " + t.getMessage());
            } finally {
                ImportSessionResponse.FileStatus.Status finalStatus = sf.getStatus();
                if (finalStatus == ImportSessionResponse.FileStatus.Status.EXTRACTING
                    || finalStatus == ImportSessionResponse.FileStatus.Status.ANALYZING
                    || finalStatus == ImportSessionResponse.FileStatus.Status.QUEUED) {
                    log.error("File {} ended in non-terminal state {} — forcing ERROR to unblock UI",
                        sf.getFilename(), finalStatus);
                    markError(sf, "INTERNAL_ERROR",
                        "Processing ended unexpectedly while " + finalStatus.name().toLowerCase()
                        + ". Please retry.");
                }
                log.info("Analysis pipeline finished for {}: final status={}", sf.getFilename(), sf.getStatus());
                jobPersister.onSnapshot(session);
            }
        });
    }

    /**
     * The per-file pipeline body: extract → dedup → Claude classify.
     * Extracted from the {@link #analyzeFileAsync} lambda so the outer try/catch/finally
     * can guarantee a terminal status (READY, ERROR, or DUPLICATE) regardless of which
     * stage throws.
     */
    private void processFile(ImportSession session,
                             ImportSession.SessionFile sf,
                             String fileId,
                             MultipartFile detached,
                             boolean reanalysis) {
        // 1) Extract text -------------------------------------------------------
        ExtractedDocument doc;
        try {
            sf.setStatus(ImportSessionResponse.FileStatus.Status.EXTRACTING);
            log.info("Extracting {} (session {})", sf.getFilename(), session.getSessionId());
            doc = extractor.extract(detached);
        } catch (TemplateImportException tie) {
            log.warn("Extraction rejected for {}: {} ({})", sf.getFilename(), tie.getCode(), tie.getMessage());
            markError(sf, tie.getCode().name(), tie.getMessage());
            return;
        } catch (Exception e) {
            log.error("Unexpected extraction error for {}: {}", sf.getFilename(), e.getMessage(), e);
            markError(sf, "EXTRACTION_ERROR", "Could not extract text: " + e.getMessage());
            return;
        }

        sf.setExtracted(doc);
        sf.setContentHash(doc.contentHash());
        log.info("Extracted {} ({} chars, {} pages, hash={}, source={})",
            sf.getFilename(),
            doc.rawText() == null ? 0 : doc.rawText().length(),
            doc.pageCount(),
            doc.contentHash(),
            doc.sourceType());

        // 2) Dedup: intra-batch first, then cross-batch (DB) --------------------
        if (isIntraBatchDuplicate(session, fileId, doc.contentHash())) {
            log.info("{} duplicates another file in the same batch — marking DUPLICATE", sf.getFilename());
            sf.setDuplicateOfTemplateName(sf.getFilename());
            sf.setStatus(ImportSessionResponse.FileStatus.Status.DUPLICATE);
            return;
        }
        try {
            List<AILegalTemplate> dbMatches = templateRepository
                .findByOrganizationIdAndContentHash(session.getOrganizationId(), doc.contentHash());
            if (!dbMatches.isEmpty()) {
                AILegalTemplate match = dbMatches.get(0);
                log.info("{} matches existing template id={} (\"{}\") — marking DUPLICATE",
                    sf.getFilename(), match.getId(), match.getName());
                sf.setDuplicateOfTemplateId(match.getId());
                sf.setDuplicateOfTemplateName(match.getName());
                sf.setStatus(ImportSessionResponse.FileStatus.Status.DUPLICATE);
                return;
            }
        } catch (Exception e) {
            log.error("Dedup query failed for {}: {}", sf.getFilename(), e.getMessage(), e);
            markError(sf, "INTERNAL_ERROR", "Could not check for duplicates: " + e.getMessage());
            return;
        }

        // 3) Claude classification ---------------------------------------------
        sf.setStatus(ImportSessionResponse.FileStatus.Status.ANALYZING);
        log.info("Calling Claude for {} (reanalysis={})", sf.getFilename(), reanalysis);
        try {
            TemplateAnalysisResult analysis = runClaudeAnalysis(doc, reanalysis);
            sf.setAnalysis(analysis);
            // 4) Binary tokenization — produce a visually-identical DOCX/PDF with detected
            // raw text swapped for {{token}} so we can re-render at draft time with 100%
            // fidelity. Never fails the pipeline — a failed transform just leaves the
            // template as text-only (status remains READY).
            cacheBinaryArtifacts(sf, detached, analysis);
            sf.setStatus(ImportSessionResponse.FileStatus.Status.READY);
            log.info("Analysis complete for {} — status=READY", sf.getFilename());
        } catch (Exception e) {
            log.error("Claude analysis failed for {}: {}", sf.getFilename(), e.getMessage(), e);
            markError(sf, "AI_ERROR", "Could not classify document: " + e.getMessage());
        }
    }

    // ==================== Sprint 1.6: Binary tokenization ====================

    /**
     * Produce a tokenized copy of the uploaded bytes so the template can be re-rendered
     * at draft time with 100% visual fidelity to the source. DOCX always runs; PDF runs
     * only when {@code templateImport.pdfInPlaceEnabled=true} (default false).
     *
     * <p>Legacy .doc and OCR-only PDFs are intentionally skipped — neither has a text layer
     * the transformer can reason about.
     *
     * <p>Never throws. On any failure (missing bytes, transformer error) the session file
     * simply has no binary fields populated and the commit path falls back to text-only.
     */
    private void cacheBinaryArtifacts(ImportSession.SessionFile sf,
                                      MultipartFile detached,
                                      TemplateAnalysisResult analysis) {
        ExtractedDocument extracted = sf.getExtracted();
        if (extracted == null) return;

        String sourceType = extracted.sourceType();
        boolean isDocx = "IMPORTED_DOCX".equals(sourceType);
        boolean isPdf  = "IMPORTED_PDF".equals(sourceType); // not IMPORTED_PDF_OCR
        if (!isDocx && !isPdf) return;
        if (isPdf && !pdfTemplateTransformer.isEnabled()) {
            log.debug("PDF in-place transform disabled — {} will be saved as text-only", sf.getFilename());
            return;
        }

        byte[] originalBytes;
        try {
            originalBytes = detached.getBytes();
        } catch (IOException ioe) {
            log.warn("Could not read original bytes for binary tokenization of {}: {}",
                sf.getFilename(), ioe.getMessage());
            return;
        }
        if (originalBytes == null || originalBytes.length == 0) return;

        List<DocxTemplateTransformer.Replacement> replacements = buildReplacements(analysis);
        if (replacements.isEmpty()) {
            log.debug("No replaceable variables for {} — skipping binary tokenization", sf.getFilename());
            return;
        }

        byte[] transformedBytes;
        try {
            transformedBytes = isDocx
                ? docxTemplateTransformer.transform(originalBytes, replacements)
                : pdfTemplateTransformer.transform(originalBytes, replacements);
        } catch (Exception e) {
            log.warn("Binary template transform failed for {} — falling back to text-only: {}",
                sf.getFilename(), e.getMessage(), e);
            return;
        }

        sf.setOriginalBytes(originalBytes);
        sf.setTransformedBytes(transformedBytes);
        sf.setBinaryFormat(isDocx ? "DOCX" : "PDF");
        log.info("Binary template cached for {} ({} bytes, format={})",
            sf.getFilename(), transformedBytes.length, sf.getBinaryFormat());
    }

    /**
     * Map Claude's detected variables to {@link DocxTemplateTransformer.Replacement} pairs.
     * Skips variables that are already in {@code {{mustache}}} form (no-op replacement)
     * and anything missing the raw match string or target key.
     */
    private List<DocxTemplateTransformer.Replacement> buildReplacements(TemplateAnalysisResult analysis) {
        return buildReplacements(analysis, null, null);
    }

    /**
     * Same as {@link #buildReplacements(TemplateAnalysisResult)} but lets the caller narrow the
     * set (exclude rejected keys) and remap keys (apply attorney renames). Used both at initial
     * analysis (filters null) and by retokenize (filters populated from attorney review).
     */
    private List<DocxTemplateTransformer.Replacement> buildReplacements(
            TemplateAnalysisResult analysis,
            Collection<String> rejectedKeys,
            Map<String, String> renames) {
        List<DocxTemplateTransformer.Replacement> reps = new ArrayList<>();
        if (analysis == null) return reps;
        Set<String> rejected = rejectedKeys == null ? Set.of() : new HashSet<>(rejectedKeys);
        Map<String, String> rmap = renames == null ? Map.of() : renames;
        for (TemplateAnalysisResult.DetectedVariable v : analysis.safeDetectedVariables()) {
            if (Boolean.TRUE.equals(v.getIsPreExistingPlaceholder())) continue;
            String raw = v.getRawText();
            String key = v.getSuggestedKey();
            if (raw == null || raw.isBlank()) continue;
            if (key == null || key.isBlank()) continue;
            if (rejected.contains(key)) continue;
            String finalKey = rmap.getOrDefault(key, key);
            reps.add(new DocxTemplateTransformer.Replacement(raw, "{{" + finalKey + "}}"));
        }
        return reps;
    }

    private static String sha256Hex(byte[] bytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(bytes);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    // ==================== Sprint 1.6: Preview + Retokenize ====================

    /** Which copy of the bytes the caller wants to see. */
    public enum PreviewVariant { ORIGINAL, TRANSFORMED }

    /** Carrier for preview bytes + the metadata the controller needs to build the response. */
    public record PreviewBytes(byte[] bytes, String binaryFormat, String filename) {}

    /**
     * Return the cached original or tokenized bytes for a file in an import session.
     * Returns {@code null} when there is no binary cached yet (text-only fallback,
     * transform failed, or PDF flag disabled). The controller should map that to 404.
     *
     * @throws SecurityException        when the session belongs to another user
     * @throws RuntimeException         when the session or file is unknown/expired
     */
    public PreviewBytes getFilePreview(UUID sessionId, String fileId, PreviewVariant variant) {
        ImportSession session = requireSession(sessionId);
        requireSessionOwner(session);
        ImportSession.SessionFile sf = session.getFiles().get(fileId);
        if (sf == null) {
            throw new RuntimeException("File not found in session: " + fileId);
        }
        byte[] bytes = (variant == PreviewVariant.ORIGINAL)
            ? sf.getOriginalBytes()
            : sf.getTransformedBytes();
        if (bytes == null || bytes.length == 0) return null;
        return new PreviewBytes(bytes, sf.getBinaryFormat(), sf.getFilename());
    }

    /**
     * Re-run the binary transform with the attorney's live review decisions applied
     * (rejected variable keys are excluded; renames swap the target token). The session's
     * cached {@code transformedBytes} are replaced in place so the next preview GET serves
     * the refreshed copy.
     *
     * <p>No-op behavior:
     * <ul>
     *   <li>If the file has no {@code originalBytes} cached (text-only path), returns {@code false}.</li>
     *   <li>If the replacement set is empty after filters, the original bytes are echoed back as
     *       the "transformed" copy — effectively clearing any prior tokenization.</li>
     * </ul>
     *
     * @return true when the bytes were regenerated; false when there is nothing to retokenize.
     */
    public boolean retokenize(UUID sessionId, String fileId, RetokenizeRequest req) {
        ImportSession session = requireSession(sessionId);
        requireSessionOwner(session);
        ImportSession.SessionFile sf = session.getFiles().get(fileId);
        if (sf == null) {
            throw new RuntimeException("File not found in session: " + fileId);
        }
        byte[] originalBytes = sf.getOriginalBytes();
        String format = sf.getBinaryFormat();
        if (originalBytes == null || originalBytes.length == 0 || format == null) {
            return false;
        }

        List<String> rejected = req == null ? null : req.getRejectedVariableKeys();
        Map<String, String> renames = req == null ? null : req.getVariableRenames();
        List<DocxTemplateTransformer.Replacement> replacements =
            buildReplacements(sf.getAnalysis(), rejected, renames);

        byte[] newBytes;
        try {
            if (replacements.isEmpty()) {
                newBytes = originalBytes;
            } else if ("DOCX".equals(format)) {
                newBytes = docxTemplateTransformer.transform(originalBytes, replacements);
            } else if ("PDF".equals(format)) {
                newBytes = pdfTemplateTransformer.transform(originalBytes, replacements);
            } else {
                log.warn("Retokenize called on unknown binary format {} for {}", format, sf.getFilename());
                return false;
            }
        } catch (Exception e) {
            throw new RuntimeException("Retokenization failed: " + e.getMessage(), e);
        }
        sf.setTransformedBytes(newBytes);
        log.info("Retokenized {} with {} replacement(s) — {} bytes",
            sf.getFilename(), replacements.size(), newBytes.length);
        return true;
    }

    private void requireSessionOwner(ImportSession session) {
        Long currentUserId = tenantService.getCurrentUserId().orElse(null);
        if (currentUserId == null || !currentUserId.equals(session.getUserId())) {
            throw new SecurityException("Import session belongs to a different user.");
        }
    }

    /**
     * Reorder {@code detectedVariables} to follow first-occurrence reading order in the rendered
     * body. Claude returns variables grouped by category or detection order, which doesn't match
     * how an attorney reads the form left-to-right top-to-bottom. {@link #persistVariables} uses
     * the resulting list-index as {@code displayOrder} so the "Fields to fill" sidebar lines up
     * with the document.
     *
     * <p>Variables not found in the body (e.g., key was renamed mid-flight) keep their original
     * ordering at the END of the list — they're still persisted, just deprioritized.
     */
    private void sortVariablesByBodyOrder(TemplateAnalysisResult result) {
        if (result == null) return;
        List<TemplateAnalysisResult.DetectedVariable> vars = result.getDetectedVariables();
        if (vars == null || vars.size() <= 1) return;
        String body = result.getSuggestedBodyWithPlaceholders();
        if (body == null || body.isBlank()) return;

        vars.sort(java.util.Comparator.comparingInt(v -> {
            String key = v == null ? null : v.getSuggestedKey();
            if (key == null || key.isBlank()) return Integer.MAX_VALUE;
            int idx = body.indexOf("{{" + key + "}}");
            return idx < 0 ? Integer.MAX_VALUE : idx;
        }));
    }

    /**
     * Render the PDF graphics-primitive cues (signature lines, bordered callouts) as a prompt
     * section Claude can act on. Empty list → empty section (no token cost). The "STRUCTURAL
     * CUES" header signals to Claude that visual structure was detected and should be reflected
     * in the HTML output via the rules in the STRUCTURAL ELEMENTS section above.
     */
    private String formatStructuralCues(List<String> hints) {
        if (hints == null || hints.isEmpty()) return "";
        StringBuilder sb = new StringBuilder("\n            STRUCTURAL CUES (graphics primitives detected in the source PDF — apply the\n");
        sb.append("            STRUCTURAL ELEMENTS rules above when emitting suggestedBodyWithPlaceholders):\n");
        for (String h : hints) {
            sb.append("            - ").append(h).append("\n");
        }
        return sb.toString();
    }

    // ==================== Claude Prompt ====================

    private TemplateAnalysisResult runClaudeAnalysis(ExtractedDocument doc, boolean reanalysis) throws Exception {
        // Reject documents whose echoed-body output would blow past Claude's 32 k-token cap. ~4 chars/token
        // for English legal prose, so >480 k chars is a useful proxy for "Claude can't return this in one
        // call." Limit is set generously above the typical 40-page ceiling so we only fail on truly oversized
        // docs (60+ pages), not on borderline 40-pagers.
        int rawLen = doc.rawText() == null ? 0 : doc.rawText().length();
        if (rawLen > 480_000) {
            throw new TemplateImportException(
                TemplateImportException.Code.FILE_TOO_LARGE,
                "Template exceeds the size limit (~40 pages). Please split the document into multiple"
                + " templates and import each separately."
            );
        }

        String systemMessage = """
            You are a legal-document classification assistant for a template-management system.
            You analyze uploaded law-firm templates and return ONLY a JSON object matching the schema below.
            Do NOT include explanatory prose outside the JSON.
            Use deterministic temperature — your outputs are parsed programmatically.
            """;

        String prompt = String.format("""
            Classify this legal template and extract its variables.

            RESPOND WITH JSON ONLY, matching this schema:
            {
              "classification": {
                "documentType": "lor|motion_to_dismiss|complaint|demand_letter|divorce_petition|custody_motion|financial_statement|plea_agreement|sentencing_memo|retainer_agreement|engagement_letter|settlement_agreement|other",
                "practiceArea": "pi|family|criminal|immigration|civil|contract|business|employment|real_estate|ip|estate|bankruptcy|tax|environmental|class_action|other",
                "jurisdiction": "MA|TX|CA|NY|FL|...|federal|null",
                "confidence": 0.00-1.00,
                "evidence": "short snippet justifying the classification",
                "category": "MOTION|BRIEF|PLEADING|CONTRACT|CORRESPONDENCE|DISCOVERY|SETTLEMENT|COURT_FILING|INTERNAL_MEMO|CLIENT_ADVICE|RESEARCH_MEMO|OPINION_LETTER|IMMIGRATION_FORM|FAMILY_LAW_FORM|CRIMINAL_MOTION|REAL_ESTATE_DOC|PATENT_APPLICATION"
              },
              "detectedVariables": [
                {
                  "rawText": "[CLIENT_NAME]",
                  "suggestedKey": "client_name",
                  "suggestedLabel": "Client Name",
                  "dataType": "TEXT|NUMBER|DATE|BOOLEAN|EMAIL|PHONE|ADDRESS|CASE_REF|CLIENT_REF",
                  "confidence": 0.00-1.00,
                  "occurrences": 3,
                  "isPreExistingPlaceholder": true
                }
              ],
              "warnings": [
                { "severity": "INFO|WARNING|ERROR", "code": "pii_detected|client_info_baked_in|low_confidence_classification", "message": "..." }
              ],
              "suggestedName": "MA PI Letter of Representation",
              "suggestedDescription": "short one-line description",
              "suggestedBodyWithPlaceholders": "<body with {{key}} substituted for each detected rawText>",
              "requiresManualClassification": false
            }

            VARIABLE DETECTION RULES
            - Look for [BRACKETED_PLACEHOLDERS], <<double_angles>>, underscore blanks (_____),
              CAPS_WITH_UNDERSCORES that look like field names, and existing {{mustache}} placeholders.
            - Also flag free-text PII that should be parameterized (named parties, dollar amounts,
              specific dates). Set confidence < 0.7 for these so the attorney can reject.
            - Set isPreExistingPlaceholder=true only for tokens already using {{mustache}} syntax.
            - In suggestedBodyWithPlaceholders replace each rawText with {{suggestedKey}}.
              Apply the structural rules and HTML-output rules described below.

            LETTERHEAD, FOOTER, AND SIGNATURE-BLOCK RULES (apply to suggestedBodyWithPlaceholders)

            ALL DOCUMENTS — strip the following:
            - The sender's firm letterhead at the TOP: firm name (often centered, ALL CAPS, or
              large), firm street address, phone / fax / email / website lines. Typically
              appears BEFORE the date or any recipient information.
            - Footer content: page numbers ("Page 1 of N", "1 of 2", standalone numerals on
              their own line), repeating firm contact lines, copyright notices, and disclaimers
              that aren't part of the substantive document.

            SIGNATURE BLOCKS — handle by document class. This is critical:

            CORRESPONDENCE (letter-style documents — documentType in: lor, demand_letter,
            opinion_letter, internal_memo, sentencing_memo; OR category=CORRESPONDENCE,
            INTERNAL_MEMO, CLIENT_ADVICE, OPINION_LETTER):
            - STRIP the sender attorney's closing signature block: closing salutation
              ("Sincerely,", "Very truly yours,", "Best regards,"), the specific sender's name
              (e.g., "David H. Altman"), title, bar number, and any hardcoded sender contact
              info. Cut from the closing salutation through end-of-document.
            - PRESERVE the recipient/addressee block, "VIA Email"/"VIA Hand Delivery" delivery
              lines, Re:/Subject lines, "Dear ..." salutation, and ALL body paragraphs.

            INSTRUMENTS (documents that are themselves the legal artifact — documentType in:
            retainer_agreement, engagement_letter, settlement_agreement, divorce_petition,
            custody_motion, financial_statement, plea_agreement, or contains words like
            "Trust", "Will", "Power of Attorney", "Deed", "Operating Agreement", "Articles of
            Incorporation", "Bylaws"; OR category in: CONTRACT, SETTLEMENT, REAL_ESTATE_DOC,
            FAMILY_LAW_FORM, IMMIGRATION_FORM, COURT_FILING, PLEADING, MOTION, BRIEF,
            CRIMINAL_MOTION, PATENT_APPLICATION):
            - PRESERVE all party signature blocks. Settlors, Trustees, Testators, Grantors,
              Principals, Parties, Plaintiffs, Defendants, Petitioners, Respondents, Witnesses,
              Notaries — these are the substantive legal content of the instrument and MUST
              appear in suggestedBodyWithPlaceholders. Names that look like generic placeholders
              (e.g., "John Smith, Settlor and Trustee") are part of the template structure;
              parameterize them via {{variable_placeholders}} but DO NOT delete the block.
            - PRESERVE notary acknowledgement blocks, witness attestation blocks, and any
              "STATE OF __ / COUNTY OF __" jurat blocks. These are part of the instrument's
              legal validity and must appear in the body.
            - The "PRESERVE" rule overrides any other "strip" instinct. When in doubt, KEEP
              the content rather than removing it.

            Rationale: correspondence templates are stationery-overlaid at draft time so the
            sending attorney's identity must NOT be baked in. Instruments are the legal artifact
            itself — their signatory blocks ARE the document; deleting them produces an invalid
            template that can never be used.

            HTML OUTPUT FORMATTING (apply to suggestedBodyWithPlaceholders)
            - OUTPUT THE BODY AS HTML, not plain text. Preserve the document's visible
              structure so it renders in a browser preview the way the source document looks.
            - Use these tags:
              * <p>...</p>            for prose paragraphs (one per logical paragraph)
              * <br>                  for hard line breaks WITHIN a paragraph (e.g., between
                                      lines of an address block — NOT between paragraphs)
              * <strong>...</strong>  for bold text (ALL CAPS labels like "Re:" / "Claim
                                      Number:" / section headings inline in prose)
              * <em>...</em>          for italicized text (case names, statute references)
              * <h2 class="document-title">  for the document's top-of-page title (the trust name,
                                              will title, contract title, etc.) — renders bigger
                                              and centered. Use this ONLY for the very first
                                              heading at the start of the document body.
              * <h2>...</h2>          for major section headers (see HEADING PATTERNS below)
              * <h3>...</h3>          for sub-section headers
              * <h4>...</h4>          for sub-sub-section headers
              * <ol><li>...</li></ol> for numbered lists ("1. Confirmation of PIP benefits...")
              * <ul><li>...</li></ul> for bulleted lists

            HEADING PATTERNS — apply these strictly so headings render bold in the editor:
              * Lines matching ^(ARTICLE|SECTION|PART|CHAPTER)\\s+\\w+ (e.g., "ARTICLE 1 - OUR
                TRUST", "SECTION III: REPRESENTATIONS", "PART A — DEFINITIONS") MUST be wrapped
                in <h2>...</h2>. Never use <p> or <strong> for these — only <h2>.
              * Lines matching ^\\d+\\.\\d+\\b\\s+\\S+ (e.g., "1.1 TRUST CERTIFICATION",
                "5.2 RIGHT TO AMEND", "6.1 PERSONAL PROPERTY") MUST be wrapped in <h3>...</h3>.
              * Lines matching ^\\d+\\.\\d+\\.\\d+\\b\\s+\\S+ (e.g., "1.1.1 NOMINEE TRUSTEE")
                MUST be wrapped in <h4>...</h4>.
              * "Re:" / "Subject:" / "Claim Number:" inline labels inside paragraphs stay as
                <strong>...</strong> — do NOT promote those to headings.
            - Address / contact blocks: a SINGLE <p> with <br> between lines. Do NOT use one
              <p> per line — that creates awkward paragraph spacing that doesn't match the
              source document's visual rhythm.
            - Prose paragraphs: each blank-line-separated paragraph in the source becomes
              ONE <p>. Hard wraps from PDF column-width (mid-paragraph \\n) collapse into
              continuous text within the same <p>.
            - Wrap {{variable_placeholders}} inline within whatever HTML element they sit in.
              Do NOT introduce extra tags around them.
            - Do NOT include <html>, <head>, <body>, or any document chrome — output only the
              body fragment. The frontend renders it inside its own preview pane.

            STRUCTURAL ELEMENTS — apply when the document contains these patterns OR when
            the STRUCTURAL CUES block below indicates them:

            - SIGNATURE LINES — when the source has a signatory block (a personal name followed
              by a comma and a role like "Settlor", "Trustee", "Testator", "Grantor", "Witness",
              "Notary Public", "Plaintiff", "Defendant", "Party", "Buyer", "Seller", "Lessor",
              "Lessee"), emit each signatory as a <p class="signature-line"> paragraph:
                <p class="signature-line">{{settlor_1_name}}, Settlor and Trustee</p>
                <p class="signature-line">{{settlor_2_name}}, Settlor and Trustee</p>
              One <p class="signature-line"> per signatory. The renderer expands this to a real
              horizontal rule above each name in the exported PDF and Word file. Do NOT use
              <hr/>, inline {@code style="border-top:..."}, or any other custom markup — only
              the {@code class="signature-line"} attribute on a <p> element survives the editor's
              sanitization layer all the way to the export pipeline.

            - BORDERED CALLOUT BOXES — when the source contains a notary acknowledgement
              disclaimer, sworn-statement preamble, important-notice block, or similar callout
              that visually appears in a bordered box (e.g., the standard California notary
              disclaimer "A notary public or other officer completing this certificate verifies
              only the identity..."), wrap that block in a div with the callout-box class:
                <div class="callout-box">
                  <p>...callout content...</p>
                </div>
              The renderer expands this to a single-cell bordered table for the PDF export.
              Apply this whenever the STRUCTURAL CUES indicate a bordered rectangle on a page
              AND there is semantically a callout-style block (disclaimer, notice, sworn
              statement). Do NOT box ordinary prose paragraphs. Do NOT use a raw <table> with
              inline border styles — only the {@code class="callout-box"} marker survives.

            - JURAT / ACKNOWLEDGEMENT BLOCKS — for "STATE OF ___ / COUNTY OF ___ / On ___
              before me ___ a Notary Public, personally appeared ___" style blocks, preserve
              the line-by-line layout via <p>STATE OF CALIFORNIA</p><p>COUNTY OF {{county}}</p>
              etc., NOT collapsed into a single paragraph. The structured layout is part of
              the form's legal meaning.

            CLASSIFICATION RULES
            - If multiple docTypes plausible, pick highest-confidence and set requiresManualClassification=true when confidence < 0.60.
            - For unknown practice areas use "other" rather than guessing.
            - jurisdiction: prefer ISO 2-letter for state law; use "federal" for FRCP/USC; "null" if unclear.
            %s
            DOCUMENT BODY:
            ---
            %s
            ---
            """, formatStructuralCues(doc.structureHints()), doc.rawText());

        String model = reanalysis ? MODEL_REANALYSIS : MODEL_FIRST_PASS;
        String raw = claudeService.generateCompletionWithModel(
                prompt, systemMessage, false, null, 0.0, model, CLAUDE_MAX_TOKENS)
            .get(CLAUDE_TIMEOUT_SECONDS, TimeUnit.SECONDS);

        String jsonStr = extractJson(raw);
        if (jsonStr == null) {
            throw new IllegalStateException("Claude response did not contain parseable JSON");
        }

        TemplateAnalysisResult result = objectMapper.readValue(jsonStr, TemplateAnalysisResult.class);
        result.setWarnings(combineWarnings(result.getWarnings(), doc.warnings()));
        sortVariablesByBodyOrder(result);

        // Surface low-confidence as a warning so the UI can prompt the attorney.
        if (result.getClassification() != null
            && result.getClassification().getConfidence() != null
            && BigDecimal.valueOf(result.getClassification().getConfidence()).compareTo(LOW_CONFIDENCE_THRESHOLD) < 0) {
            result.setRequiresManualClassification(true);
            result.getWarnings().add(ImportWarning.warning(
                "low_confidence_classification",
                "AI confidence is low — please verify the document type and practice area before importing."
            ));
        }
        return result;
    }

    private List<ImportWarning> combineWarnings(List<ImportWarning> claudeWarnings, List<ImportWarning> extractWarnings) {
        List<ImportWarning> out = new ArrayList<>();
        if (extractWarnings != null) out.addAll(extractWarnings);
        if (claudeWarnings != null)  out.addAll(claudeWarnings);
        return out;
    }

    /** Tolerates Claude wrapping JSON in ```json fences or trailing prose. */
    private String extractJson(String raw) {
        if (raw == null) return null;
        int fence = raw.indexOf("```json");
        if (fence != -1) {
            int start = raw.indexOf('\n', fence) + 1;
            int end = raw.indexOf("```", start);
            if (end > start) return raw.substring(start, end).trim();
        }
        int open = raw.indexOf('{');
        int close = raw.lastIndexOf('}');
        if (open != -1 && close > open) return raw.substring(open, close + 1);
        return null;
    }

    // ==================== Commit ====================

    @Transactional
    public ImportCommitResponse commit(UUID sessionId, ImportCommitRequest req) {
        ImportSession session = requireSession(sessionId);
        Long currentUserId = tenantService.getCurrentUserId().orElse(null);
        if (currentUserId == null || !currentUserId.equals(session.getUserId())) {
            throw new SecurityException("Import session belongs to a different user.");
        }

        UUID batchId = UUID.randomUUID();
        List<Long> createdIds = new ArrayList<>();
        List<String> failures = new ArrayList<>();
        int created = 0, skipped = 0, overwritten = 0, failed = 0;

        for (ImportCommitRequest.FileDecision decision : req.getDecisions()) {
            ImportSession.SessionFile sf = session.getFiles().get(decision.getFileId());
            if (sf == null) { failed++; failures.add("Unknown fileId: " + decision.getFileId()); continue; }

            try {
                switch (decision.getAction()) {
                    case SKIP -> skipped++;
                    case IMPORT -> {
                        if (sf.getStatus() != ImportSessionResponse.FileStatus.Status.READY) {
                            skipped++;
                            failures.add("Skipped " + sf.getFilename() + ": not in READY state (" + sf.getStatus() + ").");
                            break;
                        }
                        AILegalTemplate saved = persistNewTemplate(session, sf, decision, batchId);
                        createdIds.add(saved.getId());
                        created++;
                    }
                    case OVERWRITE -> {
                        if (decision.getOverwriteTemplateId() == null) {
                            failed++; failures.add("OVERWRITE missing templateId for " + sf.getFilename());
                            break;
                        }
                        AILegalTemplate saved = overwriteExistingTemplate(session, sf, decision, batchId);
                        createdIds.add(saved.getId());
                        overwritten++;
                    }
                }
            } catch (Exception e) {
                failed++;
                failures.add(sf.getFilename() + ": " + e.getMessage());
                log.error("Commit failure for file {} in session {}: {}", sf.getFilename(), sessionId, e.getMessage(), e);
            }
        }

        jobPersister.onCommitted(session);
        sessionStore.remove(sessionId);
        return ImportCommitResponse.builder()
            .importBatchId(batchId)
            .created(created)
            .skipped(skipped)
            .overwritten(overwritten)
            .failed(failed)
            .createdTemplateIds(createdIds)
            .failures(failures)
            .build();
    }

    private AILegalTemplate persistNewTemplate(ImportSession session,
                                               ImportSession.SessionFile sf,
                                               ImportCommitRequest.FileDecision decision,
                                               UUID batchId) {
        TemplateAnalysisResult analysis = sf.getAnalysis();
        String body = buildFinalBody(analysis, decision);

        AILegalTemplate t = new AILegalTemplate();
        t.setName(firstNonBlank(decision.getTemplateName(), analysis.getSuggestedName(), "Imported template"));
        t.setDescription(firstNonBlank(decision.getTemplateDescription(), analysis.getSuggestedDescription(), null));
        t.setCategory(resolveCategory(decision.getCategory(), analysis.getClassification()));
        t.setPracticeArea(firstNonBlank(decision.getPracticeArea(),
                analysis.getClassification() != null ? analysis.getClassification().getPracticeArea() : null,
                null));
        t.setJurisdiction(firstNonBlank(decision.getJurisdiction(),
                analysis.getClassification() != null ? analysis.getClassification().getJurisdiction() : null,
                "Massachusetts"));
        t.setDocumentType(analysis.getClassification() != null ? analysis.getClassification().getDocumentType() : null);
        t.setTemplateContent(body);
        t.setTemplateType("TEXT");
        t.setOrganizationId(session.getOrganizationId());
        t.setCreatedBy(session.getUserId());
        t.setIsPublic(false);
        t.setIsApproved(false);
        t.setIsMaCertified(false);

        // Import metadata
        t.setSourceType(sf.getExtracted().sourceType());
        t.setSourceFilename(sf.getFilename());
        t.setImportBatchId(batchId);
        t.setImportConfidence(analysis.getClassification() != null && analysis.getClassification().getConfidence() != null
                ? BigDecimal.valueOf(analysis.getClassification().getConfidence()).setScale(2, RoundingMode.HALF_UP)
                : null);
        t.setIsPrivate(Boolean.TRUE.equals(decision.getIsPrivate()));
        t.setImportedByUserId(session.getUserId());
        t.setImportedAt(LocalDateTime.now());
        t.setContentHash(sf.getContentHash());

        applyBinaryTemplate(t, sf);

        AILegalTemplate saved = templateRepository.save(t);
        persistVariables(saved.getId(), analysis, decision);
        return saved;
    }

    private AILegalTemplate overwriteExistingTemplate(ImportSession session,
                                                      ImportSession.SessionFile sf,
                                                      ImportCommitRequest.FileDecision decision,
                                                      UUID batchId) {
        AILegalTemplate existing = templateRepository
            .findByIdAndOrganizationId(decision.getOverwriteTemplateId(), session.getOrganizationId())
            .orElseThrow(() -> new RuntimeException("Template to overwrite not found or not owned by this org"));

        TemplateAnalysisResult analysis = sf.getAnalysis();
        existing.setTemplateContent(buildFinalBody(analysis, decision));
        existing.setDescription(firstNonBlank(decision.getTemplateDescription(), analysis.getSuggestedDescription(), existing.getDescription()));
        existing.setSourceType(sf.getExtracted().sourceType());
        existing.setSourceFilename(sf.getFilename());
        existing.setImportBatchId(batchId);
        existing.setImportConfidence(analysis.getClassification() != null && analysis.getClassification().getConfidence() != null
                ? BigDecimal.valueOf(analysis.getClassification().getConfidence()).setScale(2, RoundingMode.HALF_UP)
                : existing.getImportConfidence());
        existing.setImportedByUserId(session.getUserId());
        existing.setImportedAt(LocalDateTime.now());
        existing.setContentHash(sf.getContentHash());
        if (decision.getIsPrivate() != null) existing.setIsPrivate(decision.getIsPrivate());

        applyBinaryTemplate(existing, sf);

        AILegalTemplate saved = templateRepository.save(existing);
        persistVariables(saved.getId(), analysis, decision);
        return saved;
    }

    /**
     * Copy the tokenized bytes from the session into the entity's binary columns.
     * When present, flips {@code templateType} to {@code HYBRID} so the drafting fork
     * (Sprint 1.6 / Phase G) can pick the binary renderer over the text path.
     *
     * <p>When absent (no binary produced — e.g. OCR PDF, PDF flag off, transform failed),
     * all binary columns are cleared and {@code templateType} is reset to {@code TEXT}.
     * This keeps the overwrite path honest: stale binary from a prior import is never
     * left paired with new text content.
     */
    private void applyBinaryTemplate(AILegalTemplate t, ImportSession.SessionFile sf) {
        byte[] binary = sf.getTransformedBytes();
        if (binary == null || binary.length == 0) {
            t.setTemplateBinary(null);
            t.setTemplateBinaryFormat(null);
            t.setHasBinaryTemplate(false);
            t.setBinarySha256(null);
            t.setBinarySizeBytes(null);
            t.setTemplateType("TEXT");
            return;
        }
        t.setTemplateBinary(binary);
        t.setTemplateBinaryFormat(sf.getBinaryFormat());
        t.setHasBinaryTemplate(true);
        t.setBinarySha256(sha256Hex(binary));
        t.setBinarySizeBytes(binary.length);
        t.setTemplateType("HYBRID");
    }

    private void persistVariables(Long templateId, TemplateAnalysisResult analysis, ImportCommitRequest.FileDecision decision) {
        Set<String> rejected = decision.getRejectedVariableKeys() == null
            ? Set.of() : new HashSet<>(decision.getRejectedVariableKeys());
        Map<String, String> renames = decision.getVariableRenames() == null
            ? Map.of() : decision.getVariableRenames();

        int order = 0;
        for (TemplateAnalysisResult.DetectedVariable v : analysis.safeDetectedVariables()) {
            String finalKey = renames.getOrDefault(v.getSuggestedKey(), v.getSuggestedKey());
            if (rejected.contains(v.getSuggestedKey())) continue;

            AITemplateVariable av = AITemplateVariable.builder()
                .templateId(templateId)
                .variableName(finalKey)
                .displayName(v.getSuggestedLabel())
                .variableType(parseVariableType(v.getDataType()))
                .dataSource(DataSource.USER_INPUT)
                .isRequired(true)
                .displayOrder(order++)
                .build();
            variableRepository.save(av);
        }
    }

    private String buildFinalBody(TemplateAnalysisResult analysis, ImportCommitRequest.FileDecision decision) {
        String body = analysis.getSuggestedBodyWithPlaceholders();
        if (body == null || body.isBlank()) return "";

        // Apply key renames to the body so placeholders match the persisted variable names.
        Map<String, String> renames = decision.getVariableRenames();
        if (renames != null) {
            for (Map.Entry<String, String> e : renames.entrySet()) {
                body = body.replace("{{" + e.getKey() + "}}", "{{" + e.getValue() + "}}");
            }
        }

        // Strip rejected placeholders — leave the raw text they originally replaced, so the
        // attorney's review choice to reject a variable results in fixed text, not an empty {{}}.
        if (decision.getRejectedVariableKeys() != null) {
            for (TemplateAnalysisResult.DetectedVariable v : analysis.safeDetectedVariables()) {
                if (decision.getRejectedVariableKeys().contains(v.getSuggestedKey())) {
                    body = body.replace("{{" + v.getSuggestedKey() + "}}", v.getRawText() == null ? "" : v.getRawText());
                }
            }
        }
        return body;
    }

    // ==================== Helpers ====================

    private ImportSession requireSession(UUID sessionId) {
        return sessionStore.get(sessionId)
            .orElseThrow(() -> new RuntimeException("Import session not found or expired: " + sessionId));
    }

    private boolean isIntraBatchDuplicate(ImportSession session, String currentFileId, String hash) {
        for (Map.Entry<String, ImportSession.SessionFile> e : session.getFiles().entrySet()) {
            if (e.getKey().equals(currentFileId)) continue;
            if (hash.equals(e.getValue().getContentHash())) return true;
        }
        return false;
    }

    private void markError(ImportSession.SessionFile sf, String code, String message) {
        sf.setStatus(ImportSessionResponse.FileStatus.Status.ERROR);
        sf.setErrorCode(code);
        sf.setErrorMessage(message);
    }

    private TemplateCategory resolveCategory(String override, TemplateAnalysisResult.Classification c) {
        String candidate = override != null ? override : (c != null ? c.getCategory() : null);
        if (candidate == null) return TemplateCategory.CORRESPONDENCE;
        try {
            return TemplateCategory.valueOf(candidate.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return TemplateCategory.CORRESPONDENCE;
        }
    }

    private VariableType parseVariableType(String raw) {
        if (raw == null) return VariableType.TEXT;
        try {
            return VariableType.valueOf(raw.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return VariableType.TEXT;
        }
    }

    private String firstNonBlank(String... candidates) {
        for (String c : candidates) if (c != null && !c.isBlank()) return c;
        return null;
    }
}
