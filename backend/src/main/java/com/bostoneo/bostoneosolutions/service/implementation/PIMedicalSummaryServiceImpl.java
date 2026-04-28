package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.PIMedicalSummaryDTO;
import com.bostoneo.bostoneosolutions.exception.ResourceNotFoundException;
import com.bostoneo.bostoneosolutions.model.PIMedicalRecord;
import com.bostoneo.bostoneosolutions.model.PIMedicalSummary;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.PIMedicalRecordRepository;
import com.bostoneo.bostoneosolutions.repository.PIMedicalSummaryRepository;
import com.bostoneo.bostoneosolutions.service.PIMedicalSummaryService;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementation of PI Medical Summary Service
 */
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class PIMedicalSummaryServiceImpl implements PIMedicalSummaryService {

    private final PIMedicalSummaryRepository summaryRepository;
    private final PIMedicalRecordRepository recordRepository;
    private final TenantService tenantService;
    private final ClaudeSonnet4Service claudeService;
    private final ObjectMapper objectMapper;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public PIMedicalSummaryDTO getMedicalSummary(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return summaryRepository.findByCaseIdAndOrganizationId(caseId, orgId)
                .map(this::mapToDTO)
                .orElse(null);
    }

    @Override
    public PIMedicalSummaryDTO generateMedicalSummary(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Generating medical summary for case: {} in org: {}", caseId, orgId);

        // Get all medical records
        List<PIMedicalRecord> records = recordRepository
                .findByCaseIdAndOrganizationIdOrderByTreatmentDateAsc(caseId, orgId);

        if (records.isEmpty()) {
            log.warn("No medical records found for case: {}", caseId);
            throw new IllegalStateException("No medical records found to generate summary");
        }

        // Build provider summary
        List<Map<String, Object>> providerSummary = buildProviderSummary(caseId, orgId);

        // Collect all diagnoses
        List<Map<String, Object>> diagnosisList = collectDiagnoses(records);

        // Analyze treatment gaps
        List<Map<String, Object>> treatmentGaps = analyzeTreatmentGapsInternal(records);

        // Generate AI analysis
        Map<String, Object> aiAnalysis = generateAIAnalysis(records, providerSummary, diagnosisList);

        // Calculate metrics
        BigDecimal totalBilled = recordRepository.sumBilledAmountByCaseId(caseId, orgId);
        LocalDate firstDate = recordRepository.findEarliestTreatmentDate(caseId, orgId);
        LocalDate lastDate = recordRepository.findLatestTreatmentDate(caseId, orgId);

        int treatmentDuration = 0;
        if (firstDate != null && lastDate != null) {
            treatmentDuration = (int) ChronoUnit.DAYS.between(firstDate, lastDate);
        }

        // Calculate total gap days
        int totalGapDays = treatmentGaps.stream()
                .mapToInt(gap -> (Integer) gap.getOrDefault("gapDays", 0))
                .sum();

        // Get or create summary
        PIMedicalSummary summary = summaryRepository.findByCaseIdAndOrganizationId(caseId, orgId)
                .orElse(PIMedicalSummary.builder()
                        .caseId(caseId)
                        .organizationId(orgId)
                        .build());

        // Update summary
        summary.setProviderSummary(providerSummary);
        summary.setDiagnosisList(diagnosisList);
        summary.setRedFlags(extractRedFlags(aiAnalysis));
        summary.setMissingRecords(detectMissingRecords(records));
        summary.setTreatmentChronology(buildChronology(records));
        summary.setPhasedChronology(generatePhasedChronology(records));
        summary.setKeyHighlights((String) aiAnalysis.get("keyHighlights"));
        summary.setPrognosisAssessment((String) aiAnalysis.get("prognosis"));

        // Metrics
        summary.setTotalProviders(providerSummary.size());
        summary.setTotalVisits(records.size());
        summary.setTotalBilled(totalBilled);
        summary.setTreatmentDurationDays(treatmentDuration);
        summary.setTreatmentGapDays(totalGapDays);

        // Completeness
        int completenessScore = calculateCompletenessScore(records, providerSummary);
        summary.setCompletenessScore(completenessScore);
        summary.setCompletenessNotes(generateCompletenessNotes(records, completenessScore));

        // Generation info
        summary.setGeneratedAt(LocalDateTime.now());
        summary.setGeneratedByModel("claude-sonnet-4-6");
        summary.setLastRecordDate(lastDate);
        summary.setIsStale(false);

        PIMedicalSummary saved = summaryRepository.save(summary);
        log.info("Medical summary generated with completeness score: {}%", completenessScore);

        return mapToDTO(saved);
    }

    @Override
    public boolean isSummaryCurrent(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return summaryRepository.findByCaseIdAndOrganizationId(caseId, orgId)
                .map(summary -> !Boolean.TRUE.equals(summary.getIsStale()))
                .orElse(false);
    }

    @Override
    public String getTreatmentChronology(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return summaryRepository.findByCaseIdAndOrganizationId(caseId, orgId)
                .map(PIMedicalSummary::getTreatmentChronology)
                .orElse(null);
    }

    @Override
    public List<Map<String, Object>> getProviderSummary(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return summaryRepository.findByCaseIdAndOrganizationId(caseId, orgId)
                .map(PIMedicalSummary::getProviderSummary)
                .orElse(Collections.emptyList());
    }

    @Override
    public List<Map<String, Object>> getDiagnosisList(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return summaryRepository.findByCaseIdAndOrganizationId(caseId, orgId)
                .map(PIMedicalSummary::getDiagnosisList)
                .orElse(Collections.emptyList());
    }

    @Override
    public List<Map<String, Object>> getRedFlags(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return summaryRepository.findByCaseIdAndOrganizationId(caseId, orgId)
                .map(PIMedicalSummary::getRedFlags)
                .orElse(Collections.emptyList());
    }

    @Override
    public List<Map<String, Object>> getMissingRecords(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return summaryRepository.findByCaseIdAndOrganizationId(caseId, orgId)
                .map(PIMedicalSummary::getMissingRecords)
                .orElse(Collections.emptyList());
    }

    @Override
    public String getPrognosisAssessment(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return summaryRepository.findByCaseIdAndOrganizationId(caseId, orgId)
                .map(PIMedicalSummary::getPrognosisAssessment)
                .orElse(null);
    }

    @Override
    public Map<String, Object> getCompletenessMetrics(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        PIMedicalSummary summary = summaryRepository.findByCaseIdAndOrganizationId(caseId, orgId)
                .orElse(null);

        Map<String, Object> metrics = new HashMap<>();
        if (summary != null) {
            metrics.put("completenessScore", summary.getCompletenessScore());
            metrics.put("completenessNotes", summary.getCompletenessNotes());
            metrics.put("totalProviders", summary.getTotalProviders());
            metrics.put("totalVisits", summary.getTotalVisits());
            metrics.put("totalBilled", summary.getTotalBilled());
            metrics.put("treatmentDurationDays", summary.getTreatmentDurationDays());
            metrics.put("treatmentGapDays", summary.getTreatmentGapDays());
            metrics.put("isStale", summary.getIsStale());
            metrics.put("lastGenerated", summary.getGeneratedAt());
        }
        return metrics;
    }

    @Override
    public List<Map<String, Object>> analyzeTreatmentGaps(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        List<PIMedicalRecord> records = recordRepository
                .findByCaseIdAndOrganizationIdOrderByTreatmentDateAsc(caseId, orgId);
        return analyzeTreatmentGapsInternal(records);
    }

    @Override
    public Map<String, Object> generateAdjusterDefenseAnalysis(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Generating adjuster defense analysis for case: {} in org: {}", caseId, orgId);

        List<PIMedicalRecord> records = recordRepository
                .findByCaseIdAndOrganizationIdOrderByTreatmentDateAsc(caseId, orgId);

        if (records.isEmpty()) {
            throw new IllegalStateException("No medical records found to analyze");
        }

        // Build context from records
        StringBuilder recordsSummary = new StringBuilder();
        for (PIMedicalRecord r : records) {
            recordsSummary.append(String.format(
                    "- %s | %s | %s | Billed: $%s | Findings: %s\n",
                    r.getTreatmentDate() != null ? r.getTreatmentDate().toString() : "No date",
                    r.getProviderName(),
                    r.getRecordType(),
                    r.getBilledAmount() != null ? r.getBilledAmount().toString() : "0",
                    r.getKeyFindings() != null ? r.getKeyFindings() : "None"
            ));
        }

        // Collect diagnoses
        List<String> allDiagnoses = new ArrayList<>();
        for (PIMedicalRecord r : records) {
            if (r.getDiagnoses() != null) {
                for (Map<String, Object> d : r.getDiagnoses()) {
                    String code = String.valueOf(d.getOrDefault("icd_code", ""));
                    String desc = String.valueOf(d.getOrDefault("description", ""));
                    if (!code.isEmpty()) allDiagnoses.add(code + " - " + desc);
                }
            }
        }

        // Get treatment gaps
        List<Map<String, Object>> gaps = analyzeTreatmentGapsInternal(records);

        String prompt = String.format("""
            You are an expert personal injury defense analyst. Analyze this case's medical records
            and predict how an insurance adjuster will attack the case value. For each attack vector,
            provide the issue, supporting evidence, and a specific counter-argument the plaintiff's
            attorney can use.

            MEDICAL RECORDS:
            %s

            DIAGNOSES:
            %s

            TREATMENT GAPS:
            %s

            ---

            Analyze for these attack vectors (include ALL that apply):
            1. TREATMENT_GAP - Gaps in treatment that suggest injuries resolved
            2. PRE_EXISTING - Pre-existing conditions or degenerative findings
            3. EXCESSIVE_TREATMENT - Arguably excessive number of visits or costs
            4. CAUSATION - Challenges linking injuries to the accident
            5. MISSING_DOCUMENTATION - Gaps in documentation that weaken the case
            6. BILLING_CONCERNS - Unusually high charges or duplicate billing

            Return a JSON array with this structure:
            {
              "attackVectors": [
                {
                  "type": "TREATMENT_GAP",
                  "severity": "HIGH",
                  "issue": "Description of what the adjuster will argue",
                  "evidence": "Specific facts from the records supporting this attack",
                  "counterArgument": "Specific counter-argument with legal doctrine and recommended action"
                }
              ]
            }

            Severity levels: HIGH (strong attack that could significantly reduce value),
            MEDIUM (moderate concern), LOW (minor issue).

            IMPORTANT:
            - Only include attack vectors that have actual evidence in the records
            - Counter-arguments must reference specific records, dates, or legal doctrines
            - Include actionable recommendations (e.g., "Request prior PCP records")
            - Be specific, not generic — reference actual provider names and dates

            Return ONLY the JSON, no additional text.
            """,
                recordsSummary.toString(),
                String.join("\n", allDiagnoses),
                gaps.toString()
        );

        try {
            String response = claudeService.generateCompletion(prompt, false).get();

            // Extract JSON
            int start = response.indexOf('{');
            int end = response.lastIndexOf('}');
            if (start >= 0 && end > start) {
                String json = response.substring(start, end + 1);
                @SuppressWarnings("unchecked")
                Map<String, Object> result = new com.fasterxml.jackson.databind.ObjectMapper()
                        .readValue(json, Map.class);
                result.put("generatedAt", LocalDateTime.now().toString());
                result.put("caseId", caseId);

                // Persist to database so it survives page navigation
                try {
                    Optional<PIMedicalSummary> summaryOpt = summaryRepository.findByCaseIdAndOrganizationId(caseId, orgId);
                    if (summaryOpt.isPresent()) {
                        PIMedicalSummary summary = summaryOpt.get();
                        summary.setAdjusterDefenseAnalysis(result);
                        summary.setAdjusterAnalysisGeneratedAt(LocalDateTime.now());
                        summaryRepository.save(summary);
                        log.info("Adjuster defense analysis persisted to DB for case: {}", caseId);
                    }
                } catch (Exception saveErr) {
                    log.warn("Failed to persist adjuster analysis (non-fatal): {}", saveErr.getMessage());
                }

                return result;
            }

            throw new RuntimeException("Failed to parse AI response for adjuster analysis");

        } catch (Exception e) {
            log.error("Error generating adjuster defense analysis: {}", e.getMessage());
            throw new RuntimeException("Failed to generate adjuster defense analysis: " + e.getMessage());
        }
    }

    public Map<String, Object> getSavedAdjusterAnalysis(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        Optional<PIMedicalSummary> summaryOpt = summaryRepository.findByCaseIdAndOrganizationId(caseId, orgId);
        if (summaryOpt.isPresent() && summaryOpt.get().getAdjusterDefenseAnalysis() != null) {
            return summaryOpt.get().getAdjusterDefenseAnalysis();
        }
        return null;
    }

    @Override
    public void deleteMedicalSummary(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting medical summary for case: {}", caseId);
        summaryRepository.deleteByCaseIdAndOrganizationId(caseId, orgId);
    }

    // Helper methods

    private List<Map<String, Object>> buildProviderSummary(Long caseId, Long orgId) {
        List<Object[]> results = recordRepository.getProviderSummary(caseId, orgId);
        return results.stream().map(row -> {
            Map<String, Object> summary = new HashMap<>();
            summary.put("providerName", row[0]);
            summary.put("providerType", row[1]);
            summary.put("visitCount", row[2]);
            summary.put("totalBilled", row[3]);
            summary.put("firstVisit", row[4]);
            summary.put("lastVisit", row[5]);
            return summary;
        }).collect(Collectors.toList());
    }

    private List<Map<String, Object>> collectDiagnoses(List<PIMedicalRecord> records) {
        Map<String, Map<String, Object>> uniqueDiagnoses = new HashMap<>();

        for (PIMedicalRecord record : records) {
            if (record.getDiagnoses() != null) {
                for (Map<String, Object> diagnosis : record.getDiagnoses()) {
                    String icdCode = (String) diagnosis.get("icd_code");
                    if (icdCode != null && !uniqueDiagnoses.containsKey(icdCode)) {
                        Map<String, Object> diagEntry = new HashMap<>(diagnosis);
                        diagEntry.put("firstDocumented", record.getTreatmentDate());
                        diagEntry.put("provider", record.getProviderName());
                        uniqueDiagnoses.put(icdCode, diagEntry);
                    }
                }
            }
        }

        return new ArrayList<>(uniqueDiagnoses.values());
    }

    /**
     * Detect treatment gaps using interval-merge over [treatmentDate, treatmentEndDate].
     *
     * The naive sequential approach (prev.endDate vs next.startDate ordered by startDate)
     * mis-flags single-day records that fall WITHIN a long-running multi-DOS record's
     * span as gaps. Example: Team Rehab record [11/11/2025, 03/26/2026] absorbs an
     * imaging visit on 12/27/2025 and an ortho visit on 03/05/2026; the old algorithm
     * would still flag a 68-day gap between the imaging and ortho records because it
     * had already moved past Team Rehab in the sorted iteration.
     *
     * Interval merge solves this: build [start, end] per record (end defaults to start),
     * sort by start, merge overlapping/adjacent intervals (within 1 day), then flag
     * gaps > 30 days between the merged intervals.
     */
    private List<Map<String, Object>> analyzeTreatmentGapsInternal(List<PIMedicalRecord> records) {
        List<Interval> intervals = records.stream()
                .filter(r -> !"INSURANCE_LEDGER".equals(r.getRecordType()))
                .filter(r -> r.getTreatmentDate() != null)
                .map(r -> {
                    LocalDate start = r.getTreatmentDate();
                    LocalDate end = (r.getTreatmentEndDate() != null && !r.getTreatmentEndDate().isBefore(start))
                            ? r.getTreatmentEndDate() : start;
                    String provider = r.getProviderName() == null ? "Unknown" : r.getProviderName();
                    return new Interval(start, end, provider);
                })
                .sorted(Comparator.comparing(iv -> iv.start))
                .collect(Collectors.toCollection(ArrayList::new));

        if (intervals.size() < 2) {
            return new ArrayList<>();
        }

        List<Interval> merged = new ArrayList<>();
        Interval current = intervals.get(0);
        for (int i = 1; i < intervals.size(); i++) {
            Interval next = intervals.get(i);
            if (!next.start.isAfter(current.end.plusDays(1))) {
                if (next.end.isAfter(current.end)) {
                    current.end = next.end;
                    current.endProvider = next.endProvider;
                }
            } else {
                merged.add(current);
                current = next;
            }
        }
        merged.add(current);

        List<Map<String, Object>> gaps = new ArrayList<>();
        for (int i = 1; i < merged.size(); i++) {
            Interval prev = merged.get(i - 1);
            Interval next = merged.get(i);
            long gapDays = ChronoUnit.DAYS.between(prev.end, next.start);
            if (gapDays > 30) {
                Map<String, Object> gap = new HashMap<>();
                gap.put("gapStart", prev.end);
                gap.put("gapEnd", next.start);
                gap.put("gapDays", (int) gapDays);
                gap.put("previousProvider", prev.endProvider);
                gap.put("nextProvider", next.startProvider);
                gap.put("severity", gapDays > 60 ? "HIGH" : "MEDIUM");
                gaps.add(gap);
            }
        }
        return gaps;
    }

    private static final class Interval {
        LocalDate start;
        LocalDate end;
        final String startProvider;
        String endProvider;

        Interval(LocalDate start, LocalDate end, String provider) {
            this.start = start;
            this.end = end;
            this.startProvider = provider;
            this.endProvider = provider;
        }
    }

    /**
     * Tier 4 — derive a phase-organized chronology from the records.
     * Sends the records (excluding INSURANCE_LEDGER) to the AI with instructions to
     * group them into clinical phases (Acute, Initial follow-up, Conservative
     * treatment, Specialist referral, etc.) with a rationale for each phase.
     *
     * Returns null on any failure — the rest of the summary regen still completes.
     * Output shape: [{phase, phaseRationale, startDate, endDate, recordIds: [...]}]
     */
    private List<Map<String, Object>> generatePhasedChronology(List<PIMedicalRecord> records) {
        List<PIMedicalRecord> clinicalRecords = records.stream()
                .filter(r -> !"INSURANCE_LEDGER".equals(r.getRecordType()))
                .filter(r -> r.getTreatmentDate() != null)
                .sorted(Comparator.comparing(PIMedicalRecord::getTreatmentDate))
                .toList();

        if (clinicalRecords.size() < 2) {
            // Phasing isn't meaningful with 0-1 records; skip silently
            return null;
        }

        StringBuilder recordsBlock = new StringBuilder();
        for (PIMedicalRecord r : clinicalRecords) {
            String findings = r.getKeyFindings() == null ? "" : r.getKeyFindings();
            if (findings.length() > 200) findings = findings.substring(0, 200);
            recordsBlock.append(String.format("- id=%d | %s | %s (%s) | %s | %s%n",
                    r.getId(),
                    r.getTreatmentDate(),
                    r.getProviderName(),
                    r.getTreatingClinician() == null ? "" : r.getTreatingClinician(),
                    r.getRecordType(),
                    findings.replace("\n", " ").replace("|", "/")));
        }

        String prompt = String.format("""
            You are a personal-injury case-strategy analyst writing for the attorney
            handling this case. The phaseRationale text you produce will be displayed
            verbatim on the demand-package summary the attorney shows to insurance
            adjusters and (if needed) jurors. Write like a senior paralegal — clinical,
            confident, and plainly readable. No internal database language.

            Given the chronological list of medical records below, group them into
            CLINICAL PHASES with rationale paragraphs.

            Pick phase names that fit the actual treatment arc — common patterns include:
              "Acute" — initial post-MVA encounter (ED visit, immediate evaluation)
              "Initial follow-up" — first specialist evaluations / treatment plan setup
              "Conservative treatment" — ongoing PT/chiro/routine visits, possibly with imaging
              "Specialist referral" — orthopedic / neurology consults when conservative care plateaus
              "MRI / imaging workup" — diagnostic phase if imaging clusters
              "Post-treatment" / "Records compilation" — final visits + documentation finalization
            But DON'T force a 5-phase structure if the records don't support it. A short
            case may have just 2 phases. A long stalled case may have a "Pause / gap" phase.

            For each phase return:
              - phase: short name (e.g., "Acute", "Conservative treatment")
              - phaseRationale: 2-3 sentences of ATTORNEY-FACING NARRATIVE PROSE explaining
                what the encounters in this phase represent clinically, and the case-strategy
                significance (causation, treatment necessity, plateau before imaging, etc.).
                Refer to encounters by DATE and PROVIDER NAME. NEVER use phrasings like
                "Record 95", "Records 95 and 96", "Record id=100", "record IDs", or any
                reference to the internal id numbers shown in the RECORDS block below.
                The attorney never sees those IDs; mentioning them looks like a system
                glitch and undermines credibility.
              - startDate: YYYY-MM-DD of earliest record in this phase
              - endDate: YYYY-MM-DD of latest record in this phase
              - recordIds: array of the id= numbers from the RECORDS block that belong to
                this phase. This field is for internal grouping ONLY and is not shown to
                the attorney. Always include it, but do NOT reference these numbers in
                phaseRationale prose.

            GOOD rationale (attorney-facing, no IDs):
              "Initial emergency department evaluation at Cambridge Health Alliance on
               11/06/2025, with cervical and lumbar strain documented after a high-speed
               MVC. The ED course establishes the causal nexus to the accident and rules
               out emergent pathology, anchoring the mechanism narrative for the demand."

            BAD rationale (DO NOT WRITE THIS WAY):
              "Records 95 and 96 document the initial ED presentation..."
              "Record id=100 covers the conservative-treatment phase..."

            RECORDS:
            %s

            Return ONLY a JSON array — no prose, no markdown fence. Example:
            [
              {"phase": "Acute", "phaseRationale": "...", "startDate": "2025-11-06",
               "endDate": "2025-11-06", "recordIds": [12]},
              {"phase": "Conservative treatment", "phaseRationale": "...",
               "startDate": "2025-11-11", "endDate": "2025-12-22", "recordIds": [13,14,15]}
            ]
            """, recordsBlock);

        try {
            String response = claudeService.generateCompletionWithModel(
                    prompt, null, false, null, null, "claude-sonnet-4-6").get();
            // Strip code fences if AI added them despite instruction
            String json = response.trim();
            int firstBracket = json.indexOf('[');
            int lastBracket = json.lastIndexOf(']');
            if (firstBracket < 0 || lastBracket <= firstBracket) {
                log.warn("Phased chronology AI response missing JSON array — skipping");
                return null;
            }
            json = json.substring(firstBracket, lastBracket + 1);
            List<Map<String, Object>> phases = objectMapper.readValue(json,
                    new TypeReference<List<Map<String, Object>>>() {});
            // Defensive: strip internal record-ID references that may have leaked into
            // the attorney-facing rationale prose despite explicit prompt warnings.
            phases.forEach(p -> {
                Object r = p.get("phaseRationale");
                if (r instanceof String s) {
                    p.put("phaseRationale", sanitizePhaseRationale(s));
                }
            });
            log.info("Generated {} treatment phases from {} clinical records",
                    phases.size(), clinicalRecords.size());
            return phases;
        } catch (Exception e) {
            log.warn("Failed to generate phased chronology — leaving null: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Strip internal record-ID phrasings that may have leaked into the AI's
     * attorney-facing rationale prose. Patterns covered:
     *   "Records 95 and 96"      "Record 97"
     *   "record id=100"          "Record IDs 95, 96, 100"
     *   "Records 95-100"
     * Replacement is a neutral phrase ("the encounter(s)") so the surrounding
     * sentence still reads naturally. If the AI followed the prompt this is a no-op.
     */
    private String sanitizePhaseRationale(String s) {
        if (s == null || s.isBlank()) return s;
        String out = s;
        // "Record id=100" or "record id = 100"
        out = out.replaceAll("(?i)\\brecord\\s+id\\s*=\\s*\\d+\\b", "the encounter");
        // "Records 95 and 96" / "Records 95, 96, 100" / "Records 95-100"
        out = out.replaceAll(
                "(?i)\\brecords?\\s+\\d+(?:\\s*(?:,\\s*|\\s+and\\s+|\\s*[-–]\\s*)\\d+)+\\b",
                "the encounters");
        // Singular trailing pattern: "Record 97"
        out = out.replaceAll("(?i)\\brecords?\\s+\\d+\\b", "the encounter");
        // Collapse any double spaces / leading-comma artifacts
        out = out.replaceAll("\\s{2,}", " ").replaceAll("\\s+,", ",").trim();
        return out;
    }

    private Map<String, Object> generateAIAnalysis(List<PIMedicalRecord> records,
                                                    List<Map<String, Object>> providers,
                                                    List<Map<String, Object>> diagnoses) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("""
            You are a medical records analyst for a personal injury law firm.
            Analyze the following medical treatment history and provide your analysis in the EXACT format below.

            IMPORTANT: Use these EXACT section headers with a colon, then provide the content on the same or following lines.
            Do NOT include the section name in the content itself.

            KEY_HIGHLIGHTS:
            [Write 2-3 sentences about the most important clinical findings - injuries sustained, severity, and treatment received]

            RED_FLAGS:
            [List any concerning issues as bullet points with - prefix. Include treatment gaps, inconsistencies, pre-existing condition mentions, or documentation weaknesses]

            PROGNOSIS:
            [Write 2-3 sentences about the recovery status, future treatment needs, and likelihood of permanent impairment or ongoing symptoms]

            CAUSATION:
            [Write 1-2 sentences about how the documented injuries relate to the accident]

            TREATMENT HISTORY:
            """);

        for (PIMedicalRecord record : records) {
            prompt.append(String.format("\n- %s | %s | %s",
                    record.getTreatmentDate(),
                    record.getProviderName(),
                    record.getRecordType()));
            if (record.getKeyFindings() != null) {
                prompt.append(" | Findings: ").append(record.getKeyFindings());
            }
        }

        prompt.append("\n\nDIAGNOSES:\n");
        for (Map<String, Object> diag : diagnoses) {
            prompt.append(String.format("- %s: %s\n",
                    diag.get("icd_code"),
                    diag.get("description")));
        }

        Map<String, Object> result = new HashMap<>();
        try {
            String response = claudeService.generateCompletion(prompt.toString(), false).get();

            // Parse response sections
            result.put("fullAnalysis", response);
            result.put("keyHighlights", extractSection(response, "KEY_HIGHLIGHTS", "RED_FLAGS"));
            result.put("prognosis", extractSection(response, "PROGNOSIS", "CAUSATION"));
            result.put("rawRedFlags", extractSection(response, "RED_FLAGS", "PROGNOSIS"));
            result.put("causation", extractSection(response, "CAUSATION", null));

        } catch (Exception e) {
            log.error("Error generating AI analysis: ", e);
            result.put("error", e.getMessage());
        }

        return result;
    }

    /**
     * Extract content between a section header and the next section (or end of text)
     * @param response The full AI response
     * @param sectionName The section to extract (e.g., "KEY_HIGHLIGHTS")
     * @param nextSectionName The next section name to stop at (or null to go to end)
     * @return The extracted content, cleaned of the section header
     */
    private String extractSection(String response, String sectionName, String nextSectionName) {
        if (response == null || response.isEmpty()) return "";

        // Find section start - look for various formats
        int start = -1;
        String[] possibleHeaders = {
            sectionName + ":",
            sectionName + " :",
            "**" + sectionName + "**:",
            "**" + sectionName + ":**",
            sectionName,
            sectionName.toLowerCase() + ":",
            sectionName.replace("_", " ") + ":"
        };

        for (String header : possibleHeaders) {
            int idx = response.indexOf(header);
            if (idx != -1) {
                start = idx;
                break;
            }
        }

        if (start == -1) return "";

        // Find section end
        int end = response.length();
        if (nextSectionName != null) {
            // Look for next section
            String[] nextHeaders = {
                nextSectionName + ":",
                nextSectionName + " :",
                "**" + nextSectionName + "**:",
                "**" + nextSectionName + ":**",
                "\n" + nextSectionName,
                nextSectionName.replace("_", " ") + ":"
            };

            for (String header : nextHeaders) {
                int idx = response.indexOf(header, start + sectionName.length());
                if (idx != -1 && idx < end) {
                    end = idx;
                }
            }
        }

        // Extract and clean content
        String content = response.substring(start, end);

        // Remove the section header itself
        for (String header : possibleHeaders) {
            content = content.replace(header, "");
        }

        // Clean up whitespace and newlines
        content = content.trim();

        // Remove leading newlines but keep paragraph structure
        while (content.startsWith("\n")) {
            content = content.substring(1);
        }

        return content.trim();
    }

    private List<Map<String, Object>> extractRedFlags(Map<String, Object> aiAnalysis) {
        List<Map<String, Object>> redFlags = new ArrayList<>();

        String rawFlags = (String) aiAnalysis.get("rawRedFlags");
        if (rawFlags != null && !rawFlags.isEmpty()) {
            // Parse bullet points
            String[] lines = rawFlags.split("\n");
            for (String line : lines) {
                line = line.trim();
                if (line.startsWith("-") || line.startsWith("•")) {
                    Map<String, Object> flag = new HashMap<>();
                    flag.put("description", line.substring(1).trim());
                    flag.put("severity", determineSeverity(line));
                    redFlags.add(flag);
                }
            }
        }

        return redFlags;
    }

    private String determineSeverity(String text) {
        text = text.toLowerCase();
        if (text.contains("significant") || text.contains("major") || text.contains("severe")) {
            return "HIGH";
        } else if (text.contains("minor") || text.contains("slight")) {
            return "LOW";
        }
        return "MEDIUM";
    }

    private List<Map<String, Object>> detectMissingRecords(List<PIMedicalRecord> records) {
        List<Map<String, Object>> missing = new ArrayList<>();

        // Check for common missing scenarios
        Set<String> providerTypes = records.stream()
                .map(PIMedicalRecord::getProviderType)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // If there are specialist visits but no imaging
        if ((providerTypes.contains("Orthopedics") || providerTypes.contains("Neurology")) &&
                !providerTypes.contains("Radiology")) {
            Map<String, Object> missingImaging = new HashMap<>();
            missingImaging.put("type", "Imaging Records");
            missingImaging.put("reason", "Specialist visits without corresponding imaging records");
            missingImaging.put("priority", "HIGH");
            missing.add(missingImaging);
        }

        // Check for referenced but not obtained records
        for (PIMedicalRecord record : records) {
            if (record.getFollowUpRecommendations() != null) {
                String rec = record.getFollowUpRecommendations().toLowerCase();
                if (rec.contains("referred to") || rec.contains("recommend seeing")) {
                    Map<String, Object> referral = new HashMap<>();
                    referral.put("type", "Referral Follow-up");
                    referral.put("reason", "Referral mentioned in " + record.getProviderName() + " notes");
                    referral.put("priority", "MEDIUM");
                    missing.add(referral);
                }
            }
        }

        return missing;
    }

    private String buildChronology(List<PIMedicalRecord> records) {
        StringBuilder chronology = new StringBuilder();
        chronology.append("| Date | Provider / Clinician | Type | Key Detail |\n");
        chronology.append("|------|----------------------|------|-----------|\n");

        // Exclude insurance ledgers (PIP logs / EOBs) — they're not clinical encounters and
        // their treatmentDate is null by design, which would render as "null" in the chronology.
        List<PIMedicalRecord> chronicleRecords = records.stream()
                .filter(r -> !"INSURANCE_LEDGER".equals(r.getRecordType()))
                .toList();

        for (PIMedicalRecord record : chronicleRecords) {
            String providerCell = formatProviderCell(record);
            String detailCell = formatDetailCell(record);

            chronology.append(String.format("| %s | %s | %s | %s |\n",
                    record.getTreatmentDate(),
                    providerCell,
                    record.getRecordType(),
                    detailCell));
        }

        return chronology.toString();
    }

    /** Provider cell: facility name + clinician name when available (e.g., "Team Rehab — DC Ian Giuttari"). */
    private String formatProviderCell(PIMedicalRecord record) {
        String facility = record.getProviderName() == null ? "" : record.getProviderName().replace("|", "/");
        String clinician = record.getTreatingClinician();
        if (clinician != null && !clinician.isBlank()) {
            return facility + " — " + clinician.replace("|", "/");
        }
        return facility;
    }

    /**
     * Compact inline rendering of clinical detail for the chronology row.
     * Combines key findings + vitals + ROM + special tests + medications into a single
     * pipe-safe cell, capped at 400 chars to keep the table renderable. Full detail
     * available on the record's API response for the future detail-pane UI.
     */
    private String formatDetailCell(PIMedicalRecord record) {
        List<String> parts = new ArrayList<>();

        if (record.getVitals() != null && !record.getVitals().isEmpty()) {
            parts.add("Vitals " + formatVitals(record.getVitals()));
        }
        if (record.getRangeOfMotion() != null && !record.getRangeOfMotion().isEmpty()) {
            parts.add("ROM " + formatRangeOfMotion(record.getRangeOfMotion()));
        }
        if (record.getSpecialTests() != null && !record.getSpecialTests().isEmpty()) {
            parts.add(formatSpecialTests(record.getSpecialTests()));
        }
        if (record.getKeyFindings() != null && !record.getKeyFindings().isBlank()) {
            parts.add(record.getKeyFindings().trim());
        }
        if (record.getMedicationsAdministered() != null && !record.getMedicationsAdministered().isEmpty()) {
            parts.add("Meds given: " + formatMedications(record.getMedicationsAdministered()));
        }
        if (record.getMedicationsPrescribed() != null && !record.getMedicationsPrescribed().isEmpty()) {
            parts.add("Rx: " + formatMedications(record.getMedicationsPrescribed()));
        }

        if (parts.isEmpty()) return "-";

        String combined = String.join("; ", parts).replace("|", "/").replace("\n", " ");
        // Cap at 400 chars so rendered tables stay manageable; long detail lives on the record itself
        return combined.length() > 400 ? combined.substring(0, 397) + "..." : combined;
    }

    private String formatVitals(Map<String, Object> v) {
        List<String> bits = new ArrayList<>();
        if (v.get("bp") != null) bits.add("BP " + v.get("bp"));
        if (v.get("hr") != null) bits.add("HR " + v.get("hr"));
        if (v.get("pain") != null) bits.add("pain " + v.get("pain"));
        if (v.get("bmi") != null) bits.add("BMI " + v.get("bmi"));
        if (v.get("temp_f") != null) bits.add("T " + v.get("temp_f") + "°F");
        if (v.get("spo2") != null) bits.add("SpO2 " + v.get("spo2") + "%");
        return String.join(" ", bits);
    }

    @SuppressWarnings("unchecked")
    private String formatRangeOfMotion(Map<String, Object> rom) {
        List<String> bits = new ArrayList<>();
        for (Map.Entry<String, Object> region : rom.entrySet()) {
            if (region.getValue() instanceof Map<?, ?> measurements && !measurements.isEmpty()) {
                List<String> motionBits = new ArrayList<>();
                ((Map<String, Object>) measurements).forEach((motion, deg) -> motionBits.add(motion + " " + deg));
                bits.add(region.getKey() + " " + String.join("/", motionBits) + "°");
            }
        }
        return String.join("; ", bits);
    }

    private String formatSpecialTests(List<Map<String, Object>> tests) {
        return tests.stream()
                .map(t -> {
                    String result = String.valueOf(t.getOrDefault("result", "")).toLowerCase();
                    String prefix = result.startsWith("pos") ? "(+)" : result.startsWith("neg") ? "(−)" : "";
                    String side = String.valueOf(t.getOrDefault("side", ""));
                    String name = String.valueOf(t.getOrDefault("name", ""));
                    StringBuilder s = new StringBuilder(prefix);
                    if (!side.isBlank() && !"null".equals(side)) s.append(" ").append(side);
                    if (!name.isBlank() && !"null".equals(name)) s.append(" ").append(name);
                    return s.toString().trim();
                })
                .collect(Collectors.joining(", "));
    }

    private String formatMedications(List<Map<String, Object>> meds) {
        return meds.stream()
                .map(m -> {
                    String name = String.valueOf(m.getOrDefault("name", ""));
                    String dose = String.valueOf(m.getOrDefault("dose", ""));
                    return (dose.isBlank() || "null".equals(dose)) ? name : name + " " + dose;
                })
                .collect(Collectors.joining(", "));
    }

    private int calculateCompletenessScore(List<PIMedicalRecord> records, List<Map<String, Object>> providers) {
        int score = 0;

        // Has at least 3 medical visits
        if (records.size() >= 3) score += 20;
        else if (records.size() >= 1) score += 10;

        // Has diagnoses documented
        long recordsWithDiagnoses = records.stream()
                .filter(r -> r.getDiagnoses() != null && !r.getDiagnoses().isEmpty())
                .count();
        if (recordsWithDiagnoses == records.size()) score += 25;
        else if (recordsWithDiagnoses > 0) score += 15;

        // Has billing information
        long recordsWithBilling = records.stream()
                .filter(r -> r.getBilledAmount() != null && r.getBilledAmount().compareTo(BigDecimal.ZERO) > 0)
                .count();
        if (recordsWithBilling == records.size()) score += 20;
        else if (recordsWithBilling > 0) score += 10;

        // Has multiple provider types
        long uniqueTypes = providers.stream()
                .map(p -> p.get("providerType"))
                .filter(Objects::nonNull)
                .distinct()
                .count();
        if (uniqueTypes >= 3) score += 20;
        else if (uniqueTypes >= 2) score += 15;
        else if (uniqueTypes >= 1) score += 10;

        // Has key findings documented
        long recordsWithFindings = records.stream()
                .filter(r -> r.getKeyFindings() != null && !r.getKeyFindings().isEmpty())
                .count();
        if (recordsWithFindings == records.size()) score += 15;
        else if (recordsWithFindings > 0) score += 10;

        return Math.min(100, score);
    }

    private String generateCompletenessNotes(List<PIMedicalRecord> records, int score) {
        List<String> notes = new ArrayList<>();

        if (score < 50) {
            notes.add("Medical documentation is incomplete. Consider obtaining additional records.");
        } else if (score < 75) {
            notes.add("Medical documentation is adequate but could be strengthened.");
        } else {
            notes.add("Medical documentation is comprehensive.");
        }

        long missingDiagnoses = records.stream()
                .filter(r -> r.getDiagnoses() == null || r.getDiagnoses().isEmpty())
                .count();
        if (missingDiagnoses > 0) {
            notes.add(String.format("%d records missing ICD-10 codes.", missingDiagnoses));
        }

        long missingBilling = records.stream()
                .filter(r -> r.getBilledAmount() == null || r.getBilledAmount().compareTo(BigDecimal.ZERO) == 0)
                .count();
        if (missingBilling > 0) {
            notes.add(String.format("%d records missing billing information.", missingBilling));
        }

        return String.join(" ", notes);
    }

    private PIMedicalSummaryDTO mapToDTO(PIMedicalSummary entity) {
        return PIMedicalSummaryDTO.builder()
                .id(entity.getId())
                .caseId(entity.getCaseId())
                .organizationId(entity.getOrganizationId())
                .treatmentChronology(entity.getTreatmentChronology())
                .phasedChronology(entity.getPhasedChronology())
                .providerSummary(entity.getProviderSummary())
                .diagnosisList(entity.getDiagnosisList())
                .redFlags(entity.getRedFlags())
                .missingRecords(entity.getMissingRecords())
                .keyHighlights(entity.getKeyHighlights())
                .prognosisAssessment(entity.getPrognosisAssessment())
                .totalProviders(entity.getTotalProviders())
                .totalVisits(entity.getTotalVisits())
                .totalBilled(entity.getTotalBilled())
                .treatmentDurationDays(entity.getTreatmentDurationDays())
                .treatmentGapDays(entity.getTreatmentGapDays())
                .completenessScore(entity.getCompletenessScore())
                .completenessNotes(entity.getCompletenessNotes())
                .generatedAt(entity.getGeneratedAt())
                .generatedByModel(entity.getGeneratedByModel())
                .lastRecordDate(entity.getLastRecordDate())
                .isStale(entity.getIsStale())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
