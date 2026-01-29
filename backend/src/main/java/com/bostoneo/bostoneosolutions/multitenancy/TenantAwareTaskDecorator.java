package com.bostoneo.bostoneosolutions.multitenancy;

import org.springframework.core.task.TaskDecorator;
import org.springframework.lang.NonNull;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Task decorator that propagates both security and tenant context to async threads.
 * SECURITY: This ensures that @Async methods retain both the authentication context
 * and tenant context from the calling thread, preventing unauthorized access and
 * cross-tenant data access.
 */
public class TenantAwareTaskDecorator implements TaskDecorator {

    @Override
    @NonNull
    public Runnable decorate(@NonNull Runnable runnable) {
        // Capture BOTH tenant and security context from the calling thread
        Long currentTenantId = TenantContext.getCurrentTenant();
        SecurityContext securityContext = SecurityContextHolder.getContext();

        return () -> {
            try {
                // Restore security context in the async thread
                if (securityContext != null && securityContext.getAuthentication() != null) {
                    SecurityContextHolder.setContext(securityContext);
                }
                // Set the tenant context in the async thread
                if (currentTenantId != null) {
                    TenantContext.setCurrentTenant(currentTenantId);
                }
                runnable.run();
            } finally {
                // Always clear both contexts after execution to prevent leaks
                SecurityContextHolder.clearContext();
                TenantContext.clear();
            }
        };
    }
}
