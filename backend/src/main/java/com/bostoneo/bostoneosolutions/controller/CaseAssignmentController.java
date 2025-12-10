package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.CaseAssignmentService;
import com.bostoneo.bostoneosolutions.service.SecurityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/legal/case-assignments")
@RequiredArgsConstructor
@Slf4j
public class CaseAssignmentController {

    private final CaseAssignmentService caseAssignmentService;
    private final SecurityService securityService;

    // ==================== Get All Assignments ====================

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY')")
    public ResponseEntity<HttpResponse> getAllAssignments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        log.info("Getting all assignments with pagination: page={}, size={}", page, size);

        try {
            Sort sort = Sort.by(Sort.Direction.fromString(sortDir), sortBy);
            Pageable pageable = PageRequest.of(page, size, sort);
            Page<CaseAssignmentDTO> assignments = caseAssignmentService.getAllAssignments(pageable);

            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("assignments", assignments))
                    .message("All assignments retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error getting all assignments: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to retrieve assignments: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }

    // ==================== Assignment Operations ====================

    @PostMapping("/assign")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY', 'ROLE_FINANCE')")
    public ResponseEntity<HttpResponse> assignCase(@Valid @RequestBody CaseAssignmentRequest request) {
        log.info("Assigning case {} to user {}", request.getCaseId(), request.getUserId());
        
        try {
            CaseAssignmentDTO assignment = caseAssignmentService.assignCase(request);
            return ResponseEntity.status(CREATED).body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("assignment", assignment))
                    .message("Case assigned successfully")
                    .status(CREATED)
                    .statusCode(CREATED.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error assigning case: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to assign case: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    @PostMapping("/auto-assign/{caseId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY', 'ROLE_FINANCE')")
    public ResponseEntity<HttpResponse> autoAssignCase(@PathVariable Long caseId) {
        log.info("Auto-assigning case {}", caseId);
        
        try {
            CaseAssignmentDTO assignment = caseAssignmentService.autoAssignCase(caseId);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("assignment", assignment))
                    .message("Case auto-assigned successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error auto-assigning case: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to auto-assign case: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    @PostMapping("/transfer")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY')")
    public ResponseEntity<HttpResponse> transferCase(@Valid @RequestBody CaseTransferRequest request) {
        log.info("Requesting case transfer for case {}", request.getCaseId());
        
        try {
            CaseAssignmentDTO assignment = caseAssignmentService.transferCase(request);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("assignment", assignment))
                    .message("Case transfer completed successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error transferring case: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to transfer case: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    @DeleteMapping("/{caseId}/user/{userId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY', 'ROLE_FINANCE')")
    public ResponseEntity<HttpResponse> unassignCase(
            @PathVariable Long caseId,
            @PathVariable Long userId,
            @RequestParam(required = false) String reason) {
        log.info("Unassigning user {} from case {}", userId, caseId);
        
        try {
            caseAssignmentService.unassignCase(caseId, userId, reason);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("User unassigned from case successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error unassigning user from case: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to unassign user: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    // ==================== Query Operations ====================
    
    @GetMapping("/case/{caseId}")
    @PreAuthorize("hasRole('ROLE_USER') or @securityService.canAccessCase(#caseId)")
    public ResponseEntity<HttpResponse> getCaseAssignments(@PathVariable Long caseId) {
        log.info("Getting assignments for case {}", caseId);
        
        try {
            List<CaseAssignmentDTO> assignments = caseAssignmentService.getCaseAssignments(caseId);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("assignments", assignments))
                    .message("Case assignments retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error getting case assignments: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to retrieve assignments: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    @GetMapping("/user/{userId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY') or @securityService.isCurrentUser(#userId)")
    public ResponseEntity<HttpResponse> getUserAssignments(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "assignedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        log.info("Getting assignments for user {}", userId);
        
        try {
            Sort sort = Sort.by(Sort.Direction.fromString(sortDir), sortBy);
            Pageable pageable = PageRequest.of(page, size, sort);
            Page<CaseAssignmentDTO> assignments = caseAssignmentService.getUserAssignments(userId, pageable);
            
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("assignments", assignments))
                    .message("User assignments retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error getting user assignments: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to retrieve user assignments: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    @GetMapping("/case/{caseId}/primary")
    @PreAuthorize("hasRole('ROLE_USER') or @securityService.canAccessCase(#caseId)")
    public ResponseEntity<HttpResponse> getPrimaryAssignment(@PathVariable Long caseId) {
        log.info("Getting primary assignment for case {}", caseId);
        
        try {
            CaseAssignmentDTO assignment = caseAssignmentService.getPrimaryAssignment(caseId);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("assignment", assignment))
                    .message("Primary assignment retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error getting primary assignment: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to retrieve primary assignment: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    @GetMapping("/case/{caseId}/team")
    @PreAuthorize("hasRole('ROLE_USER') or @securityService.canAccessCase(#caseId)")
    public ResponseEntity<HttpResponse> getTeamMembers(@PathVariable Long caseId) {
        log.info("Getting team members for case {}", caseId);
        
        try {
            List<CaseAssignmentDTO> teamMembers = caseAssignmentService.getTeamMembers(caseId);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("teamMembers", teamMembers))
                    .message("Team members retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error getting team members: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to retrieve team members: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    // ==================== Workload Operations ====================
    
    @GetMapping("/workload/user/{userId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY') or @securityService.isCurrentUser(#userId)")
    public ResponseEntity<HttpResponse> getUserWorkload(@PathVariable Long userId) {
        log.info("Getting workload for user {}", userId);
        
        try {
            UserWorkloadDTO workload = caseAssignmentService.calculateUserWorkload(userId);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("workload", workload))
                    .message("User workload retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error getting user workload: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to retrieve user workload: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    @GetMapping("/workload/team/{managerId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY') or @securityService.isCurrentUser(#managerId)")
    public ResponseEntity<HttpResponse> getTeamWorkload(@PathVariable Long managerId) {
        log.info("Getting team workload for manager {}", managerId);
        
        try {
            List<UserWorkloadDTO> teamWorkload = caseAssignmentService.getTeamWorkload(managerId);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("teamWorkload", teamWorkload))
                    .message("Team workload retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error getting team workload: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to retrieve team workload: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    @GetMapping("/workload/analytics")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY')")
    public ResponseEntity<HttpResponse> getWorkloadAnalytics() {
        log.info("Getting workload analytics");
        
        try {
            WorkloadAnalyticsDTO analytics = caseAssignmentService.getWorkloadAnalytics();
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("analytics", analytics))
                    .message("Workload analytics retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error getting workload analytics: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to retrieve workload analytics: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    // ==================== Assignment Rules ====================
    
    @GetMapping("/rules")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY')")
    public ResponseEntity<HttpResponse> getActiveRules() {
        log.info("Getting active assignment rules");
        
        try {
            List<AssignmentRuleDTO> rules = caseAssignmentService.getActiveRules();
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("rules", rules))
                    .message("Assignment rules retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error getting assignment rules: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to retrieve assignment rules: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    @PostMapping("/rules")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY')")
    public ResponseEntity<HttpResponse> createRule(@Valid @RequestBody AssignmentRuleDTO rule) {
        log.info("Creating assignment rule");
        
        try {
            AssignmentRuleDTO createdRule = caseAssignmentService.createRule(rule);
            return ResponseEntity.status(CREATED).body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("rule", createdRule))
                    .message("Assignment rule created successfully")
                    .status(CREATED)
                    .statusCode(CREATED.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error creating assignment rule: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to create assignment rule: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    @PutMapping("/rules/{ruleId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY')")
    public ResponseEntity<HttpResponse> updateRule(
            @PathVariable Long ruleId,
            @Valid @RequestBody AssignmentRuleDTO rule) {
        log.info("Updating assignment rule {}", ruleId);
        
        try {
            caseAssignmentService.updateRule(ruleId, rule);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Assignment rule updated successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error updating assignment rule: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to update assignment rule: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    // ==================== History & Audit ====================
    
    @GetMapping("/history/case/{caseId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY') or @securityService.canAccessCase(#caseId)")
    public ResponseEntity<HttpResponse> getAssignmentHistory(
            @PathVariable Long caseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "performedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        log.info("Getting assignment history for case {}", caseId);
        
        try {
            Sort sort = Sort.by(Sort.Direction.fromString(sortDir), sortBy);
            Pageable pageable = PageRequest.of(page, size, sort);
            Page<AssignmentHistoryDTO> history = caseAssignmentService.getAssignmentHistory(caseId, pageable);
            
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("history", history))
                    .message("Assignment history retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error getting assignment history: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to retrieve assignment history: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    // ==================== Transfer Requests ====================
    
    @GetMapping("/transfer-requests")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY')")
    public ResponseEntity<HttpResponse> getPendingTransferRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "requestedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        log.info("Getting pending transfer requests");
        
        try {
            Sort sort = Sort.by(Sort.Direction.fromString(sortDir), sortBy);
            Pageable pageable = PageRequest.of(page, size, sort);
            Page<CaseTransferRequestDTO> requests = caseAssignmentService.getPendingTransferRequests(pageable);
            
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("requests", requests))
                    .message("Transfer requests retrieved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error getting transfer requests: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to retrieve transfer requests: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    @PostMapping("/transfer-requests/{requestId}/approve")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY')")
    public ResponseEntity<HttpResponse> approveTransfer(
            @PathVariable Long requestId,
            @RequestParam(required = false) String notes) {
        log.info("Approving transfer request {}", requestId);
        
        try {
            CaseTransferRequestDTO request = caseAssignmentService.approveTransfer(requestId, notes);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("request", request))
                    .message("Transfer request approved successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error approving transfer request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to approve transfer request: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
    
    @PostMapping("/transfer-requests/{requestId}/reject")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_ATTORNEY')")
    public ResponseEntity<HttpResponse> rejectTransfer(
            @PathVariable Long requestId,
            @RequestParam(required = false) String notes) {
        log.info("Rejecting transfer request {}", requestId);
        
        try {
            CaseTransferRequestDTO request = caseAssignmentService.rejectTransfer(requestId, notes);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(of("request", request))
                    .message("Transfer request rejected successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (Exception e) {
            log.error("Error rejecting transfer request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Failed to reject transfer request: " + e.getMessage())
                    .status(BAD_REQUEST)
                    .statusCode(BAD_REQUEST.value())
                    .build()
            );
        }
    }
} 