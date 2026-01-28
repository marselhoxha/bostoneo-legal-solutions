package com.bostoneo.bostoneosolutions.dtomapper;

import com.bostoneo.bostoneosolutions.dto.CalendarEventDTO;
import com.bostoneo.bostoneosolutions.model.CalendarEvent;
import com.bostoneo.bostoneosolutions.model.LegalCase;

/**
 * Mapper for CalendarEvent <-> CalendarEventDTO conversions.
 * SECURITY: Uses explicit field mapping instead of BeanUtils.copyProperties to prevent
 * unintended data exposure from nested entities.
 */
public class CalendarEventDTOMapper {

    public static CalendarEventDTO fromCalendarEvent(CalendarEvent event) {
        if (event == null) {
            return null;
        }

        CalendarEventDTO dto = new CalendarEventDTO();

        // SECURITY: Explicit field mapping - no nested entity data leakage
        dto.setId(event.getId());
        dto.setOrganizationId(event.getOrganizationId());
        dto.setTitle(event.getTitle());
        dto.setDescription(event.getDescription());
        dto.setStartTime(event.getStartTime());
        dto.setEndTime(event.getEndTime());
        dto.setLocation(event.getLocation());
        dto.setEventType(event.getEventType());
        dto.setStatus(event.getStatus());
        dto.setAllDay(event.getAllDay());
        dto.setRecurrenceRule(event.getRecurrenceRule());
        dto.setColor(event.getColor());
        dto.setReminderMinutes(event.getReminderMinutes());
        dto.setReminderSent(event.getReminderSent());
        dto.setExternalId(event.getExternalId());
        dto.setExternalCalendar(event.getExternalCalendar());
        dto.setEmailNotification(event.getEmailNotification());
        dto.setPushNotification(event.getPushNotification());
        dto.setHighPriority(event.getHighPriority());
        dto.setUserId(event.getUserId());
        dto.setCaseId(event.getCaseId());
        dto.setCreatedAt(event.getCreatedAt());
        dto.setUpdatedAt(event.getUpdatedAt());

        // Set case related fields if available (display-only, no entity exposure)
        if (event.getLegalCase() != null) {
            LegalCase legalCase = event.getLegalCase();
            dto.setCaseTitle(legalCase.getTitle());
            dto.setCaseNumber(legalCase.getCaseNumber());
        }

        // Handle the list conversion for additional reminders
        if (event.getAdditionalReminders() != null && !event.getAdditionalReminders().isEmpty()) {
            dto.setAdditionalReminders(event.getAdditionalRemindersList());
        }

        // Handle the list conversion for reminders sent tracking
        if (event.getRemindersSent() != null && !event.getRemindersSent().isEmpty()) {
            dto.setRemindersSent(event.getRemindersSentList());
        }

        return dto;
    }

    public static CalendarEvent toCalendarEvent(CalendarEventDTO dto) {
        if (dto == null) {
            return null;
        }

        CalendarEvent event = new CalendarEvent();

        // SECURITY: Explicit field mapping - controlled data flow
        event.setId(dto.getId());
        event.setOrganizationId(dto.getOrganizationId());
        event.setTitle(dto.getTitle());
        event.setDescription(dto.getDescription());
        event.setStartTime(dto.getStartTime());
        event.setEndTime(dto.getEndTime());
        event.setLocation(dto.getLocation());
        event.setEventType(dto.getEventType());
        event.setStatus(dto.getStatus());
        event.setAllDay(dto.getAllDay());
        event.setRecurrenceRule(dto.getRecurrenceRule());
        event.setColor(dto.getColor());
        event.setReminderMinutes(dto.getReminderMinutes());
        event.setReminderSent(dto.getReminderSent());
        event.setExternalId(dto.getExternalId());
        event.setExternalCalendar(dto.getExternalCalendar());
        event.setEmailNotification(dto.getEmailNotification());
        event.setPushNotification(dto.getPushNotification());
        event.setHighPriority(dto.getHighPriority());
        event.setUserId(dto.getUserId());
        event.setCaseId(dto.getCaseId());
        // Don't copy createdAt/updatedAt - let JPA handle these

        // Handle the list conversion for additional reminders
        if (dto.getAdditionalReminders() != null && !dto.getAdditionalReminders().isEmpty()) {
            event.setAdditionalRemindersList(dto.getAdditionalReminders());
        }

        // Handle the list conversion for reminders sent tracking
        if (dto.getRemindersSent() != null && !dto.getRemindersSent().isEmpty()) {
            event.setRemindersSentList(dto.getRemindersSent());
        }

        // Don't copy case and user directly as they need to be proper entity references
        // Setting their IDs is sufficient as JPA will handle the relationships

        return event;
    }
    
    public static void updateCalendarEventFromDTO(CalendarEventDTO dto, CalendarEvent event) {
        if (dto == null || event == null) {
            return;
        }
        
        // Update direct properties
        if (dto.getTitle() != null) event.setTitle(dto.getTitle());
        if (dto.getDescription() != null) event.setDescription(dto.getDescription());
        if (dto.getStartTime() != null) event.setStartTime(dto.getStartTime());
        if (dto.getEndTime() != null) event.setEndTime(dto.getEndTime());
        if (dto.getLocation() != null) event.setLocation(dto.getLocation());
        if (dto.getEventType() != null) event.setEventType(dto.getEventType());
        if (dto.getStatus() != null) event.setStatus(dto.getStatus());
        if (dto.getAllDay() != null) event.setAllDay(dto.getAllDay());
        if (dto.getRecurrenceRule() != null) event.setRecurrenceRule(dto.getRecurrenceRule());
        if (dto.getColor() != null) event.setColor(dto.getColor());
        if (dto.getReminderMinutes() != null) event.setReminderMinutes(dto.getReminderMinutes());
        if (dto.getReminderSent() != null) event.setReminderSent(dto.getReminderSent());
        if (dto.getExternalId() != null) event.setExternalId(dto.getExternalId());
        if (dto.getExternalCalendar() != null) event.setExternalCalendar(dto.getExternalCalendar());
        
        // Update notification preferences
        if (dto.getEmailNotification() != null) event.setEmailNotification(dto.getEmailNotification());
        if (dto.getPushNotification() != null) event.setPushNotification(dto.getPushNotification());
        
        // Update new fields
        if (dto.getHighPriority() != null) event.setHighPriority(dto.getHighPriority());
        
        // Handle additional reminders list
        if (dto.getAdditionalReminders() != null) {
            event.setAdditionalRemindersList(dto.getAdditionalReminders());
        }
        
        // Handle reminders sent list
        if (dto.getRemindersSent() != null) {
            event.setRemindersSentList(dto.getRemindersSent());
        }
        
        // Don't update IDs or related entities directly here
        // These should be handled explicitly in the service layer
    }
} 