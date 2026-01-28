package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.model.AuditLog;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.AuditLogRepository;
import com.bostoneo.bostoneosolutions.service.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AuditLogServiceImpl implements AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final TenantService tenantService;

    @Override
    public AuditLog log(AuditLog.AuditAction action, AuditLog.EntityType entityType, Long entityId, String description) {
        return log(action, entityType, entityId, description, null);
    }

    @Override
    public AuditLog log(AuditLog.AuditAction action, AuditLog.EntityType entityType, Long entityId, String description, String metadata) {
        Long userId = tenantService.getCurrentUserId().orElse(null);
        Long organizationId = TenantContext.getCurrentTenant();
        String ipAddress = getClientIpAddress();
        String userAgent = getUserAgent();

        return log(userId, organizationId, action, entityType, entityId, description, metadata, ipAddress, userAgent);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AuditLog log(Long userId, Long organizationId, AuditLog.AuditAction action, AuditLog.EntityType entityType,
                        Long entityId, String description, String metadata, String ipAddress, String userAgent) {
        try {
            // Ensure metadata is valid JSON for PostgreSQL JSONB column
            String safeMetadata = (metadata != null && !metadata.isEmpty()) ? metadata : "{}";

            AuditLog auditLog = AuditLog.builder()
                    .userId(userId)
                    .organizationId(organizationId)
                    .action(action)
                    .entityType(entityType)
                    .entityId(entityId)
                    .description(description)
                    .metadata(safeMetadata)
                    .ipAddress(ipAddress)
                    .userAgent(userAgent)
                    .timestamp(LocalDateTime.now())
                    .build();

            AuditLog saved = auditLogRepository.save(auditLog);
            log.debug("Audit log created: {} {} on {} {}", action, entityType, entityId, description);
            return saved;
        } catch (Exception e) {
            // Don't let audit logging failures break the main operation
            log.error("Failed to create audit log: {}", e.getMessage());
            return null;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLog> getAuditLogs(Pageable pageable) {
        Long organizationId = TenantContext.getCurrentTenant();
        // SECURITY: Require organization context - never return unfiltered audit logs
        if (organizationId == null) {
            throw new RuntimeException("Organization context required to access audit logs");
        }
        return auditLogRepository.findByOrganizationIdOrderByTimestampDesc(organizationId, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditLog> getAuditLogsByEntity(AuditLog.EntityType entityType, Long entityId) {
        Long organizationId = TenantContext.getCurrentTenant();
        // SECURITY: Require organization context - never return unfiltered audit logs
        if (organizationId == null) {
            throw new RuntimeException("Organization context required to access audit logs");
        }
        return auditLogRepository.findByOrganizationIdAndEntityTypeAndEntityIdOrderByTimestampDesc(organizationId, entityType, entityId);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLog> getAuditLogsByUser(Long userId, Pageable pageable) {
        Long organizationId = TenantContext.getCurrentTenant();
        // SECURITY: Require organization context - never return unfiltered audit logs
        if (organizationId == null) {
            throw new RuntimeException("Organization context required to access audit logs");
        }
        return auditLogRepository.findByOrganizationIdAndUserIdOrderByTimestampDesc(organizationId, userId, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLog> getAuditLogsByDateRange(LocalDateTime startDate, LocalDateTime endDate, Pageable pageable) {
        Long organizationId = TenantContext.getCurrentTenant();
        if (organizationId != null) {
            return auditLogRepository.findByOrganizationIdAndTimestampBetweenOrderByTimestampDesc(organizationId, startDate, endDate, pageable);
        }
        return auditLogRepository.findByTimestampBetweenOrderByTimestampDesc(startDate, endDate, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditLog> getRecentActivities(int limit) {
        LocalDateTime since = LocalDateTime.now().minusDays(7);
        Long organizationId = TenantContext.getCurrentTenant();
        if (organizationId != null) {
            return auditLogRepository.findRecentActivitiesForDashboardByOrganization(organizationId, since, PageRequest.of(0, limit));
        }
        return auditLogRepository.findRecentActivitiesForDashboard(since, PageRequest.of(0, limit));
    }

    private String getClientIpAddress() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                String xForwardedFor = request.getHeader("X-Forwarded-For");
                if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
                    return xForwardedFor.split(",")[0].trim();
                }
                return request.getRemoteAddr();
            }
        } catch (Exception e) {
            log.debug("Could not get client IP address: {}", e.getMessage());
        }
        return null;
    }

    private String getUserAgent() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                return request.getHeader("User-Agent");
            }
        } catch (Exception e) {
            log.debug("Could not get user agent: {}", e.getMessage());
        }
        return null;
    }
}
