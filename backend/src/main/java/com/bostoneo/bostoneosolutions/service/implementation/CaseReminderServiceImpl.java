package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.CaseReminderDTO;
import com.bostoneo.bostoneosolutions.dto.CreateReminderRequest;
import com.bostoneo.bostoneosolutions.dto.UpdateReminderRequest;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.exception.ResourceNotFoundException;
import com.bostoneo.bostoneosolutions.model.CaseReminder;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.CaseReminderRepository;
import com.bostoneo.bostoneosolutions.service.CaseActivityService;
import com.bostoneo.bostoneosolutions.service.CaseReminderService;
import com.bostoneo.bostoneosolutions.service.LegalCaseService;
import com.bostoneo.bostoneosolutions.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service implementation for case reminders with proper database persistence
 * and multi-tenant isolation using organization_id filtering.
 */
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class CaseReminderServiceImpl implements CaseReminderService {

    private final CaseReminderRepository reminderRepository;
    private final CaseActivityService activityService;
    private final LegalCaseService legalCaseService;
    private final UserService userService;
    private final TenantService tenantService;

    /**
     * SECURITY: Get the current organization ID from tenant context (required)
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    /**
     * Get the current authenticated user's ID
     */
    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof UserDTO) {
                return ((UserDTO) principal).getId();
            } else if (principal instanceof UserPrincipal) {
                return ((UserPrincipal) principal).getUser().getId();
            }
        }
        throw new RuntimeException("Authentication required - could not determine current user");
    }

    @Override
    public List<CaseReminderDTO> getRemindersByCaseId(Long caseId, String status) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting reminders for case ID: {} with status: {} in org: {}", caseId, status, orgId);

        // Verify case exists (this already has tenant filtering)
        legalCaseService.getCase(caseId);

        List<CaseReminder> reminders;
        if (status != null && !status.isEmpty()) {
            // SECURITY: Use tenant-filtered query with status
            reminders = reminderRepository.findByOrganizationIdAndCaseIdAndStatusOrderByDueDateAsc(orgId, caseId, status);
        } else {
            // SECURITY: Use tenant-filtered query
            reminders = reminderRepository.findByOrganizationIdAndCaseIdOrderByDueDateAsc(orgId, caseId);
        }

        return reminders.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public CaseReminderDTO getReminderById(Long caseId, Long reminderId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting reminder ID: {} for case ID: {} in org: {}", reminderId, caseId, orgId);

        // Verify case exists
        legalCaseService.getCase(caseId);

        // SECURITY: Use tenant-filtered query
        CaseReminder reminder = reminderRepository.findByIdAndOrganizationId(reminderId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Reminder not found with ID: " + reminderId));

        // Verify reminder belongs to the specified case
        if (!reminder.getCaseId().equals(caseId)) {
            throw new ResourceNotFoundException("Reminder not found with ID: " + reminderId);
        }

        return convertToDTO(reminder);
    }

    @Override
    public CaseReminderDTO createReminder(CreateReminderRequest request) {
        Long orgId = getRequiredOrganizationId();
        Long userId = getCurrentUserId();
        log.info("Creating reminder for case ID: {} in org: {} by user: {}", request.getCaseId(), orgId, userId);

        // Verify case exists
        legalCaseService.getCase(request.getCaseId());

        // Create new reminder entity
        CaseReminder reminder = CaseReminder.builder()
                .organizationId(orgId) // SECURITY: Set organization ID
                .caseId(request.getCaseId())
                .userId(userId)
                .title(request.getTitle())
                .description(request.getDescription())
                .dueDate(request.getDueDate())
                .reminderDate(request.getReminderDate())
                .status("PENDING")
                .priority(request.getPriority() != null ? request.getPriority() : "MEDIUM")
                .build();

        // Save to database
        CaseReminder saved = reminderRepository.save(reminder);

        // Log activity
        activityService.logReminderCreated(request.getCaseId(), saved.getId(), request.getTitle());

        return convertToDTO(saved);
    }

    @Override
    public CaseReminderDTO updateReminder(Long caseId, Long reminderId, UpdateReminderRequest request) {
        Long orgId = getRequiredOrganizationId();
        log.info("Updating reminder ID: {} for case ID: {} in org: {}", reminderId, caseId, orgId);

        // SECURITY: Get reminder with tenant filter
        CaseReminder reminder = reminderRepository.findByIdAndOrganizationId(reminderId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Reminder not found with ID: " + reminderId));

        // Verify reminder belongs to the specified case
        if (!reminder.getCaseId().equals(caseId)) {
            throw new ResourceNotFoundException("Reminder not found with ID: " + reminderId);
        }

        // Update fields if provided
        if (request.getTitle() != null) {
            reminder.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            reminder.setDescription(request.getDescription());
        }
        if (request.getDueDate() != null) {
            reminder.setDueDate(request.getDueDate());
        }
        if (request.getReminderDate() != null) {
            reminder.setReminderDate(request.getReminderDate());
        }
        if (request.getStatus() != null) {
            reminder.setStatus(request.getStatus());
        }
        if (request.getPriority() != null) {
            reminder.setPriority(request.getPriority());
        }

        // Save the updated reminder
        CaseReminder saved = reminderRepository.save(reminder);

        // Log activity
        activityService.logReminderUpdated(caseId, reminderId, saved.getTitle());

        return convertToDTO(saved);
    }

    @Override
    public CaseReminderDTO completeReminder(Long caseId, Long reminderId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Completing reminder ID: {} for case ID: {} in org: {}", reminderId, caseId, orgId);

        // SECURITY: Get reminder with tenant filter
        CaseReminder reminder = reminderRepository.findByIdAndOrganizationId(reminderId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Reminder not found with ID: " + reminderId));

        // Verify reminder belongs to the specified case
        if (!reminder.getCaseId().equals(caseId)) {
            throw new ResourceNotFoundException("Reminder not found with ID: " + reminderId);
        }

        // Update status to completed
        reminder.setStatus("COMPLETED");

        // Save the updated reminder
        CaseReminder saved = reminderRepository.save(reminder);

        // Log activity
        activityService.logReminderCompleted(caseId, reminderId, saved.getTitle());

        return convertToDTO(saved);
    }

    @Override
    public void deleteReminder(Long caseId, Long reminderId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting reminder ID: {} for case ID: {} in org: {}", reminderId, caseId, orgId);

        // SECURITY: Get reminder with tenant filter (to get title for logging)
        CaseReminder reminder = reminderRepository.findByIdAndOrganizationId(reminderId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Reminder not found with ID: " + reminderId));

        // Verify reminder belongs to the specified case
        if (!reminder.getCaseId().equals(caseId)) {
            throw new ResourceNotFoundException("Reminder not found with ID: " + reminderId);
        }

        // SECURITY: Delete with tenant filter
        reminderRepository.deleteByIdAndOrganizationId(reminderId, orgId);

        // Log activity
        activityService.logReminderDeleted(caseId, reminderId, reminder.getTitle());
    }

    @Override
    public List<CaseReminderDTO> getUpcomingRemindersForCurrentUser() {
        Long orgId = getRequiredOrganizationId();
        Long userId = getCurrentUserId();
        log.info("Getting upcoming reminders for user {} in org {}", userId, orgId);

        // SECURITY: Use tenant-filtered query
        List<CaseReminder> reminders = reminderRepository.findUpcomingRemindersForUser(
                orgId, userId, LocalDateTime.now());

        return reminders.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    /**
     * Convert entity to DTO
     */
    private CaseReminderDTO convertToDTO(CaseReminder reminder) {
        CaseReminderDTO dto = new CaseReminderDTO();
        dto.setId(reminder.getId());
        dto.setCaseId(reminder.getCaseId());
        dto.setUserId(reminder.getUserId());
        dto.setTitle(reminder.getTitle());
        dto.setDescription(reminder.getDescription());
        dto.setDueDate(reminder.getDueDate());
        dto.setReminderDate(reminder.getReminderDate());
        dto.setStatus(reminder.getStatus());
        dto.setPriority(reminder.getPriority());
        dto.setCreatedAt(reminder.getCreatedAt());
        dto.setUpdatedAt(reminder.getUpdatedAt());

        // Fetch user details
        try {
            UserDTO user = userService.getUserById(reminder.getUserId());
            dto.setUser(user);
        } catch (Exception e) {
            log.warn("Could not fetch user information for reminder {}: {}", reminder.getId(), e.getMessage());
        }

        return dto;
    }
}
