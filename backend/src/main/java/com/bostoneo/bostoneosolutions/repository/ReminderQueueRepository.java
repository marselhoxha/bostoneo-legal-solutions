package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.ReminderQueueItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReminderQueueRepository extends JpaRepository<ReminderQueueItem, Long> {
    
    List<ReminderQueueItem> findByEventId(Long eventId);
    
    List<ReminderQueueItem> findByStatus(String status);
    
    @Query("SELECT r FROM ReminderQueueItem r WHERE r.status = 'PENDING' AND r.scheduledTime <= ?1")
    List<ReminderQueueItem> findPendingRemindersReadyToSend(LocalDateTime now);
    
    List<ReminderQueueItem> findByStatusAndLastAttemptBefore(String status, LocalDateTime time);
    
    @Query("SELECT r FROM ReminderQueueItem r WHERE r.eventId = ?1 AND r.minutesBefore = ?2 AND r.reminderType = ?3")
    List<ReminderQueueItem> findByEventAndMinutesAndType(Long eventId, Integer minutesBefore, String reminderType);
} 