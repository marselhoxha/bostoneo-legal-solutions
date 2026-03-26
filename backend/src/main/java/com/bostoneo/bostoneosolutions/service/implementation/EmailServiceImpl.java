package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.email.EmailBranding;
import com.bostoneo.bostoneosolutions.dto.email.EmailContent;
import com.bostoneo.bostoneosolutions.enumeration.VerificationType;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.CalendarEvent;
import com.bostoneo.bostoneosolutions.service.EmailService;
import com.bostoneo.bostoneosolutions.service.EmailTemplateEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailServiceImpl implements EmailService {
    private final JavaMailSender mailSender;
    private final EmailTemplateEngine templateEngine;

    @Value("${UI_APP_URL:http://localhost:4200}")
    private String frontendUrl;

    @Value("${LEGIENCE_LOGO_URL:https://app.legience.com/assets/images/legience-logo-blue.svg}")
    private String legienceLogoUrl;

    @Value("${EMAIL_FROM_ADDRESS:hello@legience.com}")
    private String fromAddress;

    @Value("${EMAIL_FROM_NAME:Legience}")
    private String fromName;

    private static final String LOGO_CID = "legience-logo";
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("h:mm a");
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\{\\{(\\w+)\\}\\}");

    /**
     * Get the logo URL for email templates. Uses CID reference so the logo
     * is embedded inline in the email and loads instantly.
     */
    private String getLogoUrl() {
        return "cid:" + LOGO_CID;
    }

    /**
     * Attach the logo as an inline image so it loads instantly in email clients.
     */
    private void addInlineLogo(MimeMessageHelper helper) {
        try {
            ClassPathResource logoResource = new ClassPathResource("static/images/legience-logo-blue.svg");
            if (logoResource.exists()) {
                helper.addInline(LOGO_CID, logoResource, "image/svg+xml");
            }
        } catch (Exception e) {
            log.warn("Could not attach inline logo: {}", e.getMessage());
        }
    }

    @Override
    public boolean sendEmail(String to, String subject, String body) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            
            helper.setFrom(fromAddress, fromName);
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
            
            helper.setFrom(fromAddress, fromName);
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
        try {
            EmailBranding branding = EmailBranding.platform(frontendUrl, getLogoUrl());

            String subject;
            EmailContent content;

            switch (verificationType) {
                case ACCOUNT:
                    subject = "Verify your Legience account";
                    content = EmailContent.builder()
                            .recipientName(firstName)
                            .bodyParagraphs(List.of(
                                    "Welcome to Legience! Your account has been created.",
                                    "Please verify your email address to get started."))
                            .ctaButton(EmailContent.CtaButton.builder()
                                    .text("Verify My Account")
                                    .url(verificationUrl)
                                    .build())
                            .signOffName("Legience Team")
                            .footerNote("If you didn't create an account, you can safely ignore this email.")
                            .build();
                    break;
                case PASSWORD:
                    subject = "Reset your password";
                    content = EmailContent.builder()
                            .recipientName(firstName)
                            .bodyParagraphs(List.of("We received a request to reset your password. Click the button below to choose a new one."))
                            .ctaButton(EmailContent.CtaButton.builder()
                                    .text("Reset Password")
                                    .url(verificationUrl)
                                    .build())
                            .infoBox(EmailContent.InfoBox.builder()
                                    .html("This link expires in <strong>24 hours</strong>. If you didn't request this, your password will remain unchanged.")
                                    .level("amber")
                                    .build())
                            .signOffName("Legience Team")
                            .build();
                    break;
                default:
                    throw new ApiException("Unable to send email. Email type unknown");
            }

            String htmlContent = templateEngine.render(branding, content);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(email);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);
            addInlineLogo(helper);

            mailSender.send(mimeMessage);
            log.info("Verification email sent to {}", firstName);
        } catch (ApiException e) {
            throw e;
        } catch (Exception exception) {
            log.error("Failed to send verification email to {}: {}", email, exception.getMessage(), exception);
        }
    }

    @Override
    public void sendDeadlineReminderEmail(String email, String firstName, CalendarEvent event, int minutesBefore) {
        try {
            EmailBranding branding = EmailBranding.firmInternal("Legience", getLogoUrl(), "#1e56b6", null, frontendUrl);

            // Determine urgency
            boolean isHighPriority = "DEADLINE".equals(event.getEventType()) &&
                    event.getStatus() != null && event.getStatus().contains("HIGH");

            EmailContent.UrgencyBanner urgency = null;
            if ("DEADLINE".equals(event.getEventType())) {
                urgency = EmailContent.UrgencyBanner.builder()
                    .text(isHighPriority ? "URGENT DEADLINE" : "DEADLINE APPROACHING")
                    .level(isHighPriority ? "red" : "amber")
                    .build();
            } else if ("HEARING".equals(event.getEventType()) || "COURT_DATE".equals(event.getEventType())) {
                urgency = EmailContent.UrgencyBanner.builder().text("COURT APPEARANCE TODAY").level("red").build();
            }

            // Build detail card rows
            List<Map.Entry<String, String>> rows = new ArrayList<>();
            if (event.getStartTime() != null) {
                rows.add(Map.entry("Date", event.getStartTime().format(DATE_FORMATTER)));
                boolean isAllDay = event.getAllDay() != null && event.getAllDay();
                if (!isAllDay) {
                    rows.add(Map.entry("Time", event.getStartTime().format(TIME_FORMATTER)));
                }
            }
            if (event.getLocation() != null && !event.getLocation().isEmpty()) {
                rows.add(Map.entry("Location", event.getLocation()));
            }
            if (event.getLegalCase() != null && event.getLegalCase().getTitle() != null) {
                rows.add(Map.entry("Case", event.getLegalCase().getTitle()));
            }

            // Time remaining text
            String timeText;
            if (minutesBefore < 60) {
                timeText = "This event is due in " + minutesBefore + " minutes.";
            } else if (minutesBefore < 1440) {
                int hours = minutesBefore / 60;
                timeText = "This event is due in " + hours + (hours == 1 ? " hour." : " hours.");
            } else {
                int days = minutesBefore / 1440;
                timeText = "This event is due in " + days + (days == 1 ? " day." : " days.");
            }

            String accentColor = "DEADLINE".equals(event.getEventType()) ? "#d97706" :
                    ("HEARING".equals(event.getEventType()) || "COURT_DATE".equals(event.getEventType())) ? "#dc2626" : null;

            EmailContent content = EmailContent.builder()
                    .recipientName(firstName)
                    .bodyParagraphs(List.of("This is a reminder about an upcoming event.", timeText))
                    .detailCard(EmailContent.DetailCard.builder()
                        .title(event.getTitle())
                        .rows(rows)
                        .accentColor(accentColor)
                        .build())
                    .ctaButton(EmailContent.CtaButton.builder().text("View Calendar").url(frontendUrl + "/legal/calendar").build())
                    .signOffName("Legience Team")
                    .urgency(urgency)
                    .build();

            String subject = isHighPriority
                    ? "URGENT: Deadline Reminder - " + event.getTitle()
                    : "Reminder: " + event.getTitle();

            String htmlContent = templateEngine.render(branding, content);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(email);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);
            addInlineLogo(helper);
            mailSender.send(mimeMessage);

            log.info("Deadline reminder email sent to {} for event ID: {}", email, event.getId());
        } catch (Exception exception) {
            log.error("Failed to send deadline reminder email: {}", exception.getMessage());
        }
    }

    @Override
    public void sendNotificationEmail(String to, String firstName, String title, String message, String notificationType) {
        try {
            log.info("Preparing notification email to: {} ({}), Title: '{}', Type: {}", to, firstName, title, notificationType);

            EmailBranding branding = EmailBranding.firmInternal("Legience", getLogoUrl(), "#1e56b6", null, frontendUrl);

            EmailContent content = EmailContent.builder()
                    .recipientName(firstName)
                    .bodyParagraphs(List.of(message))
                    .ctaButton(EmailContent.CtaButton.builder().text("View in Dashboard").url(frontendUrl).build())
                    .signOffName("Legience Team")
                    .build();

            String htmlContent = templateEngine.render(branding, content);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(to);
            helper.setSubject("Legience - " + title);
            helper.setText(htmlContent, true);
            addInlineLogo(helper);
            mailSender.send(mimeMessage);

            log.info("Notification email sent successfully to {} for type: {}", to, notificationType);
        } catch (MessagingException | java.io.UnsupportedEncodingException exception) {
            log.error("Failed to send notification email to {}: {}", to, exception.getMessage(), exception);
        }
    }

    @Override
    public void sendMfaVerificationEmail(String email, String firstName, String code) {
        try {
            log.info("Sending MFA verification email to: {}", email);

            EmailBranding branding = EmailBranding.platform(frontendUrl, getLogoUrl());
            EmailContent content = EmailContent.builder()
                    .recipientName(firstName)
                    .bodyParagraphs(List.of("Your multi-factor authentication verification code is:"))
                    .mfaCode(EmailContent.MfaCode.builder().code(code).build())
                    .signOffName("Legience Team")
                    .footerNote("This is an automated security email. Do not share this code with anyone.")
                    .build();
            String htmlContent = templateEngine.render(branding, content);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(email);
            helper.setSubject("Legience - Your Verification Code");
            helper.setText(htmlContent, true);
            addInlineLogo(helper);

            mailSender.send(mimeMessage);
            log.info("MFA verification email sent successfully to: {}", email);
        } catch (MessagingException | java.io.UnsupportedEncodingException exception) {
            log.error("Failed to send MFA verification email to {}: {}", email, exception.getMessage(), exception);
            throw new RuntimeException("Failed to send MFA verification email", exception);
        }
    }


    @Override
    public void sendInvitationEmail(String email, String organizationName, String role, String inviteUrl, int expirationDays) {
        try {
            log.info("Sending invitation email to: {} for organization: {}", email, organizationName);

            EmailBranding branding = EmailBranding.firmClient(organizationName, null, "#405189", null, null, null, frontendUrl);

            List<Map.Entry<String, String>> rows = new ArrayList<>();
            rows.add(Map.entry("Role", role));
            rows.add(Map.entry("Expires", expirationDays + " days from now"));

            EmailContent content = EmailContent.builder()
                    .recipientName(null)
                    .greeting("You've been invited!")
                    .bodyParagraphs(List.of("You have been invited to join <strong>" + organizationName + "</strong> as a <strong>" + role + "</strong>."))
                    .detailCard(EmailContent.DetailCard.builder().title("Invitation Details").rows(rows).build())
                    .ctaButton(EmailContent.CtaButton.builder().text("Accept Invitation").url(inviteUrl).build())
                    .signOffName(organizationName)
                    .footerNote("If you didn't expect this invitation, you can safely ignore this email.")
                    .build();

            String htmlContent = templateEngine.render(branding, content);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(email);
            helper.setSubject("You've been invited to join " + organizationName);
            helper.setText(htmlContent, true);
            addInlineLogo(helper);
            mailSender.send(mimeMessage);

            log.info("Invitation email sent successfully to: {}", email);
        } catch (MessagingException | java.io.UnsupportedEncodingException exception) {
            log.error("Failed to send invitation email to {}: {}", email, exception.getMessage(), exception);
        }
    }
}
