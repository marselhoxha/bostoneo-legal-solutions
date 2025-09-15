package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.PermissionAuditLog;
import com.bostoneo.bostoneosolutions.repository.PermissionAuditLogRepository;
import com.bostoneo.bostoneosolutions.service.PermissionAuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Implementation of the PermissionAuditService interface
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class PermissionAuditServiceImpl implements PermissionAuditService {

    private final PermissionAuditLogRepository<PermissionAuditLog> auditLogRepository;

    @Override
    public PermissionAuditLog logPermissionChange(Long userId, String action, String targetType, 
                                                 Long targetId, String details) {
        log.info("Logging permission change: {} on {}", action, targetType);
        try {
            PermissionAuditLog auditLog = PermissionAuditLog.builder()
                .userId(userId)
                .action(action)
                .targetType(targetType)
                .targetId(targetId)
                .details(details)
                .timestamp(LocalDateTime.now())
                .build();

            // Get the current authenticated user if available
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                // In a real implementation, you'd get the user ID from the authentication
                // For now, we'll use 1L as a placeholder for the system user
                auditLog.setPerformedBy(1L);
            }

            return auditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.error("Error logging permission change: {}", e.getMessage());
            throw new ApiException("Error logging permission change");
        }
    }

    @Override
    public List<PermissionAuditLog> getAuditLogsByUserId(Long userId) {
        log.info("Getting audit logs for user id: {}", userId);
        try {
            return auditLogRepository.findByUserId(userId);
        } catch (Exception e) {
            log.error("Error getting audit logs: {}", e.getMessage());
            throw new ApiException("Error getting audit logs");
        }
    }

    @Override
    public List<PermissionAuditLog> getRecentAuditLogs(int limit) {
        log.info("Getting recent audit logs, limit: {}", limit);
        try {
            return auditLogRepository.findRecentLogs(limit);
        } catch (Exception e) {
            log.error("Error getting recent audit logs: {}", e.getMessage());
            throw new ApiException("Error getting recent audit logs");
        }
    }

    @Override
    public List<PermissionAuditLog> searchAuditLogs(Long userId, String action, String targetType, 
                                                  String startDateStr, String endDateStr, int limit) {
        log.info("Searching audit logs");
        try {
            LocalDateTime startDate = null;
            LocalDateTime endDate = null;
            
            if (startDateStr != null && !startDateStr.isEmpty()) {
                startDate = LocalDateTime.parse(startDateStr, DateTimeFormatter.ISO_DATE_TIME);
            }
            
            if (endDateStr != null && !endDateStr.isEmpty()) {
                endDate = LocalDateTime.parse(endDateStr, DateTimeFormatter.ISO_DATE_TIME);
            }
            
            return auditLogRepository.searchLogs(userId, action, targetType, startDate, endDate, limit);
        } catch (Exception e) {
            log.error("Error searching audit logs: {}", e.getMessage());
            throw new ApiException("Error searching audit logs");
        }
    }
} 