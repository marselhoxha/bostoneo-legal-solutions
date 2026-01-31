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
        summary.setGeneratedByModel("claude-sonnet-4");
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

    private List<Map<String, Object>> analyzeTreatmentGapsInternal(List<PIMedicalRecord> records) {
        List<Map<String, Object>> gaps = new ArrayList<>();

        for (int i = 1; i < records.size(); i++) {
            LocalDate prevDate = records.get(i - 1).getTreatmentEndDate();
            if (prevDate == null) {
                prevDate = records.get(i - 1).getTreatmentDate();
            }
            LocalDate currDate = records.get(i).getTreatmentDate();

            long daysBetween = ChronoUnit.DAYS.between(prevDate, currDate);
            if (daysBetween > 30) { // Flag gaps > 30 days
                Map<String, Object> gap = new HashMap<>();
                gap.put("gapStart", prevDate);
                gap.put("gapEnd", currDate);
                gap.put("gapDays", (int) daysBetween);
                gap.put("previousProvider", records.get(i - 1).getProviderName());
                gap.put("nextProvider", records.get(i).getProviderName());
                gap.put("severity", daysBetween > 60 ? "HIGH" : "MEDIUM");
                gaps.add(gap);
            }
        }

        return gaps;
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
        chronology.append("| Date | Provider | Type | Key Finding |\n");
        chronology.append("|------|----------|------|-------------|\n");

        for (PIMedicalRecord record : records) {
            String keyFindings = record.getKeyFindings();
            String displayFindings = "-";
            if (keyFindings != null && !keyFindings.trim().isEmpty()) {
                // Truncate to 80 chars for readability, add ellipsis if needed
                displayFindings = keyFindings.length() > 80
                    ? keyFindings.substring(0, 77) + "..."
                    : keyFindings;
                // Replace pipe characters to avoid breaking table
                displayFindings = displayFindings.replace("|", "/");
            }

            chronology.append(String.format("| %s | %s | %s | %s |\n",
                    record.getTreatmentDate(),
                    record.getProviderName().replace("|", "/"),
                    record.getRecordType(),
                    displayFindings));
        }

        return chronology.toString();
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
