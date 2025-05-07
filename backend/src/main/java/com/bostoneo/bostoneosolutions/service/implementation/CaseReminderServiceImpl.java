package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.CaseReminderDTO;
import com.bostoneo.bostoneosolutions.dto.CreateReminderRequest;
import com.bostoneo.bostoneosolutions.dto.UpdateReminderRequest;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.exception.ResourceNotFoundException;
import com.bostoneo.bostoneosolutions.service.CaseActivityService;
import com.bostoneo.bostoneosolutions.service.CaseReminderService;
import com.bostoneo.bostoneosolutions.service.LegalCaseService;
import com.bostoneo.bostoneosolutions.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class CaseReminderServiceImpl implements CaseReminderService {

    private final CaseActivityService activityService;
    private final LegalCaseService legalCaseService;
    private final UserService userService;
    
    // In-memory storage for reminders during development
    // In production, this would use a proper repository
    private final Map<Long, Map<Long, CaseReminderDTO>> reminderStore = new HashMap<>();
    private Long nextId = 1L;

    @Override
    public List<CaseReminderDTO> getRemindersByCaseId(Long caseId, String status) {
        log.info("Getting reminders for case ID: {} with status: {}", caseId, status);
        
        // Verify case exists
        legalCaseService.getCase(caseId);
        
        // Initialize if not exists
        reminderStore.computeIfAbsent(caseId, k -> new HashMap<>());
        
        List<CaseReminderDTO> reminders = new ArrayList<>(reminderStore.get(caseId).values());
        
        // Filter by status if provided
        if (status != null && !status.isEmpty()) {
            reminders.removeIf(reminder -> !status.equalsIgnoreCase(reminder.getStatus()));
        }
        
        return reminders;
    }

    @Override
    public CaseReminderDTO getReminderById(Long caseId, Long reminderId) {
        log.info("Getting reminder ID: {} for case ID: {}", reminderId, caseId);
        
        // Verify case exists
        legalCaseService.getCase(caseId);
        
        // Check if case has any reminders
        if (!reminderStore.containsKey(caseId) || !reminderStore.get(caseId).containsKey(reminderId)) {
            throw new ResourceNotFoundException("Reminder not found with ID: " + reminderId);
        }
        
        return reminderStore.get(caseId).get(reminderId);
    }

    @Override
    public CaseReminderDTO createReminder(CreateReminderRequest request) {
        log.info("Creating reminder for case ID: {}", request.getCaseId());
        
        // Verify case exists
        legalCaseService.getCase(request.getCaseId());
        
        // Initialize if not exists
        reminderStore.computeIfAbsent(request.getCaseId(), k -> new HashMap<>());
        
        // Create new reminder
        CaseReminderDTO reminder = new CaseReminderDTO();
        Long reminderId = nextId++;
        reminder.setId(reminderId);
        reminder.setCaseId(request.getCaseId());
        reminder.setTitle(request.getTitle());
        reminder.setDescription(request.getDescription());
        reminder.setDueDate(request.getDueDate());
        reminder.setReminderDate(request.getReminderDate());
        reminder.setStatus("PENDING"); // Default status for new reminders
        reminder.setPriority(request.getPriority() != null ? request.getPriority() : "MEDIUM");
        reminder.setCreatedAt(LocalDateTime.now());
        reminder.setUpdatedAt(LocalDateTime.now());
        
        // In a real implementation, would get the current user
        // For now, use a dummy user ID or fetch from context
        reminder.setUserId(1L);
        try {
            UserDTO user = userService.getUserById(1L);
            reminder.setUser(user);
        } catch (Exception e) {
            log.warn("Could not fetch user information for reminder creator: {}", e.getMessage());
        }
        
        // Save to store
        reminderStore.get(request.getCaseId()).put(reminderId, reminder);
        
        // Log activity
        activityService.logReminderCreated(request.getCaseId(), reminderId, request.getTitle());
        
        return reminder;
    }

    @Override
    public CaseReminderDTO updateReminder(Long caseId, Long reminderId, UpdateReminderRequest request) {
        log.info("Updating reminder ID: {} for case ID: {}", reminderId, caseId);
        
        // Get the existing reminder
        CaseReminderDTO reminder = getReminderById(caseId, reminderId);
        
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
        
        reminder.setUpdatedAt(LocalDateTime.now());
        
        // Save the updated reminder
        reminderStore.get(caseId).put(reminderId, reminder);
        
        // Log activity
        activityService.logReminderUpdated(caseId, reminderId, reminder.getTitle());
        
        return reminder;
    }

    @Override
    public CaseReminderDTO completeReminder(Long caseId, Long reminderId) {
        log.info("Completing reminder ID: {} for case ID: {}", reminderId, caseId);
        
        // Get the existing reminder
        CaseReminderDTO reminder = getReminderById(caseId, reminderId);
        
        // Update status to completed
        reminder.setStatus("COMPLETED");
        reminder.setUpdatedAt(LocalDateTime.now());
        
        // Save the updated reminder
        reminderStore.get(caseId).put(reminderId, reminder);
        
        // Log activity
        activityService.logReminderCompleted(caseId, reminderId, reminder.getTitle());
        
        return reminder;
    }

    @Override
    public void deleteReminder(Long caseId, Long reminderId) {
        log.info("Deleting reminder ID: {} for case ID: {}", reminderId, caseId);
        
        // Get the existing reminder (for title)
        CaseReminderDTO reminder = getReminderById(caseId, reminderId);
        
        // Remove the reminder
        reminderStore.get(caseId).remove(reminderId);
        
        // Log activity
        activityService.logReminderDeleted(caseId, reminderId, reminder.getTitle());
    }

    @Override
    public List<CaseReminderDTO> getUpcomingRemindersForCurrentUser() {
        log.info("Getting upcoming reminders for current user");
        
        // In a real implementation, get current user ID from security context
        Long currentUserId = 1L;
        List<CaseReminderDTO> upcomingReminders = new ArrayList<>();
        
        // Get all reminders
        for (Map<Long, CaseReminderDTO> caseReminders : reminderStore.values()) {
            for (CaseReminderDTO reminder : caseReminders.values()) {
                // Filter for current user and upcoming/pending reminders
                if (reminder.getUserId() != null && 
                    reminder.getUserId().equals(currentUserId) &&
                    "PENDING".equalsIgnoreCase(reminder.getStatus()) &&
                    reminder.getDueDate() != null && 
                    reminder.getDueDate().isAfter(LocalDateTime.now())) {
                    
                    upcomingReminders.add(reminder);
                }
            }
        }
        
        return upcomingReminders;
    }
} 