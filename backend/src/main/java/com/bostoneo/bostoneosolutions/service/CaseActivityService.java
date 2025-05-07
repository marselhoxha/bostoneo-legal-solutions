package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.CaseActivityDTO;
import com.bostoneo.bostoneosolutions.dto.CreateActivityRequest;

import java.util.List;

public interface CaseActivityService {
    
    /**
     * Get all activities for a specific case
     * 
     * @param caseId the ID of the case
     * @return list of case activities
     */
    List<CaseActivityDTO> getActivitiesByCaseId(Long caseId);
    
    /**
     * Create a new activity record
     * 
     * @param request the activity creation request
     * @return the created activity
     */
    CaseActivityDTO createActivity(CreateActivityRequest request);
    
    /**
     * Log a note added activity
     * 
     * @param caseId the ID of the case
     * @param noteId the ID of the note
     * @param noteTitle the title of the note
     * @param userId the ID of the user who added the note
     */
    void logNoteAdded(Long caseId, Long noteId, String noteTitle, Long userId);
    
    /**
     * Log a note updated activity
     * 
     * @param caseId the ID of the case
     * @param noteId the ID of the note
     * @param noteTitle the title of the note
     * @param userId the ID of the user who updated the note
     */
    void logNoteUpdated(Long caseId, Long noteId, String noteTitle, Long userId);
    
    /**
     * Log a note deleted activity
     * 
     * @param caseId the ID of the case
     * @param noteId the ID of the note
     * @param noteTitle the title of the note
     * @param userId the ID of the user who deleted the note
     */
    void logNoteDeleted(Long caseId, Long noteId, String noteTitle, Long userId);
    
    /**
     * Legacy method support
     */
    default void logNoteAdded(Long caseId, Long noteId, String noteTitle) {
        logNoteAdded(caseId, noteId, noteTitle, null);
    }
    
    /**
     * Legacy method support
     */
    default void logNoteUpdated(Long caseId, Long noteId, String noteTitle) {
        logNoteUpdated(caseId, noteId, noteTitle, null);
    }
    
    /**
     * Legacy method support
     */
    default void logNoteDeleted(Long caseId, Long noteId, String noteTitle) {
        logNoteDeleted(caseId, noteId, noteTitle, null);
    }
    
    /**
     * Log a reminder created activity
     * 
     * @param caseId the ID of the case
     * @param reminderId the ID of the reminder
     * @param reminderTitle the title of the reminder
     * @param userId the ID of the user who created the reminder
     */
    void logReminderCreated(Long caseId, Long reminderId, String reminderTitle, Long userId);
    
    /**
     * Log a reminder updated activity
     * 
     * @param caseId the ID of the case
     * @param reminderId the ID of the reminder
     * @param reminderTitle the title of the reminder
     * @param userId the ID of the user who updated the reminder
     */
    void logReminderUpdated(Long caseId, Long reminderId, String reminderTitle, Long userId);
    
    /**
     * Log a reminder completed activity
     * 
     * @param caseId the ID of the case
     * @param reminderId the ID of the reminder
     * @param reminderTitle the title of the reminder
     * @param userId the ID of the user who completed the reminder
     */
    void logReminderCompleted(Long caseId, Long reminderId, String reminderTitle, Long userId);
    
    /**
     * Log a reminder deleted activity
     * 
     * @param caseId the ID of the case
     * @param reminderId the ID of the reminder
     * @param reminderTitle the title of the reminder
     * @param userId the ID of the user who deleted the reminder
     */
    void logReminderDeleted(Long caseId, Long reminderId, String reminderTitle, Long userId);
    
    /**
     * Legacy method support
     */
    default void logReminderCreated(Long caseId, Long reminderId, String reminderTitle) {
        logReminderCreated(caseId, reminderId, reminderTitle, null);
    }
    
    /**
     * Legacy method support
     */
    default void logReminderUpdated(Long caseId, Long reminderId, String reminderTitle) {
        logReminderUpdated(caseId, reminderId, reminderTitle, null);
    }
    
    /**
     * Legacy method support
     */
    default void logReminderCompleted(Long caseId, Long reminderId, String reminderTitle) {
        logReminderCompleted(caseId, reminderId, reminderTitle, null);
    }
    
    /**
     * Legacy method support
     */
    default void logReminderDeleted(Long caseId, Long reminderId, String reminderTitle) {
        logReminderDeleted(caseId, reminderId, reminderTitle, null);
    }
} 