package com.bostoneo.bostoneosolutions.scheduler;

import com.bostoneo.bostoneosolutions.enumeration.SignatureStatus;
import com.bostoneo.bostoneosolutions.repository.SignatureRequestRepository;
import com.bostoneo.bostoneosolutions.service.SignatureReminderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Scheduler for processing signature reminders and updating expired requests.
 * Runs periodically to:
 * 1. Send scheduled reminders via Email, SMS, WhatsApp
 * 2. Mark expired signature requests as EXPIRED
 * 3. Retry failed reminders
 * 4. Clean up old reminder records
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SignatureReminderScheduler {

    private final SignatureReminderService signatureReminderService;
    private final SignatureRequestRepository signatureRequestRepository;

    /**
     * Process pending reminders every 15 minutes.
     * Sends scheduled Email, SMS, and WhatsApp reminders.
     */
    @Scheduled(cron = "0 */15 * * * *") // Every 15 minutes
    public void processPendingReminders() {
        log.info("Starting scheduled reminder processing...");
        try {
            signatureReminderService.processPendingReminders();
            log.info("Completed scheduled reminder processing");
        } catch (Exception e) {
            log.error("Error during scheduled reminder processing: {}", e.getMessage(), e);
        }
    }

    /**
     * Check for expired signature requests every hour.
     * Updates status from SENT/VIEWED/PARTIALLY_SIGNED to EXPIRED.
     */
    @Scheduled(cron = "0 0 * * * *") // Every hour at minute 0
    @Transactional
    public void processExpiredRequests() {
        log.info("Checking for expired signature requests...");
        try {
            var expiredRequests = signatureRequestRepository.findExpired(LocalDateTime.now());

            int count = 0;
            for (var request : expiredRequests) {
                request.setStatus(SignatureStatus.EXPIRED);
                signatureRequestRepository.save(request);

                // Cancel any pending reminders
                signatureReminderService.cancelReminders(request.getId());

                count++;
            }

            if (count > 0) {
                log.info("Marked {} signature requests as expired", count);
            }
        } catch (Exception e) {
            log.error("Error processing expired requests: {}", e.getMessage(), e);
        }
    }

    /**
     * Retry failed reminders once a day.
     * Gives failed reminders another chance to be sent.
     */
    @Scheduled(cron = "0 0 6 * * *") // Every day at 6 AM
    public void retryFailedReminders() {
        log.info("Retrying failed reminders...");
        try {
            signatureReminderService.retryFailedReminders();
            log.info("Completed failed reminder retry");
        } catch (Exception e) {
            log.error("Error retrying failed reminders: {}", e.getMessage(), e);
        }
    }

    /**
     * Clean up old reminder records weekly.
     * Removes sent/cancelled reminders older than 30 days.
     */
    @Scheduled(cron = "0 0 3 * * SUN") // Every Sunday at 3 AM
    public void cleanupOldReminders() {
        log.info("Cleaning up old reminder records...");
        try {
            signatureReminderService.cleanupOldReminders(30);
            log.info("Completed reminder cleanup");
        } catch (Exception e) {
            log.error("Error cleaning up reminders: {}", e.getMessage(), e);
        }
    }

    /**
     * Send expiry warnings for requests expiring soon.
     * Runs daily to catch any requests that might not have reminders scheduled.
     */
    @Scheduled(cron = "0 0 9 * * *") // Every day at 9 AM
    public void sendExpiryWarnings() {
        log.info("Checking for signature requests expiring soon...");
        try {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime tomorrow = now.plusDays(1);

            var expiringSoon = signatureRequestRepository.findExpiringSoon(now, tomorrow);

            for (var request : expiringSoon) {
                // Only send if no reminder was sent in the last 12 hours
                if (request.getLastReminderSentAt() == null ||
                        request.getLastReminderSentAt().isBefore(now.minusHours(12))) {
                    try {
                        signatureReminderService.sendImmediateReminder(request.getId(), null);
                        log.info("Sent expiry warning for request {} expiring at {}",
                                request.getId(), request.getExpiresAt());
                    } catch (Exception e) {
                        log.error("Failed to send expiry warning for request {}: {}",
                                request.getId(), e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error sending expiry warnings: {}", e.getMessage(), e);
        }
    }
}
