package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface CaseAssignmentService {
    
    // Assignment Operations
    CaseAssignmentDTO assignCase(CaseAssignmentRequest request);
    CaseAssignmentDTO autoAssignCase(Long caseId);
    CaseAssignmentDTO transferCase(CaseTransferRequest request);
    void unassignCase(Long caseId, Long userId, String reason);
    
    // Query Operations
    List<CaseAssignmentDTO> getAllAssignments();
    List<CaseAssignmentDTO> getCaseAssignments(Long caseId);
    Page<CaseAssignmentDTO> getUserAssignments(Long userId, Pageable pageable);
    CaseAssignmentDTO getPrimaryAssignment(Long caseId);
    List<CaseAssignmentDTO> getTeamMembers(Long caseId);
    
    // Workload Operations
    UserWorkloadDTO calculateUserWorkload(Long userId);
    List<UserWorkloadDTO> getTeamWorkload(Long managerId);
    WorkloadAnalyticsDTO getWorkloadAnalytics();
    
    // Assignment Rules
    List<AssignmentRuleDTO> getActiveRules();
    AssignmentRuleDTO createRule(AssignmentRuleDTO rule);
    void updateRule(Long ruleId, AssignmentRuleDTO rule);
    
    // History & Audit
    Page<AssignmentHistoryDTO> getAssignmentHistory(Long caseId, Pageable pageable);
    
    // Transfer Requests
    Page<CaseTransferRequestDTO> getPendingTransferRequests(Pageable pageable);
    CaseTransferRequestDTO approveTransfer(Long requestId, String notes);
    CaseTransferRequestDTO rejectTransfer(Long requestId, String notes);
}