package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.AssignedAttorneyDTO;
import com.bostoneo.bostoneosolutions.dto.CaseActivityDTO;
import com.bostoneo.bostoneosolutions.dto.CaseDocumentDTO;
import com.bostoneo.bostoneosolutions.dto.DocumentDTO;
import com.bostoneo.bostoneosolutions.dto.DocumentVersionDTO;
import com.bostoneo.bostoneosolutions.dto.LegalCaseDTO;
import com.bostoneo.bostoneosolutions.dto.LegalDocumentDTO;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.dto.CreateActivityRequest;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.enumeration.DocumentStatus;
import com.bostoneo.bostoneosolutions.enumeration.DocumentType;
import com.bostoneo.bostoneosolutions.enumeration.DocumentCategory;
import com.bostoneo.bostoneosolutions.exception.LegalCaseException;
import com.bostoneo.bostoneosolutions.dtomapper.LegalCaseDTOMapper;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.LegalDocument;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.model.DocumentVersion;
import com.bostoneo.bostoneosolutions.model.Client;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.repository.DocumentVersionRepository;
import com.bostoneo.bostoneosolutions.repository.ClientRepository;
import com.bostoneo.bostoneosolutions.repository.CaseAssignmentRepository;
import com.bostoneo.bostoneosolutions.model.CaseAssignment;
import com.bostoneo.bostoneosolutions.service.LegalCaseService;
import com.bostoneo.bostoneosolutions.service.LegalDocumentService;
import com.bostoneo.bostoneosolutions.service.UserService;
import com.bostoneo.bostoneosolutions.service.CaseActivityService;
import com.bostoneo.bostoneosolutions.service.RoleService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.util.CustomHttpResponse;
import com.bostoneo.bostoneosolutions.util.RoleUtils;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class LegalCaseServiceImpl implements LegalCaseService {

    private final LegalCaseRepository legalCaseRepository;
    private final LegalCaseDTOMapper legalCaseDTOMapper;
    private final LegalDocumentService documentService;
    private final ObjectMapper objectMapper;
    private final UserService userService;
    private final DocumentVersionRepository documentVersionRepository;
    private final CaseActivityService caseActivityService;
    private final RoleService roleService;
    private final ClientRepository clientRepository;
    private final NotificationService notificationService;
    private final CaseAssignmentRepository caseAssignmentRepository;
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    /**
     * Get the current user's ID from the security context.
     * Returns null if the user cannot be determined.
     */
    private Long getCurrentUserId() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                Object principal = authentication.getPrincipal();
                if (principal instanceof UserDTO) {
                    return ((UserDTO) principal).getId();
                }
            }
        } catch (Exception e) {
            log.warn("Could not get current user ID: {}", e.getMessage());
        }
        return null;
    }

    @Override
    public LegalCaseDTO createCase(LegalCaseDTO caseDTO) {
        // SECURITY: Set organization_id from tenant context for multi-tenant isolation
        Long orgId = getRequiredOrganizationId();

        LegalCase legalCase = legalCaseDTOMapper.toEntity(caseDTO);
        legalCase.setOrganizationId(orgId);
        legalCase = legalCaseRepository.save(legalCase);
        return legalCaseDTOMapper.toDTO(legalCase);
    }

    @Override
    public LegalCaseDTO updateCase(Long id, LegalCaseDTO caseDTO) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        LegalCase existingCase = legalCaseRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new LegalCaseException("Case not found or access denied: " + id));

        // Capture old values for notification comparison
        String oldStatus = existingCase.getStatus() != null ? existingCase.getStatus().toString() : null;
        String oldPriority = existingCase.getPriority() != null ? existingCase.getPriority().toString() : null;
        
        // Update fields from DTO
        existingCase.setTitle(caseDTO.getTitle());
        existingCase.setClientName(caseDTO.getClientName());
        existingCase.setClientEmail(caseDTO.getClientEmail());
        existingCase.setClientPhone(caseDTO.getClientPhone());
        existingCase.setClientAddress(caseDTO.getClientAddress());
        existingCase.setStatus(caseDTO.getStatus());
        existingCase.setPriority(caseDTO.getPriority());
        existingCase.setType(caseDTO.getType());
        existingCase.setDescription(caseDTO.getDescription());
        
        // Update court info
        existingCase.setCountyName(caseDTO.getCountyName());
        existingCase.setCourtroom(caseDTO.getCourtroom());
        existingCase.setJudgeName(caseDTO.getJudgeName());
        
        // Update important dates
        existingCase.setFilingDate(caseDTO.getFilingDate());
        existingCase.setNextHearing(caseDTO.getNextHearing());
        existingCase.setTrialDate(caseDTO.getTrialDate());
        
        // Update billing info
        existingCase.setHourlyRate(caseDTO.getHourlyRate());
        existingCase.setTotalHours(caseDTO.getTotalHours());
        existingCase.setTotalAmount(caseDTO.getTotalAmount());
        existingCase.setPaymentStatus(caseDTO.getPaymentStatus());

        // Update Personal Injury (PI) fields - only if provided (not null)
        if (caseDTO.getInjuryDate() != null) existingCase.setInjuryDate(caseDTO.getInjuryDate());
        if (caseDTO.getInjuryType() != null) existingCase.setInjuryType(caseDTO.getInjuryType());
        if (caseDTO.getInjuryDescription() != null) existingCase.setInjuryDescription(caseDTO.getInjuryDescription());
        if (caseDTO.getAccidentLocation() != null) existingCase.setAccidentLocation(caseDTO.getAccidentLocation());
        if (caseDTO.getLiabilityAssessment() != null) existingCase.setLiabilityAssessment(caseDTO.getLiabilityAssessment());
        if (caseDTO.getComparativeNegligencePercent() != null) existingCase.setComparativeNegligencePercent(caseDTO.getComparativeNegligencePercent());
        if (caseDTO.getMedicalProviders() != null) existingCase.setMedicalProviders(caseDTO.getMedicalProviders());
        if (caseDTO.getMedicalExpensesTotal() != null) existingCase.setMedicalExpensesTotal(caseDTO.getMedicalExpensesTotal().doubleValue());
        if (caseDTO.getLostWages() != null) existingCase.setLostWages(caseDTO.getLostWages().doubleValue());
        if (caseDTO.getFutureMedicalEstimate() != null) existingCase.setFutureMedicalEstimate(caseDTO.getFutureMedicalEstimate().doubleValue());
        if (caseDTO.getPainSufferingMultiplier() != null) existingCase.setPainSufferingMultiplier(caseDTO.getPainSufferingMultiplier().doubleValue());
        if (caseDTO.getSettlementDemandAmount() != null) existingCase.setSettlementDemandAmount(caseDTO.getSettlementDemandAmount().doubleValue());
        if (caseDTO.getSettlementOfferAmount() != null) existingCase.setSettlementOfferAmount(caseDTO.getSettlementOfferAmount().doubleValue());
        if (caseDTO.getSettlementFinalAmount() != null) existingCase.setSettlementFinalAmount(caseDTO.getSettlementFinalAmount().doubleValue());
        if (caseDTO.getSettlementDate() != null) existingCase.setSettlementDate(caseDTO.getSettlementDate());
        if (caseDTO.getInsuranceCompany() != null) existingCase.setInsuranceCompany(caseDTO.getInsuranceCompany());
        if (caseDTO.getInsurancePolicyNumber() != null) existingCase.setInsurancePolicyNumber(caseDTO.getInsurancePolicyNumber());
        if (caseDTO.getInsurancePolicyLimit() != null) existingCase.setInsurancePolicyLimit(caseDTO.getInsurancePolicyLimit().doubleValue());
        if (caseDTO.getInsuranceAdjusterName() != null) existingCase.setInsuranceAdjusterName(caseDTO.getInsuranceAdjusterName());
        if (caseDTO.getInsuranceAdjusterContact() != null) existingCase.setInsuranceAdjusterContact(caseDTO.getInsuranceAdjusterContact());
        if (caseDTO.getInsuranceAdjusterEmail() != null) existingCase.setInsuranceAdjusterEmail(caseDTO.getInsuranceAdjusterEmail());
        if (caseDTO.getInsuranceAdjusterPhone() != null) existingCase.setInsuranceAdjusterPhone(caseDTO.getInsuranceAdjusterPhone());
        if (caseDTO.getEmployerName() != null) existingCase.setEmployerName(caseDTO.getEmployerName());
        if (caseDTO.getEmployerEmail() != null) existingCase.setEmployerEmail(caseDTO.getEmployerEmail());
        if (caseDTO.getEmployerPhone() != null) existingCase.setEmployerPhone(caseDTO.getEmployerPhone());
        if (caseDTO.getEmployerHrContact() != null) existingCase.setEmployerHrContact(caseDTO.getEmployerHrContact());
        if (caseDTO.getDefendantName() != null) existingCase.setDefendantName(caseDTO.getDefendantName());
        if (caseDTO.getDefendantAddress() != null) existingCase.setDefendantAddress(caseDTO.getDefendantAddress());

        existingCase = legalCaseRepository.save(existingCase);

        // Check for status changes and trigger notifications
        String newStatus = existingCase.getStatus() != null ? existingCase.getStatus().toString() : null;
        String newPriority = existingCase.getPriority() != null ? existingCase.getPriority().toString() : null;

        // Get the current user's ID to exclude from notifications (don't notify yourself)
        Long currentUserId = getCurrentUserId();

        // Trigger notifications for case status changes
        if (oldStatus != null && newStatus != null && !oldStatus.equals(newStatus)) {
            try {
                String title = "Case Status Changed";
                String message = String.format("Case \"%s\" status changed from %s to %s",
                    existingCase.getTitle(), oldStatus, newStatus);

                // Get all users assigned to this case
                Set<Long> notificationUserIds = new HashSet<>();
                try {
                    List<CaseAssignment> caseAssignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(existingCase.getId(), orgId);
                    for (CaseAssignment assignment : caseAssignments) {
                        if (assignment.getAssignedTo() != null) {
                            notificationUserIds.add(assignment.getAssignedTo().getId());
                        }
                    }
                } catch (Exception e) {
                    log.error("Failed to get case assignments for notifications: {}", e.getMessage());
                }

                // Remove the current user from notification list (don't notify yourself)
                notificationUserIds.remove(currentUserId);

                // Send notification to each assigned user
                for (Long userId : notificationUserIds) {
                    notificationService.sendCrmNotification(title, message, userId, "CASE_STATUS_CHANGED",
                        Map.of("caseId", existingCase.getId(), "oldStatus", oldStatus, "newStatus", newStatus));
                }

                log.info("Case status change notifications sent to {} users for case ID: {}, status: {} -> {}",
                    notificationUserIds.size(),
                    existingCase.getId(), oldStatus, newStatus);
            } catch (Exception e) {
                log.error("Failed to send case status change notification for case ID: {}", existingCase.getId(), e);
            }
        }

        // Trigger notifications for case priority changes
        if (oldPriority != null && newPriority != null && !oldPriority.equals(newPriority)) {
            try {
                String title = "Case Priority Changed";
                String message = String.format("Case \"%s\" priority changed from %s to %s",
                    existingCase.getTitle(), oldPriority, newPriority);

                // Get all users assigned to this case
                Set<Long> notificationUserIds = new HashSet<>();
                try {
                    List<CaseAssignment> caseAssignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(existingCase.getId(), orgId);
                    for (CaseAssignment assignment : caseAssignments) {
                        if (assignment.getAssignedTo() != null) {
                            notificationUserIds.add(assignment.getAssignedTo().getId());
                        }
                    }
                } catch (Exception e) {
                    log.error("Failed to get case assignments for notifications: {}", e.getMessage());
                }

                // Remove the current user from notification list (don't notify yourself)
                notificationUserIds.remove(currentUserId);

                // Send notification to each assigned user
                for (Long userId : notificationUserIds) {
                    notificationService.sendCrmNotification(title, message, userId, "CASE_PRIORITY_CHANGED",
                        Map.of("caseId", existingCase.getId(), "oldPriority", oldPriority, "newPriority", newPriority));
                }

                log.info("Case priority change notifications sent to {} users for case ID: {}, priority: {} -> {}",
                    notificationUserIds.size(),
                    existingCase.getId(), oldPriority, newPriority);
            } catch (Exception e) {
                log.error("Failed to send case priority change notification for case ID: {}", existingCase.getId(), e);
            }
        }

        return legalCaseDTOMapper.toDTO(existingCase);
    }

    @Override
    public LegalCaseDTO getCase(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new LegalCaseException("Case not found or access denied: " + id));
        return legalCaseDTOMapper.toDTO(legalCase);
    }

    @Override
    public LegalCaseDTO getCaseByNumber(String caseNumber) {
        LegalCase legalCase = legalCaseRepository.findByCaseNumber(caseNumber)
            .orElseThrow(() -> new LegalCaseException("Case not found with number: " + caseNumber));
        return legalCaseDTOMapper.toDTO(legalCase);
    }

    @Override
    public Page<LegalCaseDTO> getAllCases(int page, int size) {
        // Sort by created_at descending to show newest cases first
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        // Use tenant-filtered query - throw exception if no organization context
        Page<LegalCase> cases = tenantService.getCurrentOrganizationId()
            .map(orgId -> legalCaseRepository.findByOrganizationId(orgId, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));

        return cases.map(this::toDTOWithAttorneys);
    }

    /**
     * Converts a LegalCase entity to DTO and populates assigned attorneys
     */
    private LegalCaseDTO toDTOWithAttorneys(LegalCase legalCase) {
        LegalCaseDTO dto = legalCaseDTOMapper.toDTO(legalCase);

        // Fetch and populate assigned attorneys - SECURITY: use org-filtered query
        try {
            List<CaseAssignment> assignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(legalCase.getId(), legalCase.getOrganizationId());
            if (assignments != null && !assignments.isEmpty()) {
                List<AssignedAttorneyDTO> attorneys = assignments.stream()
                    .filter(a -> a.getAssignedTo() != null)
                    .map(a -> AssignedAttorneyDTO.builder()
                        .id(a.getAssignedTo().getId())
                        .firstName(a.getAssignedTo().getFirstName())
                        .lastName(a.getAssignedTo().getLastName())
                        .email(a.getAssignedTo().getEmail())
                        .roleType(a.getRoleType() != null ? a.getRoleType().name() : null)
                        .workloadWeight(a.getWorkloadWeight() != null ? a.getWorkloadWeight().doubleValue() : null)
                        .assignmentId(a.getId())
                        .assignedAt(a.getAssignedAt() != null ? java.sql.Timestamp.valueOf(a.getAssignedAt()) : null)
                        .active(a.isActive())
                        .build())
                    .collect(Collectors.toList());
                dto.setAssignedAttorneys(attorneys);
            }
        } catch (Exception e) {
            log.warn("Failed to fetch attorneys for case {}: {}", legalCase.getId(), e.getMessage());
        }

        return dto;
    }

    @Override
    public Page<LegalCaseDTO> getCasesForUser(Long userId, int page, int size) {
        log.info("Getting cases for user ID: {}, page: {}, size: {}", userId, page, size);
        
        // Get user to check their role
        UserDTO user = userService.getUserById(userId);
        if (user == null) {
            log.warn("User not found with ID: {}", userId);
            return Page.empty(PageRequest.of(page, size));
        }
        
        String userRole = user.getRoleName();
        log.info("User ID: {} has role: {}", userId, userRole);
        
        // Admin users can see all cases (within their organization)
        if ("ROLE_ADMIN".equals(userRole) || "ROLE_ATTORNEY".equals(userRole) || "ROLE_MANAGER".equals(userRole) ||
            "MANAGING_PARTNER".equals(userRole) || "SENIOR_PARTNER".equals(userRole) || "OF_COUNSEL".equals(userRole)) {
            log.info("User has admin/senior role, returning all cases");
            Long orgId = getRequiredOrganizationId();
            // SECURITY: Use tenant-filtered query
            Page<LegalCase> cases = legalCaseRepository.findByOrganizationId(
                orgId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
            );
            return cases.map(this::toDTOWithAttorneys);
        }
        
        // ATTORNEY-LEVEL ROLES: See assigned cases (Associates, Paralegals, etc.)
        if ("ROLE_PARALEGAL".equals(userRole) || "ASSOCIATE".equals(userRole) || "JUNIOR_ASSOCIATE".equals(userRole) || "SENIOR_ASSOCIATE".equals(userRole)) {
            log.info("User has attorney-level role, getting assigned cases");
            // Get case IDs from case role assignments
            Set<com.bostoneo.bostoneosolutions.model.CaseRoleAssignment> caseRoleAssignments = roleService.getCaseRoleAssignments(userId);
            
            if (caseRoleAssignments.isEmpty()) {
                return Page.empty(PageRequest.of(page, size));
            }
            
            // Extract case IDs from active assignments
            List<Long> caseIds = caseRoleAssignments.stream()
                .filter(assignment -> assignment.isActive()) // Only active assignments
                .map(assignment -> assignment.getLegalCase().getId())
                .distinct()
                .collect(Collectors.toList());
                
            if (caseIds.isEmpty()) {
                return Page.empty(PageRequest.of(page, size));
            }

            Long orgId = getRequiredOrganizationId();
            // SECURITY: Get cases by IDs with tenant filtering
            Page<LegalCase> cases = legalCaseRepository.findByOrganizationIdAndIdIn(
                orgId,
                caseIds,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
            );
            return cases.map(legalCaseDTOMapper::toDTO);
        }

        // CLIENT: See only cases where explicitly assigned
        // Note: Client users have ROLE_USER role in this system
        if ("ROLE_CLIENT".equals(userRole) || "ROLE_USER".equals(userRole)) {
            // Get case IDs from case role assignments
            Set<com.bostoneo.bostoneosolutions.model.CaseRoleAssignment> caseRoleAssignments = roleService.getCaseRoleAssignments(userId);
            
            if (caseRoleAssignments.isEmpty()) {
                log.info("No case role assignments found for user ID: {}", userId);
                return Page.empty(PageRequest.of(page, size));
            }
            
            // Extract case IDs from active assignments
            List<Long> caseIds = caseRoleAssignments.stream()
                .filter(assignment -> assignment.isActive()) // Only active assignments
                .map(assignment -> assignment.getLegalCase().getId())
                .distinct()
                .collect(Collectors.toList());
                
            if (caseIds.isEmpty()) {
                log.info("No active case assignments found for user ID: {}", userId);
                return Page.empty(PageRequest.of(page, size));
            }
            
            log.info("Found {} active case assignments for user ID: {}, case IDs: {}", caseIds.size(), userId, caseIds);

            Long orgId = getRequiredOrganizationId();
            // SECURITY: Get cases by IDs with tenant filtering
            Page<LegalCase> cases = legalCaseRepository.findByOrganizationIdAndIdIn(
                orgId,
                caseIds,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
            );

            // Map to DTOs with client-specific filtering
            return cases.map(legalCase -> {
                LegalCaseDTO dto = legalCaseDTOMapper.toDTO(legalCase);
                // Filter sensitive information for clients
                dto.setHourlyRate(null);
                dto.setTotalHours(null);
                dto.setTotalAmount(null);
                dto.setBillingInfo(null);
                dto.setJudgeName(null);
                dto.setCourtroom(null);
                dto.setDescription(null); // Hide attorney notes
                return dto;
            });
        }
        
        // SECRETARY: See case list with limited details
        if ("ROLE_SECRETARY".equals(userRole)) {
            Long orgId = getRequiredOrganizationId();
            // SECURITY: Use tenant-filtered query
            Page<LegalCase> allCases = legalCaseRepository.findByOrganizationId(
                orgId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
            );

            // Map to DTOs with limited information
            return allCases.map(legalCase -> {
                LegalCaseDTO dto = new LegalCaseDTO();
                // Only basic info for secretary
                dto.setId(legalCase.getId());
                dto.setCaseNumber(legalCase.getCaseNumber());
                dto.setTitle(legalCase.getTitle());
                dto.setClientName(legalCase.getClientName());
                dto.setStatus(legalCase.getStatus());
                dto.setPriority(legalCase.getPriority());
                dto.setFilingDate(legalCase.getFilingDate());
                dto.setNextHearing(legalCase.getNextHearing());
                // Important dates
                if (legalCase.getFilingDate() != null || legalCase.getNextHearing() != null || legalCase.getTrialDate() != null) {
                    Map<String, Object> dates = new HashMap<>();
                    dates.put("filingDate", legalCase.getFilingDate());
                    dates.put("nextHearing", legalCase.getNextHearing());
                    dates.put("trialDate", legalCase.getTrialDate());
                    dto.setImportantDates(dates);
                }
                return dto;
            });
        }
        
        // Default: no access
        return Page.empty(PageRequest.of(page, size));
    }

    @Override
    public Page<LegalCaseDTO> searchCases(String search, int page, int size) {
        log.info("Searching cases with term: {}", search);
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        // Use tenant-filtered search - throw exception if no organization context
        Page<LegalCase> cases = tenantService.getCurrentOrganizationId()
            .map(orgId -> legalCaseRepository.searchCasesByOrganization(orgId, search, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));

        return cases.map(this::toDTOWithAttorneys);
    }

    @Override
    public Page<LegalCaseDTO> searchCasesByTitle(String title, int page, int size) {
        Long orgId = getRequiredOrganizationId();
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        // SECURITY: Use tenant-filtered search
        Page<LegalCase> cases = legalCaseRepository.findByOrganizationIdAndTitleContainingIgnoreCase(
            orgId, title, pageable
        );
        return cases.map(legalCaseDTOMapper::toDTO);
    }

    @Override
    public Page<LegalCaseDTO> searchCasesByClientName(String clientName, int page, int size) {
        Long orgId = getRequiredOrganizationId();
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        // SECURITY: Use tenant-filtered search
        Page<LegalCase> cases = legalCaseRepository.findByOrganizationIdAndClientNameContainingIgnoreCase(
            orgId, clientName, pageable
        );
        return cases.map(legalCaseDTOMapper::toDTO);
    }

    @Override
    public Page<LegalCaseDTO> getCasesByStatus(CaseStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        // Use tenant-filtered query - throw exception if no organization context
        Page<LegalCase> cases = tenantService.getCurrentOrganizationId()
            .map(orgId -> legalCaseRepository.findByOrganizationIdAndStatus(orgId, status, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));

        return cases.map(legalCaseDTOMapper::toDTO);
    }

    @Override
    public Page<LegalCaseDTO> getCasesByType(String type, int page, int size) {
        Long orgId = getRequiredOrganizationId();
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        // SECURITY: Use tenant-filtered query
        Page<LegalCase> cases = legalCaseRepository.findByOrganizationIdAndType(
            orgId, type, pageable
        );
        return cases.map(legalCaseDTOMapper::toDTO);
    }

    @Override
    public Page<LegalCaseDTO> getCasesByClientId(Long clientId, int page, int size) {
        log.info("Getting cases for client ID: {}", clientId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query to get the client
        Client client = clientRepository.findByIdAndOrganizationId(clientId, orgId)
            .orElseThrow(() -> new RuntimeException("Client not found or access denied: " + clientId));

        // SECURITY: Search cases by client name with tenant filter
        Page<LegalCase> cases = legalCaseRepository.findByOrganizationIdAndClientNameContainingIgnoreCase(
            orgId,
            client.getName(),
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );

        return cases.map(legalCaseDTOMapper::toDTO);
    }

    @Override
    public void deleteCase(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify ownership before deletion
        if (!legalCaseRepository.existsByIdAndOrganizationId(id, orgId)) {
            throw new LegalCaseException("Case not found or access denied: " + id);
        }
        legalCaseRepository.deleteById(id);
    }

    @Override
    public LegalCaseDTO updateCaseStatus(Long id, CaseStatus status) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new LegalCaseException("Case not found or access denied: " + id));
        legalCase.setStatus(status);
        legalCase = legalCaseRepository.save(legalCase);
        return legalCaseDTOMapper.toDTO(legalCase);
    }
    
    // Document Management methods
    
    @Override
    public List<DocumentDTO> getCaseDocuments(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Check if case exists with tenant filtering
        legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
            .orElseThrow(() -> new LegalCaseException("Case not found or access denied: " + caseId));
            
        log.info("Getting documents for case: {}", caseId);
        
        try {
            CustomHttpResponse<List<LegalDocument>> response = documentService.getDocumentsByCaseId(caseId);
            
            if (response.getStatusCode() != 200 || response.getData() == null) {
                throw new RuntimeException("Failed to retrieve case documents: " + response.getMessage());
            }
            
            // Convert to DTOs with user information
            return response.getData().stream().map(doc -> {
                DocumentDTO dto = new DocumentDTO();
                dto.setId(doc.getId().toString());
                dto.setTitle(doc.getTitle());
                dto.setType(doc.getType().name());
                
                // Safely convert category to string, handling null values
                if (doc.getCategory() != null) {
                    dto.setCategory(doc.getCategory().name());
                } else {
                    dto.setCategory("OTHER");
                }
                
                dto.setFileName(doc.getFileName());
                dto.setDescription(doc.getDescription());
                dto.setTags(doc.getTags());
                dto.setUploadedAt(doc.getUploadedAt());
                
                // Add user information if available
                if (doc.getUploadedBy() != null) {
                    try {
                        UserDTO userDTO = userService.getUserById(doc.getUploadedBy());
                        if (userDTO != null) {
                            dto.setUploadedBy(userDTO);
                        }
                    } catch (Exception e) {
                        log.warn("Could not retrieve user information for document {}: {}", doc.getId(), e.getMessage());
                    }
                }
                
                return dto;
            }).collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Error fetching documents for case {}: {}", caseId, e.getMessage(), e);
            throw new RuntimeException("Failed to fetch documents", e);
        }
    }
    
    @Override
    public DocumentDTO uploadDocument(Long caseId, MultipartFile file, String title,
                                    String type, String category, String description, String tags, UserDTO user) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Check if case exists with tenant filtering
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
            .orElseThrow(() -> new LegalCaseException("Case not found or access denied: " + caseId));
            
        log.info("Uploading document for case: {}", caseId);
        
        // Validate category based on user role
        String userRole = user.getRoleName();
        DocumentCategory selectedCategory = null;
        
        try {
            selectedCategory = category != null ? DocumentCategory.valueOf(category) : DocumentCategory.PUBLIC;
        } catch (IllegalArgumentException e) {
            log.warn("Invalid category: {}. Using PUBLIC instead.", category);
            selectedCategory = DocumentCategory.PUBLIC;
        }
        
        // Enforce category restrictions based on role
        if ("ROLE_CLIENT".equals(userRole)) {
            // Clients can only upload PUBLIC documents
            if (selectedCategory != DocumentCategory.PUBLIC) {
                log.warn("Client attempted to upload {} document. Changing to PUBLIC.", selectedCategory);
                selectedCategory = DocumentCategory.PUBLIC;
            }
        } else if ("ROLE_SECRETARY".equals(userRole)) {
            // Secretaries cannot upload confidential or privileged documents
            if (selectedCategory == DocumentCategory.CONFIDENTIAL || 
                selectedCategory == DocumentCategory.ATTORNEY_CLIENT_PRIVILEGE) {
                log.warn("Secretary attempted to upload {} document. Changing to INTERNAL.", selectedCategory);
                selectedCategory = DocumentCategory.INTERNAL;
            }
        } else if ("ROLE_PARALEGAL".equals(userRole)) {
            // Paralegals cannot create attorney-client privileged documents
            if (selectedCategory == DocumentCategory.ATTORNEY_CLIENT_PRIVILEGE) {
                log.warn("Paralegal attempted to upload ATTORNEY_CLIENT_PRIVILEGE document. Changing to CONFIDENTIAL.", selectedCategory);
                selectedCategory = DocumentCategory.CONFIDENTIAL;
            }
        }
        // ADMIN and ATTORNEY can upload any category
        
        try {
            // Create DocumentDTO to pass to the document service
            LegalDocumentDTO documentDTO = new LegalDocumentDTO();
            documentDTO.setTitle(title != null ? title : "Untitled Document");
            DocumentType selectedType;
            try {
                selectedType = type != null ? DocumentType.valueOf(type) : DocumentType.OTHER;
            } catch (IllegalArgumentException e) {
                log.warn("Invalid document type: {}. Using OTHER instead.", type);
                selectedType = DocumentType.OTHER;
            }
            documentDTO.setType(selectedType);
            documentDTO.setCategory(selectedCategory);
            documentDTO.setStatus(DocumentStatus.FINAL);
            documentDTO.setCaseId(caseId);
            documentDTO.setDescription(description);

            // Set the user who is uploading the document
            if (user != null && user.getId() != null) {
                documentDTO.setUploadedBy(user.getId());
            }

            // Convert tags string to List if provided
            if (tags != null && !tags.isEmpty()) {
                List<String> tagList = Arrays.asList(tags.split(","));
                documentDTO.setTags(tagList);
            }
            
            // Convert to JSON string
            String documentDataJson = objectMapper.writeValueAsString(documentDTO);
            
            // Call the document service to handle the file upload and metadata storage
            CustomHttpResponse<LegalDocument> response = documentService.uploadDocument(file, documentDataJson);
            
            if (response.getStatusCode() != 200 || response.getData() == null) {
                throw new RuntimeException("Failed to upload document: " + response.getMessage());
            }
            
            // Convert the saved LegalDocument to DocumentDTO for the response
            LegalDocument savedDocument = response.getData();
            
            // Create initial version record
            DocumentVersion initialVersion = new DocumentVersion();
            initialVersion.setDocumentId(savedDocument.getId());
            initialVersion.setVersionNumber(1);
            initialVersion.setFileName(savedDocument.getFileName());
            initialVersion.setFileUrl(savedDocument.getUrl());
            initialVersion.setFileType(savedDocument.getFileType());
            initialVersion.setFileSize(savedDocument.getFileSize());
            initialVersion.setChanges("Initial version");
            if (user != null && user.getId() != null) {
                initialVersion.setUploadedBy(user.getId());
            }
            
            // Save version metadata
            DocumentVersion savedVersion = documentVersionRepository.save(initialVersion);
            log.info("Initial document version metadata saved: {}", savedVersion);
            
            DocumentDTO resultDTO = new DocumentDTO();
            resultDTO.setId(savedDocument.getId().toString());
            resultDTO.setTitle(savedDocument.getTitle());
            resultDTO.setType(savedDocument.getType().name());
            resultDTO.setCategory(savedDocument.getCategory() != null ? savedDocument.getCategory().name() : "PUBLIC");
            resultDTO.setDescription(savedDocument.getDescription());
            resultDTO.setFileName(savedDocument.getFileName());
            resultDTO.setFileUrl(savedDocument.getUrl());
            resultDTO.setTags(savedDocument.getTags());
            resultDTO.setUploadedAt(savedDocument.getUploadedAt());
            resultDTO.setCurrentVersion(1);
            
            // Set uploaded by information
            resultDTO.setUploadedBy(user);
            
            // Convert version record to DTO
            DocumentVersionDTO versionDTO = new DocumentVersionDTO();
            versionDTO.setId(savedVersion.getId().toString());
            versionDTO.setVersionNumber(savedVersion.getVersionNumber());
            versionDTO.setFileName(savedVersion.getFileName());
            versionDTO.setFileUrl(savedVersion.getFileUrl());
            versionDTO.setUploadedAt(savedVersion.getUploadedAt());
            versionDTO.setChanges(savedVersion.getChanges());
            versionDTO.setUploadedBy(user);
            
            resultDTO.setVersions(Collections.singletonList(versionDTO));
            
            // Log case activity for document upload
            CaseActivityDTO activityDTO = new CaseActivityDTO();
            activityDTO.setCaseId(caseId);
            activityDTO.setActivityType("DOCUMENT_ADDED");
            activityDTO.setDescription("Document \"" + savedDocument.getTitle() + "\" was uploaded");
            activityDTO.setCreatedAt(LocalDateTime.now());
            if (user != null && user.getId() != null) {
                activityDTO.setUserId(user.getId());
            }
            
            // Add metadata about the document
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("documentId", savedDocument.getId().toString());
            metadata.put("documentTitle", savedDocument.getTitle());
            metadata.put("documentType", savedDocument.getType().name());
            activityDTO.setMetadata(metadata);
            
            // Log the activity
            logCaseActivity(activityDTO);
            
            return resultDTO;
        } catch (Exception e) {
            log.error("Error in document upload process: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to upload document", e);
        }
    }
    
    @Override
    public DocumentDTO getDocument(Long caseId, Long documentId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Check if case exists with tenant filtering
        legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
            .orElseThrow(() -> new LegalCaseException("Case not found or access denied: " + caseId));
            
        log.info("Retrieving document with id: {} for case: {}", documentId, caseId);
        
        CustomHttpResponse<LegalDocument> response = documentService.getDocumentById(documentId);
        
        if (response.getStatusCode() != 200 || response.getData() == null) {
            throw new RuntimeException("Document not found with id: " + documentId);
        }
        
        LegalDocument document = response.getData();
        
        // Verify the document belongs to the specified case
        if (!document.getCaseId().equals(caseId)) {
            throw new LegalCaseException("Document does not belong to the specified case");
        }
        
        // Convert to DTO
        DocumentDTO dto = new DocumentDTO();
        dto.setId(document.getId().toString());
        dto.setTitle(document.getTitle());
        dto.setType(document.getType().name());
        dto.setCategory(document.getCategory() != null ? document.getCategory().name() : "PUBLIC");
        dto.setFileName(document.getFileName());
        dto.setFileUrl(document.getUrl());
        dto.setDescription(document.getDescription());
        dto.setTags(document.getTags());
        dto.setUploadedAt(document.getUploadedAt());
        
        // Add user information if available
        if (document.getUploadedBy() != null) {
            try {
                UserDTO userDTO = userService.getUserById(document.getUploadedBy());
                if (userDTO != null) {
                    dto.setUploadedBy(userDTO);
                }
            } catch (Exception e) {
                log.warn("Could not retrieve user information for document {}: {}", document.getId(), e.getMessage());
            }
        }
        
        return dto;
    }
    
    @Override
    public void deleteDocument(Long caseId, Long documentId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Check if case exists with tenant filtering
        legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
            .orElseThrow(() -> new LegalCaseException("Case not found or access denied: " + caseId));
            
        // Check if document exists and belongs to the case
        CustomHttpResponse<LegalDocument> docResponse = documentService.getDocumentById(documentId);
        if (docResponse.getStatusCode() != 200 || docResponse.getData() == null) {
            throw new RuntimeException("Document not found with id: " + documentId);
        }
        
        LegalDocument document = docResponse.getData();
        if (!document.getCaseId().equals(caseId)) {
            throw new LegalCaseException("Document does not belong to the specified case");
        }
        
        log.info("Deleting document with id: {} for case: {}", documentId, caseId);
        
        // Delete document using the document service
        CustomHttpResponse<Void> response = documentService.deleteDocument(documentId);
        if (response.getStatusCode() != 200) {
            throw new RuntimeException("Failed to delete document: " + response.getMessage());
        }
        
        log.info("Document deleted successfully: {}", documentId);
    }
    
    @Override
    public Resource downloadDocument(Long caseId, Long documentId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Check if case exists with tenant filtering
        legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
            .orElseThrow(() -> new LegalCaseException("Case not found or access denied: " + caseId));
            
        log.info("Downloading document with id: {} for case: {}", documentId, caseId);
        
        try {
            // Get the document metadata
            CustomHttpResponse<LegalDocument> docResponse = documentService.getDocumentById(documentId);
            if (docResponse.getStatusCode() != 200 || docResponse.getData() == null) {
                throw new RuntimeException("Document not found with id: " + documentId);
            }
            
            LegalDocument document = docResponse.getData();
            
            // Verify the document belongs to the specified case
            if (!document.getCaseId().equals(caseId)) {
                throw new LegalCaseException("Document does not belong to the specified case");
            }
            
            // Retrieve the actual document file
            byte[] documentBytes = documentService.downloadDocument(documentId);
            
            // Return as resource
            return new ByteArrayResource(documentBytes) {
                @Override
                public String getFilename() {
                    return document.getFileName();
                }
            };
        } catch (Exception e) {
            log.error("Error downloading document: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to download document", e);
        }
    }
    
    @Override
    public DocumentVersionDTO uploadNewDocumentVersion(Long caseId, Long documentId,
                                                    MultipartFile file, String notes, Long uploadedBy) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Check if case exists with tenant filtering
        legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
            .orElseThrow(() -> new LegalCaseException("Case not found or access denied: " + caseId));
            
        log.info("Uploading new version for document: {} in case: {}", documentId, caseId);
        
        try {
            // Get the document metadata
            CustomHttpResponse<LegalDocument> docResponse = documentService.getDocumentById(documentId);
            if (docResponse.getStatusCode() != 200 || docResponse.getData() == null) {
                throw new RuntimeException("Document not found with id: " + documentId);
            }
            
            LegalDocument document = docResponse.getData();
            
            // Verify the document belongs to the specified case
            if (!document.getCaseId().equals(caseId)) {
                throw new LegalCaseException("Document does not belong to the specified case");
            }
            
            // Get the next version number
            Integer maxVersion = documentVersionRepository.findMaxVersionNumberByDocumentId(documentId);
            int nextVersion = (maxVersion != null) ? maxVersion + 1 : 1;
            
            // Create storage path for the new version
            String documentPath = createDocumentVersionStoragePath(caseId, documentId);
            
            // Generate a unique filename with original extension preserved
            String originalFilename = file.getOriginalFilename();
            String fileExtension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                fileExtension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String uniqueFilename = UUID.randomUUID() + fileExtension;
            
            // Full path where the file will be stored
            Path fullPath = Paths.get(documentPath, uniqueFilename);
            
            // Save the file
            Files.write(fullPath, file.getBytes());
            log.info("Version file saved to: {}", fullPath);
            
            // Create document version entity
            DocumentVersion version = new DocumentVersion();
            version.setDocumentId(documentId);
            version.setVersionNumber(nextVersion);
            version.setFileName(originalFilename != null ? originalFilename : document.getFileName());
            version.setFileUrl(fullPath.toString());
            version.setChanges(notes);
            version.setFileType(file.getContentType());
            version.setFileSize(file.getSize());
            
            // Set uploaded by user
            version.setUploadedBy(uploadedBy);
            
            // Save version metadata
            DocumentVersion savedVersion = documentVersionRepository.save(version);
            
            // Send notifications using DocumentVersionService logic (but manually here to avoid circular call)
            // This is a simplified version - we should call documentVersionService instead but avoiding complexity for now
            try {
                String title = "Document Version Updated";
                String message = String.format("New version (v%d) of document \"%s\" has been uploaded", 
                    nextVersion, document.getTitle() != null ? document.getTitle() : document.getFileName());
                
                Set<Long> notificationUserIds = new HashSet<>();
                
                // SECURITY: Get users assigned to the case if this document is related to a case (with org filter)
                if (document.getCaseId() != null && document.getOrganizationId() != null) {
                    List<CaseAssignment> caseAssignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(document.getCaseId(), document.getOrganizationId());
                    for (CaseAssignment assignment : caseAssignments) {
                        if (assignment.getAssignedTo() != null) {
                            notificationUserIds.add(assignment.getAssignedTo().getId());
                        }
                    }
                }

                // Remove the user who uploaded the new version from notifications (don't notify yourself)
                if (uploadedBy != null) {
                    notificationUserIds.remove(uploadedBy);
                }
                
                // Send notifications to all collected users
                for (Long userId : notificationUserIds) {
                    notificationService.sendCrmNotification(title, message, userId, 
                        "DOCUMENT_VERSION_UPDATED", Map.of("documentId", documentId,
                                                           "versionId", savedVersion.getId(),
                                                           "versionNumber", nextVersion,
                                                           "fileName", savedVersion.getFileName(),
                                                           "caseId", document.getCaseId() != null ? document.getCaseId() : 0));
                }
                
                log.info("📧 Document version update notifications sent to {} users", notificationUserIds.size());
            } catch (Exception e) {
                log.error("Failed to send document version update notifications: {}", e.getMessage());
            }
            log.info("Document version metadata saved: {}", savedVersion);
            
            // Convert to DTO
            DocumentVersionDTO versionDTO = new DocumentVersionDTO();
            versionDTO.setId(savedVersion.getId().toString());
            versionDTO.setVersionNumber(savedVersion.getVersionNumber());
            versionDTO.setFileName(savedVersion.getFileName());
            versionDTO.setFileUrl(savedVersion.getFileUrl());
            versionDTO.setUploadedAt(savedVersion.getUploadedAt());
            versionDTO.setChanges(savedVersion.getChanges());
            
            // Add user information if available
            if (savedVersion.getUploadedBy() != null) {
                try {
                    UserDTO userDTO = userService.getUserById(savedVersion.getUploadedBy());
                    if (userDTO != null) {
                        versionDTO.setUploadedBy(userDTO);
                    }
                } catch (Exception e) {
                    log.warn("Could not retrieve user information for version: {}", e.getMessage());
                }
            }
            
            return versionDTO;
        } catch (Exception e) {
            log.error("Error uploading document version: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to upload new document version", e);
        }
    }
    
    @Override
    public List<DocumentVersionDTO> getDocumentVersions(Long caseId, Long documentId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Check if case exists with tenant filtering
        legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
            .orElseThrow(() -> new LegalCaseException("Case not found or access denied: " + caseId));
            
        // Check if document exists and belongs to the case
        CustomHttpResponse<LegalDocument> docResponse = documentService.getDocumentById(documentId);
        if (docResponse.getStatusCode() != 200 || docResponse.getData() == null) {
            throw new RuntimeException("Document not found with id: " + documentId);
        }
        
        LegalDocument document = docResponse.getData();
        if (!document.getCaseId().equals(caseId)) {
            throw new LegalCaseException("Document does not belong to the specified case");
        }
            
        log.info("Getting versions for document: {} in case: {}", documentId, caseId);
        
        // Get all versions for this document
        List<DocumentVersion> versions = documentVersionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId);
        
        // Convert to DTOs
        return versions.stream().map(version -> {
            DocumentVersionDTO dto = new DocumentVersionDTO();
            dto.setId(version.getId().toString());
            dto.setVersionNumber(version.getVersionNumber());
            dto.setFileName(version.getFileName());
            dto.setFileUrl(version.getFileUrl());
            dto.setUploadedAt(version.getUploadedAt());
            dto.setChanges(version.getChanges());
            
            // Add user information if available
            if (version.getUploadedBy() != null) {
                try {
                    UserDTO userDTO = userService.getUserById(version.getUploadedBy());
                    if (userDTO != null) {
                        dto.setUploadedBy(userDTO);
                    }
                } catch (Exception e) {
                    log.warn("Could not retrieve user information for version: {}", e.getMessage());
                }
            }
            
            return dto;
        }).collect(Collectors.toList());
    }
    
    @Override
    public Resource downloadDocumentVersion(Long caseId, Long documentId, Long versionId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Check if case exists with tenant filtering
        legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
            .orElseThrow(() -> new LegalCaseException("Case not found or access denied: " + caseId));
            
        // Check if document exists and belongs to the case
        CustomHttpResponse<LegalDocument> docResponse = documentService.getDocumentById(documentId);
        if (docResponse.getStatusCode() != 200 || docResponse.getData() == null) {
            throw new RuntimeException("Document not found with id: " + documentId);
        }
        
        LegalDocument document = docResponse.getData();
        if (!document.getCaseId().equals(caseId)) {
            throw new LegalCaseException("Document does not belong to the specified case");
        }
            
        log.info("Downloading version {} of document: {} for case: {}", versionId, documentId, caseId);

        try {
            // SECURITY: Use tenant-filtered query
            DocumentVersion version = documentVersionRepository.findByIdAndOrganizationId(versionId, orgId)
                .orElseThrow(() -> new EntityNotFoundException("Version not found or access denied: " + versionId));
            
            // Verify the version belongs to the specified document
            if (!version.getDocumentId().equals(documentId)) {
                throw new RuntimeException("Version does not belong to the specified document");
            }
            
            // Read the file
            Path filePath = Paths.get(version.getFileUrl());
            if (!Files.exists(filePath)) {
                throw new IOException("Version file not found at path: " + filePath);
            }
            
            byte[] fileContent = Files.readAllBytes(filePath);
            
            // Return as resource
            return new ByteArrayResource(fileContent) {
                @Override
                public String getFilename() {
                    return version.getFileName();
                }
            };
        } catch (Exception e) {
            log.error("Error downloading document version: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to download document version", e);
        }
    }
    
    /**
     * Creates a structured path for document version storage
     * Format: BASE_DIR/cases/{caseId}/documents/{documentId}/versions/
     */
    private String createDocumentVersionStoragePath(Long caseId, Long documentId) throws IOException {
        // Create a structured path: BASE_DIR/cases/{caseId}/documents/{documentId}/versions/
        Path path = Paths.get(
            System.getProperty("user.home") + "/bostoneosolutions/documents/",
            "cases", 
            caseId.toString(), 
            "documents",
            documentId.toString(),
            "versions"
        );
        
        // Create directories if they don't exist
        Files.createDirectories(path);
        
        return path.toString();
    }
    
    // Case Activities methods
    
    @Override
    public List<CaseActivityDTO> getCaseActivities(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Check if case exists with tenant filtering
        legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
            .orElseThrow(() -> new LegalCaseException("Case not found or access denied: " + caseId));
            
        log.info("Getting activities for case: {}", caseId);
        
        // Use the dedicated service to get activities
        return caseActivityService.getActivitiesByCaseId(caseId);
    }
    
    @Override
    public CaseActivityDTO logCaseActivity(CaseActivityDTO activityDTO) {
        log.info("Logging activity for case: {}", activityDTO.getCaseId());
        
        // Convert DTO to request
        CreateActivityRequest request = new CreateActivityRequest();
        request.setCaseId(activityDTO.getCaseId());
        request.setActivityType(activityDTO.getActivityType());
        request.setReferenceId(activityDTO.getReferenceId());
        request.setReferenceType(activityDTO.getReferenceType());
        request.setDescription(activityDTO.getDescription());
        request.setMetadata((Map<String, Object>)activityDTO.getMetadata());
        
        // Create the activity using the service
        return caseActivityService.createActivity(request);
    }

    @Override
    public LegalCaseDTO getCaseForUser(Long id, Long userId, Collection<String> roles) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new LegalCaseException("Case not found or access denied: " + id));
        
        // Get user to check their specific role
        UserDTO user = userService.getUserById(userId);
        if (user == null) {
            throw new LegalCaseException("User not found");
        }
        
        // Get ALL user roles, not just the primary one
        Collection<String> userRoles = roles; // Use the roles collection passed in
        
        // Also check user's role names if available
        if (user.getRoles() != null && !user.getRoles().isEmpty()) {
            // Combine both sources of roles
            Set<String> allRoles = new HashSet<>(roles);
            user.getRoles().forEach(role -> allRoles.add(role));
            userRoles = allRoles;
        }
        
        log.info("Checking case access for user {} with roles: {}", userId, userRoles);
        
        // Check if user has administrative/attorney level access
        // Include hierarchical roles with both ROLE_ prefixed and non-prefixed versions
        boolean hasFullAccess = userRoles.stream().anyMatch(role -> 
            "ROLE_ADMIN".equals(role) || 
            "ROLE_ATTORNEY".equals(role) ||
            "MANAGING_PARTNER".equals(role) ||
            "ROLE_MANAGING_PARTNER".equals(role) ||
            "SENIOR_PARTNER".equals(role) ||
            "ROLE_SENIOR_PARTNER".equals(role) ||
            "EQUITY_PARTNER".equals(role) ||
            "ROLE_EQUITY_PARTNER".equals(role) ||
            "OF_COUNSEL".equals(role) ||
            "ROLE_OF_COUNSEL".equals(role) ||
            "ASSOCIATE".equals(role) ||
            "ROLE_ASSOCIATE".equals(role) ||
            "ROLE_MANAGER".equals(role)
        );
        
        // ADMIN/ATTORNEY/PARTNERS: Full access to all case information
        if (hasFullAccess) {
            log.info("User {} has full access to case {}", userId, id);
            return legalCaseDTOMapper.toDTO(legalCase);
        }
        
        // Check for paralegal access
        boolean isParalegal = userRoles.stream().anyMatch(role -> 
            "ROLE_PARALEGAL".equals(role) || 
            "PARALEGAL".equals(role) || 
            "LEGAL_ASSISTANT".equals(role)
        );
        
        // Check for client access  
        boolean isClient = userRoles.stream().anyMatch(role -> 
            "ROLE_CLIENT".equals(role) || 
            "ROLE_USER".equals(role)
        );
        
        // Check for secretary access
        boolean isSecretary = userRoles.stream().anyMatch(role -> 
            "ROLE_SECRETARY".equals(role) || 
            "LEGAL_SECRETARY".equals(role)
        );
        
        LegalCaseDTO dto = legalCaseDTOMapper.toDTO(legalCase);
        
        // PARALEGAL: Edit access to assigned cases
        if (isParalegal) {
            // Check if paralegal is assigned to this case
            Set<com.bostoneo.bostoneosolutions.model.CaseRoleAssignment> assignments = roleService.getCaseRoleAssignments(userId);
            boolean hasAccess = assignments.stream()
                .anyMatch(a -> a.getLegalCase().getId().equals(id) && a.isActive());
                
            if (!hasAccess) {
                throw new LegalCaseException("You don't have access to this case");
            }
            
            // Paralegals can see most information but not financial details
            dto.setHourlyRate(null);
            dto.setTotalHours(null);
            dto.setTotalAmount(null);
            dto.setBillingInfo(null);
            
            return dto;
        }
        
        // Default: Full access for any authenticated user (as fallback)
        log.info("User {} with roles {} granted access to case {}", userId, userRoles, id);
        return dto;
    }

    @Override
    public List<CaseDocumentDTO> getCaseDocumentsForUser(Long caseId, Long userId, Collection<String> roles) {
        List<DocumentDTO> allDocuments = getCaseDocuments(caseId);
        
        // Get user to check their specific role
        UserDTO user = userService.getUserById(userId);
        if (user == null) {
            return Collections.emptyList();
        }
        
        String userRole = user.getRoleName();
        Collection<String> userRoles = roles != null ? roles : Collections.emptyList();
        
        // Define document categories
        Set<String> publicCategories = Set.of("PUBLIC", "FILING", "COURT_ORDER");
        Set<String> internalCategories = Set.of("INTERNAL", "NOTES", "RESEARCH");
        Set<String> confidentialCategories = Set.of("CONFIDENTIAL", "FINANCIAL", "STRATEGY");
        Set<String> privilegedCategories = Set.of("ATTORNEY_CLIENT_PRIVILEGE", "WORK_PRODUCT");
        
        // ADMIN/ATTORNEY/PARTNERS: Full access to all documents
        Set<String> adminRoles = Set.of(
            "ROLE_ADMIN", "ROLE_ATTORNEY", "ROLE_MANAGING_PARTNER", 
            "ROLE_SENIOR_PARTNER", "ROLE_EQUITY_PARTNER", "ROLE_OF_COUNSEL",
            "MANAGING_PARTNER", "SENIOR_PARTNER", "EQUITY_PARTNER", "OF_COUNSEL"
        );
        
        boolean isAdmin = adminRoles.contains(userRole) || 
                         userRoles.stream().anyMatch(role -> adminRoles.contains(role));
        
        if (isAdmin) {
            log.info("Admin user {} with roles {} accessing all documents for case {}", 
                    userId, userRoles, caseId);
            return allDocuments.stream()
                .map(doc -> {
                    CaseDocumentDTO dto = new CaseDocumentDTO();
                    dto.setId(doc.getId());
                    dto.setTitle(doc.getTitle());
                    dto.setType(doc.getType());
                    dto.setCategory(doc.getCategory());
                    dto.setDescription(doc.getDescription());
                    dto.setTags(doc.getTags());
                    dto.setUploadedAt(doc.getUploadedAt());
                    dto.setUploadedBy(doc.getUploadedBy());
                    return dto;
                })
                .collect(Collectors.toList());
        }
        
        // PARALEGAL/MANAGER: Can see all except attorney-client privileged
        if ("ROLE_PARALEGAL".equals(userRole) || "ROLE_MANAGER".equals(userRole)) {
            // Check if paralegal is assigned to this case
            if ("ROLE_PARALEGAL".equals(userRole)) {
                Set<com.bostoneo.bostoneosolutions.model.CaseRoleAssignment> assignments = roleService.getCaseRoleAssignments(userId);
                boolean hasAccess = assignments.stream()
                    .anyMatch(a -> a.getLegalCase().getId().equals(caseId) && a.isActive());
                    
                if (!hasAccess) {
                    return Collections.emptyList();
                }
            }
            
            return allDocuments.stream()
                .filter(doc -> {
                    String category = doc.getCategory() != null ? doc.getCategory().toUpperCase() : "PUBLIC";
                    // Exclude only attorney-client privileged documents
                    return !privilegedCategories.contains(category);
                })
                .map(doc -> {
                    CaseDocumentDTO dto = new CaseDocumentDTO();
                    dto.setId(doc.getId());
                    dto.setTitle(doc.getTitle());
                    dto.setType(doc.getType());
                    dto.setCategory(doc.getCategory());
                    dto.setDescription(doc.getDescription());
                    dto.setTags(doc.getTags());
                    dto.setUploadedAt(doc.getUploadedAt());
                    dto.setUploadedBy(doc.getUploadedBy());
                    return dto;
                })
                .collect(Collectors.toList());
        }
        
        // SECRETARY: Only public and basic documents
        if ("ROLE_SECRETARY".equals(userRole)) {
            return allDocuments.stream()
                .filter(doc -> {
                    String category = doc.getCategory() != null ? doc.getCategory().toUpperCase() : "PUBLIC";
                    String type = doc.getType() != null ? doc.getType().toUpperCase() : "";
                    
                    // Secretary can only see public documents
                    boolean isPublic = publicCategories.contains(category) || "PUBLIC".equals(category);
                    boolean isBasicType = "CONTRACT".equals(type) || "COURT_ORDER".equals(type) || 
                                        "FILING".equals(type) || "CORRESPONDENCE".equals(type);
                    
                    return isPublic || isBasicType;
                })
                .map(doc -> {
                    CaseDocumentDTO dto = new CaseDocumentDTO();
                    dto.setId(doc.getId());
                    dto.setTitle(doc.getTitle());
                    dto.setType(doc.getType());
                    dto.setUploadedAt(doc.getUploadedAt());
                    // Limited information for secretary
                    return dto;
                })
                .collect(Collectors.toList());
        }
        
        // Default: No access
        return Collections.emptyList();
    }

    @Override
    public List<CaseActivityDTO> getCaseActivitiesForUser(Long caseId, Long userId, Collection<String> roles) {
        List<CaseActivityDTO> allActivities = getCaseActivities(caseId);
        
        // If user is a client, filter activities
        if (roles.contains("ROLE_CLIENT")) {
            // Only show client-visible activities
            Set<String> clientVisibleTypes = Set.of(
                "CASE_CREATED", 
                "STATUS_CHANGED", 
                "HEARING_SCHEDULED",
                "DOCUMENT_SHARED" // Only documents explicitly shared with client
            );
            
            return allActivities.stream()
                .filter(activity -> clientVisibleTypes.contains(activity.getActivityType()))
                .map(activity -> {
                    // Create a sanitized copy
                    CaseActivityDTO sanitized = new CaseActivityDTO();
                    sanitized.setId(activity.getId());
                    sanitized.setActivityType(activity.getActivityType());
                    sanitized.setCreatedAt(activity.getCreatedAt());
                    
                    // Simplify description for clients
                    if ("STATUS_CHANGED".equals(activity.getActivityType())) {
                        sanitized.setDescription("Case status updated");
                    } else if ("HEARING_SCHEDULED".equals(activity.getActivityType())) {
                        sanitized.setDescription("Hearing scheduled");
                    } else {
                        sanitized.setDescription(activity.getDescription());
                    }
                    
                    // Don't include internal metadata
                    return sanitized;
                })
                .collect(Collectors.toList());
        }
        
        // For staff, return all activities
        return allActivities;
    }
} 