package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.model.Lead;
import com.bostoneo.bostoneosolutions.model.LeadActivity;
import com.bostoneo.bostoneosolutions.model.LeadPipelineHistory;
import com.bostoneo.bostoneosolutions.model.PipelineStage;
import com.bostoneo.bostoneosolutions.repository.LeadRepository;
import com.bostoneo.bostoneosolutions.repository.LeadActivityRepository;
import com.bostoneo.bostoneosolutions.repository.LeadPipelineHistoryRepository;
import com.bostoneo.bostoneosolutions.repository.PipelineStageRepository;
import com.bostoneo.bostoneosolutions.service.LeadService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.handler.AuthenticatedWebSocketHandler;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class LeadServiceImpl implements LeadService {

    private final LeadRepository leadRepository;
    private final LeadActivityRepository leadActivityRepository;
    private final LeadPipelineHistoryRepository leadPipelineHistoryRepository;
    private final PipelineStageRepository pipelineStageRepository;
    private final AuthenticatedWebSocketHandler webSocketHandler;
    private final NotificationService notificationService;
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    // Valid pipeline status transitions
    private static final Map<String, Set<String>> VALID_TRANSITIONS = Map.of(
        "NEW", Set.of("CONTACTED", "UNQUALIFIED", "LOST"),
        "CONTACTED", Set.of("QUALIFIED", "UNQUALIFIED", "LOST"),
        "QUALIFIED", Set.of("CONSULTATION_SCHEDULED", "UNQUALIFIED", "LOST"),
        "CONSULTATION_SCHEDULED", Set.of("PROPOSAL_SENT", "QUALIFIED", "UNQUALIFIED", "LOST"),
        "PROPOSAL_SENT", Set.of("NEGOTIATION", "CONVERTED", "LOST"),
        "NEGOTIATION", Set.of("CONVERTED", "PROPOSAL_SENT", "LOST"),
        "CONVERTED", Set.of(), // Final state
        "LOST", Set.of(), // Final state
        "UNQUALIFIED", Set.of() // Final state
    );

    @Override
    public Lead save(Lead lead) {
        return leadRepository.save(lead);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Lead> findById(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return leadRepository.findByIdAndOrganizationId(id, orgId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> findAll() {
        // Use tenant-filtered query - throw exception if no organization context
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> leadRepository.findByOrganizationId(orgId))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Lead> findAll(Pageable pageable) {
        // Use tenant-filtered query - throw exception if no organization context
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> leadRepository.findByOrganizationId(orgId, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public void deleteById(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify ownership before deletion
        if (!leadRepository.existsByIdAndOrganizationId(id, orgId)) {
            throw new RuntimeException("Lead not found or access denied: " + id);
        }
        leadRepository.deleteById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existsById(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return leadRepository.existsByIdAndOrganizationId(id, orgId);
    }

    @Override
    public Lead createLead(Lead lead, Long createdBy) {
        log.info("Creating new lead: {} {} by user: {}", lead.getFirstName(), lead.getLastName(), createdBy);
        
        // Set default values if not provided
        if (lead.getStatus() == null) lead.setStatus("NEW");
        if (lead.getSource() == null) lead.setSource("WEBSITE");
        if (lead.getPriority() == null) lead.setPriority("MEDIUM");
        if (lead.getLeadScore() == null) lead.setLeadScore(50);
        if (lead.getUrgencyLevel() == null) lead.setUrgencyLevel("MEDIUM");
        if (lead.getLeadQuality() == null) lead.setLeadQuality("UNKNOWN");
        if (lead.getCommunicationPreference() == null) lead.setCommunicationPreference("EMAIL");
        if (lead.getCaseComplexity() == null) lead.setCaseComplexity("MEDIUM");
        
        Lead savedLead = save(lead);
        
        // Add initial activity
        addActivity(savedLead.getId(), "LEAD_CREATED", "Lead Created", 
            "Lead was created from intake submission", createdBy);
        
        return savedLead;
    }

    @Override
    public Lead updateLead(Long id, Lead lead, Long userId) {
        log.info("Updating lead ID: {} by user: {}", id, userId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        Lead existing = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        // Update fields
        existing.setFirstName(lead.getFirstName());
        existing.setLastName(lead.getLastName());
        existing.setEmail(lead.getEmail());
        existing.setPhone(lead.getPhone());
        existing.setCompany(lead.getCompany());
        existing.setPracticeArea(lead.getPracticeArea());
        existing.setInitialInquiry(lead.getInitialInquiry());
        existing.setEstimatedCaseValue(lead.getEstimatedCaseValue());
        existing.setNotes(lead.getNotes());
        existing.setReferralSource(lead.getReferralSource());
        existing.setMarketingCampaign(lead.getMarketingCampaign());
        existing.setClientBudgetRange(lead.getClientBudgetRange());
        existing.setGeographicLocation(lead.getGeographicLocation());
        existing.setCommunicationPreference(lead.getCommunicationPreference());
        existing.setBestContactTime(lead.getBestContactTime());
        
        return save(existing);
    }

    @Override
    public Lead assignLead(Long id, Long assignedTo, Long assignedBy) {
        log.info("Assigning lead ID: {} to user: {} by user: {}", id, assignedTo, assignedBy);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        Lead lead = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        Long previousAssignee = lead.getAssignedTo();
        lead.setAssignedTo(assignedTo);
        
        Lead savedLead = save(lead);
        
        // Add activity
        String description = previousAssignee == null ? 
            "Lead assigned to attorney" : "Lead reassigned to new attorney";
        addActivity(id, "ASSIGNMENT", "Lead Assignment", description, assignedBy);
        
        // Send notification about lead assignment
        sendLeadAssignmentNotification(savedLead, assignedTo, assignedBy, previousAssignee == null);
        
        return savedLead;
    }

    @Override
    public Lead reassignLead(Long id, Long newAssignedTo, Long assignedBy, String reason) {
        log.info("Reassigning lead ID: {} to user: {} by user: {} for reason: {}", id, newAssignedTo, assignedBy, reason);
        
        Lead lead = assignLead(id, newAssignedTo, assignedBy);
        
        // Add specific reassignment activity
        addActivity(id, "REASSIGNMENT", "Lead Reassigned", 
            "Lead reassigned. Reason: " + reason, assignedBy);
        
        return lead;
    }

    @Override
    public Lead updateStatus(Long id, String newStatus, Long userId, String notes) {
        log.info("Updating lead ID: {} status to: {} by user: {}", id, newStatus, userId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        Lead lead = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        String oldStatus = lead.getStatus();
        
        if (!canTransitionToStatus(oldStatus, newStatus)) {
            throw new RuntimeException("Invalid status transition from " + oldStatus + " to " + newStatus);
        }
        
        lead.setStatus(newStatus);
        if ("CONVERTED".equals(newStatus)) {
            lead.setConvertedAt(new Timestamp(System.currentTimeMillis()));
        }
        
        Lead savedLead = save(lead);
        
        // Record pipeline history
        recordPipelineTransition(id, oldStatus, newStatus, userId, notes);
        
        // Add activity
        addActivity(id, "STATUS_CHANGE", "Status Updated", 
            "Status changed from " + oldStatus + " to " + newStatus + 
            (notes != null ? ". Notes: " + notes : ""), userId);
        
        // Send notification about status change
        sendLeadStatusChangeNotification(savedLead, oldStatus, newStatus, userId, notes);
        
        return savedLead;
    }

    @Override
    public Lead markAsContacted(Long id, Long userId, String contactMethod, String notes) {
        log.info("Marking lead ID: {} as contacted via {} by user: {}", id, contactMethod, userId);
        
        Lead lead = updateStatus(id, "CONTACTED", userId, notes);
        
        // Add specific contact activity
        addActivity(id, "CONTACT", "First Contact Made", 
            "Lead contacted via " + contactMethod + 
            (notes != null ? ". Notes: " + notes : ""), userId);
        
        return lead;
    }

    @Override
    public Lead markAsQualified(Long id, Long userId, String qualificationNotes) {
        log.info("Marking lead ID: {} as qualified by user: {}", id, userId);
        
        Lead lead = updateStatus(id, "QUALIFIED", userId, qualificationNotes);
        
        addActivity(id, "QUALIFICATION", "Lead Qualified", 
            "Lead has been qualified" + 
            (qualificationNotes != null ? ". Notes: " + qualificationNotes : ""), userId);
        
        return lead;
    }

    @Override
    public Lead scheduleConsultation(Long id, Timestamp consultationDate, Long userId, String notes) {
        log.info("Scheduling consultation for lead ID: {} on {} by user: {}", id, consultationDate, userId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        Lead lead = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        lead.setConsultationDate(consultationDate);
        lead = updateStatus(id, "CONSULTATION_SCHEDULED", userId, notes);
        
        addActivity(id, "CONSULTATION_SCHEDULED", "Consultation Scheduled", 
            "Consultation scheduled for " + consultationDate + 
            (notes != null ? ". Notes: " + notes : ""), userId);
        
        return lead;
    }

    @Override
    public Lead markProposalSent(Long id, Long userId, String proposalDetails) {
        log.info("Marking proposal sent for lead ID: {} by user: {}", id, userId);
        
        Lead lead = updateStatus(id, "PROPOSAL_SENT", userId, proposalDetails);
        
        addActivity(id, "PROPOSAL", "Proposal Sent", 
            "Legal proposal sent to client" + 
            (proposalDetails != null ? ". Details: " + proposalDetails : ""), userId);
        
        return lead;
    }

    @Override
    public Lead startNegotiation(Long id, Long userId, String negotiationNotes) {
        log.info("Starting negotiation for lead ID: {} by user: {}", id, userId);
        
        Lead lead = updateStatus(id, "NEGOTIATION", userId, negotiationNotes);
        
        addActivity(id, "NEGOTIATION", "Negotiation Started", 
            "Contract negotiation phase started" + 
            (negotiationNotes != null ? ". Notes: " + negotiationNotes : ""), userId);
        
        return lead;
    }

    @Override
    public Lead markAsConverted(Long id, Long userId, String conversionNotes) {
        log.info("Converting lead ID: {} by user: {}", id, userId);
        
        Lead lead = updateStatus(id, "CONVERTED", userId, conversionNotes);
        
        addActivity(id, "CONVERSION", "Lead Converted", 
            "Lead successfully converted to client" + 
            (conversionNotes != null ? ". Notes: " + conversionNotes : ""), userId);
        
        return lead;
    }

    @Override
    public Lead markAsLost(Long id, String lostReason, Long userId) {
        log.info("Marking lead ID: {} as lost by user: {} for reason: {}", id, userId, lostReason);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        Lead lead = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        lead.setLostReason(lostReason);
        lead = updateStatus(id, "LOST", userId, "Lead marked as lost: " + lostReason);
        
        return lead;
    }

    @Override
    public Lead markAsUnqualified(Long id, String unqualificationReason, Long userId) {
        log.info("Marking lead ID: {} as unqualified by user: {} for reason: {}", id, userId, unqualificationReason);
        
        Lead lead = updateStatus(id, "UNQUALIFIED", userId, "Lead unqualified: " + unqualificationReason);
        
        return lead;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> findByStatus(String status) {
        // Use tenant-filtered query - throw exception if no organization context
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> leadRepository.findByOrganizationIdAndStatus(orgId, status))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Lead> findByStatus(String status, Pageable pageable) {
        // Use tenant-filtered query - throw exception if no organization context
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> leadRepository.findByOrganizationIdAndStatus(orgId, status, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> findByPracticeArea(String practiceArea) {
        // SECURITY: Use tenant-filtered query
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> leadRepository.findByOrganizationIdAndPracticeArea(orgId, practiceArea))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Lead> findByPracticeArea(String practiceArea, Pageable pageable) {
        // SECURITY: Use tenant-filtered query
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> leadRepository.findByOrganizationIdAndPracticeArea(orgId, practiceArea, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> findByAssignedTo(Long assignedTo) {
        // SECURITY: Use tenant-filtered query
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> leadRepository.findByOrganizationIdAndAssignedTo(orgId, assignedTo))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Lead> findByAssignedTo(Long assignedTo, Pageable pageable) {
        // SECURITY: Use tenant-filtered query
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> leadRepository.findByOrganizationIdAndAssignedTo(orgId, assignedTo, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> findActiveLead() {
        // SECURITY: Use tenant-filtered query
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> leadRepository.findActiveLeadsByOrganizationOrderByScoreAndCreatedAt(orgId))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Lead> findActiveLeads(Pageable pageable) {
        // Use tenant-filtered query - throw exception if no organization context
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> leadRepository.findActiveLeadsByOrganization(orgId, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public Lead updateLeadScore(Long id, Integer leadScore, Long userId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Lead lead = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        Integer oldScore = lead.getLeadScore();
        lead.setLeadScore(leadScore);
        
        Lead savedLead = save(lead);
        
        addActivity(id, "SCORE_UPDATE", "Lead Score Updated", 
            "Lead score changed from " + oldScore + " to " + leadScore, userId);
        
        return savedLead;
    }

    @Override
    public Lead updatePriority(Long id, String priority, Long userId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Lead lead = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        String oldPriority = lead.getPriority();
        lead.setPriority(priority);
        
        Lead savedLead = save(lead);
        
        addActivity(id, "PRIORITY_UPDATE", "Priority Updated", 
            "Priority changed from " + oldPriority + " to " + priority, userId);
        
        return savedLead;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> findHighScoreLeads(Integer minScore) {
        // SECURITY: Use tenant-filtered query
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> leadRepository.findByOrganizationIdAndLeadScoreGreaterThanEqualOrderByLeadScoreDesc(orgId, minScore))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> findByPriority(String priority) {
        // SECURITY: Use tenant-filtered query
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> leadRepository.findByOrganizationIdAndPriority(orgId, priority))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public Lead scheduleFollowUp(Long id, Timestamp followUpDate, Long userId, String notes) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Lead lead = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        lead.setFollowUpDate(followUpDate);
        Lead savedLead = save(lead);
        
        addActivity(id, "FOLLOW_UP_SCHEDULED", "Follow-up Scheduled", 
            "Follow-up scheduled for " + followUpDate + 
            (notes != null ? ". Notes: " + notes : ""), userId);
        
        return savedLead;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> findLeadsRequiringFollowUp(Timestamp date) {
        // SECURITY: Use tenant-filtered query
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> leadRepository.findLeadsRequiringFollowUpByOrganization(orgId, date))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> findOverdueFollowUps() {
        return findLeadsRequiringFollowUp(new Timestamp(System.currentTimeMillis()));
    }

    @Override
    public Lead updateEstimatedCaseValue(Long id, BigDecimal estimatedValue, Long userId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Lead lead = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        BigDecimal oldValue = lead.getEstimatedCaseValue();
        lead.setEstimatedCaseValue(estimatedValue);
        
        Lead savedLead = save(lead);
        
        addActivity(id, "VALUE_UPDATE", "Estimated Case Value Updated", 
            "Estimated case value changed from " + oldValue + " to " + estimatedValue, userId);
        
        return savedLead;
    }

    @Override
    public LeadActivity addActivity(Long leadId, String activityType, String title, String description, Long userId) {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));

        LeadActivity activity = LeadActivity.builder()
            .organizationId(orgId)  // SECURITY: Set organization context
            .leadId(leadId)
            .activityType(activityType)
            .title(title)
            .description(description)
            .activityDate(new Timestamp(System.currentTimeMillis()))
            .createdBy(userId)
            .isBillable(false)
            .build();

        return leadActivityRepository.save(activity);
    }

    @Override
    public LeadActivity addCallActivity(Long leadId, Integer durationMinutes, String outcome, Long userId) {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));

        LeadActivity activity = LeadActivity.builder()
            .organizationId(orgId)  // SECURITY: Set organization context
            .leadId(leadId)
            .activityType("CALL")
            .title("Phone Call")
            .description("Phone call with lead")
            .activityDate(new Timestamp(System.currentTimeMillis()))
            .durationMinutes(durationMinutes)
            .outcome(outcome)
            .createdBy(userId)
            .isBillable(false)
            .build();

        return leadActivityRepository.save(activity);
    }

    @Override
    public LeadActivity addEmailActivity(Long leadId, String subject, String notes, Long userId) {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));

        LeadActivity activity = LeadActivity.builder()
            .organizationId(orgId)  // SECURITY: Set organization context
            .leadId(leadId)
            .activityType("EMAIL")
            .title("Email: " + subject)
            .description("Email communication with lead")
            .activityDate(new Timestamp(System.currentTimeMillis()))
            .outcome(notes)
            .createdBy(userId)
            .isBillable(false)
            .build();

        return leadActivityRepository.save(activity);
    }

    @Override
    public LeadActivity addMeetingActivity(Long leadId, Timestamp meetingDate, Integer durationMinutes, String outcome, Long userId) {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));

        LeadActivity activity = LeadActivity.builder()
            .organizationId(orgId)  // SECURITY: Set organization context
            .leadId(leadId)
            .activityType("MEETING")
            .title("Meeting with Lead")
            .description("In-person or virtual meeting")
            .activityDate(meetingDate)
            .durationMinutes(durationMinutes)
            .outcome(outcome)
            .createdBy(userId)
            .isBillable(false)
            .build();

        return leadActivityRepository.save(activity);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeadActivity> getLeadActivities(Long leadId) {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        // SECURITY: Use tenant-filtered query
        return leadActivityRepository.findByLeadIdAndOrganizationIdOrderByActivityDateDesc(leadId, orgId);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LeadActivity> getLeadActivities(Long leadId, Pageable pageable) {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        // SECURITY: Use tenant-filtered query
        return leadActivityRepository.findByLeadIdAndOrganizationIdOrderByActivityDateDesc(leadId, orgId, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public long countByStatus(String status) {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        // SECURITY: Use tenant-filtered query
        return leadRepository.countByOrganizationIdAndStatus(orgId, status);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Object[]> getStatusStatistics() {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        // SECURITY: Use tenant-filtered query
        return leadRepository.countByOrganizationIdGroupedByStatus(orgId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Object[]> getPracticeAreaStatistics() {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        // SECURITY: Use tenant-filtered query
        return leadRepository.countByOrganizationIdGroupedByPracticeArea(orgId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> findLeadsByDateRange(Timestamp startDate, Timestamp endDate) {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        // SECURITY: Use tenant-filtered query
        return leadRepository.findByOrganizationIdAndCreatedAtBetween(orgId, startDate, endDate);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> findStaleLeads(String status, int daysStale) {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        Timestamp staleDate = new Timestamp(System.currentTimeMillis() - (daysStale * 24 * 60 * 60 * 1000L));
        // SECURITY: Use tenant-filtered query
        return leadRepository.findStaleLeadsByOrganization(orgId, status, staleDate);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> findLeadsByStatusIn(List<String> statuses) {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        // SECURITY: Use tenant-filtered query
        return leadRepository.findByOrganizationIdAndStatusInList(orgId, statuses);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Lead> findLeadsByStatusIn(List<String> statuses, Pageable pageable) {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        // SECURITY: Use tenant-filtered query
        return leadRepository.findByOrganizationIdAndStatusIn(orgId, statuses, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean canTransitionToStatus(String currentStatus, String newStatus) {
        return VALID_TRANSITIONS.getOrDefault(currentStatus, Collections.emptySet()).contains(newStatus);
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getValidNextStatuses(String currentStatus) {
        return new ArrayList<>(VALID_TRANSITIONS.getOrDefault(currentStatus, Collections.emptySet()));
    }

    @Override
    public Lead updateLeadQuality(Long id, String leadQuality, Long userId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Lead lead = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        String oldQuality = lead.getLeadQuality();
        lead.setLeadQuality(leadQuality);
        
        Lead savedLead = save(lead);
        
        addActivity(id, "QUALITY_UPDATE", "Lead Quality Updated", 
            "Lead quality changed from " + oldQuality + " to " + leadQuality, userId);
        
        return savedLead;
    }

    @Override
    public Lead updateClientBudgetRange(Long id, String budgetRange, Long userId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Lead lead = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        lead.setClientBudgetRange(budgetRange);
        return save(lead);
    }

    @Override
    public Lead updateCaseComplexity(Long id, String complexity, Long userId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Lead lead = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        lead.setCaseComplexity(complexity);
        return save(lead);
    }

    @Override
    public Lead updateCommunicationPreference(Long id, String preference, Long userId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Lead lead = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        lead.setCommunicationPreference(preference);
        return save(lead);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> findUpcomingConsultations(Timestamp startDate, Timestamp endDate) {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        // SECURITY: Use tenant-filtered query
        return leadRepository.findByOrganizationIdAndConsultationDateBetween(orgId, startDate, endDate);
    }

    @Override
    public Lead rescheduleConsultation(Long id, Timestamp newDate, Long userId, String reason) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Lead lead = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        Timestamp oldDate = lead.getConsultationDate();
        lead.setConsultationDate(newDate);
        
        Lead savedLead = save(lead);
        
        addActivity(id, "CONSULTATION_RESCHEDULED", "Consultation Rescheduled", 
            "Consultation rescheduled from " + oldDate + " to " + newDate + 
            ". Reason: " + reason, userId);
        
        return savedLead;
    }

    @Override
    public Lead cancelConsultation(Long id, Long userId, String reason) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Lead lead = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        lead.setConsultationDate(null);
        if ("CONSULTATION_SCHEDULED".equals(lead.getStatus())) {
            lead.setStatus("QUALIFIED");
        }
        
        Lead savedLead = save(lead);
        
        addActivity(id, "CONSULTATION_CANCELLED", "Consultation Cancelled", 
            "Consultation cancelled. Reason: " + reason, userId);
        
        return savedLead;
    }

    @Override
    public Lead completeConsultation(Long id, Long userId, String outcome, String nextSteps) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Lead lead = leadRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Lead not found or access denied: " + id));
        
        Lead savedLead = save(lead);
        
        addActivity(id, "CONSULTATION_COMPLETED", "Consultation Completed", 
            "Consultation completed. Outcome: " + outcome + 
            (nextSteps != null ? ". Next steps: " + nextSteps : ""), userId);
        
        return savedLead;
    }

    private void recordPipelineTransition(Long leadId, String fromStatus, String toStatus, Long userId, String notes) {
        Long orgId = getRequiredOrganizationId();
        // Map status to stage IDs - this is a temporary solution
        // In a production system, you'd have a proper mapping table
        Long fromStageId = mapStatusToStageId(fromStatus);
        Long toStageId = mapStatusToStageId(toStatus);

        LeadPipelineHistory history = LeadPipelineHistory.builder()
            .organizationId(orgId)
            .leadId(leadId)
            .fromStageId(fromStageId)
            .toStageId(toStageId)
            .movedBy(userId)
            .notes(notes)
            .automated(false)
            .build();

        try {
            leadPipelineHistoryRepository.save(history);
        } catch (Exception e) {
            log.error("Failed to save pipeline history for lead {}: {}", leadId, e.getMessage());
            // Don't fail the main operation if history recording fails
        }
    }
    
    private Long mapStatusToStageId(String status) {
        // Map status strings to actual pipeline stage IDs from database
        // 17=New Lead, 18=Initial Contact, 19=Qualification, 20=Consultation, 
        // 21=Proposal, 22=Negotiation, 23=Won, 24=Lost
        switch (status.toUpperCase()) {
            case "NEW": return 17L;          // New Lead
            case "CONTACTED": return 18L;    // Initial Contact
            case "QUALIFIED": return 19L;    // Qualification
            case "CONSULTATION_SCHEDULED": return 20L;  // Consultation
            case "PROPOSAL_SENT": return 21L; // Proposal
            case "NEGOTIATION": return 22L;   // Negotiation
            case "CONVERTED": return 23L;     // Won
            case "LOST": return 24L;          // Lost
            case "UNQUALIFIED": return 24L;   // Map to Lost since there's no separate Unqualified stage
            default: 
                log.warn("Unknown status: {}, defaulting to stage ID 17 (New Lead)", status);
                return 17L; // Default to "New Lead" stage
        }
    }

    // Additional methods for CrmLeadsResource support
    @Override
    @Transactional(readOnly = true)
    public List<PipelineStage> getAllPipelineStages() {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        // SECURITY: Return only system stages + org-specific stages
        return pipelineStageRepository.findAllActiveStagesByOrganizationId(orgId);
    }

    @Override
    public Lead advanceInPipeline(Long leadId, String newStatus, Long userId, String notes) {
        return updateStatus(leadId, newStatus, userId, notes);
    }

    @Override
    public Lead moveToStage(Long leadId, Long stageId, Long userId, String notes) {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));

        // Verify lead exists (findById is already tenant-filtered)
        findById(leadId)
            .orElseThrow(() -> new RuntimeException("Lead not found with ID: " + leadId));

        // SECURITY: Get stage with tenant filter (allows system stages or org-specific stages)
        PipelineStage stage = pipelineStageRepository.findByIdAndOrganizationIdOrSystem(stageId, orgId)
            .orElseThrow(() -> new RuntimeException("Pipeline stage not found or access denied: " + stageId));

        // Update lead status based on stage name
        String newStatus = mapStageToStatus(stage.getName());
        return updateStatus(leadId, newStatus, userId, notes);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> getLeadCountsByStatus() {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        // SECURITY: Use tenant-filtered query
        List<Object[]> statusCounts = leadRepository.countByOrganizationIdGroupedByStatus(orgId);
        Map<String, Long> result = new HashMap<>();

        for (Object[] row : statusCounts) {
            String status = (String) row[0];
            Long count = (Long) row[1];
            result.put(status, count);
        }

        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> getRecentlyMovedLeads(int limit) {
        // Get leads with recent pipeline history - tenant filtered
        List<Lead> leads = tenantService.getCurrentOrganizationId()
            .map(orgId -> leadRepository.findByOrganizationId(orgId))
            .orElseThrow(() -> new RuntimeException("Organization context required"));

        return leads.stream()
            .sorted((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()))
            .limit(limit)
            .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> getStaleLeads() {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        // Find leads that haven't been updated in 7 days
        Timestamp staleDate = new Timestamp(System.currentTimeMillis() - (7 * 24 * 60 * 60 * 1000L));
        // SECURITY: Use tenant-filtered query
        return leadRepository.findStaleLeadsByOrganization(orgId, "NEW", staleDate);
    }

    @Override
    public Lead assignLeadWithNotes(Long leadId, Long assignedTo, Long assignedBy, String notes) {
        // Call the original 3-parameter method
        Lead lead = assignLead(leadId, assignedTo, assignedBy);
        
        // Add activity for assignment with notes
        if (notes != null && !notes.trim().isEmpty()) {
            addActivity(leadId, "ASSIGNMENT", "Lead Assigned", notes, assignedBy);
        }
        
        return lead;
    }

    @Override
    public Lead scheduleConsultation(Long leadId, String consultationDateStr, Long scheduledBy, String notes) {
        try {
            log.info("Parsing consultation date string: {}", consultationDateStr);
            
            // Handle null or empty date string
            if (consultationDateStr == null || consultationDateStr.trim().isEmpty()) {
                throw new RuntimeException("Consultation date cannot be null or empty");
            }
            
            // Clean and normalize the date string
            String normalizedDateStr = consultationDateStr.trim().replace("T", " ");
            
            // Add seconds if missing (format: yyyy-MM-dd HH:mm)
            if (normalizedDateStr.matches("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$")) {
                normalizedDateStr += ":00";
                log.info("Added seconds to date string: {}", normalizedDateStr);
            }
            
            // Validate the final format before parsing
            if (!normalizedDateStr.matches("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$")) {
                throw new RuntimeException("Date format does not match expected pattern yyyy-MM-dd HH:mm:ss");
            }
            
            Timestamp consultationDate = Timestamp.valueOf(normalizedDateStr);
            log.info("Successfully parsed consultation date: {}", consultationDate);
            
            return scheduleConsultation(leadId, consultationDate, scheduledBy, notes);
        } catch (IllegalArgumentException e) {
            log.error("Failed to parse consultation date: {} - {}", consultationDateStr, e.getMessage());
            throw new RuntimeException("Invalid consultation date format: " + consultationDateStr + 
                ". Expected format: yyyy-MM-dd HH:mm or yyyy-MM-dd HH:mm:ss. Error: " + e.getMessage());
        } catch (Exception e) {
            log.error("Unexpected error parsing consultation date: {}", consultationDateStr, e);
            throw new RuntimeException("Failed to parse consultation date: " + consultationDateStr + 
                ". Error: " + e.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> getLeadCountsByPracticeArea() {
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        // SECURITY: Use tenant-filtered query
        List<Object[]> practiceAreaCounts = leadRepository.countByOrganizationIdGroupedByPracticeArea(orgId);
        Map<String, Long> result = new HashMap<>();

        for (Object[] row : practiceAreaCounts) {
            String practiceArea = (String) row[0];
            Long count = (Long) row[1];
            if (practiceArea != null) {
                result.put(practiceArea, count);
            }
        }

        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Lead> getRecentLeads(int limit) {
        // Tenant-filtered recent leads
        List<Lead> leads = tenantService.getCurrentOrganizationId()
            .map(orgId -> leadRepository.findByOrganizationId(orgId))
            .orElseThrow(() -> new RuntimeException("Organization context required"));

        return leads.stream()
            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
            .limit(limit)
            .toList();
    }

    // ==================== Notification Helper Methods ====================
    
    /**
     * Send notification about lead assignment
     */
    private void sendLeadAssignmentNotification(Lead lead, Long assignedTo, Long assignedBy, boolean isNewAssignment) {
        try {
            String leadName = String.format("%s %s", 
                lead.getFirstName() != null ? lead.getFirstName() : "",
                lead.getLastName() != null ? lead.getLastName() : "").trim();
            
            if (leadName.isEmpty()) {
                leadName = "Lead #" + lead.getId();
            }
            
            String practiceArea = lead.getPracticeArea() != null ? lead.getPracticeArea() : "General";
            String notificationType = isNewAssignment ? "LEAD_ASSIGNED" : "LEAD_REASSIGNED";
            String title = isNewAssignment ? "Lead Assigned" : "Lead Reassigned";
            String message = String.format("%s: %s lead '%s' %s", 
                title, practiceArea, leadName, isNewAssignment ? "assigned" : "reassigned");
            
            // Create notification data
            Map<String, Object> notificationData = Map.of(
                "type", notificationType,
                "leadId", lead.getId(),
                "leadName", leadName,
                "practiceArea", practiceArea,
                "assignedTo", assignedTo,
                "assignedBy", assignedBy,
                "title", title,
                "message", message,
                "timestamp", System.currentTimeMillis()
            );
            
            // SECURITY: Send via WebSocket only to users in the same organization
            webSocketHandler.broadcastToOrganization(lead.getOrganizationId(), notificationData);

            // ALSO send via FCM - specifically to the assigned user for offline notifications
            notificationService.sendCrmNotification(title, message, assignedTo, notificationType, notificationData);

            log.info("Sent lead assignment notification (WebSocket + FCM) for lead ID: {} to user: {} in org: {}", lead.getId(), assignedTo, lead.getOrganizationId());
            
        } catch (Exception e) {
            log.error("Failed to send lead assignment notification for lead ID: {}", lead.getId(), e);
        }
    }
    
    /**
     * Send notification about lead status changes
     */
    private void sendLeadStatusChangeNotification(Lead lead, String oldStatus, String newStatus, Long userId, String notes) {
        try {
            String leadName = String.format("%s %s", 
                lead.getFirstName() != null ? lead.getFirstName() : "",
                lead.getLastName() != null ? lead.getLastName() : "").trim();
            
            if (leadName.isEmpty()) {
                leadName = "Lead #" + lead.getId();
            }
            
            String practiceArea = lead.getPracticeArea() != null ? lead.getPracticeArea() : "General";
            String title = "Lead Status Changed";
            String message = String.format("Lead '%s' status changed from %s to %s", leadName, oldStatus, newStatus);
            
            // Create notification data
            Map<String, Object> notificationData = Map.of(
                "type", "LEAD_STATUS_CHANGE",
                "leadId", lead.getId(),
                "leadName", leadName,
                "practiceArea", practiceArea,
                "oldStatus", oldStatus,
                "newStatus", newStatus,
                "changedBy", userId,
                "title", title,
                "message", message,
                "timestamp", System.currentTimeMillis()
            );
            
            // SECURITY: Send via WebSocket only to users in the same organization
            webSocketHandler.broadcastToOrganization(lead.getOrganizationId(), notificationData);

            // Collect users to notify (like case status change pattern)
            Set<Long> notificationUserIds = new HashSet<>();

            // Add assigned user if exists
            if (lead.getAssignedTo() != null) {
                notificationUserIds.add(lead.getAssignedTo());
            }

            // Remove the user who made the change from notifications (don't notify yourself)
            notificationUserIds.remove(userId);

            // Send notification to each user
            for (Long notificationUserId : notificationUserIds) {
                notificationService.sendCrmNotification(title, message, notificationUserId,
                    "LEAD_STATUS_CHANGED", Map.of("leadId", lead.getId(), "oldStatus", oldStatus, "newStatus", newStatus));
            }

            log.info("📧 Lead status change notifications sent to {} users", notificationUserIds.size());
            
            log.info("Sent lead status change notification (WebSocket + FCM) for lead ID: {} - {} to {}", lead.getId(), oldStatus, newStatus);
            
        } catch (Exception e) {
            log.error("Failed to send lead status change notification for lead ID: {}", lead.getId(), e);
        }
    }

    private String mapStageToStatus(String stageName) {
        // Map stage names to lead statuses
        switch (stageName.toUpperCase()) {
            case "NEW LEAD":
            case "NEW":
                return "NEW";
            case "CONTACTED":
                return "CONTACTED";
            case "QUALIFIED":
                return "QUALIFIED";
            case "CONSULTATION SCHEDULED":
                return "CONSULTATION_SCHEDULED";
            case "PROPOSAL SENT":
                return "PROPOSAL_SENT";
            case "NEGOTIATION":
                return "NEGOTIATION";
            case "CONVERTED":
                return "CONVERTED";
            case "LOST":
                return "LOST";
            case "UNQUALIFIED":
                return "UNQUALIFIED";
            default:
                return "NEW";
        }
    }
}