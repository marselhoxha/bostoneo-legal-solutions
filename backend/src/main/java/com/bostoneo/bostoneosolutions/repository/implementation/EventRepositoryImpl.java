package com.bostoneo.bostoneosolutions.repository.implementation;

import com.bostoneo.bostoneosolutions.enumeration.EventType;
import com.bostoneo.bostoneosolutions.model.UserEvent;
import com.bostoneo.bostoneosolutions.repository.EventRepository;
import com.bostoneo.bostoneosolutions.rowmapper.UserEventRowMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Map;

import static com.bostoneo.bostoneosolutions.query.EventQuery.*;
import static java.util.Map.of;

@Repository
@RequiredArgsConstructor
@Slf4j
public class EventRepositoryImpl implements EventRepository {
    private final NamedParameterJdbcTemplate jdbc;

    // ==================== TENANT-FILTERED METHODS ====================

    @Override
    public Collection<UserEvent> getEventsByUserIdAndOrganizationId(Long userId, Long organizationId) {
        log.debug("SECURITY: Fetching events for user {} in organization {}", userId, organizationId);
        return jdbc.query(SELECT_EVENTS_BY_USER_ID_AND_ORG_QUERY,
                of("id", userId, "organizationId", organizationId),
                new UserEventRowMapper());
    }

    @Override
    public void addUserEvent(String email, EventType eventType, String device, String ipAddress, Long organizationId) {
        log.debug("SECURITY: Adding event for email {} in organization {}", email, organizationId);
        jdbc.update(INSERT_EVENT_BY_USER_EMAIL_WITH_ORG_QUERY,
                of("email", email, "type", eventType.name(), "device", device, "ipAddress", ipAddress, "organizationId", organizationId));
    }

    @Override
    public void addUserEvent(Long userId, EventType eventType, String device, String ipAddress, Long organizationId) {
        log.debug("SECURITY: Adding event for userId {} in organization {}", userId, organizationId);
        jdbc.update(INSERT_EVENT_BY_USER_ID_WITH_ORG_QUERY,
                of("userId", userId, "type", eventType.name(), "device", device, "ipAddress", ipAddress, "organizationId", organizationId));
    }

    // ==================== DEPRECATED METHODS ====================

    @Override
    @Deprecated
    public Collection<UserEvent> getEventsByUserId(Long userId) {
        log.warn("SECURITY: Using deprecated getEventsByUserId without organization filter");
        return jdbc.query(SELECT_EVENTS_BY_USER_ID_QUERY, of("id", userId), new UserEventRowMapper());
    }

    @Override
    @Deprecated
    public void addUserEvent(String email, EventType eventType, String device, String ipAddress) {
        log.warn("SECURITY: Using deprecated addUserEvent without organization filter");
        jdbc.update(INSERT_EVENT_BY_USER_EMAIL_QUERY, of("email", email, "type", eventType.name(), "device", device, "ipAddress", ipAddress));
    }

    @Override
    @Deprecated
    public void addUserEvent(Long userId, EventType eventType, String device, String ipAddress) {
        log.warn("SECURITY: Using deprecated addUserEvent without organization filter - operation skipped");
        // Empty implementation - deprecated and unsafe
    }
}
