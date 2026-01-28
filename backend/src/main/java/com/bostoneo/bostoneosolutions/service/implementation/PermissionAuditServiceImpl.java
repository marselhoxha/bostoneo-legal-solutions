package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.PermissionAuditLog;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
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
    private final TenantService tenantService;

    /**
     * Helper method to get the current organization ID
     */
    private Long getCurrentOrganizationId() {
        return tenantService.getCurrentOrganizationId().orElse(null);
    }

    /**
     * Helper method to get the required organization ID (throws if not available)
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new ApiException("Organization context required"));
    }

    @Override
    public PermissionAuditLog logPermissionChange(Long userId, String action, String targetType,
                                                 Long targetId, String details) {
        log.info("Logging permission change: {} on {}", action, targetType);
        try {
            PermissionAuditLog auditLog = PermissionAuditLog.builder()
                .organizationId(getCurrentOrganizationId())
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
                if (authentication.getPrincipal() instanceof com.bostoneo.bostoneosolutions.dto.UserDTO) {
                    com.bostoneo.bostoneosolutions.dto.UserDTO user =
                        (com.bostoneo.bostoneosolutions.dto.UserDTO) authentication.getPrincipal();
                    auditLog.setPerformedBy(user.getId());
                } else {
                    auditLog.setPerformedBy(1L); // System user
                }
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
            Long orgId = getRequiredOrganizationId();
            return auditLogRepository.findByUserIdAndOrganizationId(userId, orgId);
        } catch (Exception e) {
            log.error("Error getting audit logs: {}", e.getMessage());
            throw new ApiException("Error getting audit logs");
        }
    }

    @Override
    public List<PermissionAuditLog> getRecentAuditLogs(int limit) {
        log.info("Getting recent audit logs, limit: {}", limit);
        try {
            Long orgId = getRequiredOrganizationId();
            return auditLogRepository.findRecentLogsByOrganizationId(orgId, limit);
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
            Long orgId = getRequiredOrganizationId();
            LocalDateTime startDate = null;
            LocalDateTime endDate = null;

            if (startDateStr != null && !startDateStr.isEmpty()) {
                startDate = LocalDateTime.parse(startDateStr, DateTimeFormatter.ISO_DATE_TIME);
            }

            if (endDateStr != null && !endDateStr.isEmpty()) {
                endDate = LocalDateTime.parse(endDateStr, DateTimeFormatter.ISO_DATE_TIME);
            }

            return auditLogRepository.searchLogsByOrganizationId(orgId, userId, action, targetType, startDate, endDate, limit);
        } catch (Exception e) {
            log.error("Error searching audit logs: {}", e.getMessage());
            throw new ApiException("Error searching audit logs");
        }
    }
} 