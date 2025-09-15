package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.Lead;
import com.bostoneo.bostoneosolutions.model.LeadActivity;
import com.bostoneo.bostoneosolutions.model.PipelineStage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface LeadService {
    
    // Basic CRUD operations
    Lead save(Lead lead);
    
    Optional<Lead> findById(Long id);
    
    List<Lead> findAll();
    
    Page<Lead> findAll(Pageable pageable);
    
    void deleteById(Long id);
    
    boolean existsById(Long id);
    
    // Lead creation and management
    Lead createLead(Lead lead, Long createdBy);
    
    Lead updateLead(Long id, Lead lead, Long userId);
    
    Lead assignLead(Long id, Long assignedTo, Long assignedBy);
    
    Lead reassignLead(Long id, Long newAssignedTo, Long assignedBy, String reason);
    
    // Status pipeline management (NEW → CONTACTED → QUALIFIED → CONSULTATION_SCHEDULED → PROPOSAL_SENT → NEGOTIATION → CONVERTED/LOST/UNQUALIFIED)
    Lead updateStatus(Long id, String newStatus, Long userId, String notes);
    
    Lead markAsContacted(Long id, Long userId, String contactMethod, String notes);
    
    Lead markAsQualified(Long id, Long userId, String qualificationNotes);
    
    Lead scheduleConsultation(Long id, Timestamp consultationDate, Long userId, String notes);
    
    Lead markProposalSent(Long id, Long userId, String proposalDetails);
    
    Lead startNegotiation(Long id, Long userId, String negotiationNotes);
    
    Lead markAsConverted(Long id, Long userId, String conversionNotes);
    
    Lead markAsLost(Long id, String lostReason, Long userId);
    
    Lead markAsUnqualified(Long id, String unqualificationReason, Long userId);
    
    // Status and filtering operations
    List<Lead> findByStatus(String status);
    
    Page<Lead> findByStatus(String status, Pageable pageable);
    
    List<Lead> findByPracticeArea(String practiceArea);
    
    Page<Lead> findByPracticeArea(String practiceArea, Pageable pageable);
    
    List<Lead> findByAssignedTo(Long assignedTo);
    
    Page<Lead> findByAssignedTo(Long assignedTo, Pageable pageable);
    
    List<Lead> findActiveLead();
    
    Page<Lead> findActiveLeads(Pageable pageable);
    
    // Lead scoring and prioritization
    Lead updateLeadScore(Long id, Integer leadScore, Long userId);
    
    Lead updatePriority(Long id, String priority, Long userId);
    
    List<Lead> findHighScoreLeads(Integer minScore);
    
    List<Lead> findByPriority(String priority);
    
    // Follow-up and scheduling management
    Lead scheduleFollowUp(Long id, Timestamp followUpDate, Long userId, String notes);
    
    List<Lead> findLeadsRequiringFollowUp(Timestamp date);
    
    List<Lead> findOverdueFollowUps();
    
    Lead updateEstimatedCaseValue(Long id, java.math.BigDecimal estimatedValue, Long userId);
    
    // Activity tracking
    LeadActivity addActivity(Long leadId, String activityType, String title, String description, Long userId);
    
    LeadActivity addCallActivity(Long leadId, Integer durationMinutes, String outcome, Long userId);
    
    LeadActivity addEmailActivity(Long leadId, String subject, String notes, Long userId);
    
    LeadActivity addMeetingActivity(Long leadId, Timestamp meetingDate, Integer durationMinutes, String outcome, Long userId);
    
    List<LeadActivity> getLeadActivities(Long leadId);
    
    Page<LeadActivity> getLeadActivities(Long leadId, Pageable pageable);
    
    // Analytics and reporting
    long countByStatus(String status);
    
    List<Object[]> getStatusStatistics();
    
    List<Object[]> getPracticeAreaStatistics();
    
    List<Lead> findLeadsByDateRange(Timestamp startDate, Timestamp endDate);
    
    List<Lead> findStaleLeads(String status, int daysStale);
    
    // Pipeline management
    List<Lead> findLeadsByStatusIn(List<String> statuses);
    
    Page<Lead> findLeadsByStatusIn(List<String> statuses, Pageable pageable);
    
    boolean canTransitionToStatus(String currentStatus, String newStatus);
    
    List<String> getValidNextStatuses(String currentStatus);
    
    // Lead quality and scoring
    Lead updateLeadQuality(Long id, String leadQuality, Long userId);
    
    Lead updateClientBudgetRange(Long id, String budgetRange, Long userId);
    
    Lead updateCaseComplexity(Long id, String complexity, Long userId);
    
    Lead updateCommunicationPreference(Long id, String preference, Long userId);
    
    // Consultation management
    List<Lead> findUpcomingConsultations(Timestamp startDate, Timestamp endDate);
    
    Lead rescheduleConsultation(Long id, Timestamp newDate, Long userId, String reason);
    
    Lead cancelConsultation(Long id, Long userId, String reason);
    
    Lead completeConsultation(Long id, Long userId, String outcome, String nextSteps);
    
    // Additional methods for CrmLeadsResource support
    List<PipelineStage> getAllPipelineStages();
    
    Lead advanceInPipeline(Long leadId, String newStatus, Long userId, String notes);
    
    Lead moveToStage(Long leadId, Long stageId, Long userId, String notes);
    
    Map<String, Long> getLeadCountsByStatus();
    
    List<Lead> getRecentlyMovedLeads(int limit);
    
    List<Lead> getStaleLeads();
    
    Lead assignLeadWithNotes(Long leadId, Long assignedTo, Long assignedBy, String notes);
    
    Lead scheduleConsultation(Long leadId, String consultationDateStr, Long scheduledBy, String notes);
    
    Map<String, Long> getLeadCountsByPracticeArea();
    
    List<Lead> getRecentLeads(int limit);
}