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
        // Default implementation logs the action
        System.out.println("Sending email for invoice " + invoice.getInvoiceNumber() + " using template " + templateName);
    }
    
    default void sendReminderEmail(String to, String subject, String body) {
        sendEmail(to, subject, body);
    }
    
    void sendNotificationEmail(String to, String firstName, String title, String message, String notificationType);
}