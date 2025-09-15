package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.AuditActivityResponseDTO;
import com.bostoneo.bostoneosolutions.dto.AuditLogDTO;
import com.bostoneo.bostoneosolutions.dto.CreateAuditLogRequest;
import com.bostoneo.bostoneosolutions.model.AuditLog;
import org.springframework.data.domain.Page;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service for comprehensive system auditing and activity tracking
 */
public interface SystemAuditService {
    
    /**
     * Log a system activity
     * @param userId The user who performed the action
     * @param action The action taken
     * @param entityType The type of entity affected
     * @param entityId The ID of the entity
     * @param description Human-readable description
     * @param metadata Additional metadata as JSON
     */
    void logActivity(Long userId, AuditLog.AuditAction action, AuditLog.EntityType entityType, 
                    Long entityId, String description, String metadata);
    
    /**
     * Log a system activity with enriched context (for AOP)
     * @param username The username who performed the action
     * @param action The action taken
     * @param entityType The type of entity affected
     * @param entityId The ID of the entity
     * @param description Human-readable description
     * @param metadata Additional metadata as Map
     * @param ipAddress Client IP address
     * @param userAgent Client user agent
     */
    void logActivity(String username, AuditLog.AuditAction action, AuditLog.EntityType entityType, 
                    Long entityId, String description, java.util.Map<String, Object> metadata, 
                    String ipAddress, String userAgent);
    
    /**
     * Log activity from request DTO
     * @param request The audit log request
     * @return The created audit log DTO
     */
    AuditLogDTO logActivity(CreateAuditLogRequest request);
    
    /**
     * Get recent activities for dashboard
     * @param limit Maximum number of activities to return
     * @return Response containing activities and statistics
     */
    AuditActivityResponseDTO getRecentActivities(int limit);
    
    /**
     * Get activities for a specific user
     * @param userId The user ID
     * @param page Page number
     * @param size Page size
     * @return Page of audit log DTOs
     */
    Page<AuditLogDTO> getUserActivities(Long userId, int page, int size);
    
    /**
     * Get activities by date range
     * @param startDate Start date
     * @param endDate End date
     * @param page Page number
     * @param size Page size
     * @return Page of audit log DTOs
     */
    Page<AuditLogDTO> getActivitiesByDateRange(LocalDateTime startDate, LocalDateTime endDate, int page, int size);
    
    /**
     * Get activities for a specific entity
     * @param entityType The entity type
     * @param entityId The entity ID
     * @return List of audit log DTOs
     */
    List<AuditLogDTO> getEntityActivities(AuditLog.EntityType entityType, Long entityId);
    
    /**
     * Get activity statistics
     * @return Activity statistics
     */
    AuditActivityResponseDTO.ActivityStatistics getActivityStatistics();
    
    /**
     * Get activity counts for dashboard
     * @return Activity counts (total, today, week)
     */
    ActivityCounts getActivityCounts();
    
    /**
     * Create test audit entries for debugging timestamp issues
     * Used for troubleshooting timestamp display problems
     */
    void createTestAuditEntries();
    
    /**
     * Helper class for activity counts
     */
    class ActivityCounts {
        public final long total;
        public final long today;
        public final long week;
        
        public ActivityCounts(long total, long today, long week) {
            this.total = total;
            this.today = today;
            this.week = week;
        }
    }
} 
 
 
 
 
 
 