package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.enumeration.VerificationType;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.CalendarEvent;
import com.bostoneo.bostoneosolutions.service.EmailService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.core.io.Resource;

import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@AllArgsConstructor
@Slf4j
public class EmailServiceImpl implements EmailService {
    private final JavaMailSender mailSender;
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("h:mm a");
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\{\\{(\\w+)\\}\\}");

    @Override
    public boolean sendEmail(String to, String subject, String body) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            
            helper.setFrom("info@bostoneo.com", "Bostoneo Legal Solutions");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(body, true); // true indicates HTML content
            
            mailSender.send(message);
            log.info("Email sent successfully to: {}", to);
            return true;
        } catch (MessagingException | java.io.UnsupportedEncodingException e) {
            log.error("Failed to send email to: {}", to, e);
            return false;
        }
    }

    @Override
    public boolean sendEmailWithAttachment(String to, String subject, String body, Resource attachment, String attachmentName) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            
            helper.setFrom("info@bostoneo.com", "Bostoneo Legal Solutions");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(body, true); // true indicates HTML content
            
            // Add attachment if provided
            if (attachment != null && attachmentName != null) {
                helper.addAttachment(attachmentName, attachment);
                log.info("Added attachment: {} to email", attachmentName);
            }
            
            mailSender.send(message);
            log.info("Email with attachment sent successfully to: {}", to);
            return true;
        } catch (MessagingException e) {
            log.error("Failed to send email with attachment to: {}", to, e);
            return false;
        } catch (Exception e) {
            log.error("Unexpected error sending email with attachment to: {}", to, e);
            return false;
        }
    }

    @Override
    public boolean sendTemplatedEmail(String to, String subject, String templateContent, Map<String, String> templateData) {
        String processedContent = processTemplate(templateContent, templateData);
        String processedSubject = processTemplate(subject, templateData);
        return sendEmail(to, processedSubject, processedContent);
    }

    private String processTemplate(String templateContent, Map<String, String> templateData) {
        Matcher matcher = PLACEHOLDER_PATTERN.matcher(templateContent);
        StringBuffer result = new StringBuffer();
        
        while (matcher.find()) {
            String key = matcher.group(1);
            String replacement = templateData.getOrDefault(key, "");
            // Escape $ and \ in the replacement string for the appendReplacement method
            replacement = replacement.replace("\\", "\\\\").replace("$", "\\$");
            matcher.appendReplacement(result, replacement);
        }
        
        matcher.appendTail(result);
        return result.toString();
    }

    @Override
    public void sendVerificationEmail(String firstName, String email, String verificationUrl, VerificationType verificationType) {
        try{
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom("info@bostoneo.com");
            message.setTo(email);
            message.setText(getEmailMessage(firstName, verificationUrl, verificationType));
            message.setSubject(String.format("Bostoneo Solutions - %s Verification Email", StringUtils.capitalize(verificationType.getType())));
            mailSender.send(message);
            log.info("Email sent to {}", firstName);
        } catch (Exception exception) {
            log.error(exception.getMessage());
        }
    }

    @Override
    public void sendDeadlineReminderEmail(String email, String firstName, CalendarEvent event, int minutesBefore) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom("info@bostoneo.com");
            message.setTo(email);
            message.setText(getDeadlineReminderMessage(firstName, event, minutesBefore));
            
            // Check if the deadline is high priority - use property name directly
            // Since highPriority might not exist in the model yet, use a safer approach
            boolean isHighPriority = false;
            try {
                // Try to check if the event type is DEADLINE and has a high priority status
                isHighPriority = "DEADLINE".equals(event.getEventType()) && 
                                 event.getStatus() != null && 
                                 event.getStatus().contains("HIGH");
            } catch (Exception e) {
                log.debug("Could not determine priority status", e);
            }
            
            // Set the subject based on priority
            String subject = isHighPriority
                ? "🚨 URGENT: Deadline Reminder - " + event.getTitle()
                : "⏰ Deadline Reminder - " + event.getTitle();
                
            message.setSubject(subject);
            mailSender.send(message);
            
            log.info("Deadline reminder email sent to {} for event ID: {}", email, event.getId());
        } catch (Exception exception) {
            log.error("Failed to send deadline reminder email: {}", exception.getMessage());
        }
    }
    
    private String getDeadlineReminderMessage(String firstName, CalendarEvent event, int minutesBefore) {
        StringBuilder message = new StringBuilder();
        message.append("Hello ").append(firstName).append(",\n\n");
        
        // Format the reminder based on priority status from event type and status
        boolean isHighPriority = false;
        try {
            isHighPriority = "DEADLINE".equals(event.getEventType()) && 
                             event.getStatus() != null && 
                             event.getStatus().contains("HIGH");
        } catch (Exception e) {
            log.debug("Could not determine priority status", e);
        }
        
        if (isHighPriority) {
            message.append("This is an URGENT reminder about an approaching high-priority deadline.\n\n");
        } else {
            message.append("This is a reminder about an approaching deadline.\n\n");
        }
        
        // Event details section
        message.append("DEADLINE DETAILS:\n");
        message.append("------------------------------------------\n");
        message.append("Title: ").append(event.getTitle()).append("\n");
        
        if (StringUtils.isNotBlank(event.getDescription())) {
            message.append("Description: ").append(event.getDescription()).append("\n");
        }
        
        // Format the date time nicely
        String formattedDate = event.getStartTime().format(DATE_FORMATTER);
        String formattedTime = event.getStartTime().format(TIME_FORMATTER);
        
        message.append("Due Date: ").append(formattedDate).append("\n");
        
        // Check if all-day event - safely
        boolean isAllDay = event.getAllDay() != null && event.getAllDay();
        if (!isAllDay) {
            message.append("Due Time: ").append(formattedTime).append("\n");
        }
        
        // Add related case information if available
        if (event.getCaseId() != null) {
            message.append("\nRELATED CASE:\n");
            message.append("------------------------------------------\n");
            
            String caseTitle = "N/A";
            // Try to safely get case title
            if (event.getLegalCase() != null && event.getLegalCase().getTitle() != null) {
                caseTitle = event.getLegalCase().getTitle();
            }
            message.append("Case: ").append(caseTitle).append("\n");
            
            // Try to safely get case number
            String caseNumber = null;
            if (event.getLegalCase() != null) {
                caseNumber = event.getLegalCase().getCaseNumber();
            }
            
            if (StringUtils.isNotBlank(caseNumber)) {
                message.append("Case Number: ").append(caseNumber).append("\n");
            }
        }
        
        // Format time remaining message
        message.append("\n");
        if (minutesBefore < 60) {
            message.append("This deadline is due in ").append(minutesBefore).append(" minutes.\n");
        } else if (minutesBefore < 1440) { // less than 1 day
            int hours = minutesBefore / 60;
            message.append("This deadline is due in ").append(hours).append(hours == 1 ? " hour.\n" : " hours.\n");
        } else {
            int days = minutesBefore / 1440;
            message.append("This deadline is due in ").append(days).append(days == 1 ? " day.\n" : " days.\n");
        }
        
        // Add call to action
        message.append("\nPlease login to the Bostoneo Legal Solutions platform to view more details and manage this deadline.\n\n");
        message.append("Thank you,\n");
        message.append("Bostoneo Legal Solutions Team");
        
        return message.toString();
    }

    @Override
    public void sendNotificationEmail(String to, String firstName, String title, String message, String notificationType) {
        try {
            log.info("📧 EMAIL SERVICE: Preparing to send notification email to: {} ({}), Title: '{}', Type: {}", to, firstName, title, notificationType);
            
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            
            helper.setFrom("info@bostoneo.com", "Bostoneo Legal Solutions");
            helper.setTo(to);
            helper.setSubject("Bostoneo Solutions - " + title);
            
            String htmlContent = buildHtmlNotificationEmail(firstName, title, message, notificationType);
            log.info("📧 HTML content generated, length: {} characters", htmlContent.length());
            
            helper.setText(htmlContent, true); // true indicates HTML content
            
            log.info("📧 Sending email via JavaMailSender...");
            mailSender.send(mimeMessage);
            log.info("✅ HTML notification email sent successfully to {} for type: {}", to, notificationType);
        } catch (MessagingException | java.io.UnsupportedEncodingException exception) {
            log.error("❌ Failed to send notification email to {}: {}", to, exception.getMessage(), exception);
        }
    }

    private String getNotificationEmailMessage(String firstName, String title, String message, String notificationType) {
        return buildHtmlNotificationEmail(firstName, title, message, notificationType);
    }
    
    private String buildHtmlNotificationEmail(String firstName, String title, String message, String notificationType) {
        // Get notification type specific details
        NotificationTypeInfo typeInfo = getNotificationTypeInfo(notificationType);
        
        StringBuilder html = new StringBuilder();
        
        // HTML Email Template
        html.append("<!DOCTYPE html>");
        html.append("<html lang=\"en\">");
        html.append("<head>");
        html.append("<meta charset=\"UTF-8\">");
        html.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
        html.append("<title>").append(title).append("</title>");
        html.append("<style>");
        html.append(getEmailCSS());
        html.append("</style>");
        html.append("</head>");
        html.append("<body>");
        
        // Main Container
        html.append("<div class=\"email-container\">");
        
        // Header
        html.append("<div class=\"header\">");
        html.append("<div class=\"logo\">");
        html.append("<h2>Bostoneo Legal Solutions</h2>");
        html.append("</div>");
        html.append("</div>");
        
        // Main Content
        html.append("<div class=\"content\">");
        
        // Greeting
        html.append("<div class=\"greeting\">");
        html.append("<h3>Hello ").append(firstName).append(",</h3>");
        html.append("</div>");
        
        // Notification Badge
        html.append("<div class=\"notification-badge ").append(typeInfo.badgeClass).append("\">");
        html.append("<div class=\"badge-icon\">").append(typeInfo.icon).append("</div>");
        html.append("<div class=\"badge-content\">");
        html.append("<h4>").append(title).append("</h4>");
        html.append("<p class=\"notification-type\">").append(typeInfo.displayName).append("</p>");
        html.append("</div>");
        html.append("</div>");
        
        // Message Content
        html.append("<div class=\"message-content\">");
        html.append("<p>").append(message).append("</p>");
        html.append("</div>");
        
        // Type-specific additional information
        if (typeInfo.additionalInfo != null && !typeInfo.additionalInfo.isEmpty()) {
            html.append("<div class=\"additional-info\">");
            html.append("<p>").append(typeInfo.additionalInfo).append("</p>");
            html.append("</div>");
        }
        
        // Call to Action
        html.append("<div class=\"cta-section\">");
        html.append("<a href=\"#\" class=\"cta-button\">View in Dashboard</a>");
        html.append("<p class=\"cta-text\">Login to Bostoneo Legal Solutions to view full details and take action.</p>");
        html.append("</div>");
        
        html.append("</div>"); // End content
        
        // Footer
        html.append("<div class=\"footer\">");
        html.append("<p>Best regards,<br>");
        html.append("<strong>Bostoneo Legal Solutions Team</strong></p>");
        html.append("<div class=\"footer-links\">");
        html.append("<p><small>");
        html.append("This is an automated notification from your legal case management system. ");
        html.append("You can manage your notification preferences in your account settings.");
        html.append("</small></p>");
        html.append("</div>");
        html.append("</div>");
        
        html.append("</div>"); // End container
        html.append("</body>");
        html.append("</html>");
        
        return html.toString();
    }
    
    private String getEmailCSS() {
        return """
            body {
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f5f7fa;
                color: #333333;
                line-height: 1.6;
            }
            
            .email-container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                border-radius: 8px;
                overflow: hidden;
            }
            
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                text-align: center;
            }
            
            .header h2 {
                margin: 0;
                font-size: 24px;
                font-weight: 300;
                letter-spacing: 1px;
            }
            
            .content {
                padding: 30px;
            }
            
            .greeting h3 {
                margin: 0 0 20px 0;
                color: #333333;
                font-size: 20px;
                font-weight: 500;
            }
            
            .notification-badge {
                display: flex;
                align-items: center;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid;
            }
            
            .notification-badge.case { 
                background-color: #e3f2fd; 
                border-left-color: #1976d2; 
            }
            
            .notification-badge.task { 
                background-color: #fff3e0; 
                border-left-color: #f57c00; 
            }
            
            .notification-badge.document { 
                background-color: #e8f5e8; 
                border-left-color: #388e3c; 
            }
            
            .notification-badge.invoice { 
                background-color: #fce4ec; 
                border-left-color: #c2185b; 
            }
            
            .notification-badge.lead { 
                background-color: #f3e5f5; 
                border-left-color: #7b1fa2; 
            }
            
            .notification-badge.intake { 
                background-color: #e0f2f1; 
                border-left-color: #00695c; 
            }
            
            .notification-badge.expense { 
                background-color: #fff8e1; 
                border-left-color: #ff8f00; 
            }
            
            .notification-badge.calendar { 
                background-color: #e1f5fe; 
                border-left-color: #0277bd; 
            }
            
            .notification-badge.system { 
                background-color: #fafafa; 
                border-left-color: #616161; 
            }
            
            .notification-badge.default { 
                background-color: #f5f5f5; 
                border-left-color: #757575; 
            }
            
            .badge-icon {
                font-size: 24px;
                margin-right: 15px;
                width: 40px;
                text-align: center;
            }
            
            .badge-content h4 {
                margin: 0 0 5px 0;
                color: #333333;
                font-size: 18px;
                font-weight: 600;
            }
            
            .notification-type {
                margin: 0;
                font-size: 12px;
                color: #666666;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 500;
            }
            
            .message-content {
                margin: 25px 0;
            }
            
            .message-content p {
                margin: 0;
                font-size: 16px;
                color: #555555;
                line-height: 1.6;
            }
            
            .additional-info {
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 6px;
                margin: 20px 0;
                border-left: 3px solid #007bff;
            }
            
            .additional-info p {
                margin: 0;
                font-size: 14px;
                color: #666666;
                font-style: italic;
            }
            
            .cta-section {
                text-align: center;
                margin: 30px 0;
                padding: 20px;
                background-color: #f8f9fa;
                border-radius: 8px;
            }
            
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 25px;
                font-weight: 600;
                font-size: 16px;
                margin-bottom: 10px;
                transition: transform 0.2s ease;
            }
            
            .cta-button:hover {
                transform: translateY(-2px);
            }
            
            .cta-text {
                margin: 15px 0 0 0;
                font-size: 14px;
                color: #666666;
            }
            
            .footer {
                background-color: #f8f9fa;
                padding: 20px;
                text-align: center;
                border-top: 1px solid #e9ecef;
            }
            
            .footer p {
                margin: 0 0 10px 0;
                color: #555555;
            }
            
            .footer-links small {
                color: #999999;
                font-size: 12px;
                line-height: 1.4;
            }
            
            @media only screen and (max-width: 600px) {
                .email-container {
                    margin: 10px;
                    border-radius: 0;
                }
                
                .content {
                    padding: 20px;
                }
                
                .notification-badge {
                    flex-direction: column;
                    text-align: center;
                }
                
                .badge-icon {
                    margin: 0 0 10px 0;
                }
            }
            """;
    }
    
    private NotificationTypeInfo getNotificationTypeInfo(String notificationType) {
        return switch (notificationType.toUpperCase()) {
            case "CASE_STATUS_CHANGED" -> new NotificationTypeInfo(
                "⚖️", "case", "Case Update", 
                "A case status has been updated. Please review the case details and take any necessary action."
            );
            case "CASE_PRIORITY_CHANGED" -> new NotificationTypeInfo(
                "🔥", "case", "Case Priority Update", 
                "A case priority has been modified. Please review the updated priority level."
            );
            case "CASE_ASSIGNMENT_ADDED" -> new NotificationTypeInfo(
                "👥", "case", "Case Assignment", 
                "You have been assigned to a new case. Please review the case details."
            );
            case "TASK_CREATED" -> new NotificationTypeInfo(
                "📋", "task", "New Task", 
                "A new task has been created and assigned to you. Please review the task details and deadline."
            );
            case "TASK_STATUS_CHANGED" -> new NotificationTypeInfo(
                "✅", "task", "Task Update", 
                "A task status has been updated. Please check the task progress."
            );
            case "TASK_DEADLINE_APPROACHING" -> new NotificationTypeInfo(
                "⏰", "task", "Deadline Alert", 
                "A task deadline is approaching. Please ensure you complete the task on time."
            );
            case "DOCUMENT_UPLOADED" -> new NotificationTypeInfo(
                "📄", "document", "Document Upload", 
                "A new document has been uploaded to the system. Please review the document library."
            );
            case "DOCUMENT_VERSION_UPDATED" -> new NotificationTypeInfo(
                "🔄", "document", "Document Update", 
                "A document has been updated with a new version. Please review the latest changes."
            );
            case "INVOICE_CREATED" -> new NotificationTypeInfo(
                "💰", "invoice", "New Invoice", 
                "A new invoice has been generated. Please review the billing details."
            );
            case "PAYMENT_RECEIVED" -> new NotificationTypeInfo(
                "💳", "invoice", "Payment Received", 
                "A payment has been received and processed. Please check your billing dashboard."
            );
            case "EXPENSE_SUBMITTED" -> new NotificationTypeInfo(
                "🧾", "expense", "Expense Submission", 
                "A new expense has been submitted for approval. Please review and approve if necessary."
            );
            case "LEAD_STATUS_CHANGED" -> new NotificationTypeInfo(
                "🎯", "lead", "Lead Update", 
                "A lead status has been updated. Please follow up as needed."
            );
            case "INTAKE_FORM_SUBMITTED" -> new NotificationTypeInfo(
                "📝", "intake", "New Intake Form", 
                "A new client intake form has been submitted. Please review and follow up promptly."
            );
            case "CALENDAR_EVENT_CREATED" -> new NotificationTypeInfo(
                "📅", "calendar", "Calendar Event", 
                "A new calendar event has been created. Please check your schedule."
            );
            case "SYSTEM_ISSUE" -> new NotificationTypeInfo(
                "⚠️", "system", "System Alert", 
                "A system issue has been detected. Please contact support if you experience any problems."
            );
            default -> new NotificationTypeInfo(
                "🔔", "default", "Notification", 
                "Please login to the platform for more details."
            );
        };
    }
    
    private static class NotificationTypeInfo {
        final String icon;
        final String badgeClass;
        final String displayName;
        final String additionalInfo;
        
        NotificationTypeInfo(String icon, String badgeClass, String displayName, String additionalInfo) {
            this.icon = icon;
            this.badgeClass = badgeClass;
            this.displayName = displayName;
            this.additionalInfo = additionalInfo;
        }
    }

    private String getEmailMessage(String firstName, String verificationUrl, VerificationType verificationType) {
        switch (verificationType) {
            case PASSWORD:
                return "Hello " + firstName + "," + "\n\nReset password request. Please click the link below to reset your password. \n\n" + verificationUrl + "\n\nThe Support Team";
            case ACCOUNT:
                return "Hello " + firstName + "," + "\n\nYour new account has been created. Please click the link below to verify your account. \n\n" + verificationUrl + "\n\nThe Support Team";
            default:
                throw new ApiException("Unable to send email. Email type unknown");
        }
    }
}
