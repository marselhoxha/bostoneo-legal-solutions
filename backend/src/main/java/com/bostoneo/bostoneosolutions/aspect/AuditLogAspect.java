package com.bostoneo.bostoneosolutions.aspect;

import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.service.AuditLogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;

/**
 * Aspect for automatic audit logging of annotated methods
 */
@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class AuditLogAspect {

    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    @Around("@annotation(com.bostoneo.bostoneosolutions.annotation.AuditLog)")
    public Object logActivity(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        AuditLog auditLogAnnotation = method.getAnnotation(AuditLog.class);

        // Get annotation values
        String actionStr = auditLogAnnotation.action();
        String entityTypeStr = auditLogAnnotation.entityType();
        String description = auditLogAnnotation.description();
        boolean includeParams = auditLogAnnotation.includeParams();
        boolean includeResult = auditLogAnnotation.includeResult();

        // Parse action and entity type
        com.bostoneo.bostoneosolutions.model.AuditLog.AuditAction action = parseAction(actionStr);
        com.bostoneo.bostoneosolutions.model.AuditLog.EntityType entityType = parseEntityType(entityTypeStr);

        // Build metadata from parameters if requested
        String metadata = null;
        Long entityId = null;

        if (includeParams) {
            Map<String, Object> paramMap = new HashMap<>();
            String[] paramNames = signature.getParameterNames();
            Object[] paramValues = joinPoint.getArgs();

            for (int i = 0; i < paramNames.length; i++) {
                String paramName = paramNames[i];
                Object paramValue = paramValues[i];

                // Try to extract entity ID from common parameter names
                if (entityId == null && paramValue instanceof Long) {
                    if (paramName.equalsIgnoreCase("id") ||
                        paramName.endsWith("Id") ||
                        paramName.equals("entityId")) {
                        entityId = (Long) paramValue;
                    }
                }

                // Add to metadata (skip large objects and sensitive data)
                if (paramValue != null && !isSensitiveParam(paramName)) {
                    try {
                        if (paramValue instanceof Long || paramValue instanceof String ||
                            paramValue instanceof Integer || paramValue instanceof Boolean) {
                            paramMap.put(paramName, paramValue);
                        } else {
                            paramMap.put(paramName, paramValue.getClass().getSimpleName());
                        }
                    } catch (Exception e) {
                        paramMap.put(paramName, "unable to serialize");
                    }
                }
            }

            if (!paramMap.isEmpty()) {
                try {
                    metadata = objectMapper.writeValueAsString(paramMap);
                } catch (Exception e) {
                    log.debug("Could not serialize audit metadata: {}", e.getMessage());
                }
            }
        }

        // Execute the method
        Object result = null;
        Exception exception = null;
        try {
            result = joinPoint.proceed();
        } catch (Exception e) {
            exception = e;
        }

        // Try to extract entity ID from result if not found in params
        if (entityId == null && result != null && includeResult) {
            entityId = extractEntityIdFromResult(result);
        }

        // Build description if not provided
        if (description == null || description.isEmpty()) {
            description = buildDescription(action, entityType, method.getName());
        }

        // Log the activity asynchronously — don't block the response
        try {
            String safeMetadata = (metadata != null && !metadata.isEmpty()) ? metadata : "{}";
            final Long finalEntityId = entityId;
            final String finalDescription = description;
            final com.bostoneo.bostoneosolutions.model.AuditLog.AuditAction finalAction = action;
            final com.bostoneo.bostoneosolutions.model.AuditLog.EntityType finalEntityType = entityType;
            java.util.concurrent.CompletableFuture.runAsync(() -> {
                try {
                    auditLogService.log(finalAction, finalEntityType, finalEntityId, finalDescription, safeMetadata);
                } catch (Exception ex) {
                    log.error("Failed to log audit activity (async): {}", ex.getMessage());
                }
            });
        } catch (Exception e) {
            log.error("Failed to submit audit activity: {}", e.getMessage());
        }

        // Re-throw exception if occurred
        if (exception != null) {
            throw exception;
        }

        return result;
    }

    private com.bostoneo.bostoneosolutions.model.AuditLog.AuditAction parseAction(String action) {
        if (action == null || action.isEmpty()) {
            return com.bostoneo.bostoneosolutions.model.AuditLog.AuditAction.CREATE;
        }
        try {
            return com.bostoneo.bostoneosolutions.model.AuditLog.AuditAction.valueOf(action.toUpperCase());
        } catch (IllegalArgumentException e) {
            log.warn("Unknown audit action: {}, defaulting to CREATE", action);
            return com.bostoneo.bostoneosolutions.model.AuditLog.AuditAction.CREATE;
        }
    }

    private com.bostoneo.bostoneosolutions.model.AuditLog.EntityType parseEntityType(String entityType) {
        if (entityType == null || entityType.isEmpty()) {
            return com.bostoneo.bostoneosolutions.model.AuditLog.EntityType.USER;
        }
        try {
            return com.bostoneo.bostoneosolutions.model.AuditLog.EntityType.valueOf(entityType.toUpperCase());
        } catch (IllegalArgumentException e) {
            log.warn("Unknown entity type: {}, defaulting to USER", entityType);
            return com.bostoneo.bostoneosolutions.model.AuditLog.EntityType.USER;
        }
    }

    private boolean isSensitiveParam(String paramName) {
        String lowerName = paramName.toLowerCase();
        return lowerName.contains("password") ||
               lowerName.contains("secret") ||
               lowerName.contains("token") ||
               lowerName.contains("key") ||
               lowerName.contains("credential");
    }

    private Long extractEntityIdFromResult(Object result) {
        try {
            if (result instanceof ResponseEntity<?> responseEntity) {
                Object body = responseEntity.getBody();
                if (body instanceof Map<?, ?> map) {
                    Object data = map.get("data");
                    if (data instanceof Map<?, ?> dataMap) {
                        // Try common ID field names
                        for (String idField : new String[]{"id", "entityId", "organizationId", "userId", "caseId"}) {
                            Object idValue = dataMap.get(idField);
                            if (idValue instanceof Long) {
                                return (Long) idValue;
                            } else if (idValue instanceof Integer) {
                                return ((Integer) idValue).longValue();
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Could not extract entity ID from result: {}", e.getMessage());
        }
        return null;
    }

    private String buildDescription(com.bostoneo.bostoneosolutions.model.AuditLog.AuditAction action,
                                    com.bostoneo.bostoneosolutions.model.AuditLog.EntityType entityType,
                                    String methodName) {
        return String.format("%s %s via %s", action.name().toLowerCase(), entityType.name().toLowerCase(), methodName);
    }
}
