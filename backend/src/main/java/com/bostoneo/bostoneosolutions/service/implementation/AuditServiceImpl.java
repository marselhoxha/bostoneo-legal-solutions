package com.***REMOVED***.***REMOVED***solutions.service.implementation;

import com.***REMOVED***.***REMOVED***solutions.model.PermissionAuditLog;
import com.***REMOVED***.***REMOVED***solutions.repository.PermissionAuditRepository;
import com.***REMOVED***.***REMOVED***solutions.service.AuditService;
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
    
    @Override
    public void logPermissionChange(Long userId, String action, String targetType, Long targetId, String details) {
        try {
            // Get the user who is performing the action
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            Long performedBy = 1L; // Default to system user if can't determine
            
            if (auth != null && auth.getPrincipal() instanceof com.***REMOVED***.***REMOVED***solutions.dto.UserDTO) {
                com.***REMOVED***.***REMOVED***solutions.dto.UserDTO user = 
                    (com.***REMOVED***.***REMOVED***solutions.dto.UserDTO) auth.getPrincipal();
                performedBy = user.getId();
            }
            
            PermissionAuditLog log = PermissionAuditLog.builder()
                .userId(userId)
                .action(action)
                .targetType(targetType)
                .targetId(targetId)
                .details(details)
                .performedBy(performedBy)
                .timestamp(LocalDateTime.now())
                .build();
            
            auditRepository.create(log);
            
        } catch (Exception e) {
            log.error("Failed to log permission change: {}", e.getMessage(), e);
            // Don't throw exception here - we don't want audit failures to affect normal operations
        }
    }
} 