package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.model.CalendarEvent;
import com.***REMOVED***.***REMOVED***solutions.model.ReminderQueueItem;

import java.util.List;

public interface ReminderQueueService {
    
    /**
     * Enqueue a reminder for a calendar event
     */
    ReminderQueueItem enqueueReminder(CalendarEvent event, Integer minutesBefore, String reminderType);
    
    /**
     * Process pending reminders that are ready to be sent
     */
    void processReminderQueue();
    
    /**
     * Get all pending reminders
     */
    List<ReminderQueueItem> getPendingReminders();
    
    /**
     * Mark a reminder as sent
     */
    void markReminderAsSent(Long reminderId);
    
    /**
     * Mark a reminder as failed
     */
    void markReminderAsFailed(Long reminderId, String errorMessage);
    
    /**
     * Delete reminders for an event
     */
    void deleteRemindersForEvent(Long eventId);
} 