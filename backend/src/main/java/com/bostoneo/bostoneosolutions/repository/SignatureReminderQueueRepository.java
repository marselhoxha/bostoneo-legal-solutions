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

    /**
     * Find pending reminders due to be sent.
     * NOTE: Used by background scheduler - processes all orgs intentionally.
     * Each reminder has org context for proper tenant isolation in processing.
     */
    @Query("SELECT r FROM SignatureReminderQueue r WHERE r.status = 'PENDING' " +
            "AND r.scheduledAt <= :now ORDER BY r.scheduledAt ASC")
    List<SignatureReminderQueue> findPendingReminders(@Param("now") LocalDateTime now);

    // Find pending reminders for a specific organization
    @Query("SELECT r FROM SignatureReminderQueue r WHERE r.organizationId = :orgId " +
            "AND r.status = 'PENDING' AND r.scheduledAt <= :now ORDER BY r.scheduledAt ASC")
    List<SignatureReminderQueue> findPendingRemindersByOrganization(@Param("orgId") Long organizationId,
                                                                      @Param("now") LocalDateTime now);

    /**
     * @deprecated Use findByOrganizationIdAndSignatureRequestIdOrderByScheduledAtAsc instead for tenant isolation
     */
    @Deprecated
    List<SignatureReminderQueue> findBySignatureRequestIdOrderByScheduledAtAsc(Long signatureRequestId);

    /**
     * @deprecated Use findByOrganizationIdAndSignatureRequestIdAndStatus instead for tenant isolation
     */
    @Deprecated
    List<SignatureReminderQueue> findBySignatureRequestIdAndStatus(Long signatureRequestId, ReminderStatus status);

    // TENANT-FILTERED: Find all reminders for a signature request
    @Query("SELECT r FROM SignatureReminderQueue r WHERE r.organizationId = :orgId AND r.signatureRequestId = :requestId ORDER BY r.scheduledAt ASC")
    List<SignatureReminderQueue> findByOrganizationIdAndSignatureRequestIdOrderByScheduledAtAsc(
            @Param("orgId") Long organizationId, @Param("requestId") Long signatureRequestId);

    // TENANT-FILTERED: Find pending reminders for a signature request
    @Query("SELECT r FROM SignatureReminderQueue r WHERE r.organizationId = :orgId AND r.signatureRequestId = :requestId AND r.status = :status")
    List<SignatureReminderQueue> findByOrganizationIdAndSignatureRequestIdAndStatus(
            @Param("orgId") Long organizationId, @Param("requestId") Long signatureRequestId, @Param("status") ReminderStatus status);

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

    /**
     * Find failed reminders for retry.
     * NOTE: Used by background scheduler - processes all orgs intentionally.
     * Each reminder has org context for proper tenant isolation in processing.
     */
    @Query("SELECT r FROM SignatureReminderQueue r WHERE r.status = 'FAILED' " +
            "AND r.scheduledAt >= :since ORDER BY r.scheduledAt ASC")
    List<SignatureReminderQueue> findFailedReminders(@Param("since") LocalDateTime since);

    // Find failed reminders for a specific organization
    @Query("SELECT r FROM SignatureReminderQueue r WHERE r.organizationId = :orgId AND r.status = 'FAILED' " +
            "AND r.scheduledAt >= :since ORDER BY r.scheduledAt ASC")
    List<SignatureReminderQueue> findFailedRemindersByOrganization(@Param("orgId") Long organizationId,
                                                                     @Param("since") LocalDateTime since);

    // Delete old completed/cancelled reminders
    @Modifying
    @Query("DELETE FROM SignatureReminderQueue r WHERE r.status IN ('SENT', 'CANCELLED') " +
            "AND r.scheduledAt < :before")
    int deleteOldReminders(@Param("before") LocalDateTime before);

    /**
     * SECURITY: Find by ID with tenant isolation
     */
    java.util.Optional<SignatureReminderQueue> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Check existence with tenant isolation
     */
    boolean existsByIdAndOrganizationId(Long id, Long organizationId);
}
