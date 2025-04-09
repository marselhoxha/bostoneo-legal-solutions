package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.enumeration.EventType;
import com.bostoneo.bostoneosolutions.model.UserEvent;

import java.util.Collection;

public interface EventService {
    Collection<UserEvent> getEventsByUserId(Long userId);
    void addUserEvent(String email, EventType eventType, String device, String ipAddress);
    void addUserEvent(Long userId, EventType eventType, String device, String ipAddress);
}
