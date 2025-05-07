package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.CaseReminderDTO;
import com.bostoneo.bostoneosolutions.dto.CreateReminderRequest;
import com.bostoneo.bostoneosolutions.dto.UpdateReminderRequest;

import java.util.List;

public interface CaseReminderService {
    
    /**
     * Get all reminders for a specific case
     * 
     * @param caseId the ID of the case
     * @param status optional filter by status
     * @return list of case reminders
     */
    List<CaseReminderDTO> getRemindersByCaseId(Long caseId, String status);
    
    /**
     * Get a specific reminder by ID
     * 
     * @param caseId the ID of the case
     * @param reminderId the ID of the reminder
     * @return the case reminder
     */
    CaseReminderDTO getReminderById(Long caseId, Long reminderId);
    
    /**
     * Create a new reminder for a case
     * 
     * @param request the reminder creation request
     * @return the created case reminder
     */
    CaseReminderDTO createReminder(CreateReminderRequest request);
    
    /**
     * Update an existing reminder
     * 
     * @param caseId the ID of the case
     * @param reminderId the ID of the reminder
     * @param request the reminder update request
     * @return the updated case reminder
     */
    CaseReminderDTO updateReminder(Long caseId, Long reminderId, UpdateReminderRequest request);
    
    /**
     * Mark a reminder as completed
     * 
     * @param caseId the ID of the case
     * @param reminderId the ID of the reminder
     * @return the updated case reminder
     */
    CaseReminderDTO completeReminder(Long caseId, Long reminderId);
    
    /**
     * Delete a reminder
     * 
     * @param caseId the ID of the case
     * @param reminderId the ID of the reminder
     */
    void deleteReminder(Long caseId, Long reminderId);
    
    /**
     * Get all upcoming reminders for the current user
     * 
     * @return list of upcoming reminders
     */
    List<CaseReminderDTO> getUpcomingRemindersForCurrentUser();
} 