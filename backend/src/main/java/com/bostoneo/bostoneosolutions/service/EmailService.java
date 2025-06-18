package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.enumeration.VerificationType;
import com.***REMOVED***.***REMOVED***solutions.model.CalendarEvent;
import com.***REMOVED***.***REMOVED***solutions.model.Invoice;

import java.util.Map;

public interface EmailService {
    
    boolean sendEmail(String to, String subject, String body);
    
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
}