package com.bostoneo.bostoneosolutions.config;

import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.repository.AuditLogRepository;
import com.bostoneo.bostoneosolutions.service.SystemAuditService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.RequestParam;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.time.LocalDateTime;

/**
 * AOP Aspect for automatic audit logging
 */
@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class AuditAspect {

    private final SystemAuditService auditService;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;

    @Around("@annotation(auditLog)")
    public Object logActivity(ProceedingJoinPoint joinPoint, AuditLog auditLog) throws Throwable {
        // Check if this is a preview request and skip audit logging
        if (isPreviewRequest(joinPoint)) {
            return joinPoint.proceed();
        }
        
        Object result = joinPoint.proceed();
        
        try {
            // Get current user
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.isAuthenticated() || 
                authentication instanceof AnonymousAuthenticationToken) {
                return result;
            }
            
            // Handle both UserDetails and UserDTO as principal
            String username = null;
            Long userId = null;
            
            Object principal = authentication.getPrincipal();
            if (principal instanceof UserDetails) {
                UserDetails userDetails = (UserDetails) principal;
                username = userDetails.getUsername();
            } else if (principal instanceof UserDTO) {
                UserDTO userDTO = (UserDTO) principal;
                username = userDTO.getEmail();
                userId = userDTO.getId();
            } else {
                log.debug("Unknown principal type: " + principal.getClass().getName());
                return result;
            }
            
            // Find user by email/username or use the userId from UserDTO
            User user = null;
            try {
                if (userId != null) {
                    // If we have userId from UserDTO, get the user directly
                    user = userRepository.get(userId);
                } else if (username != null) {
                    // Otherwise, try to find by email
                    user = userRepository.getUserByEmail(username);
                }
            } catch (Exception e) {
                log.debug("User not found: " + (userId != null ? "ID " + userId : username));
                return result;
            }
            
            if (user == null) {
                return result;
            }
            
            // Create audit log entry
            String action = determineAction(auditLog, ((MethodSignature) joinPoint.getSignature()).getMethod(), joinPoint);
            String entityType = determineEntityType(auditLog, ((MethodSignature) joinPoint.getSignature()).getMethod(), joinPoint);
            Long entityId = determineEntityId(joinPoint);
            String description = determineDescription(auditLog, ((MethodSignature) joinPoint.getSignature()).getMethod(), joinPoint, result);
            String metadata = generateMetadata(joinPoint, result);
            
            com.bostoneo.bostoneosolutions.model.AuditLog.AuditAction auditAction;
            com.bostoneo.bostoneosolutions.model.AuditLog.EntityType auditEntityType;
            
            try {
                auditAction = com.bostoneo.bostoneosolutions.model.AuditLog.AuditAction.valueOf(action.toUpperCase());
            } catch (IllegalArgumentException e) {
                auditAction = com.bostoneo.bostoneosolutions.model.AuditLog.AuditAction.CREATE;
            }
            
            try {
                auditEntityType = com.bostoneo.bostoneosolutions.model.AuditLog.EntityType.valueOf(entityType.toUpperCase());
            } catch (IllegalArgumentException e) {
                auditEntityType = com.bostoneo.bostoneosolutions.model.AuditLog.EntityType.USER;
            }
            
            com.bostoneo.bostoneosolutions.model.AuditLog auditLogEntry = com.bostoneo.bostoneosolutions.model.AuditLog.builder()
                    .organizationId(user.getOrganizationId())
                    .userId(user.getId())
                    .action(auditAction)
                    .entityType(auditEntityType)
                    .entityId(entityId)
                    .description(description)
                    .metadata(metadata)
                    .ipAddress(getClientIpAddress())
                    .userAgent(getUserAgent())
                    .timestamp(LocalDateTime.now())
                    .build();
            
            auditLogRepository.save(auditLogEntry);
            
        } catch (Exception e) {
            // Log error but don't fail the original request
            log.error("Failed to create audit log: {}", e.getMessage(), e);
        }
        
        return result;
    }

    private boolean isPreviewRequest(ProceedingJoinPoint joinPoint) {
        Object[] args = joinPoint.getArgs();
        if (args != null) {
            for (Object arg : args) {
                if (arg instanceof Boolean && arg.equals(true)) {
                    // Check if this boolean parameter is the preview parameter
                    MethodSignature signature = (MethodSignature) joinPoint.getSignature();
                    Method method = signature.getMethod();
                    
                    // Check method parameters for preview parameter
                    Parameter[] parameters = method.getParameters();
                    for (int i = 0; i < parameters.length && i < args.length; i++) {
                        if (parameters[i].isAnnotationPresent(RequestParam.class)) {
                            RequestParam requestParam = parameters[i].getAnnotation(RequestParam.class);
                            if ("preview".equals(requestParam.value()) && args[i].equals(true)) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    private String determineAction(AuditLog auditLog, Method method, JoinPoint joinPoint) {
        if (!auditLog.action().isEmpty()) {
            return auditLog.action();
        }

        // Infer action from method name
        String methodName = method.getName().toLowerCase();
        if (methodName.startsWith("create") || methodName.startsWith("save") || methodName.startsWith("add")) {
            return "CREATE";
        } else if (methodName.startsWith("update") || methodName.startsWith("edit") || methodName.startsWith("modify")) {
            return "UPDATE";
        } else if (methodName.startsWith("delete") || methodName.startsWith("remove")) {
            return "DELETE";
        } else if (methodName.contains("login")) {
            return "LOGIN";
        } else if (methodName.contains("logout")) {
            return "LOGOUT";
        }
        
        return "ACTION";
    }

    private String determineEntityType(AuditLog auditLog, Method method, JoinPoint joinPoint) {
        if (!auditLog.entityType().isEmpty()) {
            return auditLog.entityType();
        }

        // Infer entity type from method name or class name
        String methodName = method.getName().toLowerCase();
        String className = method.getDeclaringClass().getSimpleName().toLowerCase();
        
        if (methodName.contains("client") || className.contains("client")) {
            return "CLIENT";
        } else if (methodName.contains("case") || className.contains("case") || className.contains("legalcase")) {
            return "LEGAL_CASE";
        } else if (methodName.contains("document") || className.contains("document")) {
            return "DOCUMENT";
        } else if (methodName.contains("invoice") || className.contains("invoice")) {
            return "INVOICE";
        } else if (methodName.contains("expense") || className.contains("expense")) {
            return "EXPENSE";
        } else if (methodName.contains("category") || className.contains("category")) {
            return "EXPENSE_CATEGORY";
        } else if (methodName.contains("vendor") || className.contains("vendor")) {
            return "VENDOR";
        } else if (methodName.contains("user") || className.contains("user")) {
            return "USER";
        } else if (methodName.contains("role") || className.contains("role")) {
            return "ROLE";
        } else if (methodName.contains("permission") || className.contains("permission")) {
            return "PERMISSION";
        } else if (methodName.contains("appointment") || className.contains("appointment")) {
            return "APPOINTMENT";
        } else if (methodName.contains("activity") || className.contains("activity")) {
            return "ACTIVITY";
        }
        
        return "SYSTEM";
    }

    private String determineDescription(AuditLog auditLog, Method method, JoinPoint joinPoint, Object result) {
        if (!auditLog.description().isEmpty()) {
            return auditLog.description();
        }

        String action = determineAction(auditLog, method, joinPoint);
        String entityType = determineEntityType(auditLog, method, joinPoint);
        String methodName = method.getName();
        
        // Create more descriptive messages based on action and entity
        switch (action.toUpperCase()) {
            case "CREATE":
                return getCreateDescription(entityType, methodName);
            case "UPDATE":
                return getUpdateDescription(entityType, methodName);
            case "DELETE":
                return getDeleteDescription(entityType, methodName);
            case "LOGIN":
                return "User successfully logged into the system";
            case "LOGOUT":
                return "User logged out of the system";
            case "ASSIGN":
                return getAssignDescription(entityType, methodName);
            case "REVOKE":
                return getRevokeDescription(entityType, methodName);
            case "EXPORT":
                return getExportDescription(entityType, methodName);
            case "DOWNLOAD":
                return getDownloadDescription(entityType, methodName);
            default:
                return String.format("%s %s via %s", action, entityType.toLowerCase().replace("_", " "), methodName);
        }
    }
    
    private String getCreateDescription(String entityType, String methodName) {
        switch (entityType) {
            case "CUSTOMER":
                return "Created new client account with contact information";
            case "LEGAL_CASE":
                return "Opened new legal case with case details and client information";
            case "INVOICE":
                return "Generated new invoice for client billing";
            case "EXPENSE":
                return "Recorded new business expense with receipt and categorization";
            case "EXPENSE_CATEGORY":
                return "Created new expense category for better organization";
            case "DOCUMENT":
                return "Uploaded new document to case file";
            case "USER":
                return "Created new user account with assigned permissions";
            case "ROLE":
                return "Established new role with specific access permissions";
            case "ACTIVITY":
                return "Logged new activity entry in case timeline";
            default:
                return String.format("Created new %s", entityType.toLowerCase().replace("_", " "));
        }
    }
    
    private String getUpdateDescription(String entityType, String methodName) {
        switch (entityType) {
            case "CUSTOMER":
                return "Updated client information and contact details";
            case "LEGAL_CASE":
                if (methodName.toLowerCase().contains("status")) {
                    return "Changed legal case status in workflow";
                }
                return "Modified legal case details and information";
            case "INVOICE":
                if (methodName.toLowerCase().contains("status")) {
                    return "Updated invoice payment status";
                }
                return "Modified invoice details and billing information";
            case "EXPENSE":
                return "Updated expense record with new details";
            case "USER":
                if (methodName.toLowerCase().contains("role")) {
                    return "Modified user role assignments and permissions";
                } else if (methodName.toLowerCase().contains("settings")) {
                    return "Updated user account settings and preferences";
                }
                return "Updated user profile information";
            case "ROLE":
                if (methodName.toLowerCase().contains("primary")) {
                    return "Set role as primary for user permissions";
                }
                return "Modified role definition and permissions";
            default:
                return String.format("Updated %s information", entityType.toLowerCase().replace("_", " "));
        }
    }
    
    private String getDeleteDescription(String entityType, String methodName) {
        switch (entityType) {
            case "CUSTOMER":
                return "Deleted client account and associated data";
            case "LEGAL_CASE":
                return "Closed and archived legal case";
            case "INVOICE":
                return "Removed invoice from billing system";
            case "EXPENSE":
                return "Deleted expense record from financial tracking";
            case "DOCUMENT":
                return "Removed document from case file";
            case "USER":
                return "Deactivated user account and revoked access";
            case "ROLE":
                return "Removed role and associated permissions";
            default:
                return String.format("Deleted %s from system", entityType.toLowerCase().replace("_", " "));
        }
    }
    
    private String getAssignDescription(String entityType, String methodName) {
        switch (entityType) {
            case "ROLE":
                return "Assigned role to user with specific permissions";
            case "PERMISSION":
                return "Granted permission to role for system access";
            case "CASE_ROLE":
                return "Assigned case-specific role for legal matter";
            default:
                return String.format("Assigned %s to user or entity", entityType.toLowerCase().replace("_", " "));
        }
    }
    
    private String getRevokeDescription(String entityType, String methodName) {
        switch (entityType) {
            case "ROLE":
                return "Removed role from user and revoked permissions";
            case "PERMISSION":
                return "Revoked permission from role";
            case "CASE_ROLE":
                return "Removed case-specific role assignment";
            default:
                return String.format("Revoked %s from user or entity", entityType.toLowerCase().replace("_", " "));
        }
    }
    
    private String getExportDescription(String entityType, String methodName) {
        switch (entityType) {
            case "CUSTOMER":
                return "Exported client report with contact information";
            case "INVOICE":
                return "Generated invoice report for financial analysis";
            case "EXPENSE":
                return "Exported expense report for accounting purposes";
            default:
                return String.format("Exported %s report", entityType.toLowerCase().replace("_", " "));
        }
    }
    
    private String getDownloadDescription(String entityType, String methodName) {
        switch (entityType) {
            case "DOCUMENT":
                return "Downloaded document file from case library";
            case "INVOICE":
                return "Downloaded invoice PDF for printing or sharing";
            default:
                return String.format("Downloaded %s file", entityType.toLowerCase().replace("_", " "));
        }
    }

    private Long determineEntityId(JoinPoint joinPoint) {
        // Try to extract ID from parameters
        Object[] args = joinPoint.getArgs();
        for (Object arg : args) {
            if (arg instanceof Number) {
                return ((Number) arg).longValue();
            }
            // Try to get ID from object using reflection
            try {
                Method getIdMethod = arg.getClass().getMethod("getId");
                Object id = getIdMethod.invoke(arg);
                if (id instanceof Number) {
                    return ((Number) id).longValue();
                }
            } catch (Exception e) {
                // Ignore reflection errors
            }
        }

        // Try to extract ID from result
        if (joinPoint.getArgs().length > 0) {
            try {
                Method getIdMethod = joinPoint.getArgs()[0].getClass().getMethod("getId");
                Object id = getIdMethod.invoke(joinPoint.getArgs()[0]);
                if (id instanceof Number) {
                    return ((Number) id).longValue();
                }
            } catch (Exception e) {
                // Ignore reflection errors
            }
        }

        return null;
    }

    private String generateMetadata(JoinPoint joinPoint, Object result) {
        // Implementation of generateMetadata method
        // This method should return a JSON string representing the metadata
        // For example, you can use Jackson to serialize the metadata object
        // to a JSON string
        return "{}"; // Placeholder return, actual implementation needed
    }

    private String getClientIpAddress() {
        // Implementation of getClientIpAddress method
        // This method should return the client IP address
        // For example, you can use HttpServletRequest to get the IP address
        return "127.0.0.1"; // Placeholder return, actual implementation needed
    }

    private String getUserAgent() {
        // Implementation of getUserAgent method
        // This method should return the user agent
        // For example, you can use HttpServletRequest to get the user agent
        return "Mozilla/5.0"; // Placeholder return, actual implementation needed
    }
} 
 
 
 
 
 
 