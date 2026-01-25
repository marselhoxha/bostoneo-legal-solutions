package com.bostoneo.bostoneosolutions.multitenancy;

import lombok.extern.slf4j.Slf4j;

/**
 * ThreadLocal holder for current tenant (organization) context.
 *
 * This context is set during request processing after authentication
 * and should be used to filter all database queries to the current organization.
 *
 * Usage:
 * - TenantContext.getCurrentTenant() - Get current organization ID
 * - TenantContext.setCurrentTenant(orgId) - Set current organization ID
 * - TenantContext.clear() - Clear context (call after request completion)
 */
@Slf4j
public class TenantContext {

    private static final ThreadLocal<Long> CURRENT_TENANT = new ThreadLocal<>();

    private TenantContext() {
        // Utility class - prevent instantiation
    }

    /**
     * Get the current tenant (organization) ID for this request.
     *
     * @return The organization ID, or null if not set
     */
    public static Long getCurrentTenant() {
        return CURRENT_TENANT.get();
    }

    /**
     * Get the current tenant (organization) ID, throwing if not set.
     * Use this when tenant context is required.
     *
     * @return The organization ID
     * @throws IllegalStateException if tenant context is not set
     */
    public static Long requireCurrentTenant() {
        Long tenantId = CURRENT_TENANT.get();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context not set. Ensure user is authenticated.");
        }
        return tenantId;
    }

    /**
     * Set the current tenant (organization) ID for this request.
     * Called by TenantFilter after authentication.
     *
     * @param organizationId The organization ID from the authenticated user
     */
    public static void setCurrentTenant(Long organizationId) {
        if (organizationId != null) {
            log.debug("Setting tenant context to organization: {}", organizationId);
            CURRENT_TENANT.set(organizationId);
        }
    }

    /**
     * Clear the tenant context.
     * MUST be called after request completion to prevent memory leaks.
     */
    public static void clear() {
        log.debug("Clearing tenant context");
        CURRENT_TENANT.remove();
    }

    /**
     * Check if tenant context is set.
     *
     * @return true if tenant context is available
     */
    public static boolean isSet() {
        return CURRENT_TENANT.get() != null;
    }
}
