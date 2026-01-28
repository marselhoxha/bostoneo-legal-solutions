package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.enumeration.EventType;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.UserEvent;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.EventRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.service.EventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Collections;

@Service
@RequiredArgsConstructor
@Slf4j
public class EventServiceImpl implements EventService {
    private final EventRepository eventRepository;
    private final TenantService tenantService;
    private final UserRepository<User> userRepository;

    /**
     * Helper method to get the current organization ID
     */
    private Long getCurrentOrganizationId() {
        return tenantService.getCurrentOrganizationId().orElse(null);
    }

    /**
     * Verify user belongs to the current organization
     */
    private boolean isUserInCurrentOrganization(Long userId) {
        Long currentOrgId = getCurrentOrganizationId();
        if (currentOrgId == null) {
            return true; // No org context, allow (backward compatibility)
        }
        try {
            User user = userRepository.get(userId);
            return user != null && currentOrgId.equals(user.getOrganizationId());
        } catch (Exception e) {
            log.warn("Could not verify user organization: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public Collection<UserEvent> getEventsByUserId(Long userId) {
        // Verify user belongs to current organization
        if (!isUserInCurrentOrganization(userId)) {
            log.warn("Attempted to access events for user {} outside current organization", userId);
            return Collections.emptyList();
        }
        return eventRepository.getEventsByUserId(userId);
    }

    @Override
    public void addUserEvent(String email, EventType eventType, String device, String ipAddress) {
        eventRepository.addUserEvent(email, eventType, device, ipAddress);
    }

    @Override
    public void addUserEvent(Long userId, EventType eventType, String device, String ipAddress) {
        // Implementation for adding events by userId
    }
}
