package com.***REMOVED***.***REMOVED***solutions.resource;

import com.***REMOVED***.***REMOVED***solutions.dto.IntakeSubmissionDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.LeadConversionRequestDTO;
import com.***REMOVED***.***REMOVED***solutions.dtomapper.IntakeSubmissionDTOMapper;
import com.***REMOVED***.***REMOVED***solutions.model.IntakeSubmission;
import com.***REMOVED***.***REMOVED***solutions.model.Lead;
import com.***REMOVED***.***REMOVED***solutions.service.IntakeSubmissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/crm/intake-submissions")
@RequiredArgsConstructor
@Slf4j
public class IntakeSubmissionResource {

    private final IntakeSubmissionService intakeSubmissionService;
    private final IntakeSubmissionDTOMapper intakeSubmissionDTOMapper;

    @GetMapping
    public ResponseEntity<Page<IntakeSubmissionDTO>> getAllSubmissions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String practiceArea,
            @RequestParam(required = false) String priority) {
        
        log.info("Fetching intake submissions - page: {}, size: {}, status: {}, practiceArea: {}, priority: {}", 
            page, size, status, practiceArea, priority);
        
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        
        Page<IntakeSubmission> submissions;
        
        if (status != null || practiceArea != null || priority != null) {
            submissions = intakeSubmissionService.findByFilters(status, practiceArea, priority, pageable);
        } else {
            submissions = intakeSubmissionService.findAll(pageable);
        }
        
        Page<IntakeSubmissionDTO> submissionDTOs = submissions.map(intakeSubmissionDTOMapper::toDTO);
        
        return ResponseEntity.ok(submissionDTOs);
    }

    @GetMapping("/{id}")
    public ResponseEntity<IntakeSubmissionDTO> getSubmissionById(@PathVariable Long id) {
        log.info("Fetching intake submission with ID: {}", id);
        
        IntakeSubmission submission = intakeSubmissionService.findById(id).orElseThrow(() -> new RuntimeException("Submission not found"));
        IntakeSubmissionDTO submissionDTO = intakeSubmissionDTOMapper.toDTO(submission);
        
        return ResponseEntity.ok(submissionDTO);
    }

    @GetMapping("/pending-review")
    public ResponseEntity<Page<IntakeSubmissionDTO>> getPendingReviewSubmissions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        log.info("Fetching pending review submissions - page: {}, size: {}", page, size);
        
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<IntakeSubmission> submissions = intakeSubmissionService.findByStatus("PENDING", pageable);
        Page<IntakeSubmissionDTO> submissionDTOs = submissions.map(intakeSubmissionDTOMapper::toDTO);
        
        return ResponseEntity.ok(submissionDTOs);
    }

    @GetMapping("/high-priority")
    public ResponseEntity<List<IntakeSubmissionDTO>> getHighPrioritySubmissions() {
        log.info("Fetching high priority submissions");
        
        List<IntakeSubmission> submissions = intakeSubmissionService.findByPriorityThreshold(75);
        List<IntakeSubmissionDTO> submissionDTOs = submissions.stream()
            .map(intakeSubmissionDTOMapper::toDTO)
            .toList();
        
        return ResponseEntity.ok(submissionDTOs);
    }

    @PutMapping("/{id}/review")
    public ResponseEntity<IntakeSubmissionDTO> markAsReviewed(
            @PathVariable Long id,
            @RequestBody Map<String, String> reviewData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        log.info("Marking submission {} as reviewed by attorney: {}", id, userDetails.getUsername());
        
        Long attorneyId = 1L; // Extract from userDetails in real implementation
        String reviewNotes = reviewData.get("reviewNotes");
        
        IntakeSubmission submission = intakeSubmissionService.markAsReviewed(id, attorneyId, reviewNotes);
        IntakeSubmissionDTO submissionDTO = intakeSubmissionDTOMapper.toDTO(submission);
        
        return ResponseEntity.ok(submissionDTO);
    }

    @PostMapping("/{id}/convert-to-lead")
    public ResponseEntity<Map<String, Object>> convertToLead(
            @PathVariable Long id,
            @RequestBody @Valid LeadConversionRequestDTO conversionRequest,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        log.info("Converting submission {} to lead by attorney: {}", id, userDetails.getUsername());
        
        Long attorneyId = 1L; // Extract from userDetails in real implementation
        
        Lead lead = intakeSubmissionService.convertToLead(
            id, 
            attorneyId, 
            conversionRequest.getAssignedTo(), 
            conversionRequest.getNotes()
        );
        
        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Submission successfully converted to lead",
            "leadId", lead.getId(),
            "submissionId", id
        ));
    }

    @PutMapping("/{id}/reject")
    public ResponseEntity<IntakeSubmissionDTO> rejectSubmission(
            @PathVariable Long id,
            @RequestBody Map<String, String> rejectionData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        log.info("Rejecting submission {} by attorney: {}", id, userDetails.getUsername());
        
        Long attorneyId = 1L; // Extract from userDetails in real implementation
        String rejectionReason = rejectionData.get("rejectionReason");
        
        IntakeSubmission submission = intakeSubmissionService.markAsRejected(id, attorneyId, rejectionReason);
        IntakeSubmissionDTO submissionDTO = intakeSubmissionDTOMapper.toDTO(submission);
        
        return ResponseEntity.ok(submissionDTO);
    }

    @PutMapping("/{id}/mark-spam")
    public ResponseEntity<IntakeSubmissionDTO> markAsSpam(
            @PathVariable Long id,
            @RequestBody Map<String, String> spamData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        log.info("Marking submission {} as spam by attorney: {}", id, userDetails.getUsername());
        
        Long attorneyId = 1L; // Extract from userDetails in real implementation
        String spamReason = spamData.get("spamReason");
        
        IntakeSubmission submission = intakeSubmissionService.markAsSpam(id, attorneyId, spamReason);
        IntakeSubmissionDTO submissionDTO = intakeSubmissionDTOMapper.toDTO(submission);
        
        return ResponseEntity.ok(submissionDTO);
    }

    // Bulk Operations
    @PostMapping("/bulk/review")
    public ResponseEntity<Map<String, Object>> bulkReview(
            @RequestBody Map<String, Object> bulkData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        @SuppressWarnings("unchecked")
        List<Long> submissionIds = (List<Long>) bulkData.get("submissionIds");
        String reviewNotes = (String) bulkData.get("reviewNotes");
        
        log.info("Bulk reviewing {} submissions by attorney: {}", submissionIds.size(), userDetails.getUsername());
        
        Long attorneyId = 1L; // Extract from userDetails in real implementation
        
        List<IntakeSubmission> updatedSubmissions = intakeSubmissionService.bulkReview(submissionIds, attorneyId, reviewNotes);
        
        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Successfully reviewed " + updatedSubmissions.size() + " submissions",
            "updatedCount", updatedSubmissions.size()
        ));
    }

    @PostMapping("/bulk/convert-to-leads")
    public ResponseEntity<Map<String, Object>> bulkConvertToLeads(
            @RequestBody Map<String, Object> bulkData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        @SuppressWarnings("unchecked")
        List<Long> submissionIds = (List<Long>) bulkData.get("submissionIds");
        Long assignToAttorney = ((Number) bulkData.get("assignToAttorney")).longValue();
        String notes = (String) bulkData.get("notes");
        
        log.info("Bulk converting {} submissions to leads by attorney: {}", submissionIds.size(), userDetails.getUsername());
        
        Long attorneyId = 1L; // Extract from userDetails in real implementation
        
        List<Lead> createdLeads = intakeSubmissionService.bulkConvertToLeads(submissionIds, attorneyId, assignToAttorney, notes);
        
        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Successfully converted " + createdLeads.size() + " submissions to leads",
            "createdLeads", createdLeads.size(),
            "leadIds", createdLeads.stream().map(Lead::getId).toList()
        ));
    }

    @PostMapping("/bulk/reject")
    public ResponseEntity<Map<String, Object>> bulkReject(
            @RequestBody Map<String, Object> bulkData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        @SuppressWarnings("unchecked")
        List<Long> submissionIds = (List<Long>) bulkData.get("submissionIds");
        String rejectionReason = (String) bulkData.get("rejectionReason");
        
        log.info("Bulk rejecting {} submissions by attorney: {}", submissionIds.size(), userDetails.getUsername());
        
        Long attorneyId = 1L; // Extract from userDetails in real implementation
        
        List<IntakeSubmission> rejectedSubmissions = intakeSubmissionService.bulkReject(submissionIds, attorneyId, rejectionReason);
        
        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Successfully rejected " + rejectedSubmissions.size() + " submissions",
            "rejectedCount", rejectedSubmissions.size()
        ));
    }

    @PostMapping("/bulk/mark-spam")
    public ResponseEntity<Map<String, Object>> bulkMarkAsSpam(
            @RequestBody Map<String, Object> bulkData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        @SuppressWarnings("unchecked")
        List<Long> submissionIds = (List<Long>) bulkData.get("submissionIds");
        String spamReason = (String) bulkData.get("spamReason");
        
        log.info("Bulk marking {} submissions as spam by attorney: {}", submissionIds.size(), userDetails.getUsername());
        
        Long attorneyId = 1L; // Extract from userDetails in real implementation
        
        List<IntakeSubmission> spamSubmissions = intakeSubmissionService.bulkMarkAsSpam(submissionIds, attorneyId, spamReason);
        
        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Successfully marked " + spamSubmissions.size() + " submissions as spam",
            "spamCount", spamSubmissions.size()
        ));
    }

    // Analytics endpoints for attorney dashboard
    @GetMapping("/analytics/summary")
    public ResponseEntity<Map<String, Object>> getSubmissionSummary() {
        log.info("Fetching submission analytics summary");
        
        Map<String, Long> statusCounts = intakeSubmissionService.getSubmissionCountsByStatus();
        Map<String, Long> practiceAreaCounts = intakeSubmissionService.getSubmissionCountsByPracticeArea();
        List<IntakeSubmission> recentSubmissions = intakeSubmissionService.getRecentSubmissions(5);
        
        return ResponseEntity.ok(Map.of(
            "statusCounts", statusCounts,
            "practiceAreaCounts", practiceAreaCounts,
            "recentSubmissions", recentSubmissions.stream().map(intakeSubmissionDTOMapper::toDTO).toList(),
            "totalPending", statusCounts.getOrDefault("PENDING", 0L),
            "totalReviewed", statusCounts.getOrDefault("REVIEWED", 0L)
        ));
    }

    @GetMapping("/analytics/priority-distribution")
    public ResponseEntity<Map<String, Object>> getPriorityDistribution() {
        log.info("Fetching priority distribution analytics");
        
        Map<String, Long> priorityDistribution = intakeSubmissionService.getSubmissionsByPriorityRange();
        
        return ResponseEntity.ok(Map.of(
            "priorityDistribution", priorityDistribution,
            "highPriorityCount", priorityDistribution.getOrDefault("HIGH", 0L),
            "mediumPriorityCount", priorityDistribution.getOrDefault("MEDIUM", 0L),
            "lowPriorityCount", priorityDistribution.getOrDefault("LOW", 0L)
        ));
    }
}