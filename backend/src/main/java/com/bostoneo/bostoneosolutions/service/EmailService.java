package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.enumeration.VerificationType;
import com.bostoneo.bostoneosolutions.model.CalendarEvent;
import java.util.Map;

public interface EmailService {
    
    /**
     * Send an email with basic information
     * 
     * @param to recipient email address
     * @param subject email subject
     * @param body email body (can be HTML)
     * @return true if the email was sent successfully
     */
    boolean sendEmail(String to, String subject, String body);
    
    /**
     * Send an email using a template with placeholders
     * 
     * @param to recipient email address
     * @param subject email subject
     * @param templateContent the email template with placeholders
     * @param templateData map of placeholder variables and their values
     * @return true if the email was sent successfully
     */
    boolean sendTemplatedEmail(String to, String subject, String templateContent, Map<String, String> templateData);
    
    /**
     * Send a deadline reminder email
     * 
     * @param email recipient email
     * @param firstName recipient's first name
     * @param event the calendar event
     * @param minutesBefore minutes before the event
     */
    void sendDeadlineReminderEmail(String email, String firstName, CalendarEvent event, int minutesBefore);
    
    /**
     * Send a verification email
     * 
     * @param firstName recipient's first name
     * @param email recipient email
     * @param verificationUrl verification URL
     * @param verificationType type of verification
     */
    void sendVerificationEmail(String firstName, String email, String verificationUrl, VerificationType verificationType);
}
