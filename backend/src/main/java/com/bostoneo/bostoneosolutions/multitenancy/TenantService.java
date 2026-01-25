package com.bostoneo.bostoneosolutions.multitenancy;

import com.bostoneo.bostoneosolutions.model.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Service for accessing tenant (organization) context and current user.
 *
 * Provides convenient methods to get the current organization ID
 * and authenticated user throughout the application.
 */
@Service
@Slf4j
public class TenantService {

    /**
     * Get the current organization ID from tenant context.
     *
     * @return Optional containing the organization ID, or empty if not set
     */
    public Optional<Long> getCurrentOrganizationId() {
        return Optional.ofNullable(TenantContext.getCurrentTenant());
    }

    /**
     * Get the current organization ID, throwing if not available.
     *
     * @return The organization ID
     * @throws IllegalStateException if tenant context is not set
     */
    public Long requireCurrentOrganizationId() {
        return TenantContext.requireCurrentTenant();
    }

    /**
     * Get the currently authenticated user.
     *
     * @return Optional containing the User, or empty if not authenticated
     */
    public Optional<User> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return Optional.empty();
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof User user) {
            return Optional.of(user);
        }

        return Optional.empty();
    }

    /**
     * Get the currently authenticated user, throwing if not available.
     *
     * @return The authenticated User
     * @throws IllegalStateException if user is not authenticated
     */
    public User requireCurrentUser() {
        return getCurrentUser()
                .orElseThrow(() -> new IllegalStateException("User not authenticated"));
    }

    /**
     * Get the current user's ID.
     *
     * @return Optional containing the user ID, or empty if not authenticated
     */
    public Optional<Long> getCurrentUserId() {
        return getCurrentUser().map(User::getId);
    }

    /**
     * Check if the current user belongs to the specified organization.
     *
     * @param organizationId The organization ID to check
     * @return true if the current user belongs to the organization
     */
    public boolean belongsToOrganization(Long organizationId) {
        return getCurrentOrganizationId()
                .map(orgId -> orgId.equals(organizationId))
                .orElse(false);
    }

    /**
     * Verify that an entity belongs to the current tenant.
     * Use this to prevent cross-tenant data access.
     *
     * @param entityOrganizationId The organization ID of the entity
     * @throws SecurityException if the entity belongs to a different organization
     */
    public void verifyTenantAccess(Long entityOrganizationId) {
        Long currentOrgId = TenantContext.getCurrentTenant();
        if (currentOrgId != null && entityOrganizationId != null
                && !currentOrgId.equals(entityOrganizationId)) {
            log.warn("Cross-tenant access attempt: user org={}, entity org={}",
                    currentOrgId, entityOrganizationId);
            throw new SecurityException("Access denied: resource belongs to different organization");
        }
    }
}
