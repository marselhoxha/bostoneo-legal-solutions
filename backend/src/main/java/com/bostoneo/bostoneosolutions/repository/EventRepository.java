package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.EventType;
import com.bostoneo.bostoneosolutions.model.UserEvent;

import java.util.Collection;

public interface EventRepository {

    // ==================== TENANT-FILTERED METHODS ====================
    // SECURITY: Always use these methods for proper multi-tenant isolation.

    /**
     * SECURITY: Get events for a user within their organization
     */
    Collection<UserEvent> getEventsByUserIdAndOrganizationId(Long userId, Long organizationId);

    /**
     * SECURITY: Add user event with organization context (by email)
     */
    void addUserEvent(String email, EventType eventType, String device, String ipAddress, Long organizationId);

    /**
     * SECURITY: Add user event with organization context (by userId)
     */
    void addUserEvent(Long userId, EventType eventType, String device, String ipAddress, Long organizationId);

    // ==================== DEPRECATED METHODS ====================
    // WARNING: These methods bypass multi-tenant isolation.

    /**
     * @deprecated Use getEventsByUserIdAndOrganizationId for tenant isolation
     */
    @Deprecated
    Collection<UserEvent> getEventsByUserId(Long userId);

    /**
     * @deprecated Use addUserEvent with organizationId parameter for tenant isolation
     */
    @Deprecated
    void addUserEvent(String email, EventType eventType, String device, String ipAddress);

    /**
     * @deprecated Use addUserEvent with organizationId parameter for tenant isolation
     */
    @Deprecated
    void addUserEvent(Long userId, EventType eventType, String device, String ipAddress);
}
