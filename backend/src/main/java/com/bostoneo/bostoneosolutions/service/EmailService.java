package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.enumeration.VerificationType;
import com.bostoneo.bostoneosolutions.model.CalendarEvent;
import com.bostoneo.bostoneosolutions.model.Invoice;
import org.springframework.core.io.Resource;

import java.util.Map;

public interface EmailService {
    
    boolean sendEmail(String to, String subject, String body);
    
    boolean sendEmailWithAttachment(String to, String subject, String body, Resource attachment, String attachmentName);
    
    boolean sendTemplatedEmail(String to, String subject, String templateContent, Map<String, String> templateData);
    
    void sendVerificationEmail(String firstName, String email, String verificationUrl, VerificationType verificationType);
    
    void sendDeadlineReminderEmail(String email, String firstName, CalendarEvent event, int minutesBefore);
    
    // Legacy methods for backward compatibility
    default void sendInvoiceEmail(Invoice invoice, String templateName, boolean attachPdf) {
        // Default stub - implementations should override this method
    }
    
    default void sendReminderEmail(String to, String subject, String body) {
        sendEmail(to, subject, body);
    }
    
    void sendNotificationEmail(String to, String firstName, String title, String message, String notificationType);

    /**
     * Send organization invitation email
     * @param email Recipient email address
     * @param organizationName Name of the organization
     * @param role Role being offered
     * @param inviteUrl URL to accept the invitation
     * @param expirationDays Number of days until invitation expires
     */
    void sendInvitationEmail(String email, String organizationName, String role, String inviteUrl, int expirationDays);
}