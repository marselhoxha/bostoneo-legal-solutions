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
import com.bostoneo.bostoneosolutions.model.AITemplateVariable;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.AILegalTemplateRepository;
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
    private static final int CLAUDE_TIMEOUT_SECONDS = 90;
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

    // ==================== Session Lifecycle ====================

    public UUID createSession() {
        Long orgId  = tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new IllegalStateException("Organization context required"));
        Long userId = tenantService.getCurrentUserId()
                .orElseThrow(() -> new IllegalStateException("User context required"));
        ImportSession session = sessionStore.create(orgId, userId);
        log.info("Created template import session {} for org {}, user {}", session.getSessionId(), orgId, userId);
        return session.getSessionId();
    }

    public ImportSessionResponse getSessionResponse(UUID sessionId) {
        ImportSession session = requireSession(sessionId);
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

    // ==================== Claude Prompt ====================

    private TemplateAnalysisResult runClaudeAnalysis(ExtractedDocument doc, boolean reanalysis) throws Exception {
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

            LETTERHEAD, FOOTER, AND SIGNATURE-BLOCK REMOVAL (apply to suggestedBodyWithPlaceholders)
            - STRIP the sender's firm letterhead from the TOP of the document. This is the
              block that identifies the SENDING firm: firm name (often centered, ALL CAPS, or
              large), firm street address, phone / fax / email / website lines. It typically
              appears BEFORE the date or before any recipient (TO/addressee) information.
            - STRIP the sender's signature block at the BOTTOM of the document. This includes
              the closing salutation ("Sincerely,", "Very truly yours,", "Best regards,"),
              the SPECIFIC sender's name (e.g., "David H. Altman"), title, bar number, and any
              hardcoded sender contact info that follows the body proper. Cut from the closing
              line through end-of-document.
            - STRIP footer content: page numbers ("Page 1 of N", "1 of 2", standalone numerals
              on their own line), repeating firm contact lines, copyright notices, and
              disclaimers that aren't part of the substantive document.
            - PRESERVE everything else verbatim: the date, the recipient (TO/addressee) block,
              "VIA Email"/"VIA Hand Delivery" delivery lines, Re:/Subject lines, salutation
              ("Dear ..."), and ALL body paragraphs.
            - The recipient is part of the document content; ONLY the SENDER's identity (top
              letterhead AND bottom signature) is firm/attorney-specific.
            - Rationale: attorneys apply their own firm letterhead AND signature block via the
              stationery system at draft time. Baking a specific firm or attorney's identity
              into the saved template body would either get duplicated when stationery is
              overlaid or pin the template to one attorney. Templates must be firm- and
              attorney-agnostic.

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
              * <h2 style="text-align:center">  for centered titles or major section headers
              * <h3>...</h3>          for sub-section headers
              * <ol><li>...</li></ol> for numbered lists ("1. Confirmation of PIP benefits...")
              * <ul><li>...</li></ul> for bulleted lists
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

            CLASSIFICATION RULES
            - If multiple docTypes plausible, pick highest-confidence and set requiresManualClassification=true when confidence < 0.60.
            - For unknown practice areas use "other" rather than guessing.
            - jurisdiction: prefer ISO 2-letter for state law; use "federal" for FRCP/USC; "null" if unclear.

            DOCUMENT BODY:
            ---
            %s
            ---
            """, doc.rawText());

        String model = reanalysis ? MODEL_REANALYSIS : MODEL_FIRST_PASS;
        String raw = claudeService.generateCompletionWithModel(
                prompt, systemMessage, false, null, 0.0, model)
            .get(CLAUDE_TIMEOUT_SECONDS, TimeUnit.SECONDS);

        String jsonStr = extractJson(raw);
        if (jsonStr == null) {
            throw new IllegalStateException("Claude response did not contain parseable JSON");
        }

        TemplateAnalysisResult result = objectMapper.readValue(jsonStr, TemplateAnalysisResult.class);
        result.setWarnings(combineWarnings(result.getWarnings(), doc.warnings()));

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
