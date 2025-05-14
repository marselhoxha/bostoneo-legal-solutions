package com.***REMOVED***.***REMOVED***solutions.service.implementation;

import com.***REMOVED***.***REMOVED***solutions.enumeration.VerificationType;
import com.***REMOVED***.***REMOVED***solutions.exception.ApiException;
import com.***REMOVED***.***REMOVED***solutions.model.CalendarEvent;
import com.***REMOVED***.***REMOVED***solutions.service.EmailService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

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
            
            helper.setFrom("info@***REMOVED***.com");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(body, true); // true indicates HTML content
            
            mailSender.send(message);
            log.info("Email sent successfully to: {}", to);
            return true;
        } catch (MessagingException e) {
            log.error("Failed to send email to: {}", to, e);
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
            message.setFrom("info@***REMOVED***.com");
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
            message.setFrom("info@***REMOVED***.com");
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

    private String getEmailMessage(String firstName, String verificationUrl, VerificationType verificationType) {
        switch (verificationType) {
            case PASSWORD -> { return "Hello " + firstName + "," + "\n\nReset password request. Please click the link below to reset your password. \n\n" + verificationUrl + "\n\nThe Support Team"; }
            case ACCOUNT -> { return "Hello " + firstName + "," + "\n\nYour new account has been created. Please click the link below to verify your account. \n\n" + verificationUrl + "\n\nThe Support Team"; }
            default -> throw new ApiException("Unable to send email. Email type unknown");
        }
    }
}











