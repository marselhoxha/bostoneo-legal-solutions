package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.SignatureReminderQueue;
import com.bostoneo.bostoneosolutions.model.SignatureReminderQueue.Channel;
import com.bostoneo.bostoneosolutions.model.SignatureReminderQueue.ReminderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SignatureReminderQueueRepository extends JpaRepository<SignatureReminderQueue, Long> {

    // Find pending reminders due to be sent
    @Query("SELECT r FROM SignatureReminderQueue r WHERE r.status = 'PENDING' " +
            "AND r.scheduledAt <= :now ORDER BY r.scheduledAt ASC")
    List<SignatureReminderQueue> findPendingReminders(@Param("now") LocalDateTime now);

    // Find pending reminders for a specific organization
    @Query("SELECT r FROM SignatureReminderQueue r WHERE r.organizationId = :orgId " +
            "AND r.status = 'PENDING' AND r.scheduledAt <= :now ORDER BY r.scheduledAt ASC")
    List<SignatureReminderQueue> findPendingRemindersByOrganization(@Param("orgId") Long organizationId,
                                                                      @Param("now") LocalDateTime now);

    // Find all reminders for a signature request
    List<SignatureReminderQueue> findBySignatureRequestIdOrderByScheduledAtAsc(Long signatureRequestId);

    // Find pending reminders for a signature request
    List<SignatureReminderQueue> findBySignatureRequestIdAndStatus(Long signatureRequestId, ReminderStatus status);

    // Cancel all pending reminders for a signature request
    @Modifying
    @Query("UPDATE SignatureReminderQueue r SET r.status = 'CANCELLED' " +
            "WHERE r.signatureRequestId = :requestId AND r.status = 'PENDING'")
    int cancelPendingReminders(@Param("requestId") Long signatureRequestId);

    // Check if reminder already scheduled
    boolean existsBySignatureRequestIdAndChannelAndScheduledAtAndStatus(
            Long signatureRequestId, Channel channel, LocalDateTime scheduledAt, ReminderStatus status);

    // Count pending reminders
    long countByOrganizationIdAndStatus(Long organizationId, ReminderStatus status);

    // Find failed reminders for retry
    @Query("SELECT r FROM SignatureReminderQueue r WHERE r.status = 'FAILED' " +
            "AND r.scheduledAt >= :since ORDER BY r.scheduledAt ASC")
    List<SignatureReminderQueue> findFailedReminders(@Param("since") LocalDateTime since);

    // Delete old completed/cancelled reminders
    @Modifying
    @Query("DELETE FROM SignatureReminderQueue r WHERE r.status IN ('SENT', 'CANCELLED') " +
            "AND r.scheduledAt < :before")
    int deleteOldReminders(@Param("before") LocalDateTime before);
}
