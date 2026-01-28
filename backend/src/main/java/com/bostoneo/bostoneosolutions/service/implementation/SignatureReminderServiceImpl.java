package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.model.SignatureAuditLog;
import com.bostoneo.bostoneosolutions.model.SignatureReminderQueue;
import com.bostoneo.bostoneosolutions.model.SignatureReminderQueue.Channel;
import com.bostoneo.bostoneosolutions.model.SignatureReminderQueue.ReminderStatus;
import com.bostoneo.bostoneosolutions.model.SignatureRequest;
import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import com.bostoneo.bostoneosolutions.repository.SignatureAuditLogRepository;
import com.bostoneo.bostoneosolutions.repository.SignatureReminderQueueRepository;
import com.bostoneo.bostoneosolutions.repository.SignatureRequestRepository;
import com.bostoneo.bostoneosolutions.service.EmailService;
import com.bostoneo.bostoneosolutions.service.OrganizationTwilioService;
import com.bostoneo.bostoneosolutions.service.SignatureReminderService;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class SignatureReminderServiceImpl implements SignatureReminderService {

    private final SignatureReminderQueueRepository reminderQueueRepository;
    private final SignatureRequestRepository signatureRequestRepository;
    private final SignatureAuditLogRepository signatureAuditLogRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationTwilioService organizationTwilioService;
    private final EmailService emailService;
    private final TenantService tenantService;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMMM d, yyyy");

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public void scheduleReminders(SignatureRequest signatureRequest) {
        log.info("Scheduling reminders for signature request {}", signatureRequest.getId());

        Organization org = organizationRepository.findById(signatureRequest.getOrganizationId())
                .orElseThrow(() -> new ApiException("Organization not found"));

        // Get reminder days from organization settings
        int[] reminderDays = org.getReminderDaysArray();

        if (signatureRequest.getExpiresAt() == null) {
            log.warn("Signature request {} has no expiry date, skipping reminders", signatureRequest.getId());
            return;
        }

        LocalDateTime expiresAt = signatureRequest.getExpiresAt();

        for (int daysBeforeExpiry : reminderDays) {
            LocalDateTime scheduledAt = expiresAt.minusDays(daysBeforeExpiry);

            // Don't schedule reminders in the past
            if (scheduledAt.isBefore(LocalDateTime.now())) {
                continue;
            }

            // Schedule for each enabled channel
            if (Boolean.TRUE.equals(signatureRequest.getReminderEmail()) &&
                    Boolean.TRUE.equals(org.getSignatureReminderEmail())) {
                scheduleReminderIfNotExists(signatureRequest, Channel.EMAIL, scheduledAt);
            }

            if (Boolean.TRUE.equals(signatureRequest.getReminderSms()) &&
                    Boolean.TRUE.equals(org.getSignatureReminderSms()) &&
                    signatureRequest.getSignerPhone() != null &&
                    org.isTwilioConfigured()) {
                scheduleReminderIfNotExists(signatureRequest, Channel.SMS, scheduledAt);
            }

            if (Boolean.TRUE.equals(signatureRequest.getReminderWhatsapp()) &&
                    Boolean.TRUE.equals(org.getSignatureReminderWhatsapp()) &&
                    signatureRequest.getSignerPhone() != null &&
                    org.canSendWhatsapp()) {
                scheduleReminderIfNotExists(signatureRequest, Channel.WHATSAPP, scheduledAt);
            }
        }

        log.info("Reminders scheduled for signature request {}", signatureRequest.getId());
    }

    private void scheduleReminderIfNotExists(SignatureRequest request, Channel channel, LocalDateTime scheduledAt) {
        boolean exists = reminderQueueRepository.existsBySignatureRequestIdAndChannelAndScheduledAtAndStatus(
                request.getId(), channel, scheduledAt, ReminderStatus.PENDING);

        if (!exists) {
            SignatureReminderQueue reminder = SignatureReminderQueue.builder()
                    .organizationId(request.getOrganizationId())
                    .signatureRequestId(request.getId())
                    .channel(channel)
                    .scheduledAt(scheduledAt)
                    .status(ReminderStatus.PENDING)
                    .build();

            reminderQueueRepository.save(reminder);
            log.debug("Scheduled {} reminder for request {} at {}", channel, request.getId(), scheduledAt);
        }
    }

    @Override
    public void cancelReminders(Long signatureRequestId) {
        int cancelled = reminderQueueRepository.cancelPendingReminders(signatureRequestId);
        log.info("Cancelled {} pending reminders for signature request {}", cancelled, signatureRequestId);
    }

    @Override
    public void processPendingReminders() {
        log.debug("Processing pending reminders...");

        List<SignatureReminderQueue> pendingReminders = reminderQueueRepository.findPendingReminders(LocalDateTime.now());

        log.info("Found {} pending reminders to process", pendingReminders.size());

        for (SignatureReminderQueue reminder : pendingReminders) {
            try {
                boolean sent = sendReminder(reminder);
                if (sent) {
                    reminder.setStatus(ReminderStatus.SENT);
                    reminder.setSentAt(LocalDateTime.now());
                } else {
                    reminder.setStatus(ReminderStatus.FAILED);
                    reminder.setErrorMessage("Failed to send reminder");
                }
            } catch (Exception e) {
                log.error("Error processing reminder {}: {}", reminder.getId(), e.getMessage());
                reminder.setStatus(ReminderStatus.FAILED);
                reminder.setErrorMessage(e.getMessage());
            }
            reminderQueueRepository.save(reminder);
        }
    }

    @Override
    public boolean sendReminder(SignatureReminderQueue reminder) {
        // SECURITY: Use org-filtered query to ensure request belongs to same org as reminder
        SignatureRequest request = signatureRequestRepository.findByIdAndOrganizationId(
                reminder.getSignatureRequestId(), reminder.getOrganizationId())
                .orElse(null);

        if (request == null) {
            log.warn("Signature request {} not found for reminder {} (org: {})",
                    reminder.getSignatureRequestId(), reminder.getId(), reminder.getOrganizationId());
            return false;
        }

        // Check if request is still pending
        if (!request.isPending()) {
            log.info("Signature request {} is no longer pending, skipping reminder", request.getId());
            reminder.setStatus(ReminderStatus.CANCELLED);
            return false;
        }

        Organization org = organizationRepository.findById(reminder.getOrganizationId())
                .orElse(null);

        if (org == null) {
            log.warn("Organization {} not found for reminder {}", reminder.getOrganizationId(), reminder.getId());
            return false;
        }

        boolean sent = false;

        switch (reminder.getChannel()) {
            case EMAIL -> sent = sendEmailReminder(request, org);
            case SMS -> sent = sendSmsReminder(request, org);
            case WHATSAPP -> sent = sendWhatsAppReminder(request, org);
        }

        if (sent) {
            // Update request reminder tracking
            request.setLastReminderSentAt(LocalDateTime.now());
            request.setReminderCount(request.getReminderCount() + 1);
            signatureRequestRepository.save(request);

            // Log audit event
            logReminderEvent(request, reminder.getChannel());
        }

        return sent;
    }

    private boolean sendEmailReminder(SignatureRequest request, Organization org) {
        try {
            String subject = "Reminder: Document awaiting your signature - " + request.getTitle();

            Map<String, String> templateData = buildTemplateData(request, org);
            String body = buildEmailBody(request, org, templateData);

            boolean sent = emailService.sendEmail(request.getSignerEmail(), subject, body);
            log.info("Email reminder sent for signature request {}: {}", request.getId(), sent);
            return sent;
        } catch (Exception e) {
            log.error("Failed to send email reminder for request {}: {}", request.getId(), e.getMessage());
            return false;
        }
    }

    private boolean sendSmsReminder(SignatureRequest request, Organization org) {
        if (request.getSignerPhone() == null || request.getSignerPhone().isEmpty()) {
            log.warn("No phone number for signer in request {}", request.getId());
            return false;
        }

        if (!org.isTwilioConfigured()) {
            log.warn("Twilio not configured for organization {}", org.getId());
            return false;
        }

        try {
            Map<String, String> params = buildTemplateData(request, org);
            String message = buildSmsMessage(request, org, params);

            var response = organizationTwilioService.sendSms(org, request.getSignerPhone(), message);

            boolean sent = response != null && "SENT".equalsIgnoreCase(response.getStatus());
            log.info("SMS reminder sent for signature request {}: {}", request.getId(), sent);
            return sent;
        } catch (Exception e) {
            log.error("Failed to send SMS reminder for request {}: {}", request.getId(), e.getMessage());
            return false;
        }
    }

    private boolean sendWhatsAppReminder(SignatureRequest request, Organization org) {
        if (request.getSignerPhone() == null || request.getSignerPhone().isEmpty()) {
            log.warn("No phone number for signer in request {}", request.getId());
            return false;
        }

        if (!org.canSendWhatsapp()) {
            log.warn("WhatsApp not configured for organization {}", org.getId());
            return false;
        }

        try {
            Map<String, String> params = buildTemplateData(request, org);
            String message = buildWhatsAppMessage(request, org, params);

            var response = organizationTwilioService.sendWhatsApp(org.getId(), request.getSignerPhone(), message);

            boolean sent = response != null && "SENT".equalsIgnoreCase(response.getStatus());
            log.info("WhatsApp reminder sent for signature request {}: {}", request.getId(), sent);
            return sent;
        } catch (Exception e) {
            log.error("Failed to send WhatsApp reminder for request {}: {}", request.getId(), e.getMessage());
            return false;
        }
    }

    @Override
    public void sendImmediateReminder(Long signatureRequestId, Long userId) {
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        SignatureRequest request = signatureRequestRepository.findByIdAndOrganizationId(signatureRequestId, orgId)
                .orElseThrow(() -> new ApiException("Signature request not found or access denied"));

        if (!request.isPending()) {
            throw new ApiException("Cannot send reminder for non-pending request");
        }

        Organization org = organizationRepository.findById(request.getOrganizationId())
                .orElseThrow(() -> new ApiException("Organization not found"));

        boolean emailSent = false;
        boolean smsSent = false;
        boolean whatsappSent = false;

        // Send via all enabled channels
        if (Boolean.TRUE.equals(request.getReminderEmail())) {
            emailSent = sendEmailReminder(request, org);
        }

        if (Boolean.TRUE.equals(request.getReminderSms()) && request.getSignerPhone() != null) {
            smsSent = sendSmsReminder(request, org);
        }

        if (Boolean.TRUE.equals(request.getReminderWhatsapp()) && request.getSignerPhone() != null) {
            whatsappSent = sendWhatsAppReminder(request, org);
        }

        // Update request
        request.setLastReminderSentAt(LocalDateTime.now());
        request.setReminderCount(request.getReminderCount() + 1);
        signatureRequestRepository.save(request);

        // Log audit event
        String eventData = String.format("{\"email\":%b,\"sms\":%b,\"whatsapp\":%b,\"userId\":%d}",
                emailSent, smsSent, whatsappSent, userId);

        SignatureAuditLog auditLog = SignatureAuditLog.builder()
                .organizationId(request.getOrganizationId())
                .signatureRequestId(request.getId())
                .eventType(SignatureAuditLog.EVENT_REMINDER_SENT)
                .eventData(eventData)
                .actorType(SignatureAuditLog.ActorType.USER)
                .actorId(userId)
                .channel(SignatureAuditLog.Channel.WEB)
                .build();

        signatureAuditLogRepository.save(auditLog);

        log.info("Immediate reminder sent for request {} - Email: {}, SMS: {}, WhatsApp: {}",
                signatureRequestId, emailSent, smsSent, whatsappSent);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SignatureReminderQueue> getPendingReminders(Long signatureRequestId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return reminderQueueRepository.findByOrganizationIdAndSignatureRequestIdAndStatus(orgId, signatureRequestId, ReminderStatus.PENDING);
    }

    @Override
    public void retryFailedReminders() {
        LocalDateTime since = LocalDateTime.now().minusHours(24);
        List<SignatureReminderQueue> failedReminders = reminderQueueRepository.findFailedReminders(since);

        log.info("Retrying {} failed reminders", failedReminders.size());

        for (SignatureReminderQueue reminder : failedReminders) {
            reminder.setStatus(ReminderStatus.PENDING);
            reminder.setErrorMessage(null);
            reminderQueueRepository.save(reminder);
        }
    }

    @Override
    public void cleanupOldReminders(int daysOld) {
        LocalDateTime before = LocalDateTime.now().minusDays(daysOld);
        int deleted = reminderQueueRepository.deleteOldReminders(before);
        log.info("Deleted {} old reminders older than {} days", deleted, daysOld);
    }

    @Override
    @Transactional(readOnly = true)
    public ReminderStatsDTO getStatistics(Long organizationId) {
        long pending = reminderQueueRepository.countByOrganizationIdAndStatus(organizationId, ReminderStatus.PENDING);

        // TODO: Implement more detailed statistics
        return new ReminderStatsDTO(pending, 0, 0, 0, 0, 0);
    }

    // ==================== Private Helper Methods ====================

    private Map<String, String> buildTemplateData(SignatureRequest request, Organization org) {
        Map<String, String> data = new HashMap<>();
        data.put("signer_name", request.getSignerName());
        data.put("org_name", org.getName());
        data.put("doc_title", request.getTitle());
        data.put("expiry_date", request.getExpiresAt() != null ?
                request.getExpiresAt().format(DATE_FORMATTER) : "N/A");

        // Calculate days remaining
        if (request.getExpiresAt() != null) {
            long daysRemaining = ChronoUnit.DAYS.between(LocalDateTime.now(), request.getExpiresAt());
            data.put("days_remaining", String.valueOf(Math.max(0, daysRemaining)));
        }

        return data;
    }

    private String buildEmailBody(SignatureRequest request, Organization org, Map<String, String> data) {
        long daysRemaining = 0;
        if (request.getExpiresAt() != null) {
            daysRemaining = ChronoUnit.DAYS.between(LocalDateTime.now(), request.getExpiresAt());
        }

        String urgency = daysRemaining <= 1 ? "URGENT: " : "";

        return String.format("""
                <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>%sDocument Awaiting Your Signature</h2>
                <p>Hello %s,</p>
                <p>This is a reminder that you have a document from <strong>%s</strong> pending your signature:</p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Document:</strong> %s</p>
                    <p><strong>Expires:</strong> %s</p>
                    %s
                </div>
                <p>Please sign this document as soon as possible to avoid any delays.</p>
                <p>If you have already signed this document, please disregard this reminder.</p>
                <br>
                <p>Best regards,<br>%s</p>
                </body>
                </html>
                """,
                urgency,
                data.get("signer_name"),
                data.get("org_name"),
                data.get("doc_title"),
                data.get("expiry_date"),
                daysRemaining <= 3 ? "<p style=\"color: red;\"><strong>Only " + daysRemaining + " day(s) remaining!</strong></p>" : "",
                data.get("org_name")
        );
    }

    private String buildSmsMessage(SignatureRequest request, Organization org, Map<String, String> data) {
        // Check for custom template
        String template = org.getSmsTemplateSignatureReminder();

        if (template != null && !template.isEmpty()) {
            // Replace placeholders in custom template
            for (Map.Entry<String, String> entry : data.entrySet()) {
                template = template.replace("{" + entry.getKey() + "}", entry.getValue());
            }
            return template;
        }

        // Default template
        long daysRemaining = Long.parseLong(data.getOrDefault("days_remaining", "0"));

        if (daysRemaining <= 1) {
            return String.format("URGENT: Your signature on '%s' from %s is due tomorrow. Please sign now.",
                    data.get("doc_title"), data.get("org_name"));
        }

        return String.format("Reminder: You have a document '%s' from %s pending your signature. Expires on %s.",
                data.get("doc_title"), data.get("org_name"), data.get("expiry_date"));
    }

    private String buildWhatsAppMessage(SignatureRequest request, Organization org, Map<String, String> data) {
        // WhatsApp messages can be slightly longer
        long daysRemaining = Long.parseLong(data.getOrDefault("days_remaining", "0"));

        if (daysRemaining <= 1) {
            return String.format("🔴 *URGENT REMINDER*\n\nHi %s,\n\nYour signature on '%s' from %s expires tomorrow.\n\nPlease sign the document as soon as possible.",
                    data.get("signer_name"), data.get("doc_title"), data.get("org_name"));
        }

        return String.format("📝 *Signature Reminder*\n\nHi %s,\n\nYou have a document '%s' from %s awaiting your signature.\n\n*Expires:* %s\n\nPlease sign at your earliest convenience.",
                data.get("signer_name"), data.get("doc_title"), data.get("org_name"), data.get("expiry_date"));
    }

    private void logReminderEvent(SignatureRequest request, Channel channel) {
        SignatureAuditLog auditLog = SignatureAuditLog.builder()
                .organizationId(request.getOrganizationId())
                .signatureRequestId(request.getId())
                .eventType(SignatureAuditLog.EVENT_REMINDER_SENT)
                .eventData("{\"channel\":\"" + channel.name() + "\"}")
                .actorType(SignatureAuditLog.ActorType.SYSTEM)
                .channel(mapToAuditChannel(channel))
                .build();

        signatureAuditLogRepository.save(auditLog);
    }

    private SignatureAuditLog.Channel mapToAuditChannel(Channel reminderChannel) {
        return switch (reminderChannel) {
            case EMAIL -> SignatureAuditLog.Channel.EMAIL;
            case SMS -> SignatureAuditLog.Channel.SMS;
            case WHATSAPP -> SignatureAuditLog.Channel.WHATSAPP;
        };
    }
}
