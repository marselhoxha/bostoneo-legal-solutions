package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.algorithm.SmartAssignmentAlgorithm;
import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.enumeration.*;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.repository.*;
import com.bostoneo.bostoneosolutions.service.CaseAssignmentService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
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
    private final TenantService tenantService;
    // private final UserService userService; // Temporarily commented to avoid circular dependency
    private final SmartAssignmentAlgorithm smartAssignmentAlgorithm;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public CaseAssignmentDTO assignCase(CaseAssignmentRequest request) {
        log.info("Assigning case {} to user {}", request.getCaseId(), request.getUserId());
        Long orgId = getRequiredOrganizationId();

        // Validate request
        validateAssignmentRequest(request);

        // Check if user already assigned
        List<CaseAssignment> existing = assignmentRepository
            .findAllByCaseIdAndUserIdAndActive(request.getCaseId(), request.getUserId(), true);

        if (!existing.isEmpty()) {
            throw new ApiException("User already assigned to this case");
        }

        // SECURITY: Use tenant-filtered query
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(request.getCaseId(), orgId)
            .orElseThrow(() -> new ApiException(String.format("Legal case not found or access denied: %d", request.getCaseId())));
        User assignedTo = userRepository.get(request.getUserId());
        if (assignedTo == null) {
            throw new ApiException(String.format("User not found with ID: %d", request.getUserId()));
        }
        User currentUser = getSystemUser(); // Temporarily use system user for testing
        
        // Create new assignment
        CaseAssignment assignment = CaseAssignment.builder()
            .legalCase(legalCase)
            .organizationId(orgId)  // SECURITY: Set organization ID for tenant isolation
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
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
            .orElseThrow(() -> new ApiException("Case not found or access denied"));
        
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
            .organizationId(orgId)  // SECURITY: Set organization ID for tenant isolation
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
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(request.getCaseId(), orgId)
            .orElseThrow(() -> new ApiException("Case not found or access denied"));
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
            .organizationId(orgId)  // SECURITY: Set organization ID for tenant isolation
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
        Long orgId = getRequiredOrganizationId();

        // Debug: Check all assignments for this case - SECURITY: use org-filtered query
        List<CaseAssignment> allCaseAssignments = assignmentRepository.findActiveByCaseIdAndOrganizationId(caseId, orgId);
        log.info("All active assignments for case {}: {}", caseId, allCaseAssignments.size());
        for (CaseAssignment ca : allCaseAssignments) {
            log.info("  - Assignment ID: {}, User ID: {}, Active: {}", ca.getId(), ca.getAssignedTo().getId(), ca.isActive());
        }

        // Find all active assignments for this user/case (handles duplicates) - SECURITY: use org-filtered query
        List<CaseAssignment> assignments = assignmentRepository
            .findAllByCaseIdAndUserIdAndActiveAndOrganizationId(caseId, userId, true, orgId);

        log.info("Found {} assignments for caseId={}, userId={}, active=true", assignments.size(), caseId, userId);

        if (assignments.isEmpty()) {
            // Try to find any assignment (including inactive) for debugging - SECURITY: use org-filtered query
            List<CaseAssignment> anyAssignments = assignmentRepository
                .findAllByCaseIdAndUserIdAndActiveAndOrganizationId(caseId, userId, false, orgId);
            log.warn("No active assignments found. Inactive assignments for same user/case: {}", anyAssignments.size());
            throw new ApiException("Assignment not found");
        }

        User currentUser = getSystemUser(); // Temporarily use system user for testing

        // Deactivate all matching assignments (handles duplicates)
        for (CaseAssignment assignment : assignments) {
            assignment.setActive(false);
            assignment.setEffectiveTo(LocalDate.now());
            assignmentRepository.save(assignment);

            // Record history for each
            recordAssignmentHistory(assignment, AssignmentAction.DEACTIVATED, reason, currentUser);
        }

        log.info("Deactivated {} assignment(s) for user {} from case {}", assignments.size(), userId, caseId);

        // Update workload once
        updateUserWorkload(userId);
    }
    
    @Override
    public List<CaseAssignmentDTO> getAllAssignments() {
        try {
            log.debug("Getting all case assignments");
            // Use tenant-filtered query
            List<CaseAssignment> assignments = tenantService.getCurrentOrganizationId()
                .map(orgId -> assignmentRepository.findByOrganizationId(orgId))
                .orElseThrow(() -> new RuntimeException("Organization context required"));
            return assignments.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Error fetching all assignments: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    @Override
    public Page<CaseAssignmentDTO> getAllAssignments(Pageable pageable) {
        try {
            log.debug("Getting all case assignments with pagination: {}", pageable);
            // Use tenant-filtered query
            Page<CaseAssignment> assignmentsPage = tenantService.getCurrentOrganizationId()
                .map(orgId -> assignmentRepository.findByOrganizationIdAndActiveTrue(orgId, pageable))
                .orElseThrow(() -> new RuntimeException("Organization context required"));
            return assignmentsPage.map(this::mapToDTO);
        } catch (Exception e) {
            log.error("Error fetching all assignments with pagination: {}", e.getMessage(), e);
            return Page.empty(pageable);
        }
    }

    @Override
    public List<CaseAssignmentDTO> getCaseAssignments(Long caseId) {
        try {
            log.info("Getting case assignments for case {}", caseId);
            Long orgId = getRequiredOrganizationId();
            log.info("Checking case {} exists for org {}", caseId, orgId);
            boolean exists = legalCaseRepository.existsByIdAndOrganizationId(caseId, orgId);
            log.info("Case {} exists for org {}: {}", caseId, orgId, exists);
            // SECURITY: Verify case belongs to current organization
            if (!exists) {
                log.warn("Case {} not found or access denied for org {}", caseId, orgId);
                return Collections.emptyList();
            }
            // SECURITY: Use tenant-filtered query
            List<CaseAssignment> assignments = assignmentRepository.findActiveByCaseIdAndOrganizationId(caseId, orgId);
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
            Long orgId = getRequiredOrganizationId();
            // SECURITY: Verify user belongs to current organization
            User user = userRepository.get(userId);
            if (user == null || !orgId.equals(user.getOrganizationId())) {
                log.warn("User {} not found or access denied for org {}", userId, orgId);
                return new PageImpl<>(Collections.emptyList(), pageable, 0);
            }
            // SECURITY: Use tenant-filtered query
            Page<CaseAssignment> assignments = assignmentRepository
                .findByOrganizationIdAndUserId(orgId, userId, pageable);
            return assignments.map(this::mapToDTO);
        } catch (Exception e) {
            log.warn("Error fetching user assignments for user {}: {}", userId, e.getMessage());
            // Return empty page instead of failing
            return new PageImpl<>(Collections.emptyList(), pageable, 0);
        }
    }
    
    @Override
    public CaseAssignmentDTO getPrimaryAssignment(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify case belongs to current organization
        if (!legalCaseRepository.existsByIdAndOrganizationId(caseId, orgId)) {
            log.warn("Case {} not found or access denied for org {}", caseId, orgId);
            return null;
        }
        // SECURITY: Use tenant-filtered query
        Optional<CaseAssignment> assignment = assignmentRepository
            .findByCaseIdAndRoleTypeAndOrganizationId(caseId, CaseRoleType.LEAD_ATTORNEY, orgId);
        return assignment.map(this::mapToDTO).orElse(null);
    }

    @Override
    public List<CaseAssignmentDTO> getTeamMembers(Long caseId) {
        try {
            log.debug("Getting team members for case {}", caseId);
            Long orgId = getRequiredOrganizationId();
            // SECURITY: Verify case belongs to current organization
            if (!legalCaseRepository.existsByIdAndOrganizationId(caseId, orgId)) {
                log.warn("Case {} not found or access denied for org {}", caseId, orgId);
                return Collections.emptyList();
            }
            // SECURITY: Use tenant-filtered query
            List<CaseAssignment> assignments = assignmentRepository.findActiveByCaseIdAndOrganizationId(caseId, orgId);
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
        Long orgId = getRequiredOrganizationId();

        User user = userRepository.get(userId);
        if (user == null || !orgId.equals(user.getOrganizationId())) {
            log.warn("User with ID {} not found or access denied, returning empty workload", userId);
            // Return a minimal workload DTO instead of throwing exception
            return UserWorkloadDTO.builder()
                .userId(userId)
                .userName("Unknown User")
                .userEmail("unknown@example.com")
                .calculationDate(LocalDate.now())
                .activeCasesCount(0)
                .totalWorkloadPoints(BigDecimal.ZERO)
                .capacityPercentage(BigDecimal.ZERO)
                .maxCapacityPoints(new BigDecimal("100.00"))
                .overdueTasksCount(0)
                .upcomingDeadlinesCount(0)
                .billableHoursWeek(BigDecimal.ZERO)
                .nonBillableHoursWeek(BigDecimal.ZERO)
                .averageResponseTimeHours(BigDecimal.ZERO)
                .lastCalculatedAt(LocalDateTime.now())
                .caseBreakdown(Collections.emptyList())
                .build();
        }

        // SECURITY: Get active assignments with org filter
        List<CaseAssignment> activeAssignments = assignmentRepository
            .findActiveAssignmentsByUserIdAndOrganizationId(userId, orgId);

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

        // Get or create workload record - SECURITY: Use tenant-filtered query
        // Default maxCapacity of 100 means: 10 cases at weight 1.0 = 100% capacity
        UserWorkload workload = workloadRepository
            .findByOrganizationIdAndUserIdAndCalculationDate(orgId, userId, LocalDate.now())
            .orElse(UserWorkload.builder()
                .organizationId(orgId)
                .user(user)
                .calculationDate(LocalDate.now())
                .maxCapacityPoints(new BigDecimal("100.00")) // Default capacity: 10 cases = 100%
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
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        List<UserWorkload> teamWorkloads = workloadRepository
            .findTeamWorkloadByManagerAndOrganization(orgId, managerId, LocalDate.now());

        return teamWorkloads.stream()
            .map(this::mapWorkloadToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public WorkloadAnalyticsDTO getWorkloadAnalytics() {
        Long orgId = getRequiredOrganizationId();
        LocalDate today = LocalDate.now();

        // SECURITY: Use tenant-filtered query to get all workloads >= 0%
        List<UserWorkload> allWorkloads = workloadRepository
            .findHighWorkloadUsersByOrganization(orgId, today, BigDecimal.ZERO);
        
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
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        List<AssignmentRule> rules = ruleRepository.findActiveRulesOrderByPriorityByOrganization(orgId);
        return rules.stream()
            .map(this::mapRuleToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public AssignmentRuleDTO createRule(AssignmentRuleDTO ruleDTO) {
        Long orgId = getRequiredOrganizationId();
        AssignmentRule rule = AssignmentRule.builder()
            .organizationId(orgId) // SECURITY: Set organization ID
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
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        AssignmentRule rule = ruleRepository.findByIdAndOrganizationId(ruleId, orgId)
            .orElseThrow(() -> new ApiException("Rule not found or access denied"));

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
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify case belongs to current organization
        if (!legalCaseRepository.existsByIdAndOrganizationId(caseId, orgId)) {
            throw new ApiException("Case not found or access denied: " + caseId);
        }
        // SECURITY: Use tenant-filtered query
        Page<CaseAssignmentHistory> history = historyRepository.findByOrganizationIdAndCaseId(orgId, caseId, pageable);
        return history.map(this::mapHistoryToDTO);
    }
    
    @Override
    public Page<CaseTransferRequestDTO> getPendingTransferRequests(Pageable pageable) {
        // SECURITY: Use tenant-filtered query
        Page<com.bostoneo.bostoneosolutions.model.CaseTransferRequest> requests = tenantService.getCurrentOrganizationId()
            .map(orgId -> transferRequestRepository.findByOrganizationIdAndStatus(orgId, TransferStatus.PENDING, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        return requests.map(this::mapTransferToDTO);
    }
    
    @Override
    public CaseTransferRequestDTO approveTransfer(Long requestId, String notes) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        com.bostoneo.bostoneosolutions.model.CaseTransferRequest request = transferRequestRepository.findByIdAndOrganizationId(requestId, orgId)
            .orElseThrow(() -> new ApiException("Transfer request not found or access denied"));

        if (request.getStatus() != TransferStatus.PENDING) {
            throw new ApiException("Transfer request is not pending");
        }

        User currentUser = getSystemUser(); // Temporarily use system user for testing
        CaseAssignmentDTO result = processTransfer(request, currentUser, notes);

        return mapTransferToDTO(request);
    }

    @Override
    public CaseTransferRequestDTO rejectTransfer(Long requestId, String notes) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        com.bostoneo.bostoneosolutions.model.CaseTransferRequest request = transferRequestRepository.findByIdAndOrganizationId(requestId, orgId)
            .orElseThrow(() -> new ApiException("Transfer request not found or access denied"));
        
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
        // Base points per case - designed so that 10 cases = 100% capacity with default maxCapacity of 100
        BigDecimal basePoints = new BigDecimal("10");
        BigDecimal weight = assignment.getWorkloadWeight();

        // Normalize weight - if it's > 10, it's likely a percentage (old format), convert to multiplier
        if (weight == null || weight.compareTo(BigDecimal.ZERO) <= 0) {
            weight = BigDecimal.ONE;
        } else if (weight.compareTo(new BigDecimal("10")) > 0) {
            // Convert percentage-like values (e.g., 35, 50) to reasonable multiplier (e.g., 1.0-2.0)
            // Treat as percentage and normalize: 50 -> 1.0, 100 -> 2.0
            weight = weight.divide(new BigDecimal("50"), 2, RoundingMode.HALF_UP);
        }

        return basePoints.multiply(weight);
    }
    
    private boolean hasTransferAuthority(User user) {
        // Check if user has manager or senior role
        return user.getRoles().stream()
            .anyMatch(role -> role.getName().contains("MANAGER") || 
                             role.getName().contains("SENIOR") ||
                             role.getName().contains("PARTNER"));
    }
    
    private CaseAssignmentDTO processTransfer(com.bostoneo.bostoneosolutions.model.CaseTransferRequest request, User approver, String notes) {
        log.info("Processing transfer for case {} from user {} to user {}",
            request.getLegalCase().getId(), request.getFromUser().getId(), request.getToUser().getId());

        // Find current assignment(s) from the fromUser
        List<CaseAssignment> currentAssignments = assignmentRepository
            .findAllByCaseIdAndUserIdAndActive(
                request.getLegalCase().getId(),
                request.getFromUser().getId(),
                true);

        CaseRoleType roleType = CaseRoleType.LEAD_ATTORNEY; // Default role
        BigDecimal workloadWeight = BigDecimal.ONE;

        // Deactivate current assignment if exists
        if (!currentAssignments.isEmpty()) {
            CaseAssignment currentAssignment = currentAssignments.get(0);
            roleType = currentAssignment.getRoleType();
            workloadWeight = currentAssignment.getWorkloadWeight();

            // Deactivate all matching assignments
            for (CaseAssignment ca : currentAssignments) {
                ca.setActive(false);
                ca.setEffectiveTo(LocalDate.now());
                assignmentRepository.save(ca);
            }
            log.info("Deactivated {} existing assignment(s)", currentAssignments.size());
        } else {
            log.warn("No active assignment found for fromUser {}, creating new assignment for toUser anyway",
                request.getFromUser().getId());
        }

        // Create new assignment for toUser
        Long orgId = getRequiredOrganizationId();
        CaseAssignment newAssignment = CaseAssignment.builder()
            .legalCase(request.getLegalCase())
            .organizationId(orgId)  // SECURITY: Set organization ID for tenant isolation
            .assignedTo(request.getToUser())
            .roleType(roleType)
            .assignmentType(AssignmentType.TRANSFERRED)
            .assignedBy(approver)
            .assignedAt(LocalDateTime.now())
            .effectiveFrom(LocalDate.now())
            .workloadWeight(workloadWeight)
            .notes("Transferred: " + request.getReason())
            .active(true)
            .build();

        newAssignment = assignmentRepository.save(newAssignment);
        log.info("Created new assignment {} for user {}", newAssignment.getId(), request.getToUser().getId());

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
        String historyNote = currentAssignments.isEmpty()
            ? String.format("Assigned via transfer request. Reason: %s", request.getReason())
            : String.format("Transferred from %s. Reason: %s",
                getFullName(currentAssignments.get(0).getAssignedTo()), request.getReason());

        recordAssignmentHistory(newAssignment, AssignmentAction.TRANSFERRED, historyNote, approver);

        return mapToDTO(newAssignment);
    }
    
    private void updateUserWorkload(Long userId) {
        calculateUserWorkload(userId);
    }
    
    private void recordAssignmentHistory(CaseAssignment assignment, AssignmentAction action,
                                        String reason, User performedBy) {
        Long orgId = getRequiredOrganizationId();
        CaseAssignmentHistory history = CaseAssignmentHistory.builder()
            .organizationId(orgId)
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
                .userImageUrl(assignment.getAssignedTo() != null ? assignment.getAssignedTo().getImageUrl() : null)
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