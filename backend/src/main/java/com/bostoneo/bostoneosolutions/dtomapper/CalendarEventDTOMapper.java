package com.bostoneo.bostoneosolutions.dtomapper;

import com.bostoneo.bostoneosolutions.dto.CalendarEventDTO;
import com.bostoneo.bostoneosolutions.model.CalendarEvent;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.User;
import org.springframework.beans.BeanUtils;

public class CalendarEventDTOMapper {
    
    public static CalendarEventDTO fromCalendarEvent(CalendarEvent event) {
        if (event == null) {
            return null;
        }
        
        CalendarEventDTO dto = new CalendarEventDTO();
        BeanUtils.copyProperties(event, dto);
        
        // Set case related fields if available
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
        
        // Get user information from the UserService if needed
        // This could be enhanced to fetch user details as needed
        
        return dto;
    }
    
    public static CalendarEvent toCalendarEvent(CalendarEventDTO dto) {
        if (dto == null) {
            return null;
        }
        
        CalendarEvent event = new CalendarEvent();
        BeanUtils.copyProperties(dto, event);
        
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