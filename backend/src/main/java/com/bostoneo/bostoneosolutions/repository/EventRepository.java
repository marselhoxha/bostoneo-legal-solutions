package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.EventType;
import com.bostoneo.bostoneosolutions.model.UserEvent;

import java.util.Collection;

public interface EventRepository {

    /**
     * @deprecated WARNING: Entity UserEvent lacks organization_id - requires migration.
     * Use getEventsByUserIdAndOrganizationId when available for tenant isolation.
     */
    @Deprecated
    Collection<UserEvent> getEventsByUserId(Long userId);

    /**
     * @deprecated WARNING: Entity UserEvent lacks organization_id - requires migration.
     * Use addUserEvent with organizationId parameter when available for tenant isolation.
     */
    @Deprecated
    void addUserEvent(String email, EventType eventType, String device, String ipAddress);

    /**
     * @deprecated WARNING: Entity UserEvent lacks organization_id - requires migration.
     * Use addUserEvent with organizationId parameter when available for tenant isolation.
     */
    @Deprecated
    void addUserEvent(Long userId, EventType eventType, String device, String ipAddress);
}
