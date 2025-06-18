package com.***REMOVED***.***REMOVED***solutions.service.implementation;

import com.***REMOVED***.***REMOVED***solutions.dto.CaseActivityDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.CreateActivityRequest;
import com.***REMOVED***.***REMOVED***solutions.dto.UserDTO;
import com.***REMOVED***.***REMOVED***solutions.dtomapper.CaseActivityDTOMapper;
import com.***REMOVED***.***REMOVED***solutions.model.AuditLog;
import com.***REMOVED***.***REMOVED***solutions.model.CaseActivity;
import com.***REMOVED***.***REMOVED***solutions.repository.CaseActivityRepository;
import com.***REMOVED***.***REMOVED***solutions.service.CaseActivityService;
import com.***REMOVED***.***REMOVED***solutions.service.SystemAuditService;
import com.***REMOVED***.***REMOVED***solutions.service.UserService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class CaseActivityServiceImpl implements CaseActivityService {
    
    private final CaseActivityRepository caseActivityRepository;
    private final UserService userService;
    private final ObjectMapper objectMapper;
    private final SystemAuditService systemAuditService;
    
    @Override
    public List<CaseActivityDTO> getActivitiesByCaseId(Long caseId) {
        log.info("Getting activities for case ID: {}", caseId);
        
        List<CaseActivity> activities = caseActivityRepository.findByCaseIdOrderByCreatedAtDesc(caseId);
        log.info("Found {} activities for case ID: {}", activities.size(), caseId);
        
        // Normalize any legacy single-character activity types before converting to DTOs
        for (CaseActivity activity : activities) {
            activity.setActivityType(normalizeActivityType(activity.getActivityType()));
        }
        
        List<CaseActivityDTO> activityDTOs = activities.stream()
                .map(CaseActivityDTOMapper::fromCaseActivity)
                .collect(Collectors.toList());
        
        // Attach user information to each activity
        for (CaseActivityDTO dto : activityDTOs) {
            if (dto.getUserId() != null) {
                try {
                    UserDTO user = userService.getUserById(dto.getUserId());
                    if (user != null) {
                        dto.setUser(user);
                    }
                } catch (Exception e) {
                    log.error("Error fetching user for activity: {}", e.getMessage());
                }
            }
        }
        
        return activityDTOs;
    }

    /**
     * Normalize legacy single-character activity type codes to full string values
     */
    private String normalizeActivityType(String activityType) {
        if (activityType == null) return "OTHER";
        
        // Convert legacy codes
        switch (activityType) {
            case "N": return "NOTE_ADDED";
            case "U": return "NOTE_UPDATED";
            case "D": return "NOTE_DELETED";
            default: return activityType;
        }
    }

    @Override
    public CaseActivityDTO createActivity(CreateActivityRequest request) {
        log.info("Creating activity for case ID: {}", request.getCaseId());
        log.info("Activity type: {}, userId: {}", request.getActivityType(), request.getUserId());
        
        CaseActivity activity = new CaseActivity();
        activity.setCaseId(request.getCaseId());
        activity.setActivityType(request.getActivityType());
        activity.setReferenceId(request.getReferenceId());
        activity.setReferenceType(request.getReferenceType());
        activity.setDescription(request.getDescription());
        activity.setUserId(request.getUserId());
        activity.setCreatedAt(LocalDateTime.now());
        
        // Convert metadata to JSON if present
        if (request.getMetadata() != null) {
            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(request.getMetadata()));
            } catch (JsonProcessingException e) {
                log.error("Error serializing metadata", e);
                activity.setMetadataJson("{}");
            }
        }
        
        // Save to database
        CaseActivity savedActivity = caseActivityRepository.save(activity);
        log.info("Saved activity with ID: {}, userId: {}", savedActivity.getId(), savedActivity.getUserId());
        
        CaseActivityDTO dto = CaseActivityDTOMapper.fromCaseActivity(savedActivity);
        
        // Attach user information if userId is available
        if (dto.getUserId() != null) {
            try {
                UserDTO user = userService.getUserById(dto.getUserId());
                if (user != null) {
                    log.info("Attaching user info: {} {}", user.getFirstName(), user.getLastName());
                    dto.setUser(user);
                } else {
                    log.warn("User not found for ID: {}", dto.getUserId());
                }
            } catch (Exception e) {
                log.error("Error fetching user for activity: {}", e.getMessage());
            }
        } else {
            log.warn("No userId available for activity, user info will not be attached");
        }
        
        return dto;
    }

    @Override
    public void logNoteAdded(Long caseId, Long noteId, String noteTitle, Long userId) {
        log.info("Logging note added activity for case ID: {}, note ID: {}", caseId, noteId);
        
        try {
            // 1. Log to case_activities table (existing functionality)
            CaseActivity activity = new CaseActivity();
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("NOTE_ADDED");
            activity.setReferenceId(noteId);
            activity.setReferenceType("note");
            activity.setDescription("Note \"" + noteTitle + "\" added");
            activity.setCreatedAt(LocalDateTime.now());
            
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("noteId", noteId);
            metadata.put("noteTitle", noteTitle);
            
            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing note metadata", e);
                activity.setMetadataJson("{}");
            }
            
            caseActivityRepository.save(activity);
            log.info("Successfully logged note added activity to case_activities table");
            
            // 2. Also log to main audit_log table for unified activity feed
            if (userId != null) {
                try {
                    systemAuditService.logActivity(
                        userId,
                        AuditLog.AuditAction.CREATE,
                        AuditLog.EntityType.CASE,
                        caseId,
                        "Added note \"" + noteTitle + "\" to legal case",
                        objectMapper.writeValueAsString(metadata)
                    );
                    log.debug("Successfully logged note addition to audit_log table");
                } catch (Exception auditError) {
                    log.warn("Failed to log note addition to audit system: {}", auditError.getMessage());
                }
            }
            
        } catch (Exception e) {
            log.error("Failed to log note added activity: {}", e.getMessage());
        }
    }

    @Override
    public void logNoteUpdated(Long caseId, Long noteId, String noteTitle, Long userId) {
        log.info("Logging note updated activity for case ID: {}, note ID: {}", caseId, noteId);
        
        try {
            CaseActivity activity = new CaseActivity();
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("NOTE_UPDATED");
            activity.setReferenceId(noteId);
            activity.setReferenceType("note");
            activity.setDescription("Note \"" + noteTitle + "\" updated");
            activity.setCreatedAt(LocalDateTime.now());
            
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("noteId", noteId);
            metadata.put("noteTitle", noteTitle);
            
            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing note metadata", e);
                activity.setMetadataJson("{}");
            }
            
            caseActivityRepository.save(activity);
            log.info("Successfully logged note updated activity");
        } catch (Exception e) {
            log.error("Failed to log note updated activity: {}", e.getMessage());
        }
    }

    @Override
    public void logNoteDeleted(Long caseId, Long noteId, String noteTitle, Long userId) {
        log.info("Logging note deleted activity for case ID: {}, note ID: {}", caseId, noteId);
        
        try {
            CaseActivity activity = new CaseActivity();
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("NOTE_DELETED");
            activity.setReferenceId(noteId);
            activity.setReferenceType("note");
            activity.setDescription("Note \"" + noteTitle + "\" deleted");
            activity.setCreatedAt(LocalDateTime.now());
            
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("noteId", noteId);
            metadata.put("noteTitle", noteTitle);
            
            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing note metadata", e);
                activity.setMetadataJson("{}");
            }
            
            caseActivityRepository.save(activity);
            log.info("Successfully logged note deletion activity");
        } catch (Exception e) {
            log.error("Failed to log note deletion activity: {}", e.getMessage());
        }
    }

    @Override
    public void logReminderCreated(Long caseId, Long reminderId, String reminderTitle, Long userId) {
        log.info("Logging reminder created activity for case ID: {}, reminder ID: {}", caseId, reminderId);
        
        CaseActivity activity = new CaseActivity();
        activity.setCaseId(caseId);
        activity.setUserId(userId);
        activity.setActivityType("TASK_CREATED");
        activity.setReferenceId(reminderId);
        activity.setReferenceType("case_reminders");
        activity.setDescription("Reminder \"" + reminderTitle + "\" created");
        activity.setCreatedAt(LocalDateTime.now());
        
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("reminderId", reminderId);
        metadata.put("reminderTitle", reminderTitle);
        
        try {
            activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
        } catch (JsonProcessingException e) {
            log.error("Error serializing reminder metadata", e);
            activity.setMetadataJson("{}");
        }
        
        caseActivityRepository.save(activity);
    }

    @Override
    public void logReminderUpdated(Long caseId, Long reminderId, String reminderTitle, Long userId) {
        log.info("Logging reminder updated activity for case ID: {}, reminder ID: {}", caseId, reminderId);
        
        CaseActivity activity = new CaseActivity();
        activity.setCaseId(caseId);
        activity.setUserId(userId);
        activity.setActivityType("TASK_UPDATED");
        activity.setReferenceId(reminderId);
        activity.setReferenceType("case_reminders");
        activity.setDescription("Reminder \"" + reminderTitle + "\" updated");
        activity.setCreatedAt(LocalDateTime.now());
        
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("reminderId", reminderId);
        metadata.put("reminderTitle", reminderTitle);
        
        try {
            activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
        } catch (JsonProcessingException e) {
            log.error("Error serializing reminder metadata", e);
            activity.setMetadataJson("{}");
        }
        
        caseActivityRepository.save(activity);
    }

    @Override
    public void logReminderCompleted(Long caseId, Long reminderId, String reminderTitle, Long userId) {
        log.info("Logging reminder completed activity for case ID: {}, reminder ID: {}", caseId, reminderId);
        
        CaseActivity activity = new CaseActivity();
        activity.setCaseId(caseId);
        activity.setUserId(userId);
        activity.setActivityType("TASK_COMPLETED");
        activity.setReferenceId(reminderId);
        activity.setReferenceType("case_reminders");
        activity.setDescription("Reminder \"" + reminderTitle + "\" completed");
        activity.setCreatedAt(LocalDateTime.now());
        
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("reminderId", reminderId);
        metadata.put("reminderTitle", reminderTitle);
        
        try {
            activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
        } catch (JsonProcessingException e) {
            log.error("Error serializing reminder metadata", e);
            activity.setMetadataJson("{}");
        }
        
        caseActivityRepository.save(activity);
    }

    @Override
    public void logReminderDeleted(Long caseId, Long reminderId, String reminderTitle, Long userId) {
        log.info("Logging reminder deleted activity for case ID: {}, reminder ID: {}", caseId, reminderId);
        
        CaseActivity activity = new CaseActivity();
        activity.setCaseId(caseId);
        activity.setUserId(userId);
        activity.setActivityType("TASK_DELETED");
        activity.setReferenceId(reminderId);
        activity.setReferenceType("case_reminders");
        activity.setDescription("Reminder \"" + reminderTitle + "\" deleted");
        activity.setCreatedAt(LocalDateTime.now());
        
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("reminderId", reminderId);
        metadata.put("reminderTitle", reminderTitle);
        
        try {
            activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
        } catch (JsonProcessingException e) {
            log.error("Error serializing reminder metadata", e);
            activity.setMetadataJson("{}");
        }
        
        caseActivityRepository.save(activity);
    }

    // Legacy methods for backward compatibility
    @Override
    public void logReminderCreated(Long caseId, Long reminderId, String reminderTitle) {
        logReminderCreated(caseId, reminderId, reminderTitle, null);
    }

    @Override
    public void logReminderUpdated(Long caseId, Long reminderId, String reminderTitle) {
        logReminderUpdated(caseId, reminderId, reminderTitle, null);
    }

    @Override
    public void logReminderCompleted(Long caseId, Long reminderId, String reminderTitle) {
        logReminderCompleted(caseId, reminderId, reminderTitle, null);
    }

    @Override
    public void logReminderDeleted(Long caseId, Long reminderId, String reminderTitle) {
        logReminderDeleted(caseId, reminderId, reminderTitle, null);
    }
} 