package com.bostoneo.bostoneosolutions.multitenancy;

import org.springframework.core.task.TaskDecorator;
import org.springframework.lang.NonNull;

/**
 * Task decorator that propagates tenant context to async threads.
 * SECURITY: This ensures that @Async methods retain the tenant context
 * from the calling thread, preventing cross-tenant data access.
 */
public class TenantAwareTaskDecorator implements TaskDecorator {

    @Override
    @NonNull
    public Runnable decorate(@NonNull Runnable runnable) {
        // Capture the current tenant context from the calling thread
        Long currentTenantId = TenantContext.getCurrentTenant();

        return () -> {
            try {
                // Set the tenant context in the async thread
                if (currentTenantId != null) {
                    TenantContext.setCurrentTenant(currentTenantId);
                }
                runnable.run();
            } finally {
                // Always clear the context after execution to prevent leaks
                TenantContext.clear();
            }
        };
    }
}
