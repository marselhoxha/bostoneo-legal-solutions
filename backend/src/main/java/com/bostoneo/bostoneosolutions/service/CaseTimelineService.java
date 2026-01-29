package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.CaseTimelineDTO;
import com.bostoneo.bostoneosolutions.dto.CaseTimelineDTO.TimelinePhaseDTO;
import com.bostoneo.bostoneosolutions.model.CaseTimelineProgress;
import com.bostoneo.bostoneosolutions.model.CaseTimelineTemplate;
import com.bostoneo.bostoneosolutions.model.Client;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.CaseTimelineProgressRepository;
import com.bostoneo.bostoneosolutions.repository.CaseTimelineTemplateRepository;
import com.bostoneo.bostoneosolutions.repository.ClientRepository;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CaseTimelineService {

    private final CaseTimelineTemplateRepository templateRepository;
    private final CaseTimelineProgressRepository progressRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final ClientRepository clientRepository;
    private final NotificationService notificationService;
    private final TenantService tenantService;

    /**
     * Helper method to get the current organization ID (required for tenant isolation)
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    /**
     * Get the timeline for a specific case - TENANT FILTERED
     */
    public CaseTimelineDTO getCaseTimeline(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
                .orElseThrow(() -> new RuntimeException("Case not found: " + caseId));

        // Initialize timeline if not already done
        if (!Boolean.TRUE.equals(legalCase.getTimelineInitialized())) {
            initializeTimeline(caseId);
            // SECURITY: Use tenant-filtered query
            legalCase = legalCaseRepository.findByIdAndOrganizationId(caseId, orgId).orElseThrow();
        }

        // SECURITY: Use tenant-filtered query
        List<CaseTimelineProgress> progressList = progressRepository.findByOrganizationIdAndCaseIdOrderByPhaseOrderAsc(orgId, caseId);

        if (progressList.isEmpty()) {
            // Return empty timeline for case types without templates
            return buildEmptyTimeline(legalCase);
        }

        // Get template info for additional details
        String caseType = mapCaseTypeToTemplate(legalCase.getType());
        List<CaseTimelineTemplate> templates = templateRepository.findByCaseTypeOrderByPhaseOrderAsc(caseType);
        Map<Integer, CaseTimelineTemplate> templateMap = templates.stream()
                .collect(Collectors.toMap(CaseTimelineTemplate::getPhaseOrder, t -> t));

        // Build phase DTOs
        List<TimelinePhaseDTO> phases = new ArrayList<>();
        int currentPhaseOrder = legalCase.getCurrentTimelinePhase() != null ? legalCase.getCurrentTimelinePhase() : 1;
        int completedCount = 0;
        int skippedCount = 0;

        for (CaseTimelineProgress progress : progressList) {
            CaseTimelineTemplate template = templateMap.get(progress.getPhaseOrder());

            TimelinePhaseDTO phaseDTO = TimelinePhaseDTO.builder()
                    .id(progress.getId())
                    .phaseOrder(progress.getPhaseOrder())
                    .phaseName(progress.getPhaseName())
                    .phaseDescription(template != null ? template.getPhaseDescription() : null)
                    .status(progress.getStatus().name())
                    .icon(template != null ? template.getIcon() : "ri-checkbox-circle-line")
                    .color(template != null ? template.getColor() : "#405189")
                    .estimatedDurationDays(template != null ? template.getEstimatedDurationDays() : null)
                    .startedAt(progress.getStartedAt())
                    .completedAt(progress.getCompletedAt())
                    .notes(progress.getNotes())
                    .isCurrent(progress.getPhaseOrder().equals(currentPhaseOrder))
                    .build();

            // Calculate estimated completion date
            if (template != null && template.getEstimatedDurationDays() != null && progress.getStartedAt() != null) {
                phaseDTO.setEstimatedCompletionDate(
                        progress.getStartedAt().plusDays(template.getEstimatedDurationDays())
                );
            }

            if (progress.getStatus() == CaseTimelineProgress.TimelinePhaseStatus.COMPLETED) {
                completedCount++;
            } else if (progress.getStatus() == CaseTimelineProgress.TimelinePhaseStatus.SKIPPED) {
                skippedCount++;
            }

            phases.add(phaseDTO);
        }

        int totalPhases = progressList.size();
        // Include both completed and skipped phases in progress calculation
        int finishedPhases = completedCount + skippedCount;
        double progressPercentage = totalPhases > 0 ? (double) finishedPhases / totalPhases * 100 : 0;

        return CaseTimelineDTO.builder()
                .caseId(caseId)
                .caseNumber(legalCase.getCaseNumber())
                .caseTitle(legalCase.getTitle())
                .caseType(legalCase.getType())
                .caseStatus(legalCase.getStatus() != null ? legalCase.getStatus().name() : null)
                .currentPhase(currentPhaseOrder)
                .totalPhases(totalPhases)
                .completedPhases(completedCount)
                .skippedPhases(skippedCount)
                .progressPercentage(Math.round(progressPercentage * 100.0) / 100.0)
                .phases(phases)
                .build();
    }

    /**
     * Initialize timeline for a case based on its type - TENANT FILTERED
     */
    @Transactional
    public void initializeTimeline(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
                .orElseThrow(() -> new RuntimeException("Case not found: " + caseId));

        // Don't reinitialize if already done
        if (Boolean.TRUE.equals(legalCase.getTimelineInitialized())) {
            log.info("Timeline already initialized for case: {}", caseId);
            return;
        }

        // Map case type to template type
        String templateType = mapCaseTypeToTemplate(legalCase.getType());
        List<CaseTimelineTemplate> templates = templateRepository.findByCaseTypeOrderByPhaseOrderAsc(templateType);

        if (templates.isEmpty()) {
            log.warn("No timeline template found for case type: {}. Using default.", legalCase.getType());
            templates = createDefaultTimeline();
        }

        // Delete any existing progress (shouldn't exist but just in case)
        // SECURITY: Use tenant-filtered delete
        progressRepository.deleteByOrganizationIdAndCaseId(orgId, caseId);

        // Create progress entries for each phase
        for (CaseTimelineTemplate template : templates) {
            CaseTimelineProgress progress = CaseTimelineProgress.builder()
                    .caseId(caseId)
                    .organizationId(orgId)  // SECURITY: Set organization ID for tenant isolation
                    .phaseName(template.getPhaseName())
                    .phaseOrder(template.getPhaseOrder())
                    .status(template.getPhaseOrder() == 1 ?
                            CaseTimelineProgress.TimelinePhaseStatus.IN_PROGRESS :
                            CaseTimelineProgress.TimelinePhaseStatus.PENDING)
                    .startedAt(template.getPhaseOrder() == 1 ? LocalDateTime.now() : null)
                    .build();
            progressRepository.save(progress);
        }

        // Update case
        legalCase.setTimelineInitialized(true);
        legalCase.setCurrentTimelinePhase(1);
        legalCaseRepository.save(legalCase);

        log.info("Timeline initialized for case {} with {} phases", caseId, templates.size());
    }

    /**
     * Update the current phase of a case - TENANT FILTERED
     */
    @Transactional
    public CaseTimelineDTO updateCurrentPhase(Long caseId, Integer newPhaseOrder, String notes, Long updatedBy) {
        Long orgId = getRequiredOrganizationId();
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
                .orElseThrow(() -> new RuntimeException("Case not found: " + caseId));

        // Initialize if needed
        if (!Boolean.TRUE.equals(legalCase.getTimelineInitialized())) {
            initializeTimeline(caseId);
        }

        // SECURITY: Use tenant-filtered query
        List<CaseTimelineProgress> allPhases = progressRepository.findByOrganizationIdAndCaseIdOrderByPhaseOrderAsc(orgId, caseId);
        String newPhaseName = null;

        for (CaseTimelineProgress phase : allPhases) {
            if (phase.getPhaseOrder() < newPhaseOrder) {
                // Mark previous phases as completed
                if (phase.getStatus() != CaseTimelineProgress.TimelinePhaseStatus.COMPLETED &&
                    phase.getStatus() != CaseTimelineProgress.TimelinePhaseStatus.SKIPPED) {
                    phase.setStatus(CaseTimelineProgress.TimelinePhaseStatus.COMPLETED);
                    phase.setCompletedAt(LocalDateTime.now());
                    phase.setUpdatedBy(updatedBy);
                    progressRepository.save(phase);
                }
            } else if (phase.getPhaseOrder().equals(newPhaseOrder)) {
                // Set current phase as in progress
                phase.setStatus(CaseTimelineProgress.TimelinePhaseStatus.IN_PROGRESS);
                phase.setStartedAt(LocalDateTime.now());
                phase.setNotes(notes);
                phase.setUpdatedBy(updatedBy);
                progressRepository.save(phase);
                newPhaseName = phase.getPhaseName();
            } else {
                // Future phases remain pending
                if (phase.getStatus() == CaseTimelineProgress.TimelinePhaseStatus.IN_PROGRESS) {
                    phase.setStatus(CaseTimelineProgress.TimelinePhaseStatus.PENDING);
                    phase.setStartedAt(null);
                    progressRepository.save(phase);
                }
            }
        }

        // Update case current phase
        legalCase.setCurrentTimelinePhase(newPhaseOrder);
        legalCaseRepository.save(legalCase);

        // Send notification to client
        sendClientNotification(legalCase, "PHASE_CHANGED", newPhaseName, null);

        return getCaseTimeline(caseId);
    }

    /**
     * Mark a specific phase as completed
     */
    @Transactional
    public CaseTimelineDTO completePhase(Long caseId, Integer phaseOrder, String notes, Long updatedBy) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        CaseTimelineProgress phase = progressRepository.findByOrganizationIdAndCaseIdAndPhaseOrder(orgId, caseId, phaseOrder)
                .orElseThrow(() -> new RuntimeException("Phase not found"));

        // SECURITY: Use tenant-filtered query
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(caseId, orgId).orElseThrow();
        String completedPhaseName = phase.getPhaseName();

        phase.setStatus(CaseTimelineProgress.TimelinePhaseStatus.COMPLETED);
        phase.setCompletedAt(LocalDateTime.now());
        phase.setNotes(notes);
        phase.setUpdatedBy(updatedBy);
        progressRepository.save(phase);

        // Move to next phase if exists - SECURITY: Use tenant-filtered query
        Optional<CaseTimelineProgress> nextPhase = progressRepository.findByOrganizationIdAndCaseIdAndPhaseOrder(orgId, caseId, phaseOrder + 1);
        String nextPhaseName = null;
        if (nextPhase.isPresent()) {
            nextPhase.get().setStatus(CaseTimelineProgress.TimelinePhaseStatus.IN_PROGRESS);
            nextPhase.get().setStartedAt(LocalDateTime.now());
            progressRepository.save(nextPhase.get());

            legalCase.setCurrentTimelinePhase(phaseOrder + 1);
            legalCaseRepository.save(legalCase);
            nextPhaseName = nextPhase.get().getPhaseName();

            // Send notification for phase completion
            sendClientNotification(legalCase, "PHASE_COMPLETED", completedPhaseName, nextPhaseName);
        } else {
            // This was the last phase - close the case
            log.info("Last phase completed for case {}. Closing case.", caseId);
            legalCase.setStatus(com.bostoneo.bostoneosolutions.enumeration.CaseStatus.CLOSED);
            legalCase.setClosedDate(new java.util.Date());
            legalCaseRepository.save(legalCase);

            // Send notification that case is complete
            sendClientNotification(legalCase, "CASE_COMPLETED", completedPhaseName, null);
        }

        return getCaseTimeline(caseId);
    }

    /**
     * Skip a phase
     */
    @Transactional
    public CaseTimelineDTO skipPhase(Long caseId, Integer phaseOrder, String reason, Long updatedBy) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        CaseTimelineProgress phase = progressRepository.findByOrganizationIdAndCaseIdAndPhaseOrder(orgId, caseId, phaseOrder)
                .orElseThrow(() -> new RuntimeException("Phase not found"));

        // SECURITY: Use tenant-filtered query
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(caseId, orgId).orElseThrow();
        String skippedPhaseName = phase.getPhaseName();

        phase.setStatus(CaseTimelineProgress.TimelinePhaseStatus.SKIPPED);
        phase.setNotes(reason);
        phase.setUpdatedBy(updatedBy);
        progressRepository.save(phase);

        // Send notification to client
        sendClientNotification(legalCase, "PHASE_SKIPPED", skippedPhaseName, null);

        return getCaseTimeline(caseId);
    }

    /**
     * Get available timeline templates
     */
    public List<String> getAvailableCaseTypes() {
        return templateRepository.findDistinctCaseTypes();
    }

    /**
     * Get timeline template for a specific case type
     */
    public List<CaseTimelineTemplate> getTemplateForCaseType(String caseType) {
        return templateRepository.findByCaseTypeOrderByPhaseOrderAsc(caseType);
    }

    /**
     * Map case type from the case to a timeline template type.
     * Templates: Personal Injury, Medical Malpractice, Criminal Defense, Family Law,
     * Immigration, Real Estate, Estate, Employment, Bankruptcy, Tax,
     * Intellectual Property, Class Action, Contract, Corporate, Civil, Environmental, Business
     */
    private String mapCaseTypeToTemplate(String caseType) {
        if (caseType == null) return "Business";

        String normalized = caseType.toUpperCase().replace("_", " ").replace("-", " ");

        // Medical Malpractice (check before Personal Injury)
        if (normalized.contains("MEDICAL MALPRACTICE") || normalized.contains("SURGICAL NEGLIGENCE")) {
            return "Medical Malpractice";
        }
        // Personal Injury
        if (normalized.contains("PERSONAL INJURY") || normalized.contains("PI") ||
            normalized.contains("AUTO ACCIDENT") || normalized.contains("SLIP AND FALL")) {
            return "Personal Injury";
        }
        // Criminal Defense
        if (normalized.contains("CRIMINAL") || normalized.contains("DUI") ||
            normalized.contains("FELONY") || normalized.contains("MISDEMEANOR")) {
            return "Criminal Defense";
        }
        // Family Law
        if (normalized.contains("FAMILY") || normalized.contains("DIVORCE") ||
            normalized.contains("CUSTODY") || normalized.contains("CHILD SUPPORT") ||
            normalized.contains("DOMESTIC")) {
            return "Family Law";
        }
        // Immigration
        if (normalized.contains("IMMIGRATION") || normalized.contains("VISA") ||
            normalized.contains("CITIZENSHIP") || normalized.contains("ASYLUM") ||
            normalized.contains("REMOVAL DEFENSE")) {
            return "Immigration";
        }
        // Real Estate
        if (normalized.contains("REAL ESTATE") || normalized.contains("PROPERTY") ||
            normalized.contains("CLOSING") || normalized.contains("TITLE")) {
            return "Real Estate";
        }
        // Estate/Probate (but not Real Estate)
        if ((normalized.contains("ESTATE") && !normalized.contains("REAL ESTATE")) ||
            normalized.contains("PROBATE") || normalized.contains("TRUST") ||
            normalized.contains("WILL") || normalized.contains("ESTATE PLANNING")) {
            return "Estate";
        }
        // Employment
        if (normalized.contains("EMPLOYMENT") || normalized.contains("DISCRIMINATION") ||
            normalized.contains("WRONGFUL TERMINATION") || normalized.contains("TITLE VII") ||
            normalized.contains("MCAD") || normalized.contains("RETALIATION")) {
            return "Employment";
        }
        // Bankruptcy
        if (normalized.contains("BANKRUPTCY") || normalized.contains("CHAPTER 7") ||
            normalized.contains("CHAPTER 11") || normalized.contains("CHAPTER 13")) {
            return "Bankruptcy";
        }
        // Tax
        if (normalized.contains("TAX") || normalized.contains("IRS")) {
            return "Tax";
        }
        // Intellectual Property
        if (normalized.contains("INTELLECTUAL PROPERTY") || normalized.equals("IP") ||
            normalized.contains("TRADEMARK") || normalized.contains("PATENT") ||
            normalized.contains("COPYRIGHT") || normalized.contains("TRADE SECRET")) {
            return "Intellectual Property";
        }
        // Class Action
        if (normalized.contains("CLASS ACTION") || normalized.contains("QUI TAM") ||
            normalized.contains("FALSE CLAIMS")) {
            return "Class Action";
        }
        // Contract
        if (normalized.contains("CONTRACT") || normalized.contains("BREACH")) {
            return "Contract";
        }
        // Corporate
        if (normalized.contains("CORPORATE") || normalized.contains("MERGERS") ||
            normalized.contains("ACQUISITIONS") || normalized.contains("M&A")) {
            return "Corporate";
        }
        // Environmental
        if (normalized.contains("ENVIRONMENTAL") || normalized.contains("EPA") ||
            normalized.contains("POLLUTION") || normalized.contains("REMEDIATION")) {
            return "Environmental";
        }
        // Civil (general civil litigation)
        if (normalized.contains("CIVIL") || normalized.contains("CIVIL RIGHTS")) {
            return "Civil";
        }
        // Default to Business for anything else
        return "Business";
    }

    private CaseTimelineDTO buildEmptyTimeline(LegalCase legalCase) {
        return CaseTimelineDTO.builder()
                .caseId(legalCase.getId())
                .caseNumber(legalCase.getCaseNumber())
                .caseTitle(legalCase.getTitle())
                .caseType(legalCase.getType())
                .currentPhase(0)
                .totalPhases(0)
                .completedPhases(0)
                .progressPercentage(0.0)
                .phases(new ArrayList<>())
                .build();
    }

    private List<CaseTimelineTemplate> createDefaultTimeline() {
        // Return a generic default timeline
        List<CaseTimelineTemplate> defaults = new ArrayList<>();
        defaults.add(CaseTimelineTemplate.builder().phaseOrder(1).phaseName("Case Opened").phaseDescription("Initial case filing and documentation").icon("ri-file-text-line").color("#405189").build());
        defaults.add(CaseTimelineTemplate.builder().phaseOrder(2).phaseName("Investigation").phaseDescription("Gathering evidence and information").icon("ri-search-line").color("#3577f1").build());
        defaults.add(CaseTimelineTemplate.builder().phaseOrder(3).phaseName("Discovery").phaseDescription("Exchange of information between parties").icon("ri-folder-search-line").color("#299cdb").build());
        defaults.add(CaseTimelineTemplate.builder().phaseOrder(4).phaseName("Negotiation").phaseDescription("Settlement discussions").icon("ri-discuss-line").color("#f7b84b").build());
        defaults.add(CaseTimelineTemplate.builder().phaseOrder(5).phaseName("Resolution").phaseDescription("Final resolution or trial").icon("ri-checkbox-circle-line").color("#0ab39c").build());
        return defaults;
    }

    /**
     * Send notification to the client when case timeline changes
     */
    private void sendClientNotification(LegalCase legalCase, String actionType, String phaseName, String nextPhaseName) {
        try {
            // SECURITY: Find client by name within organization
            Long orgId = getRequiredOrganizationId();
            List<Client> clients = clientRepository.findByOrganizationIdAndNameIgnoreCase(orgId, legalCase.getClientName());

            if (clients.isEmpty()) {
                log.warn("No client found for case {} with client name: {}", legalCase.getId(), legalCase.getClientName());
                return;
            }

            Client client = clients.get(0);

            if (client.getUserId() == null) {
                log.warn("Client {} does not have a user account linked", client.getId());
                return;
            }

            String title;
            String body;
            String caseTitle = legalCase.getTitle();

            switch (actionType) {
                case "PHASE_COMPLETED":
                    title = "Case Progress Update";
                    if (nextPhaseName != null) {
                        body = String.format("Great news! The \"%s\" phase of your case \"%s\" has been completed. Your case is now in the \"%s\" phase.",
                            phaseName, caseTitle, nextPhaseName);
                    } else {
                        body = String.format("Great news! The \"%s\" phase of your case \"%s\" has been completed.",
                            phaseName, caseTitle);
                    }
                    break;
                case "PHASE_SKIPPED":
                    title = "Case Progress Update";
                    body = String.format("The \"%s\" phase of your case \"%s\" has been marked as not applicable and skipped.",
                        phaseName, caseTitle);
                    break;
                case "PHASE_CHANGED":
                    title = "Case Progress Update";
                    body = String.format("Your case \"%s\" has progressed to the \"%s\" phase.",
                        caseTitle, phaseName);
                    break;
                default:
                    title = "Case Update";
                    body = String.format("There has been an update to your case \"%s\".", caseTitle);
            }

            // Prepare notification data
            Map<String, Object> notificationData = new HashMap<>();
            notificationData.put("caseId", legalCase.getId());
            notificationData.put("caseNumber", legalCase.getCaseNumber());
            notificationData.put("url", "/client-portal/cases/" + legalCase.getId());

            // Send notification to client
            notificationService.sendCrmNotification(
                title,
                body,
                client.getUserId(),
                "CASE_TIMELINE_UPDATE",
                notificationData
            );

            log.info("Sent timeline notification to client {} for case {}: {}",
                client.getUserId(), legalCase.getId(), actionType);

        } catch (Exception e) {
            log.error("Failed to send timeline notification for case {}: {}", legalCase.getId(), e.getMessage(), e);
            // Don't throw - notification failure shouldn't break the timeline update
        }
    }
}
