package com.***REMOVED***.***REMOVED***solutions.repository.implementation;

import com.***REMOVED***.***REMOVED***solutions.enumeration.EventType;
import com.***REMOVED***.***REMOVED***solutions.model.UserEvent;
import com.***REMOVED***.***REMOVED***solutions.repository.EventRepository;
import com.***REMOVED***.***REMOVED***solutions.rowmapper.UserEventRowMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Map;

import static com.***REMOVED***.***REMOVED***solutions.query.EventQuery.INSERT_EVENT_BY_USER_EMAIL_QUERY;
import static com.***REMOVED***.***REMOVED***solutions.query.EventQuery.SELECT_EVENTS_BY_USER_ID_QUERY;
import static java.util.Map.of;

@Repository
@RequiredArgsConstructor
@Slf4j
public class EventRepositoryImpl implements EventRepository {
    private final NamedParameterJdbcTemplate jdbc;
    @Override
    public Collection<UserEvent> getEventsByUserId(Long userId) {
        return jdbc.query(SELECT_EVENTS_BY_USER_ID_QUERY, of("id", userId), new UserEventRowMapper());
    }

    @Override
    public void addUserEvent(String email, EventType eventType, String device, String ipAddress) {
        jdbc.update(INSERT_EVENT_BY_USER_EMAIL_QUERY, of("email", email, "type", eventType.name(), "device", device, "ipAddress", ipAddress));
    }

    @Override
    public void addUserEvent(Long userId, EventType eventType, String device, String ipAddress) {

    }
}
