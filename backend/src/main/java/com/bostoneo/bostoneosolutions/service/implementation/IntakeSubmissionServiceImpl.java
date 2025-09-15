package com.***REMOVED***.***REMOVED***solutions.service.implementation;

import com.***REMOVED***.***REMOVED***solutions.model.IntakeSubmission;
import com.***REMOVED***.***REMOVED***solutions.model.Lead;
import com.***REMOVED***.***REMOVED***solutions.repository.IntakeSubmissionRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.LeadRepository;
import com.***REMOVED***.***REMOVED***solutions.service.IntakeSubmissionService;
import com.***REMOVED***.***REMOVED***solutions.service.NotificationService;
import com.***REMOVED***.***REMOVED***solutions.handler.AuthenticatedWebSocketHandler;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class IntakeSubmissionServiceImpl implements IntakeSubmissionService {

    private final IntakeSubmissionRepository intakeSubmissionRepository;
    private final LeadRepository leadRepository;
    private final ObjectMapper objectMapper;
    private final AuthenticatedWebSocketHandler webSocketHandler;
    private final NotificationService notificationService;

    // Valid status transitions
    private static final Map<String, Set<String>> VALID_TRANSITIONS = Map.of(
        "PENDING", Set.of("REVIEWED", "CONVERTED_TO_LEAD", "REJECTED", "SPAM"),
        "REVIEWED", Set.of("CONVERTED_TO_LEAD", "REJECTED", "SPAM"),
        "CONVERTED_TO_LEAD", Set.of(), // Final state
        "REJECTED", Set.of(), // Final state  
        "SPAM", Set.of() // Final state
    );

    @Override
    public IntakeSubmission save(IntakeSubmission intakeSubmission) {
        return intakeSubmissionRepository.save(intakeSubmission);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<IntakeSubmission> findById(Long id) {
        return intakeSubmissionRepository.findById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeSubmission> findAll() {
        return intakeSubmissionRepository.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<IntakeSubmission> findAll(Pageable pageable) {
        return intakeSubmissionRepository.findAll(pageable);
    }

    @Override
    public void deleteById(Long id) {
        intakeSubmissionRepository.deleteById(id);
    }

    @Override
    public IntakeSubmission createSubmission(Long formId, String submissionData, String ipAddress, String userAgent, String referrer) {
        log.info("Creating new intake submission for form ID: {}", formId);
        
        IntakeSubmission submission = IntakeSubmission.builder()
            .formId(formId)
            .submissionData(submissionData)
            .ipAddress(ipAddress)
            .userAgent(userAgent)
            .referrer(referrer)
            .status("PENDING")
            .priorityScore(calculatePriorityScore(submissionData, null))
            .build();
        
        IntakeSubmission savedSubmission = save(submission);
        
        // Send notifications about new submission
        sendNewSubmissionNotification(savedSubmission);
        
        return savedSubmission;
    }

    @Override
    public IntakeSubmission createGeneralSubmission(String submissionData, String ipAddress, String userAgent, String referrer) {
        log.info("Creating new general intake submission");
        
        IntakeSubmission submission = IntakeSubmission.builder()
            .formId(null) // No specific form ID for general submissions
            .submissionData(submissionData)
            .ipAddress(ipAddress)
            .userAgent(userAgent)
            .referrer(referrer)
            .status("PENDING")
            .priorityScore(calculatePriorityScore(submissionData, null))
            .build();
        
        IntakeSubmission savedSubmission = save(submission);
        
        // Send notifications about new submission
        sendNewSubmissionNotification(savedSubmission);
        
        return savedSubmission;
    }

    @Override
    public IntakeSubmission updateSubmissionData(Long id, String submissionData, Long userId) {
        log.info("Updating submission data for ID: {} by user: {}", id, userId);
        
        IntakeSubmission submission = intakeSubmissionRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("IntakeSubmission not found with ID: " + id));
        
        submission.setSubmissionData(submissionData);
        // Recalculate priority score with new data
        submission.setPriorityScore(calculatePriorityScore(submissionData, null));
        
        return save(submission);
    }

    @Override
    public IntakeSubmission reviewSubmission(Long id, Long reviewedBy, String notes) {
        log.info("Reviewing submission ID: {} by user: {}", id, reviewedBy);
        
        IntakeSubmission submission = intakeSubmissionRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("IntakeSubmission not found with ID: " + id));
        
        if (!canTransitionToStatus(submission.getStatus(), "REVIEWED")) {
            throw new RuntimeException("Invalid status transition from " + submission.getStatus() + " to REVIEWED");
        }
        
        submission.setStatus("REVIEWED");
        submission.setReviewedBy(reviewedBy);
        submission.setReviewedAt(new Timestamp(System.currentTimeMillis()));
        submission.setNotes(notes);
        
        IntakeSubmission savedSubmission = save(submission);
        
        // Send notification about review completion
        sendStatusChangeNotification(savedSubmission, "REVIEWED", notes);
        
        return savedSubmission;
    }

    @Override
    public IntakeSubmission convertToLead(Long id, Long reviewedBy, String notes) {
        log.info("Converting submission ID: {} to lead by user: {}", id, reviewedBy);
        
        IntakeSubmission submission = intakeSubmissionRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("IntakeSubmission not found with ID: " + id));
        
        if (!canTransitionToStatus(submission.getStatus(), "CONVERTED_TO_LEAD")) {
            throw new RuntimeException("Invalid status transition from " + submission.getStatus() + " to CONVERTED_TO_LEAD");
        }
        
        // Create Lead from submission data
        Lead lead = createLeadFromSubmission(submission);
        lead = leadRepository.save(lead);
        
        // Update submission status and link to lead
        submission.setStatus("CONVERTED_TO_LEAD");
        submission.setLeadId(lead.getId());
        submission.setReviewedBy(reviewedBy);
        submission.setReviewedAt(new Timestamp(System.currentTimeMillis()));
        submission.setNotes(notes);
        
        IntakeSubmission savedSubmission = save(submission);
        
        // Send notification about successful conversion
        sendLeadConversionNotification(savedSubmission, lead);
        
        return savedSubmission;
    }

    @Override
    public IntakeSubmission rejectSubmission(Long id, Long reviewedBy, String reason) {
        log.info("Rejecting submission ID: {} by user: {} for reason: {}", id, reviewedBy, reason);
        
        IntakeSubmission submission = intakeSubmissionRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("IntakeSubmission not found with ID: " + id));
        
        if (!canTransitionToStatus(submission.getStatus(), "REJECTED")) {
            throw new RuntimeException("Invalid status transition from " + submission.getStatus() + " to REJECTED");
        }
        
        submission.setStatus("REJECTED");
        submission.setReviewedBy(reviewedBy);
        submission.setReviewedAt(new Timestamp(System.currentTimeMillis()));
        submission.setNotes(reason);
        
        IntakeSubmission savedSubmission = save(submission);
        
        // Send notification about rejection
        sendStatusChangeNotification(savedSubmission, "REJECTED", reason);
        
        return savedSubmission;
    }

    @Override
    public IntakeSubmission markAsSpam(Long id, Long reviewedBy, String reason) {
        log.info("Marking submission ID: {} as spam by user: {} for reason: {}", id, reviewedBy, reason);
        
        IntakeSubmission submission = intakeSubmissionRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("IntakeSubmission not found with ID: " + id));
        
        if (!canTransitionToStatus(submission.getStatus(), "SPAM")) {
            throw new RuntimeException("Invalid status transition from " + submission.getStatus() + " to SPAM");
        }
        
        submission.setStatus("SPAM");
        submission.setReviewedBy(reviewedBy);
        submission.setReviewedAt(new Timestamp(System.currentTimeMillis()));
        submission.setNotes(reason);
        
        IntakeSubmission savedSubmission = save(submission);
        
        // Send notification about spam marking
        sendStatusChangeNotification(savedSubmission, "SPAM", reason);
        
        return savedSubmission;
    }

    @Override
    public List<IntakeSubmission> bulkReview(List<Long> submissionIds, Long reviewedBy, String notes) {
        log.info("Bulk reviewing {} submissions by user: {}", submissionIds.size(), reviewedBy);
        
        List<IntakeSubmission> submissions = intakeSubmissionRepository.findAllById(submissionIds);
        List<IntakeSubmission> updated = new ArrayList<>();
        
        for (IntakeSubmission submission : submissions) {
            if (canTransitionToStatus(submission.getStatus(), "REVIEWED")) {
                submission.setStatus("REVIEWED");
                submission.setReviewedBy(reviewedBy);
                submission.setReviewedAt(new Timestamp(System.currentTimeMillis()));
                submission.setNotes(notes);
                updated.add(save(submission));
            }
        }
        
        return updated;
    }

    @Override
    public List<IntakeSubmission> bulkReject(List<Long> submissionIds, Long reviewedBy, String reason) {
        log.info("Bulk rejecting {} submissions by user: {}", submissionIds.size(), reviewedBy);
        
        List<IntakeSubmission> submissions = intakeSubmissionRepository.findAllById(submissionIds);
        List<IntakeSubmission> updated = new ArrayList<>();
        
        for (IntakeSubmission submission : submissions) {
            if (canTransitionToStatus(submission.getStatus(), "REJECTED")) {
                submission.setStatus("REJECTED");
                submission.setReviewedBy(reviewedBy);
                submission.setReviewedAt(new Timestamp(System.currentTimeMillis()));
                submission.setNotes(reason);
                updated.add(save(submission));
            }
        }
        
        return updated;
    }

    @Override
    public List<IntakeSubmission> bulkMarkAsSpam(List<Long> submissionIds, Long reviewedBy, String reason) {
        log.info("Bulk marking {} submissions as spam by user: {}", submissionIds.size(), reviewedBy);
        
        List<IntakeSubmission> submissions = intakeSubmissionRepository.findAllById(submissionIds);
        List<IntakeSubmission> updated = new ArrayList<>();
        
        for (IntakeSubmission submission : submissions) {
            if (canTransitionToStatus(submission.getStatus(), "SPAM")) {
                submission.setStatus("SPAM");
                submission.setReviewedBy(reviewedBy);
                submission.setReviewedAt(new Timestamp(System.currentTimeMillis()));
                submission.setNotes(reason);
                updated.add(save(submission));
            }
        }
        
        return updated;
    }

    @Override
    public List<IntakeSubmission> bulkConvertToLead(List<Long> submissionIds, Long reviewedBy, String notes) {
        log.info("Bulk converting {} submissions to leads by user: {}", submissionIds.size(), reviewedBy);
        
        List<IntakeSubmission> submissions = intakeSubmissionRepository.findAllById(submissionIds);
        List<IntakeSubmission> updated = new ArrayList<>();
        
        for (IntakeSubmission submission : submissions) {
            if (canTransitionToStatus(submission.getStatus(), "CONVERTED_TO_LEAD")) {
                // Create Lead from submission
                Lead lead = createLeadFromSubmission(submission);
                lead = leadRepository.save(lead);
                
                submission.setStatus("CONVERTED_TO_LEAD");
                submission.setLeadId(lead.getId());
                submission.setReviewedBy(reviewedBy);
                submission.setReviewedAt(new Timestamp(System.currentTimeMillis()));
                submission.setNotes(notes);
                updated.add(save(submission));
            }
        }
        
        return updated;
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeSubmission> findByStatus(String status) {
        return intakeSubmissionRepository.findByStatus(status);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<IntakeSubmission> findByStatus(String status, Pageable pageable) {
        return intakeSubmissionRepository.findByStatus(status, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeSubmission> findPendingSubmissions() {
        return intakeSubmissionRepository.findByStatus("PENDING");
    }

    @Override
    @Transactional(readOnly = true)
    public Page<IntakeSubmission> findPendingSubmissions(Pageable pageable) {
        return intakeSubmissionRepository.findByStatus("PENDING", pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeSubmission> findByFormId(Long formId) {
        return intakeSubmissionRepository.findByFormId(formId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeSubmission> findByReviewedBy(Long reviewedBy) {
        return intakeSubmissionRepository.findByReviewedBy(reviewedBy);
    }

    @Override
    public Integer calculatePriorityScore(String submissionData, String practiceArea) {
        try {
            JsonNode data = objectMapper.readTree(submissionData);
            int score = 0;
            
            // Base score factors
            if (data.has("urgency") && "HIGH".equals(data.get("urgency").asText())) {
                score += 30;
            }
            if (data.has("urgent") && data.get("urgent").asBoolean()) {
                score += 25;
            }
            
            // Practice area specific scoring
            if (data.has("charge_type") && "felony".equals(data.get("charge_type").asText())) {
                score += 40; // Criminal defense - felony cases are high priority
            }
            if (data.has("injuries") && !data.get("injuries").asText().isEmpty()) {
                score += 35; // Personal injury with documented injuries
            }
            if (data.has("court_date") && !data.get("court_date").asText().isEmpty()) {
                score += 20; // Has upcoming court date
            }
            
            // Contact information completeness
            if (data.has("email") && !data.get("email").asText().isEmpty()) score += 5;
            if (data.has("phone") && !data.get("phone").asText().isEmpty()) score += 5;
            
            // Description quality
            if (data.has("incident_description")) {
                String description = data.get("incident_description").asText();
                if (description.length() > 100) score += 10;
                if (description.length() > 300) score += 10;
            }
            
            return Math.min(score, 100); // Cap at 100
            
        } catch (Exception e) {
            log.error("Error calculating priority score", e);
            return 50; // Default score
        }
    }

    @Override
    public IntakeSubmission updatePriorityScore(Long id, Integer priorityScore) {
        IntakeSubmission submission = intakeSubmissionRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("IntakeSubmission not found with ID: " + id));
        
        submission.setPriorityScore(priorityScore);
        return save(submission);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeSubmission> findHighPrioritySubmissions(Integer minScore) {
        return intakeSubmissionRepository.findByPriorityScoreGreaterThanEqualOrderByPriorityScoreDesc(minScore);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeSubmission> findPendingOrderByPriority() {
        return intakeSubmissionRepository.findPendingOrderByPriorityAndCreatedAt();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<IntakeSubmission> findPendingOrderByPriority(Pageable pageable) {
        return intakeSubmissionRepository.findPendingOrderByPriorityAndCreatedAt(pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public long countByStatus(String status) {
        return intakeSubmissionRepository.countByStatus(status);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Object[]> getStatusStatistics() {
        return intakeSubmissionRepository.countByStatusGrouped();
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeSubmission> findSubmissionsByDateRange(Timestamp startDate, Timestamp endDate) {
        return intakeSubmissionRepository.findByCreatedAtBetween(startDate, endDate);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeSubmission> findByPracticeArea(String practiceArea) {
        return intakeSubmissionRepository.findByPracticeArea(practiceArea);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeSubmission> findRecentByStatus(String status, Timestamp since) {
        return intakeSubmissionRepository.findByStatusAndCreatedAtAfter(status, since);
    }

    @Override
    public IntakeSubmission addTags(Long id, List<String> tags, Long userId) {
        IntakeSubmission submission = intakeSubmissionRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("IntakeSubmission not found with ID: " + id));
        
        try {
            List<String> currentTags = new ArrayList<>();
            if (submission.getTags() != null) {
                JsonNode tagsNode = objectMapper.readTree(submission.getTags());
                if (tagsNode.isArray()) {
                    tagsNode.forEach(tag -> currentTags.add(tag.asText()));
                }
            }
            
            currentTags.addAll(tags);
            submission.setTags(objectMapper.writeValueAsString(currentTags));
            
        } catch (Exception e) {
            log.error("Error adding tags", e);
        }
        
        return save(submission);
    }

    @Override
    public IntakeSubmission removeTags(Long id, List<String> tags, Long userId) {
        IntakeSubmission submission = intakeSubmissionRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("IntakeSubmission not found with ID: " + id));
        
        try {
            List<String> currentTags = new ArrayList<>();
            if (submission.getTags() != null) {
                JsonNode tagsNode = objectMapper.readTree(submission.getTags());
                if (tagsNode.isArray()) {
                    tagsNode.forEach(tag -> currentTags.add(tag.asText()));
                }
            }
            
            currentTags.removeAll(tags);
            submission.setTags(objectMapper.writeValueAsString(currentTags));
            
        } catch (Exception e) {
            log.error("Error removing tags", e);
        }
        
        return save(submission);
    }

    @Override
    public IntakeSubmission updateNotes(Long id, String notes, Long userId) {
        IntakeSubmission submission = intakeSubmissionRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("IntakeSubmission not found with ID: " + id));
        
        submission.setNotes(notes);
        return save(submission);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean validateSubmissionData(String submissionData) {
        try {
            JsonNode data = objectMapper.readTree(submissionData);
            // Basic validation - should have required fields
            return data.has("email") || data.has("phone");
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public boolean canTransitionToStatus(String currentStatus, String newStatus) {
        return VALID_TRANSITIONS.getOrDefault(currentStatus, Collections.emptySet()).contains(newStatus);
    }

    @Override
    public IntakeSubmission linkToLead(Long submissionId, Long leadId, Long userId) {
        IntakeSubmission submission = intakeSubmissionRepository.findById(submissionId)
            .orElseThrow(() -> new RuntimeException("IntakeSubmission not found with ID: " + submissionId));
        
        submission.setLeadId(leadId);
        return save(submission);
    }

    @Override
    public IntakeSubmission unlinkFromLead(Long submissionId, Long userId) {
        IntakeSubmission submission = intakeSubmissionRepository.findById(submissionId)
            .orElseThrow(() -> new RuntimeException("IntakeSubmission not found with ID: " + submissionId));
        
        submission.setLeadId(null);
        return save(submission);
    }

    private Lead createLeadFromSubmission(IntakeSubmission submission) {
        try {
            JsonNode data = objectMapper.readTree(submission.getSubmissionData());
            
            return Lead.builder()
                .firstName(getStringValue(data, "first_name", "firstName"))
                .lastName(getStringValue(data, "last_name", "lastName"))
                .email(getStringValue(data, "email"))
                .phone(getStringValue(data, "phone"))
                .status("NEW")
                .source("WEBSITE")
                .practiceArea(getStringValue(data, "practiceArea") != null ? getStringValue(data, "practiceArea") : (submission.getIntakeForm() != null ? submission.getIntakeForm().getPracticeArea() : "GENERAL"))
                .leadScore(submission.getPriorityScore())
                .initialInquiry(getStringValue(data, "incident_description", "matter_description", "description"))
                .urgencyLevel(getStringValue(data, "urgency") != null ? getStringValue(data, "urgency") : "MEDIUM")
                .build();
                
        } catch (Exception e) {
            log.error("Error creating lead from submission", e);
            throw new RuntimeException("Failed to create lead from submission data");
        }
    }

    // ==================== Notification Helper Methods ====================
    
    /**
     * Send notification about new submission to relevant users
     */
    private void sendNewSubmissionNotification(IntakeSubmission submission) {
        try {
            // Extract submission data to get practice area and urgency
            JsonNode data = objectMapper.readTree(submission.getSubmissionData());
            String practiceArea = getStringValue(data, "practiceArea", "practice_area");
            String urgency = getStringValue(data, "urgency", "urgency_level", "priority");
            
            // Default values if not found
            if (practiceArea == null) practiceArea = "General";
            if (urgency == null) urgency = "MEDIUM";
            
            // Create notification data
            Map<String, Object> notificationData = Map.of(
                "type", "NEW_SUBMISSION",
                "submissionId", submission.getId(),
                "practiceArea", practiceArea,
                "urgency", urgency,
                "title", "New Intake Submission",
                "message", String.format("New %s intake submission received%s", 
                    practiceArea, 
                    urgency.equals("URGENT") || urgency.equals("HIGH") ? " - " + urgency + " priority" : ""),
                "timestamp", System.currentTimeMillis()
            );
            
            // Send via WebSocket for real-time updates
            webSocketHandler.broadcastMessage(notificationData);
            
            // ALSO send via FCM for offline/background notifications to user 1 (you)
            String title = (String) notificationData.get("title");
            String message = (String) notificationData.get("message");
            notificationService.sendCrmNotification(title, message, 1L, "NEW_SUBMISSION", notificationData);
            
            log.info("Sent new submission notification (WebSocket + FCM) for submission ID: {}", submission.getId());
            
        } catch (Exception e) {
            log.error("Failed to send new submission notification for submission ID: {}", submission.getId(), e);
        }
    }

    /**
     * Send notification about successful lead conversion
     */
    private void sendLeadConversionNotification(IntakeSubmission submission, Lead lead) {
        try {
            // Extract submission data to get practice area
            JsonNode data = objectMapper.readTree(submission.getSubmissionData());
            String practiceArea = getStringValue(data, "practiceArea", "practice_area");
            if (practiceArea == null) practiceArea = lead.getPracticeArea();
            if (practiceArea == null) practiceArea = "General";
            
            // Create notification data
            Map<String, Object> notificationData = Map.of(
                "type", "LEAD_CONVERSION",
                "submissionId", submission.getId(),
                "leadId", lead.getId(),
                "practiceArea", practiceArea,
                "title", "Submission Converted to Lead",
                "message", String.format("Intake submission successfully converted to %s lead: %s %s", 
                    practiceArea,
                    lead.getFirstName() != null ? lead.getFirstName() : "",
                    lead.getLastName() != null ? lead.getLastName() : "").trim(),
                "timestamp", System.currentTimeMillis()
            );
            
            // Send via WebSocket for real-time updates
            webSocketHandler.broadcastMessage(notificationData);
            
            // ALSO send via FCM for offline/background notifications
            String title = (String) notificationData.get("title");
            String message = (String) notificationData.get("message");
            notificationService.sendBroadcastNotification(title, message, "LEAD_CONVERSION", notificationData);
            
            log.info("Sent lead conversion notification (WebSocket + FCM) for submission ID: {} to lead ID: {}", submission.getId(), lead.getId());
            
        } catch (Exception e) {
            log.error("Failed to send lead conversion notification for submission ID: {}", submission.getId(), e);
        }
    }

    /**
     * Send notification about submission status changes
     */
    private void sendStatusChangeNotification(IntakeSubmission submission, String newStatus, String notes) {
        try {
            // Extract submission data to get practice area
            JsonNode data = objectMapper.readTree(submission.getSubmissionData());
            String practiceArea = getStringValue(data, "practiceArea", "practice_area");
            if (practiceArea == null) practiceArea = "General";
            
            // Create appropriate message based on status
            String title;
            String message;
            String notificationType;
            
            switch (newStatus) {
                case "REVIEWED":
                    title = "Submission Reviewed";
                    message = String.format("Intake submission for %s has been reviewed", practiceArea);
                    notificationType = "SUBMISSION_REVIEWED";
                    break;
                case "REJECTED":
                    title = "Submission Rejected";
                    message = String.format("Intake submission for %s has been rejected", practiceArea);
                    notificationType = "SUBMISSION_REJECTED";
                    break;
                case "SPAM":
                    title = "Submission Marked as Spam";
                    message = String.format("Intake submission for %s has been marked as spam", practiceArea);
                    notificationType = "SUBMISSION_SPAM";
                    break;
                default:
                    title = "Submission Status Changed";
                    message = String.format("Intake submission for %s status changed to %s", practiceArea, newStatus);
                    notificationType = "SUBMISSION_STATUS_CHANGE";
            }
            
            // Create notification data
            Map<String, Object> notificationData = Map.of(
                "type", notificationType,
                "submissionId", submission.getId(),
                "practiceArea", practiceArea,
                "newStatus", newStatus,
                "title", title,
                "message", message,
                "timestamp", System.currentTimeMillis()
            );
            
            // Send via WebSocket for real-time updates
            webSocketHandler.broadcastMessage(notificationData);
            
            // ALSO send via FCM for offline/background notifications
            notificationService.sendBroadcastNotification(title, message, notificationType, notificationData);
            
            log.info("Sent status change notification (WebSocket + FCM) for submission ID: {} - status: {}", submission.getId(), newStatus);
            
        } catch (Exception e) {
            log.error("Failed to send status change notification for submission ID: {}", submission.getId(), e);
        }
    }

    private String getStringValue(JsonNode data, String... fieldNames) {
        for (String fieldName : fieldNames) {
            if (data.has(fieldName) && !data.get(fieldName).isNull()) {
                return data.get(fieldName).asText();
            }
        }
        return null;
    }

    // Additional methods for IntakeSubmissionResource support
    @Override
    @Transactional(readOnly = true)
    public Page<IntakeSubmission> findByFilters(String status, String practiceArea, String priority, Pageable pageable) {
        // This would need custom query methods in repository, for now use basic filtering
        if (status != null) {
            return intakeSubmissionRepository.findByStatus(status, pageable);
        }
        return intakeSubmissionRepository.findAll(pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeSubmission> findByPriorityThreshold(int threshold) {
        return intakeSubmissionRepository.findByPriorityScoreGreaterThanEqual(threshold);
    }

    @Override
    public IntakeSubmission markAsReviewed(Long id, Long attorneyId, String reviewNotes) {
        return reviewSubmission(id, attorneyId, reviewNotes);
    }

    @Override
    public Lead convertToLead(Long id, Long reviewedBy, Long assignedTo, String notes) {
        IntakeSubmission submission = findById(id)
            .orElseThrow(() -> new RuntimeException("Submission not found with ID: " + id));
        
        // Create lead from submission
        Lead lead = createLeadFromSubmission(submission);
        if (assignedTo != null) {
            lead.setAssignedTo(assignedTo);
        }
        if (notes != null) {
            lead.setNotes(notes);
        }
        
        lead = leadRepository.save(lead);
        
        // Update submission status and link to lead
        submission.setStatus("CONVERTED_TO_LEAD");
        submission.setLeadId(lead.getId());
        submission.setReviewedBy(reviewedBy);
        submission.setReviewedAt(new Timestamp(System.currentTimeMillis()));
        save(submission);
        
        return lead;
    }

    @Override
    public IntakeSubmission markAsRejected(Long id, Long attorneyId, String rejectionReason) {
        return rejectSubmission(id, attorneyId, rejectionReason);
    }

    @Override
    public List<Lead> bulkConvertToLeads(List<Long> submissionIds, Long reviewedBy, Long assignedTo, String notes) {
        List<Lead> createdLeads = new ArrayList<>();
        
        for (Long submissionId : submissionIds) {
            try {
                Lead lead = convertToLead(submissionId, reviewedBy, assignedTo, notes);
                createdLeads.add(lead);
            } catch (Exception e) {
                log.error("Failed to convert submission {} to lead", submissionId, e);
                // Continue with other submissions
            }
        }
        
        return createdLeads;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> getSubmissionCountsByStatus() {
        List<Object[]> statusCounts = intakeSubmissionRepository.getStatusStatistics();
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
    public Map<String, Long> getSubmissionCountsByPracticeArea() {
        // This would need a custom repository method - for now return empty map
        return new HashMap<>();
    }

    @Override
    @Transactional(readOnly = true)
    public List<IntakeSubmission> getRecentSubmissions(int limit) {
        // This would need a custom repository method with limit - for now use basic findAll
        List<IntakeSubmission> all = intakeSubmissionRepository.findAll();
        return all.stream()
            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
            .limit(limit)
            .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> getSubmissionsByPriorityRange() {
        Map<String, Long> priorityDistribution = new HashMap<>();
        
        // High priority (75-100)
        List<IntakeSubmission> highPriority = intakeSubmissionRepository.findByPriorityScoreGreaterThanEqual(75);
        priorityDistribution.put("HIGH", (long) highPriority.size());
        
        // Medium priority (40-74)
        List<IntakeSubmission> mediumPriority = intakeSubmissionRepository.findByPriorityScoreBetween(40, 74);
        priorityDistribution.put("MEDIUM", (long) mediumPriority.size());
        
        // Low priority (0-39)
        List<IntakeSubmission> lowPriority = intakeSubmissionRepository.findByPriorityScoreLessThan(40);
        priorityDistribution.put("LOW", (long) lowPriority.size());
        
        return priorityDistribution;
    }
}