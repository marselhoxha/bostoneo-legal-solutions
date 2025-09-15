package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.ActiveTimerDTO;
import com.bostoneo.bostoneosolutions.dto.StartTimerRequest;
import com.bostoneo.bostoneosolutions.dto.TimeEntryDTO;

import java.util.List;

public interface TimerService {
    
    // Timer Operations
    ActiveTimerDTO startTimer(Long userId, StartTimerRequest request);
    
    ActiveTimerDTO pauseTimer(Long userId, Long timerId);
    
    ActiveTimerDTO resumeTimer(Long userId, Long timerId);
    
    void stopTimer(Long userId, Long timerId);
    
    void stopAllTimers(Long userId);
    
    // Timer Retrieval
    List<ActiveTimerDTO> getActiveTimers(Long userId);
    
    List<ActiveTimerDTO> getAllActiveTimers();
    
    ActiveTimerDTO getActiveTimer(Long timerId);
    
    ActiveTimerDTO getActiveTimerForCase(Long userId, Long legalCaseId);
    
    // Timer Status
    boolean hasActiveTimer(Long userId);
    
    boolean hasActiveTimerForCase(Long userId, Long legalCaseId);
    
    // Timer to Time Entry Conversion
    TimeEntryDTO convertTimerToTimeEntry(Long userId, Long timerId, String description);
    
    List<TimeEntryDTO> convertMultipleTimersToTimeEntries(Long userId, List<Long> timerIds);
    
    // Timer Management
    void updateTimerDescription(Long userId, Long timerId, String description);
    
    void deleteTimer(Long timerId);
    
    // Analytics
    Long getTotalActiveTimersCount();
    
    List<ActiveTimerDTO> getLongRunningTimers(Integer hoursThreshold);
} 
 
 