package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.CaseActivityDTO;
import com.bostoneo.bostoneosolutions.dto.CreateActivityRequest;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.dtomapper.CaseActivityDTOMapper;
import com.bostoneo.bostoneosolutions.model.AuditLog;
import com.bostoneo.bostoneosolutions.model.CaseActivity;
import com.bostoneo.bostoneosolutions.repository.CaseActivityRepository;
import com.bostoneo.bostoneosolutions.service.CaseActivityService;
import com.bostoneo.bostoneosolutions.service.SystemAuditService;
import com.bostoneo.bostoneosolutions.service.UserService;
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
    private final com.bostoneo.bostoneosolutions.multitenancy.TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }
    
    @Override
    public List<CaseActivityDTO> getActivitiesByCaseId(Long caseId) {
        log.info("Getting activities for case ID: {}", caseId);

        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        List<CaseActivity> activities = caseActivityRepository.findByOrganizationIdAndCaseIdOrderByCreatedAtDesc(orgId, caseId);
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

        Long orgId = getRequiredOrganizationId();
        CaseActivity activity = new CaseActivity();
        // SECURITY: Set organization ID when creating
        activity.setOrganizationId(orgId);
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
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            // 1. Log to case_activities table (existing functionality)
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
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
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
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
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
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
        Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
        CaseActivity activity = new CaseActivity();
        activity.setOrganizationId(orgId); // SECURITY: Set organization ID
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
        Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
        CaseActivity activity = new CaseActivity();
        activity.setOrganizationId(orgId); // SECURITY: Set organization ID
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
        Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
        CaseActivity activity = new CaseActivity();
        activity.setOrganizationId(orgId); // SECURITY: Set organization ID
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
        Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
        CaseActivity activity = new CaseActivity();
        activity.setOrganizationId(orgId); // SECURITY: Set organization ID
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

    // =====================================================
    // CASE STATUS & PRIORITY ACTIVITIES
    // =====================================================

    @Override
    public void logStatusChanged(Long caseId, String oldStatus, String newStatus, Long userId) {
        log.info("Logging status change for case ID: {} from {} to {}", caseId, oldStatus, newStatus);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("STATUS_CHANGED");
            activity.setReferenceType("case");
            activity.setDescription("Case status changed from " + oldStatus + " to " + newStatus);
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("oldStatus", oldStatus);
            metadata.put("newStatus", newStatus);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing status change metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
            log.info("Successfully logged status change activity");
        } catch (Exception e) {
            log.error("Failed to log status change activity: {}", e.getMessage());
        }
    }

    @Override
    public void logPriorityChanged(Long caseId, String oldPriority, String newPriority, Long userId) {
        log.info("Logging priority change for case ID: {} from {} to {}", caseId, oldPriority, newPriority);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("PRIORITY_CHANGED");
            activity.setReferenceType("case");
            activity.setDescription("Case priority changed from " + oldPriority + " to " + newPriority);
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("oldPriority", oldPriority);
            metadata.put("newPriority", newPriority);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing priority change metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to log priority change activity: {}", e.getMessage());
        }
    }

    @Override
    public void logCaseCreated(Long caseId, String caseTitle, String clientName, Long userId) {
        log.info("Logging case creation for case ID: {}", caseId);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("CASE_CREATED");
            activity.setReferenceType("case");
            activity.setDescription("Case \"" + caseTitle + "\" created for client " + clientName);
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("caseTitle", caseTitle);
            metadata.put("clientName", clientName);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing case creation metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to log case creation activity: {}", e.getMessage());
        }
    }

    // =====================================================
    // DOCUMENT ACTIVITIES
    // =====================================================

    @Override
    public void logDocumentUploaded(Long caseId, Long documentId, String documentName, Long userId) {
        log.info("Logging document upload for case ID: {}, document: {}", caseId, documentName);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("DOCUMENT_UPLOADED");
            activity.setReferenceId(documentId);
            activity.setReferenceType("document");
            activity.setDescription("Uploaded document \"" + documentName + "\"");
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("documentId", documentId);
            metadata.put("documentName", documentName);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing document upload metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to log document upload activity: {}", e.getMessage());
        }
    }

    @Override
    public void logDocumentDownloaded(Long caseId, Long documentId, String documentName, Long userId) {
        log.info("Logging document download for case ID: {}, document: {}", caseId, documentName);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("DOCUMENT_DOWNLOADED");
            activity.setReferenceId(documentId);
            activity.setReferenceType("document");
            activity.setDescription("Downloaded document \"" + documentName + "\"");
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("documentId", documentId);
            metadata.put("documentName", documentName);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing document download metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to log document download activity: {}", e.getMessage());
        }
    }

    @Override
    public void logDocumentVersionAdded(Long caseId, Long documentId, String documentName, int versionNumber, Long userId) {
        log.info("Logging document version for case ID: {}, document: {}, version: {}", caseId, documentName, versionNumber);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("DOCUMENT_VERSION_ADDED");
            activity.setReferenceId(documentId);
            activity.setReferenceType("document");
            activity.setDescription("Added version " + versionNumber + " of document \"" + documentName + "\"");
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("documentId", documentId);
            metadata.put("documentName", documentName);
            metadata.put("versionNumber", versionNumber);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing document version metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to log document version activity: {}", e.getMessage());
        }
    }

    // =====================================================
    // CALENDAR & HEARING ACTIVITIES
    // =====================================================

    @Override
    public void logHearingScheduled(Long caseId, Long eventId, String eventTitle, String eventType, Long userId) {
        log.info("Logging hearing scheduled for case ID: {}, event: {}", caseId, eventTitle);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("HEARING_SCHEDULED");
            activity.setReferenceId(eventId);
            activity.setReferenceType("calendar_event");
            activity.setDescription("Scheduled " + eventType.toLowerCase().replace("_", " ") + ": \"" + eventTitle + "\"");
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("eventId", eventId);
            metadata.put("eventTitle", eventTitle);
            metadata.put("eventType", eventType);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing hearing scheduled metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to log hearing scheduled activity: {}", e.getMessage());
        }
    }

    @Override
    public void logHearingUpdated(Long caseId, Long eventId, String eventTitle, Long userId) {
        log.info("Logging hearing update for case ID: {}, event: {}", caseId, eventTitle);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("HEARING_UPDATED");
            activity.setReferenceId(eventId);
            activity.setReferenceType("calendar_event");
            activity.setDescription("Updated hearing/event: \"" + eventTitle + "\"");
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("eventId", eventId);
            metadata.put("eventTitle", eventTitle);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing hearing update metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to log hearing update activity: {}", e.getMessage());
        }
    }

    @Override
    public void logHearingCancelled(Long caseId, Long eventId, String eventTitle, Long userId) {
        log.info("Logging hearing cancellation for case ID: {}, event: {}", caseId, eventTitle);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("HEARING_CANCELLED");
            activity.setReferenceId(eventId);
            activity.setReferenceType("calendar_event");
            activity.setDescription("Cancelled hearing/event: \"" + eventTitle + "\"");
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("eventId", eventId);
            metadata.put("eventTitle", eventTitle);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing hearing cancellation metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to log hearing cancellation activity: {}", e.getMessage());
        }
    }

    // =====================================================
    // ASSIGNMENT ACTIVITIES
    // =====================================================

    @Override
    public void logAssignmentAdded(Long caseId, Long assigneeId, String assigneeName, String roleType, Long userId) {
        log.info("Logging assignment for case ID: {}, assignee: {}", caseId, assigneeName);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("ASSIGNMENT_ADDED");
            activity.setReferenceId(assigneeId);
            activity.setReferenceType("user");
            activity.setDescription(assigneeName + " assigned as " + roleType.toLowerCase().replace("_", " "));
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("assigneeId", assigneeId);
            metadata.put("assigneeName", assigneeName);
            metadata.put("roleType", roleType);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing assignment metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to log assignment activity: {}", e.getMessage());
        }
    }

    @Override
    public void logAssignmentRemoved(Long caseId, Long assigneeId, String assigneeName, Long userId) {
        log.info("Logging unassignment for case ID: {}, assignee: {}", caseId, assigneeName);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("ASSIGNMENT_REMOVED");
            activity.setReferenceId(assigneeId);
            activity.setReferenceType("user");
            activity.setDescription(assigneeName + " removed from case");
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("assigneeId", assigneeId);
            metadata.put("assigneeName", assigneeName);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing unassignment metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to log unassignment activity: {}", e.getMessage());
        }
    }

    // =====================================================
    // COMMUNICATION ACTIVITIES
    // =====================================================

    @Override
    public void logClientContacted(Long caseId, String contactMethod, String subject, Long userId) {
        log.info("Logging client contact for case ID: {}, method: {}", caseId, contactMethod);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("CLIENT_CONTACTED");
            activity.setReferenceType("communication");
            activity.setDescription("Contacted client via " + contactMethod + ": " + subject);
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("contactMethod", contactMethod);
            metadata.put("subject", subject);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing client contact metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to log client contact activity: {}", e.getMessage());
        }
    }

    @Override
    public void logEmailSent(Long caseId, String recipient, String subject, Long userId) {
        log.info("Logging email sent for case ID: {}, to: {}", caseId, recipient);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("EMAIL_SENT");
            activity.setReferenceType("email");
            activity.setDescription("Email sent to " + recipient + ": \"" + subject + "\"");
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("recipient", recipient);
            metadata.put("subject", subject);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing email sent metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to log email sent activity: {}", e.getMessage());
        }
    }

    // =====================================================
    // FINANCIAL ACTIVITIES
    // =====================================================

    @Override
    public void logPaymentReceived(Long caseId, Long paymentId, Double amount, Long userId) {
        log.info("Logging payment received for case ID: {}, amount: ${}", caseId, amount);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("PAYMENT_RECEIVED");
            activity.setReferenceId(paymentId);
            activity.setReferenceType("payment");
            activity.setDescription(String.format("Payment received: $%.2f", amount));
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("paymentId", paymentId);
            metadata.put("amount", amount);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing payment metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to log payment activity: {}", e.getMessage());
        }
    }

    @Override
    public void logTimeEntryAdded(Long caseId, Long timeEntryId, Double hours, String description, Long userId) {
        log.info("Logging time entry for case ID: {}, hours: {}", caseId, hours);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("TIME_ENTRY_ADDED");
            activity.setReferenceId(timeEntryId);
            activity.setReferenceType("time_entry");
            activity.setDescription(String.format("Logged %.1f hours: %s", hours, description));
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("timeEntryId", timeEntryId);
            metadata.put("hours", hours);
            metadata.put("description", description);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing time entry metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to log time entry activity: {}", e.getMessage());
        }
    }

    @Override
    public void logInvoiceCreated(Long caseId, Long invoiceId, Double amount, Long userId) {
        log.info("Logging invoice created for case ID: {}, amount: ${}", caseId, amount);

        try {
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            CaseActivity activity = new CaseActivity();
            activity.setOrganizationId(orgId); // SECURITY: Set organization ID
            activity.setCaseId(caseId);
            activity.setUserId(userId);
            activity.setActivityType("INVOICE_CREATED");
            activity.setReferenceId(invoiceId);
            activity.setReferenceType("invoice");
            activity.setDescription(String.format("Invoice created for $%.2f", amount));
            activity.setCreatedAt(LocalDateTime.now());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("invoiceId", invoiceId);
            metadata.put("amount", amount);

            try {
                activity.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException e) {
                log.error("Error serializing invoice metadata", e);
                activity.setMetadataJson("{}");
            }

            caseActivityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to log invoice activity: {}", e.getMessage());
        }
    }
} 