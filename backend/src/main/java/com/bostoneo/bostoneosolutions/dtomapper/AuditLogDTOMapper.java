package com.bostoneo.bostoneosolutions.dtomapper;

import com.bostoneo.bostoneosolutions.dto.AuditLogDTO;
import com.bostoneo.bostoneosolutions.dto.CreateAuditLogRequest;
import com.bostoneo.bostoneosolutions.model.AuditLog;
import com.bostoneo.bostoneosolutions.model.User;
import org.springframework.beans.BeanUtils;

import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

public class AuditLogDTOMapper {

    private static final DateTimeFormatter DISPLAY_FORMATTER = DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm:ss");

    /**
     * Convert AuditLog entity to AuditLogDTO
     */
    public static AuditLogDTO fromAuditLog(AuditLog auditLog) {
        AuditLogDTO dto = new AuditLogDTO();
        BeanUtils.copyProperties(auditLog, dto);
        
        // Convert enums to strings
        if (auditLog.getAction() != null) {
            dto.setAction(auditLog.getAction().name());
            dto.setActionDisplayName(getActionDisplayName(auditLog.getAction()));
        }
        
        if (auditLog.getEntityType() != null) {
            dto.setEntityType(auditLog.getEntityType().name());
            dto.setEntityDisplayName(getEntityDisplayName(auditLog.getEntityType()));
        }
        
        // Format timestamp for display
        if (auditLog.getTimestamp() != null) {
            dto.setFormattedTimestamp(auditLog.getTimestamp().format(DISPLAY_FORMATTER));
        }
        
        return dto;
    }

    /**
     * Convert AuditLog entity to AuditLogDTO with user information
     */
    public static AuditLogDTO fromAuditLogWithUser(AuditLog auditLog, User user) {
        AuditLogDTO dto = fromAuditLog(auditLog);
        
        if (user != null) {
            dto.setUserName(user.getFirstName() + " " + user.getLastName());
            dto.setUserEmail(user.getEmail());
        }
        
        return dto;
    }

    /**
     * Convert CreateAuditLogRequest to AuditLog entity
     */
    public static AuditLog fromCreateRequest(CreateAuditLogRequest request) {
        AuditLog auditLog = new AuditLog();
        
        auditLog.setUserId(request.getUserId());
        auditLog.setSessionId(request.getSessionId());
        auditLog.setDescription(request.getDescription());
        auditLog.setMetadata(request.getMetadata());
        auditLog.setIpAddress(request.getIpAddress());
        auditLog.setUserAgent(request.getUserAgent());
        
        // Convert string enums
        if (request.getAction() != null) {
            try {
                auditLog.setAction(AuditLog.AuditAction.valueOf(request.getAction().toUpperCase()));
            } catch (IllegalArgumentException e) {
                auditLog.setAction(AuditLog.AuditAction.CREATE); // Default fallback
            }
        }
        
        if (request.getEntityType() != null) {
            try {
                auditLog.setEntityType(AuditLog.EntityType.valueOf(request.getEntityType().toUpperCase()));
            } catch (IllegalArgumentException e) {
                auditLog.setEntityType(AuditLog.EntityType.USER); // Default fallback
            }
        }
        
        auditLog.setEntityId(request.getEntityId());
        
        return auditLog;
    }

    /**
     * Get user-friendly display name for actions
     */
    private static String getActionDisplayName(AuditLog.AuditAction action) {
        Map<AuditLog.AuditAction, String> actionNames = new HashMap<>();
        actionNames.put(AuditLog.AuditAction.CREATE, "Created");
        actionNames.put(AuditLog.AuditAction.UPDATE, "Updated");
        actionNames.put(AuditLog.AuditAction.DELETE, "Deleted");
        actionNames.put(AuditLog.AuditAction.LOGIN, "Logged In");
        actionNames.put(AuditLog.AuditAction.LOGOUT, "Logged Out");
        actionNames.put(AuditLog.AuditAction.UPLOAD, "Uploaded");
        actionNames.put(AuditLog.AuditAction.DOWNLOAD, "Downloaded");
        actionNames.put(AuditLog.AuditAction.APPROVE, "Approved");
        actionNames.put(AuditLog.AuditAction.REJECT, "Rejected");
        actionNames.put(AuditLog.AuditAction.SUBMIT, "Submitted");
        actionNames.put(AuditLog.AuditAction.ASSIGN, "Assigned");
        actionNames.put(AuditLog.AuditAction.UNASSIGN, "Unassigned");
        actionNames.put(AuditLog.AuditAction.ARCHIVE, "Archived");
        actionNames.put(AuditLog.AuditAction.RESTORE, "Restored");
        
        return actionNames.getOrDefault(action, action.name());
    }

    /**
     * Get user-friendly display name for entity types
     */
    private static String getEntityDisplayName(AuditLog.EntityType entityType) {
        Map<AuditLog.EntityType, String> entityNames = new HashMap<>();
        entityNames.put(AuditLog.EntityType.CUSTOMER, "Client");
        entityNames.put(AuditLog.EntityType.CASE, "Case");
        entityNames.put(AuditLog.EntityType.LEGAL_CASE, "Legal Case");
        entityNames.put(AuditLog.EntityType.DOCUMENT, "Document");
        entityNames.put(AuditLog.EntityType.INVOICE, "Invoice");
        entityNames.put(AuditLog.EntityType.USER, "User");
        entityNames.put(AuditLog.EntityType.APPOINTMENT, "Appointment");
        entityNames.put(AuditLog.EntityType.PAYMENT, "Payment");
        entityNames.put(AuditLog.EntityType.EXPENSE, "Expense");
        entityNames.put(AuditLog.EntityType.ROLE, "Role");
        entityNames.put(AuditLog.EntityType.PERMISSION, "Permission");
        entityNames.put(AuditLog.EntityType.EMAIL, "Email");
        entityNames.put(AuditLog.EntityType.CALENDAR_EVENT, "Calendar Event");
        
        return entityNames.getOrDefault(entityType, entityType.name());
    }
} 
 
 
 
 
 
 