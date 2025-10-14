package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.algorithm.SmartAssignmentAlgorithm;
import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.enumeration.*;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.repository.*;
import com.bostoneo.bostoneosolutions.service.CaseAssignmentService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
// import com.bostoneo.bostoneosolutions.service.UserService; // Temporarily commented
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class CaseAssignmentServiceImpl implements CaseAssignmentService {
    
    private final CaseAssignmentRepository assignmentRepository;
    private final UserWorkloadRepository workloadRepository;
    private final AttorneyExpertiseRepository expertiseRepository;
    private final CaseAssignmentHistoryRepository historyRepository;
    private final AssignmentRuleRepository ruleRepository;
    private final CaseTransferRequestRepository transferRequestRepository;
    private final CaseTaskRepository taskRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    // private final UserService userService; // Temporarily commented to avoid circular dependency
    private final SmartAssignmentAlgorithm smartAssignmentAlgorithm;
    
    @Override
    public CaseAssignmentDTO assignCase(CaseAssignmentRequest request) {
        log.info("Assigning case {} to user {}", request.getCaseId(), request.getUserId());
        
        // Validate request
        validateAssignmentRequest(request);
        
        // Check if user already assigned
        Optional<CaseAssignment> existing = assignmentRepository
            .findByCaseIdAndUserIdAndActive(request.getCaseId(), request.getUserId(), true);
        
        if (existing.isPresent()) {
            throw new ApiException("User already assigned to this case");
        }
        
        // Get entities
        LegalCase legalCase = legalCaseRepository.findById(request.getCaseId())
            .orElseThrow(() -> new ApiException(String.format("Legal case not found with ID: %d. Please verify the case exists.", request.getCaseId())));
        User assignedTo = userRepository.get(request.getUserId());
        if (assignedTo == null) {
            throw new ApiException(String.format("User not found with ID: %d", request.getUserId()));
        }
        User currentUser = getSystemUser(); // Temporarily use system user for testing
        
        // Create new assignment
        CaseAssignment assignment = CaseAssignment.builder()
            .legalCase(legalCase)
            .assignedTo(assignedTo)
            .roleType(request.getRoleType())
            .assignmentType(AssignmentType.MANUAL)
            .assignedBy(currentUser)
            .assignedAt(LocalDateTime.now())
            .effectiveFrom(request.getEffectiveFrom() != null ? 
                request.getEffectiveFrom() : LocalDate.now())
            .effectiveTo(request.getEffectiveTo())
            .workloadWeight(request.getWorkloadWeight() != null ? 
                request.getWorkloadWeight() : BigDecimal.ONE)
            .notes(request.getNotes())
            .active(true)
            .build();
        
        assignment = assignmentRepository.save(assignment);
        
        // Update workload
        updateUserWorkload(request.getUserId());
        
        // Record history
        recordAssignmentHistory(assignment, AssignmentAction.CREATED, null, currentUser);
        
        // Send notification to assigned user
        try {
            String title = "Case Assignment";
            String message = String.format("You have been assigned to case \"%s\" as %s", 
                legalCase.getTitle(), request.getRoleType().toString());
            
            notificationService.sendCrmNotification(title, message, request.getUserId(), 
                "CASE_ASSIGNMENT_ADDED", Map.of("caseId", request.getCaseId(), "assignmentId", assignment.getId()));
            
            log.info("Case assignment notification sent to user: {}", request.getUserId());
        } catch (Exception e) {
            log.error("Failed to send case assignment notification: {}", e.getMessage());
        }
        
        return mapToDTO(assignment);
    }
    
    @Override
    public CaseAssignmentDTO autoAssignCase(Long caseId) {
        log.info("Auto-assigning case {}", caseId);
        
        LegalCase legalCase = legalCaseRepository.findById(caseId)
            .orElseThrow(() -> new ApiException("Case not found"));
        
        // Use smart assignment algorithm
        AssignmentRecommendation recommendation = smartAssignmentAlgorithm
            .recommendAssignment(legalCase);
        
        if (recommendation == null || recommendation.getRecommendedUsers().isEmpty()) {
            throw new ApiException("No suitable attorney found for auto-assignment");
        }
        
        // Assign to the top recommended user
        User recommendedUser = recommendation.getRecommendedUsers().get(0).getUser();
        User systemUser = getSystemUser();
        
        CaseAssignment assignment = CaseAssignment.builder()
            .legalCase(legalCase)
            .assignedTo(recommendedUser)
            .roleType(CaseRoleType.LEAD_ATTORNEY)
            .assignmentType(AssignmentType.AUTO_ASSIGNED)
            .assignedBy(systemUser)
            .assignedAt(LocalDateTime.now())
            .effectiveFrom(LocalDate.now())
            .workloadWeight(recommendation.getWorkloadWeight())
            .expertiseMatchScore(recommendation.getMatchScore())
            .notes("Auto-assigned based on expertise and workload")
            .active(true)
            .build();
        
        assignment = assignmentRepository.save(assignment);
        
        // Update workload
        updateUserWorkload(recommendedUser.getId());
        
        // Record history
        recordAssignmentHistory(assignment, AssignmentAction.CREATED, 
            "Auto-assigned by system", systemUser);
        
        // Send notification to assigned user
        try {
            String title = "Case Auto-Assignment";
            String message = String.format("You have been auto-assigned to case \"%s\" as %s", 
                legalCase.getTitle(), CaseRoleType.LEAD_ATTORNEY.toString());
            
            notificationService.sendCrmNotification(title, message, recommendedUser.getId(), 
                "CASE_ASSIGNMENT_ADDED", Map.of("caseId", caseId, "assignmentId", assignment.getId()));
            
            log.info("Case auto-assignment notification sent to user: {}", recommendedUser.getId());
        } catch (Exception e) {
            log.error("Failed to send case auto-assignment notification: {}", e.getMessage());
        }
        
        return mapToDTO(assignment);
    }
    
    @Override
    public CaseAssignmentDTO transferCase(com.bostoneo.bostoneosolutions.dto.CaseTransferRequest request) {
        log.info("Transferring case {} from user {} to user {}", 
            request.getCaseId(), request.getFromUserId(), request.getToUserId());
        
        // Create transfer request
        LegalCase legalCase = legalCaseRepository.findById(request.getCaseId())
            .orElseThrow(() -> new ApiException("Case not found"));
        User fromUser = userRepository.get(request.getFromUserId());
        if (fromUser == null) {
            throw new ApiException("From user not found");
        }
        User toUser = userRepository.get(request.getToUserId());
        if (toUser == null) {
            throw new ApiException("To user not found");
        }
        User currentUser = getSystemUser(); // Temporarily use system user for testing
        
        // Check if transfer request already exists
        if (transferRequestRepository.existsPendingRequest(request.getCaseId(), request.getFromUserId())) {
            throw new ApiException("Transfer request already pending for this case");
        }
        
        com.bostoneo.bostoneosolutions.model.CaseTransferRequest transferReq = com.bostoneo.bostoneosolutions.model.CaseTransferRequest.builder()
            .legalCase(legalCase)
            .fromUser(fromUser)
            .toUser(toUser)
            .requestedBy(currentUser)
            .reason(request.getReason())
            .urgency(request.getUrgency())
            .status(TransferStatus.PENDING)
            .requestedAt(LocalDateTime.now())
            .build();
        
        transferReq = transferRequestRepository.save(transferReq);
        
        // If user has authority, auto-approve
        if (hasTransferAuthority(currentUser)) {
            return processTransfer(transferReq, currentUser, "Auto-approved");
        }
        
        return mapTransferToAssignmentDTO(transferReq);
    }
    
    @Override
    public void unassignCase(Long caseId, Long userId, String reason) {
        log.info("Unassigning user {} from case {}", userId, caseId);
        
        CaseAssignment assignment = assignmentRepository
            .findByCaseIdAndUserIdAndActive(caseId, userId, true)
            .orElseThrow(() -> new ApiException("Assignment not found"));
        
        User currentUser = getSystemUser(); // Temporarily use system user for testing
        
        // Deactivate assignment
        assignment.setActive(false);
        assignment.setEffectiveTo(LocalDate.now());
        assignmentRepository.save(assignment);
        
        // Update workload
        updateUserWorkload(userId);
        
        // Record history
        recordAssignmentHistory(assignment, AssignmentAction.DEACTIVATED, reason, currentUser);
    }
    
    @Override
    public List<CaseAssignmentDTO> getAllAssignments() {
        try {
            log.debug("Getting all case assignments");
            List<CaseAssignment> assignments = assignmentRepository.findAll();
            return assignments.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Error fetching all assignments: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    @Override
    public List<CaseAssignmentDTO> getCaseAssignments(Long caseId) {
        try {
            log.debug("Getting case assignments for case {}", caseId);
            List<CaseAssignment> assignments = assignmentRepository.findActiveByCaseId(caseId);
            return assignments.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Error fetching case assignments for case {}: {}", caseId, e.getMessage(), e);
            // Return empty list instead of failing
            return Collections.emptyList();
        }
    }
    
    @Override
    public Page<CaseAssignmentDTO> getUserAssignments(Long userId, Pageable pageable) {
        try {
            Page<CaseAssignment> assignments = assignmentRepository
                .findByUserIdWithPagination(userId, pageable);
            return assignments.map(this::mapToDTO);
        } catch (Exception e) {
            log.warn("Error fetching user assignments for user {}: {}", userId, e.getMessage());
            // Return empty page instead of failing
            return new PageImpl<>(Collections.emptyList(), pageable, 0);
        }
    }
    
    @Override
    public CaseAssignmentDTO getPrimaryAssignment(Long caseId) {
        Optional<CaseAssignment> assignment = assignmentRepository
            .findByCaseIdAndRoleType(caseId, CaseRoleType.LEAD_ATTORNEY);
        return assignment.map(this::mapToDTO).orElse(null);
    }
    
    @Override
    public List<CaseAssignmentDTO> getTeamMembers(Long caseId) {
        try {
            log.debug("Getting team members for case {}", caseId);
            List<CaseAssignment> assignments = assignmentRepository.findActiveByCaseId(caseId);
            return assignments.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Error fetching team members for case {}: {}", caseId, e.getMessage(), e);
            // Return empty list instead of failing
            return Collections.emptyList();
        }
    }
    
    @Override
    public UserWorkloadDTO calculateUserWorkload(Long userId) {
        log.debug("Calculating workload for user {}", userId);
        
        User user = userRepository.get(userId);
        if (user == null) {
            log.warn("User with ID {} not found, returning empty workload", userId);
            // Return a minimal workload DTO instead of throwing exception
            return UserWorkloadDTO.builder()
                .userId(userId)
                .userName("Unknown User")
                .userEmail("unknown@example.com")
                .calculationDate(LocalDate.now())
                .activeCasesCount(0)
                .totalWorkloadPoints(BigDecimal.ZERO)
                .capacityPercentage(BigDecimal.ZERO)
                .maxCapacityPoints(new BigDecimal("40.00"))
                .overdueTasksCount(0)
                .upcomingDeadlinesCount(0)
                .billableHoursWeek(BigDecimal.ZERO)
                .nonBillableHoursWeek(BigDecimal.ZERO)
                .averageResponseTimeHours(BigDecimal.ZERO)
                .lastCalculatedAt(LocalDateTime.now())
                .caseBreakdown(Collections.emptyList())
                .build();
        }
        
        // Get active assignments
        List<CaseAssignment> activeAssignments = assignmentRepository
            .findActiveAssignmentsByUserId(userId);

        // Filter out assignments with missing/deleted cases
        List<CaseAssignment> validAssignments = activeAssignments.stream()
            .filter(assignment -> {
                try {
                    // Check if the case exists before calculating points
                    if (assignment.getLegalCase() == null || assignment.getLegalCase().getId() == null) {
                        log.warn("Skipping assignment {} - case is null", assignment.getId());
                        return false;
                    }
                    // Try to access case ID to trigger lazy loading
                    Long caseId = assignment.getLegalCase().getId();
                    return true;
                } catch (Exception e) {
                    log.warn("Skipping assignment {} - case no longer exists: {}",
                        assignment.getId(), e.getMessage());
                    return false;
                }
            })
            .collect(Collectors.toList());

        // Calculate workload points from valid assignments
        BigDecimal totalPoints = validAssignments.stream()
            .map(this::calculateAssignmentPoints)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Get or create workload record
        UserWorkload workload = workloadRepository
            .findByUserIdAndCalculationDate(userId, LocalDate.now())
            .orElse(UserWorkload.builder()
                .user(user)
                .calculationDate(LocalDate.now())
                .maxCapacityPoints(new BigDecimal("40.00")) // Default capacity
                .build());

        // Update workload metrics (use only valid assignments count)
        workload.setActiveCasesCount(validAssignments.size());
        workload.setTotalWorkloadPoints(totalPoints);
        
        // Calculate capacity percentage (avoid division by zero)
        BigDecimal capacityPercentage = BigDecimal.ZERO;
        if (workload.getMaxCapacityPoints() != null && 
            workload.getMaxCapacityPoints().compareTo(BigDecimal.ZERO) > 0) {
            capacityPercentage = totalPoints
                .divide(workload.getMaxCapacityPoints(), 2, RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100"));
            
            // Cap the percentage at a reasonable maximum (300%)
            // This also ensures it fits in DECIMAL(5,2) column
            BigDecimal maxPercentage = new BigDecimal("300.00");
            if (capacityPercentage.compareTo(maxPercentage) > 0) {
                log.warn("User {} has extremely high workload: {}% of capacity. Capping at {}", 
                    userId, capacityPercentage, maxPercentage);
                capacityPercentage = maxPercentage;
            }
        }
        workload.setCapacityPercentage(capacityPercentage);
        
        // Count overdue tasks
        int overdueTasksCount = taskRepository.countOverdueTasksByUserId(userId);
        workload.setOverdueTasksCount(overdueTasksCount);
        
        // Count upcoming deadlines (next 7 days)
        int upcomingDeadlinesCount = taskRepository
            .countUpcomingDeadlinesByUserId(userId, LocalDateTime.now().plusDays(7));
        workload.setUpcomingDeadlinesCount(upcomingDeadlinesCount);
        
        try {
            workload = workloadRepository.save(workload);
        } catch (Exception e) {
            log.error("Failed to save workload for user {}: {}", userId, e.getMessage());
            // Return the calculated workload without persisting
        }
        
        // Create DTO with case breakdown
        UserWorkloadDTO dto = mapWorkloadToDTO(workload);
        dto.setCaseBreakdown(createCaseBreakdown(activeAssignments));
        
        return dto;
    }
    
    @Override
    public List<UserWorkloadDTO> getTeamWorkload(Long managerId) {
        // Find team members
        List<UserWorkload> teamWorkloads = workloadRepository
            .findTeamWorkloadByManager(managerId, LocalDate.now());
        
        return teamWorkloads.stream()
            .map(this::mapWorkloadToDTO)
            .collect(Collectors.toList());
    }
    
    @Override
    public WorkloadAnalyticsDTO getWorkloadAnalytics() {
        LocalDate today = LocalDate.now();
        
        // Get all active attorney workloads for today
        List<UserWorkload> allWorkloads = workloadRepository
            .findHighWorkloadUsers(today, BigDecimal.ZERO); // Get all workloads >= 0%
        
        if (allWorkloads.isEmpty()) {
            // If no workloads for today, try to get latest workloads
            // This is a fallback - in production you might want to calculate fresh workloads
            return WorkloadAnalyticsDTO.builder()
                .totalAttorneys(0)
                .overloadedAttorneys(0)
                .availableAttorneys(0)
                .averageWorkload(BigDecimal.ZERO)
                .build();
        }
        
        WorkloadAnalyticsDTO analytics = WorkloadAnalyticsDTO.builder()
            .totalAttorneys(allWorkloads.size())
            .overloadedAttorneys((int) allWorkloads.stream()
                .filter(w -> w.getCapacityPercentage().compareTo(new BigDecimal("90")) > 0)
                .count())
            .availableAttorneys((int) allWorkloads.stream()
                .filter(w -> w.getCapacityPercentage().compareTo(new BigDecimal("70")) < 0)
                .count())
            .averageWorkload(calculateAverageWorkload(allWorkloads))
            .build();
        
        return analytics;
    }
    
    @Override
    public List<AssignmentRuleDTO> getActiveRules() {
        List<AssignmentRule> rules = ruleRepository.findActiveRulesOrderByPriority();
        return rules.stream()
            .map(this::mapRuleToDTO)
            .collect(Collectors.toList());
    }
    
    @Override
    public AssignmentRuleDTO createRule(AssignmentRuleDTO ruleDTO) {
        AssignmentRule rule = AssignmentRule.builder()
            .ruleName(ruleDTO.getRuleName())
            .ruleType(ruleDTO.getRuleType())
            .caseType(ruleDTO.getCaseType())
            .priorityOrder(ruleDTO.getPriorityOrder())
            .active(ruleDTO.isActive())
            .maxWorkloadPercentage(ruleDTO.getMaxWorkloadPercentage())
            .minExpertiseScore(ruleDTO.getMinExpertiseScore())
            .preferPreviousAttorney(ruleDTO.isPreferPreviousAttorney())
            .ruleConditions(ruleDTO.getRuleConditions())
            .ruleActions(ruleDTO.getRuleActions())
            .build();
        
        rule = ruleRepository.save(rule);
        return mapRuleToDTO(rule);
    }
    
    @Override
    public void updateRule(Long ruleId, AssignmentRuleDTO ruleDTO) {
        AssignmentRule rule = ruleRepository.findById(ruleId)
            .orElseThrow(() -> new ApiException("Rule not found"));
        
        rule.setRuleName(ruleDTO.getRuleName());
        rule.setRuleType(ruleDTO.getRuleType());
        rule.setCaseType(ruleDTO.getCaseType());
        rule.setPriorityOrder(ruleDTO.getPriorityOrder());
        rule.setActive(ruleDTO.isActive());
        rule.setMaxWorkloadPercentage(ruleDTO.getMaxWorkloadPercentage());
        rule.setMinExpertiseScore(ruleDTO.getMinExpertiseScore());
        rule.setPreferPreviousAttorney(ruleDTO.isPreferPreviousAttorney());
        rule.setRuleConditions(ruleDTO.getRuleConditions());
        rule.setRuleActions(ruleDTO.getRuleActions());
        
        ruleRepository.save(rule);
    }
    
    @Override
    public Page<AssignmentHistoryDTO> getAssignmentHistory(Long caseId, Pageable pageable) {
        Page<CaseAssignmentHistory> history = historyRepository.findByCaseId(caseId, pageable);
        return history.map(this::mapHistoryToDTO);
    }
    
    @Override
    public Page<CaseTransferRequestDTO> getPendingTransferRequests(Pageable pageable) {
        Page<com.bostoneo.bostoneosolutions.model.CaseTransferRequest> requests = transferRequestRepository
            .findByStatus(TransferStatus.PENDING, pageable);
        return requests.map(this::mapTransferToDTO);
    }
    
    @Override
    public CaseTransferRequestDTO approveTransfer(Long requestId, String notes) {
        com.bostoneo.bostoneosolutions.model.CaseTransferRequest request = transferRequestRepository.findById(requestId)
            .orElseThrow(() -> new ApiException("Transfer request not found"));
        
        if (request.getStatus() != TransferStatus.PENDING) {
            throw new ApiException("Transfer request is not pending");
        }
        
        User currentUser = getSystemUser(); // Temporarily use system user for testing
        CaseAssignmentDTO result = processTransfer(request, currentUser, notes);
        
        return mapTransferToDTO(request);
    }
    
    @Override
    public CaseTransferRequestDTO rejectTransfer(Long requestId, String notes) {
        com.bostoneo.bostoneosolutions.model.CaseTransferRequest request = transferRequestRepository.findById(requestId)
            .orElseThrow(() -> new ApiException("Transfer request not found"));
        
        if (request.getStatus() != TransferStatus.PENDING) {
            throw new ApiException("Transfer request is not pending");
        }
        
        User currentUser = getSystemUser(); // Temporarily use system user for testing
        
        request.setStatus(TransferStatus.REJECTED);
        request.setApprovedBy(currentUser);
        request.setApprovalNotes(notes);
        request.setProcessedAt(LocalDateTime.now());
        
        transferRequestRepository.save(request);
        
        return mapTransferToDTO(request);
    }
    
    // Helper methods
    
    private void validateAssignmentRequest(CaseAssignmentRequest request) {
        if (request.getEffectiveFrom() != null && request.getEffectiveTo() != null) {
            if (request.getEffectiveFrom().isAfter(request.getEffectiveTo())) {
                throw new ApiException("Effective from date cannot be after effective to date");
            }
        }
    }
    
    private BigDecimal calculateCaseWorkloadWeight(LegalCase legalCase) {
        // Base weight
        BigDecimal weight = BigDecimal.ONE;
        
        // Adjust for priority
        if (legalCase.getPriority() == CasePriority.HIGH || 
            legalCase.getPriority() == CasePriority.URGENT) {
            weight = weight.multiply(new BigDecimal("1.5"));
        }
        
        return weight;
    }
    
    private BigDecimal calculateAssignmentPoints(CaseAssignment assignment) {
        BigDecimal basePoints = new BigDecimal("10");
        return basePoints.multiply(assignment.getWorkloadWeight());
    }
    
    private boolean hasTransferAuthority(User user) {
        // Check if user has manager or senior role
        return user.getRoles().stream()
            .anyMatch(role -> role.getName().contains("MANAGER") || 
                             role.getName().contains("SENIOR") ||
                             role.getName().contains("PARTNER"));
    }
    
    private CaseAssignmentDTO processTransfer(com.bostoneo.bostoneosolutions.model.CaseTransferRequest request, User approver, String notes) {
        // Find current assignment
        CaseAssignment currentAssignment = assignmentRepository
            .findByCaseIdAndUserIdAndActive(
                request.getLegalCase().getId(), 
                request.getFromUser().getId(), 
                true)
            .orElseThrow(() -> new ApiException("Current assignment not found"));
        
        // Deactivate current assignment
        currentAssignment.setActive(false);
        currentAssignment.setEffectiveTo(LocalDate.now());
        assignmentRepository.save(currentAssignment);
        
        // Create new assignment
        CaseAssignment newAssignment = CaseAssignment.builder()
            .legalCase(request.getLegalCase())
            .assignedTo(request.getToUser())
            .roleType(currentAssignment.getRoleType())
            .assignmentType(AssignmentType.TRANSFERRED)
            .assignedBy(approver)
            .assignedAt(LocalDateTime.now())
            .effectiveFrom(LocalDate.now())
            .workloadWeight(currentAssignment.getWorkloadWeight())
            .notes("Transferred: " + request.getReason())
            .active(true)
            .build();
        
        newAssignment = assignmentRepository.save(newAssignment);
        
        // Update transfer request
        request.setStatus(TransferStatus.APPROVED);
        request.setApprovedBy(approver);
        request.setApprovalNotes(notes);
        request.setProcessedAt(LocalDateTime.now());
        transferRequestRepository.save(request);
        
        // Update workloads
        updateUserWorkload(request.getFromUser().getId());
        updateUserWorkload(request.getToUser().getId());
        
        // Record history
        recordAssignmentHistory(newAssignment, AssignmentAction.TRANSFERRED, 
            String.format("Transferred from %s. Reason: %s", 
                getFullName(currentAssignment.getAssignedTo()), request.getReason()), 
            approver);
        
        return mapToDTO(newAssignment);
    }
    
    private void updateUserWorkload(Long userId) {
        calculateUserWorkload(userId);
    }
    
    private void recordAssignmentHistory(CaseAssignment assignment, AssignmentAction action, 
                                        String reason, User performedBy) {
        CaseAssignmentHistory history = CaseAssignmentHistory.builder()
            .caseAssignment(assignment)
            .caseId(assignment.getLegalCase().getId())
            .userId(assignment.getAssignedTo().getId())
            .action(action)
            .reason(reason)
            .performedBy(performedBy)
            .performedAt(LocalDateTime.now())
            .build();
        
        historyRepository.save(history);
    }
    
    private List<CaseWorkloadDTO> createCaseBreakdown(List<CaseAssignment> assignments) {
        return assignments.stream()
            .map(assignment -> CaseWorkloadDTO.builder()
                .caseId(assignment.getLegalCase().getId())
                .caseNumber(assignment.getLegalCase().getCaseNumber())
                .caseTitle(assignment.getLegalCase().getTitle())
                .caseType(assignment.getLegalCase().getType())
                .priority(assignment.getLegalCase().getPriority() != null ? 
                    assignment.getLegalCase().getPriority().toString() : "NORMAL")
                .workloadPoints(calculateAssignmentPoints(assignment))
                .roleType(assignment.getRoleType().getDisplayName())
                .build())
            .collect(Collectors.toList());
    }
    
    private BigDecimal calculateAverageWorkload(List<UserWorkload> workloads) {
        if (workloads.isEmpty()) return BigDecimal.ZERO;
        
        BigDecimal total = workloads.stream()
            .map(UserWorkload::getCapacityPercentage)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        return total.divide(new BigDecimal(workloads.size()), 2, RoundingMode.HALF_UP);
    }
    
    // Mapping methods
    
    private CaseAssignmentDTO mapToDTO(CaseAssignment assignment) {
        try {
            return CaseAssignmentDTO.builder()
                .id(assignment.getId())
                .caseId(assignment.getLegalCase() != null ? assignment.getLegalCase().getId() : null)
                .caseNumber(assignment.getLegalCase() != null ? assignment.getLegalCase().getCaseNumber() : "N/A")
                .caseTitle(assignment.getLegalCase() != null ? assignment.getLegalCase().getTitle() : "N/A")
                .userId(assignment.getAssignedTo() != null ? assignment.getAssignedTo().getId() : null)
                .userName(assignment.getAssignedTo() != null ? getFullName(assignment.getAssignedTo()) : "Unknown")
                .userEmail(assignment.getAssignedTo() != null ? assignment.getAssignedTo().getEmail() : "unknown@example.com")
                .roleType(assignment.getRoleType())
                .assignmentType(assignment.getAssignmentType())
                .assignedAt(assignment.getAssignedAt())
                .effectiveFrom(assignment.getEffectiveFrom())
                .effectiveTo(assignment.getEffectiveTo())
                .active(assignment.isActive())
                .workloadWeight(assignment.getWorkloadWeight())
                .expertiseMatchScore(assignment.getExpertiseMatchScore())
                .notes(assignment.getNotes())
                .assignedByName(assignment.getAssignedBy() != null ? 
                    getFullName(assignment.getAssignedBy()) : null)
                .createdAt(assignment.getCreatedAt())
                .updatedAt(assignment.getUpdatedAt())
                .build();
        } catch (Exception e) {
            log.error("Error mapping CaseAssignment to DTO: {}", e.getMessage(), e);
            // Return minimal DTO to prevent complete failure
            return CaseAssignmentDTO.builder()
                .id(assignment.getId())
                .caseId(null)
                .caseNumber("ERROR")
                .caseTitle("Error loading case")
                .userId(null)
                .userName("Error loading user")
                .userEmail("error@example.com")
                .roleType(assignment.getRoleType())
                .assignmentType(assignment.getAssignmentType())
                .assignedAt(assignment.getAssignedAt())
                .active(assignment.isActive())
                .build();
        }
    }
    
    private UserWorkloadDTO mapWorkloadToDTO(UserWorkload workload) {
        return UserWorkloadDTO.builder()
            .userId(workload.getUser().getId())
            .userName(getFullName(workload.getUser()))
            .userEmail(workload.getUser().getEmail())
            .calculationDate(workload.getCalculationDate())
            .activeCasesCount(workload.getActiveCasesCount())
            .totalWorkloadPoints(workload.getTotalWorkloadPoints())
            .capacityPercentage(workload.getCapacityPercentage())
            .maxCapacityPoints(workload.getMaxCapacityPoints())
            .workloadStatus(workload.getWorkloadStatus())
            .overdueTasksCount(workload.getOverdueTasksCount())
            .upcomingDeadlinesCount(workload.getUpcomingDeadlinesCount())
            .billableHoursWeek(workload.getBillableHoursWeek())
            .nonBillableHoursWeek(workload.getNonBillableHoursWeek())
            .averageResponseTimeHours(workload.getAverageResponseTimeHours())
            .lastCalculatedAt(workload.getLastCalculatedAt())
            .build();
    }
    
    private AssignmentRuleDTO mapRuleToDTO(AssignmentRule rule) {
        return AssignmentRuleDTO.builder()
            .id(rule.getId())
            .ruleName(rule.getRuleName())
            .ruleType(rule.getRuleType())
            .caseType(rule.getCaseType())
            .priorityOrder(rule.getPriorityOrder())
            .active(rule.isActive())
            .maxWorkloadPercentage(rule.getMaxWorkloadPercentage())
            .minExpertiseScore(rule.getMinExpertiseScore())
            .preferPreviousAttorney(rule.isPreferPreviousAttorney())
            .ruleConditions(rule.getRuleConditions())
            .ruleActions(rule.getRuleActions())
            .createdAt(rule.getCreatedAt())
            .updatedAt(rule.getUpdatedAt())
            .build();
    }
    
    private AssignmentHistoryDTO mapHistoryToDTO(CaseAssignmentHistory history) {
        return AssignmentHistoryDTO.builder()
            .id(history.getId())
            .caseAssignmentId(history.getCaseAssignment().getId())
            .caseId(history.getCaseId())
            .userId(history.getUserId())
            .action(history.getAction())
            .previousUserName(history.getPreviousUser() != null ? 
                getFullName(history.getPreviousUser()) : null)
            .newUserName(history.getNewUser() != null ? 
                getFullName(history.getNewUser()) : null)
            .reason(history.getReason())
            .performedByName(getFullName(history.getPerformedBy()))
            .performedAt(history.getPerformedAt())
            .metadata(history.getMetadata())
            .build();
    }
    
    private CaseTransferRequestDTO mapTransferToDTO(com.bostoneo.bostoneosolutions.model.CaseTransferRequest request) {
        return CaseTransferRequestDTO.builder()
            .id(request.getId())
            .caseId(request.getLegalCase().getId())
            .caseNumber(request.getLegalCase().getCaseNumber())
            .caseTitle(request.getLegalCase().getTitle())
            .fromUserId(request.getFromUser().getId())
            .fromUserName(getFullName(request.getFromUser()))
            .toUserId(request.getToUser().getId())
            .toUserName(getFullName(request.getToUser()))
            .requestedByName(getFullName(request.getRequestedBy()))
            .reason(request.getReason())
            .urgency(request.getUrgency())
            .status(request.getStatus())
            .approvedByName(request.getApprovedBy() != null ? 
                getFullName(request.getApprovedBy()) : null)
            .approvalNotes(request.getApprovalNotes())
            .requestedAt(request.getRequestedAt())
            .processedAt(request.getProcessedAt())
            .build();
    }
    
    private CaseAssignmentDTO mapTransferToAssignmentDTO(com.bostoneo.bostoneosolutions.model.CaseTransferRequest request) {
        // Return a simplified DTO for pending transfer
        return CaseAssignmentDTO.builder()
            .caseId(request.getLegalCase().getId())
            .caseNumber(request.getLegalCase().getCaseNumber())
            .caseTitle(request.getLegalCase().getTitle())
            .userId(request.getToUser().getId())
            .userName(getFullName(request.getToUser()))
            .notes("Transfer pending: " + request.getReason())
            .build();
    }
    
    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDTO) {
            UserDTO userDTO = (UserDTO) auth.getPrincipal();
            User user = userRepository.get(userDTO.getId());
            if (user == null) {
                throw new ApiException("Current user not found");
            }
            return user;
        }
        throw new ApiException("No authenticated user found");
    }
    
    private User getSystemUser() {
        // Return system user (usually ID 1 or a specific system user)
        User systemUser = userRepository.get(1L);
        if (systemUser == null) {
            systemUser = userRepository.findByEmail("system@bostoneo.com");
            if (systemUser == null) {
                throw new ApiException("System user not found");
            }
        }
        return systemUser;
    }
    
    private String getFullName(User user) {
        if (user == null) return null;
        return user.getFirstName() + " " + user.getLastName();
    }
}