package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.EventType;
import com.bostoneo.bostoneosolutions.model.UserEvent;

import java.util.Collection;

public interface EventRepository {
    Collection<UserEvent> getEventsByUserId(Long userId);
    void addUserEvent(String email, EventType eventType, String device, String ipAddress);
    void addUserEvent(Long userId, EventType eventType, String device, String ipAddress);
}
