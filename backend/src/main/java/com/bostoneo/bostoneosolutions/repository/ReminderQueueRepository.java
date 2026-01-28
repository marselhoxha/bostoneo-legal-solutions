package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.ReminderQueueItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReminderQueueRepository extends JpaRepository<ReminderQueueItem, Long> {

    /**
     * @deprecated Use findByOrganizationIdAndEventId instead for tenant isolation
     */
    @Deprecated
    List<ReminderQueueItem> findByEventId(Long eventId);

    /**
     * @deprecated Use findByOrganizationIdAndStatus instead for tenant isolation
     */
    @Deprecated
    List<ReminderQueueItem> findByStatus(String status);

    /**
     * Find pending reminders ready to send.
     * NOTE: Used by background scheduler - processes all orgs intentionally.
     */
    @Query("SELECT r FROM ReminderQueueItem r WHERE r.status = 'PENDING' AND r.scheduledTime <= ?1")
    List<ReminderQueueItem> findPendingRemindersReadyToSend(LocalDateTime now);

    /**
     * @deprecated Use findByOrganizationIdAndStatusAndLastAttemptBefore instead for tenant isolation
     */
    @Deprecated
    List<ReminderQueueItem> findByStatusAndLastAttemptBefore(String status, LocalDateTime time);

    /**
     * @deprecated Use findByOrganizationIdAndEventAndMinutesAndType instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT r FROM ReminderQueueItem r WHERE r.eventId = ?1 AND r.minutesBefore = ?2 AND r.reminderType = ?3")
    List<ReminderQueueItem> findByEventAndMinutesAndType(Long eventId, Integer minutesBefore, String reminderType);

    // ==================== TENANT-FILTERED METHODS ====================

    /**
     * Find reminder by ID and organization (SECURITY: tenant isolation)
     */
    Optional<ReminderQueueItem> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Find all reminders for an organization (SECURITY: tenant isolation)
     */
    List<ReminderQueueItem> findByOrganizationIdOrderByScheduledTimeAsc(Long organizationId);

    /**
     * Find reminders by event within an organization (SECURITY: tenant isolation)
     */
    List<ReminderQueueItem> findByOrganizationIdAndEventId(Long organizationId, Long eventId);

    /**
     * Find pending reminders for an organization (SECURITY: tenant isolation)
     */
    @Query("SELECT r FROM ReminderQueueItem r WHERE r.organizationId = ?1 AND r.status = 'PENDING' ORDER BY r.scheduledTime ASC")
    List<ReminderQueueItem> findPendingByOrganizationId(Long organizationId);

    /**
     * Delete reminder by ID and organization (SECURITY: tenant isolation)
     */
    void deleteByIdAndOrganizationId(Long id, Long organizationId);
} 