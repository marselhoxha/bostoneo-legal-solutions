package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.SignatureReminderQueue;
import com.bostoneo.bostoneosolutions.model.SignatureRequest;

import java.util.List;

/**
 * Service for managing signature reminders across multiple channels (Email, SMS, WhatsApp).
 * Integrates with organization's Twilio subaccount for SMS/WhatsApp.
 */
public interface SignatureReminderService {

    /**
     * Schedule reminders for a signature request based on organization preferences.
     * Creates reminder queue entries for each channel and each reminder day.
     *
     * @param signatureRequest The signature request to schedule reminders for
     */
    void scheduleReminders(SignatureRequest signatureRequest);

    /**
     * Cancel all pending reminders for a signature request.
     * Called when signature is completed, declined, or voided.
     *
     * @param signatureRequestId The signature request ID
     */
    void cancelReminders(Long signatureRequestId);

    /**
     * Process all pending reminders that are due to be sent.
     * Called by the scheduler.
     */
    void processPendingReminders();

    /**
     * Send a single reminder.
     *
     * @param reminder The reminder to send
     * @return true if sent successfully
     */
    boolean sendReminder(SignatureReminderQueue reminder);

    /**
     * Send an immediate reminder for a signature request.
     * Used for manual "send reminder" action.
     *
     * @param signatureRequestId The signature request ID
     * @param userId The user triggering the reminder
     */
    void sendImmediateReminder(Long signatureRequestId, Long userId);

    /**
     * Get pending reminders for a signature request.
     *
     * @param signatureRequestId The signature request ID
     * @return List of pending reminders
     */
    List<SignatureReminderQueue> getPendingReminders(Long signatureRequestId);

    /**
     * Retry failed reminders.
     */
    void retryFailedReminders();

    /**
     * Clean up old completed/cancelled reminders.
     *
     * @param daysOld Delete reminders older than this many days
     */
    void cleanupOldReminders(int daysOld);

    /**
     * Get reminder statistics for an organization.
     *
     * @param organizationId The organization ID
     * @return Statistics DTO
     */
    ReminderStatsDTO getStatistics(Long organizationId);

    /**
     * Statistics DTO for reminders
     */
    record ReminderStatsDTO(
            long pendingCount,
            long sentToday,
            long failedToday,
            long emailSent,
            long smsSent,
            long whatsappSent
    ) {}
}
