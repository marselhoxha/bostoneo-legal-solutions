package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.model.PermissionAuditLog;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.PermissionAuditRepository;
import com.bostoneo.bostoneosolutions.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditServiceImpl implements AuditService {

    private final PermissionAuditRepository<PermissionAuditLog> auditRepository;
    private final TenantService tenantService;

    /**
     * Helper method to get the current organization ID
     */
    private Long getCurrentOrganizationId() {
        return tenantService.getCurrentOrganizationId().orElse(null);
    }

    @Override
    public void logPermissionChange(Long userId, String action, String targetType, Long targetId, String details) {
        try {
            // Get the user who is performing the action
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            Long performedBy = 1L; // Default to system user if can't determine

            if (auth != null && auth.getPrincipal() instanceof com.bostoneo.bostoneosolutions.dto.UserDTO) {
                com.bostoneo.bostoneosolutions.dto.UserDTO user =
                    (com.bostoneo.bostoneosolutions.dto.UserDTO) auth.getPrincipal();
                performedBy = user.getId();
            }

            PermissionAuditLog auditLog = PermissionAuditLog.builder()
                .organizationId(getCurrentOrganizationId())
                .userId(userId)
                .action(action)
                .targetType(targetType)
                .targetId(targetId)
                .details(details)
                .performedBy(performedBy)
                .timestamp(LocalDateTime.now())
                .build();

            auditRepository.create(auditLog);

        } catch (Exception e) {
            log.error("Failed to log permission change: {}", e.getMessage(), e);
            // Don't throw exception here - we don't want audit failures to affect normal operations
        }
    }
} 