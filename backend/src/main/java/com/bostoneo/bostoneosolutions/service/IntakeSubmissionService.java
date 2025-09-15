package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.IntakeSubmission;
import com.bostoneo.bostoneosolutions.model.Lead;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface IntakeSubmissionService {
    
    // Basic CRUD operations
    IntakeSubmission save(IntakeSubmission intakeSubmission);
    
    Optional<IntakeSubmission> findById(Long id);
    
    List<IntakeSubmission> findAll();
    
    Page<IntakeSubmission> findAll(Pageable pageable);
    
    void deleteById(Long id);
    
    // Submission creation and processing
    IntakeSubmission createSubmission(Long formId, String submissionData, String ipAddress, String userAgent, String referrer);
    
    IntakeSubmission createGeneralSubmission(String submissionData, String ipAddress, String userAgent, String referrer);
    
    IntakeSubmission updateSubmissionData(Long id, String submissionData, Long userId);
    
    // Status transition operations (core workflow)
    IntakeSubmission reviewSubmission(Long id, Long reviewedBy, String notes);
    
    IntakeSubmission convertToLead(Long id, Long reviewedBy, String notes);
    
    IntakeSubmission rejectSubmission(Long id, Long reviewedBy, String reason);
    
    IntakeSubmission markAsSpam(Long id, Long reviewedBy, String reason);
    
    // Bulk operations for attorney efficiency
    List<IntakeSubmission> bulkReview(List<Long> submissionIds, Long reviewedBy, String notes);
    
    List<IntakeSubmission> bulkReject(List<Long> submissionIds, Long reviewedBy, String reason);
    
    List<IntakeSubmission> bulkMarkAsSpam(List<Long> submissionIds, Long reviewedBy, String reason);
    
    List<IntakeSubmission> bulkConvertToLead(List<Long> submissionIds, Long reviewedBy, String notes);
    
    // Status and filtering operations
    List<IntakeSubmission> findByStatus(String status);
    
    Page<IntakeSubmission> findByStatus(String status, Pageable pageable);
    
    List<IntakeSubmission> findPendingSubmissions();
    
    Page<IntakeSubmission> findPendingSubmissions(Pageable pageable);
    
    List<IntakeSubmission> findByFormId(Long formId);
    
    List<IntakeSubmission> findByReviewedBy(Long reviewedBy);
    
    // Priority and scoring operations
    Integer calculatePriorityScore(String submissionData, String practiceArea);
    
    IntakeSubmission updatePriorityScore(Long id, Integer priorityScore);
    
    List<IntakeSubmission> findHighPrioritySubmissions(Integer minScore);
    
    List<IntakeSubmission> findPendingOrderByPriority();
    
    Page<IntakeSubmission> findPendingOrderByPriority(Pageable pageable);
    
    // Analytics and reporting operations
    long countByStatus(String status);
    
    List<Object[]> getStatusStatistics();
    
    List<IntakeSubmission> findSubmissionsByDateRange(Timestamp startDate, Timestamp endDate);
    
    List<IntakeSubmission> findByPracticeArea(String practiceArea);
    
    List<IntakeSubmission> findRecentByStatus(String status, Timestamp since);
    
    // Tag and note management
    IntakeSubmission addTags(Long id, List<String> tags, Long userId);
    
    IntakeSubmission removeTags(Long id, List<String> tags, Long userId);
    
    IntakeSubmission updateNotes(Long id, String notes, Long userId);
    
    // Validation operations
    boolean validateSubmissionData(String submissionData);
    
    boolean canTransitionToStatus(String currentStatus, String newStatus);
    
    // Lead linking operations
    IntakeSubmission linkToLead(Long submissionId, Long leadId, Long userId);
    
    IntakeSubmission unlinkFromLead(Long submissionId, Long userId);
    
    // Additional methods for IntakeSubmissionResource support
    Page<IntakeSubmission> findByFilters(String status, String practiceArea, String priority, Pageable pageable);
    
    List<IntakeSubmission> findByPriorityThreshold(int threshold);
    
    IntakeSubmission markAsReviewed(Long id, Long attorneyId, String reviewNotes);
    
    Lead convertToLead(Long id, Long reviewedBy, Long assignedTo, String notes);
    
    IntakeSubmission markAsRejected(Long id, Long attorneyId, String rejectionReason);
    
    List<Lead> bulkConvertToLeads(List<Long> submissionIds, Long reviewedBy, Long assignedTo, String notes);
    
    Map<String, Long> getSubmissionCountsByStatus();
    
    Map<String, Long> getSubmissionCountsByPracticeArea();
    
    List<IntakeSubmission> getRecentSubmissions(int limit);
    
    Map<String, Long> getSubmissionsByPriorityRange();
}