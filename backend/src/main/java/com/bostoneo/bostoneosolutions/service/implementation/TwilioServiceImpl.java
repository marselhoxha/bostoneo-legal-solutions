package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.config.TwilioConfig;
import com.bostoneo.bostoneosolutions.dto.SmsRequestDTO;
import com.bostoneo.bostoneosolutions.dto.SmsResponseDTO;
import com.bostoneo.bostoneosolutions.service.TwilioService;
import com.twilio.exception.ApiException;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.regex.Pattern;

/**
 * Implementation of TwilioService for SMS and WhatsApp communications
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TwilioServiceImpl implements TwilioService {

    private final TwilioConfig twilioConfig;

    // E.164 phone number pattern
    private static final Pattern E164_PATTERN = Pattern.compile("^\\+[1-9]\\d{1,14}$");

    // US phone number patterns for formatting
    private static final Pattern US_PHONE_PATTERN = Pattern.compile("^1?([2-9]\\d{2})([2-9]\\d{2})(\\d{4})$");

    @Override
    public SmsResponseDTO sendSms(String to, String message) {
        if (!isAvailable()) {
            log.warn("Twilio service is not available. SMS not sent to: {}", maskPhone(to));
            return SmsResponseDTO.disabled();
        }

        String formattedPhone = formatPhoneNumber(to);
        if (formattedPhone == null) {
            log.error("Invalid phone number format: {}", maskPhone(to));
            return SmsResponseDTO.failure("Invalid phone number format", "INVALID_PHONE");
        }

        try {
            Message twilioMessage = Message.creator(
                    new PhoneNumber(formattedPhone),
                    new PhoneNumber(twilioConfig.getPhoneNumber()),
                    message
            ).create();

            log.info("SMS sent successfully. SID: {}, To: {}, Status: {}",
                    twilioMessage.getSid(), maskPhone(formattedPhone), twilioMessage.getStatus());

            return SmsResponseDTO.success(twilioMessage.getSid(), twilioMessage.getStatus().toString());

        } catch (ApiException e) {
            log.error("Twilio API error sending SMS to {}: {} (Code: {})",
                    maskPhone(formattedPhone), e.getMessage(), e.getCode());
            return SmsResponseDTO.failure(e.getMessage(), String.valueOf(e.getCode()));
        } catch (Exception e) {
            log.error("Unexpected error sending SMS to {}: {}", maskPhone(formattedPhone), e.getMessage());
            return SmsResponseDTO.failure(e.getMessage(), "UNKNOWN_ERROR");
        }
    }

    @Override
    public SmsResponseDTO sendTemplatedSms(String to, String templateCode, Map<String, String> params) {
        // For now, we'll handle templates in code. Later can be moved to database.
        String message = buildMessageFromTemplate(templateCode, params);
        if (message == null) {
            return SmsResponseDTO.failure("Template not found: " + templateCode, "TEMPLATE_NOT_FOUND");
        }
        return sendSms(to, message);
    }

    @Override
    public SmsResponseDTO sendWhatsApp(String to, String message) {
        if (!twilioConfig.isWhatsAppConfigured()) {
            log.warn("WhatsApp is not configured. Message not sent to: {}", maskPhone(to));
            return SmsResponseDTO.failure("WhatsApp not configured", "WHATSAPP_NOT_CONFIGURED");
        }

        String formattedPhone = formatPhoneNumber(to);
        if (formattedPhone == null) {
            return SmsResponseDTO.failure("Invalid phone number format", "INVALID_PHONE");
        }

        try {
            // WhatsApp uses whatsapp: prefix
            Message twilioMessage = Message.creator(
                    new PhoneNumber("whatsapp:" + formattedPhone),
                    new PhoneNumber("whatsapp:" + twilioConfig.getWhatsappNumber()),
                    message
            ).create();

            log.info("WhatsApp message sent successfully. SID: {}, To: {}, Status: {}",
                    twilioMessage.getSid(), maskPhone(formattedPhone), twilioMessage.getStatus());

            return SmsResponseDTO.success(twilioMessage.getSid(), twilioMessage.getStatus().toString());

        } catch (ApiException e) {
            log.error("Twilio API error sending WhatsApp to {}: {} (Code: {})",
                    maskPhone(formattedPhone), e.getMessage(), e.getCode());
            return SmsResponseDTO.failure(e.getMessage(), String.valueOf(e.getCode()));
        } catch (Exception e) {
            log.error("Unexpected error sending WhatsApp to {}: {}", maskPhone(formattedPhone), e.getMessage());
            return SmsResponseDTO.failure(e.getMessage(), "UNKNOWN_ERROR");
        }
    }

    @Override
    public SmsResponseDTO sendSmsWithContext(SmsRequestDTO request) {
        // Log the context for audit purposes
        log.info("Sending SMS with context - To: {}, UserId: {}, ClientId: {}, CaseId: {}, Channel: {}",
                maskPhone(request.getTo()), request.getUserId(), request.getClientId(),
                request.getCaseId(), request.getChannel());

        if ("WHATSAPP".equalsIgnoreCase(request.getChannel())) {
            return sendWhatsApp(request.getTo(), request.getMessage());
        }

        return sendSms(request.getTo(), request.getMessage());
    }

    @Override
    public SmsResponseDTO sendAppointmentReminder(String to, String clientName, String appointmentTitle,
                                                   String appointmentDate, String appointmentTime) {
        String message = String.format(
                "Hi %s, this is a reminder for your appointment: %s on %s at %s. " +
                "Please call us if you need to reschedule. - Bostoneo Legal Solutions",
                clientName, appointmentTitle, appointmentDate, appointmentTime
        );
        return sendSms(to, message);
    }

    @Override
    public SmsResponseDTO sendAppointmentConfirmation(String to, String clientName, String appointmentTitle,
                                                       String appointmentDate, String appointmentTime,
                                                       String attorneyName) {
        String message = String.format(
                "Hi %s, your appointment '%s' with %s has been confirmed for %s at %s. " +
                "We look forward to seeing you! - Bostoneo Legal Solutions",
                clientName, appointmentTitle, attorneyName, appointmentDate, appointmentTime
        );
        return sendSms(to, message);
    }

    @Override
    public SmsResponseDTO sendAppointmentCancellation(String to, String clientName,
                                                       String appointmentTitle, String reason) {
        String message = String.format(
                "Hi %s, your appointment '%s' has been cancelled. %s " +
                "Please contact us to reschedule. - Bostoneo Legal Solutions",
                clientName, appointmentTitle,
                reason != null ? "Reason: " + reason + "." : ""
        );
        return sendSms(to, message);
    }

    @Override
    public SmsResponseDTO sendCaseUpdate(String to, String clientName, String caseNumber, String updateMessage) {
        String message = String.format(
                "Hi %s, update on your case #%s: %s. " +
                "Log in to your portal for details. - Bostoneo Legal Solutions",
                clientName, caseNumber, updateMessage
        );
        return sendSms(to, message);
    }

    @Override
    public boolean isAvailable() {
        return twilioConfig.isConfigured();
    }

    @Override
    public String formatPhoneNumber(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
            return null;
        }

        // Remove all non-digit characters except leading +
        String cleaned = phoneNumber.trim();
        boolean hasPlus = cleaned.startsWith("+");
        cleaned = cleaned.replaceAll("[^\\d]", "");

        if (cleaned.isEmpty()) {
            return null;
        }

        // If already in E.164 format
        if (hasPlus) {
            String e164 = "+" + cleaned;
            if (E164_PATTERN.matcher(e164).matches()) {
                return e164;
            }
        }

        // Try to format as US number
        java.util.regex.Matcher matcher = US_PHONE_PATTERN.matcher(cleaned);
        if (matcher.matches()) {
            return "+1" + matcher.group(1) + matcher.group(2) + matcher.group(3);
        }

        // If 10 digits, assume US number
        if (cleaned.length() == 10) {
            return "+1" + cleaned;
        }

        // If 11 digits starting with 1, assume US number with country code
        if (cleaned.length() == 11 && cleaned.startsWith("1")) {
            return "+" + cleaned;
        }

        // For other cases, try adding + prefix
        String withPlus = "+" + cleaned;
        if (E164_PATTERN.matcher(withPlus).matches()) {
            return withPlus;
        }

        log.warn("Could not format phone number: {}", maskPhone(phoneNumber));
        return null;
    }

    /**
     * Build message from template code and parameters
     */
    private String buildMessageFromTemplate(String templateCode, Map<String, String> params) {
        // Default templates - can be moved to database later
        String template = switch (templateCode.toUpperCase()) {
            case "APPOINTMENT_REMINDER" ->
                    "Hi {{clientName}}, reminder: {{appointmentTitle}} on {{date}} at {{time}}. - Bostoneo Legal";
            case "APPOINTMENT_CONFIRMED" ->
                    "Hi {{clientName}}, your appointment '{{appointmentTitle}}' with {{attorneyName}} is confirmed for {{date}} at {{time}}. - Bostoneo Legal";
            case "APPOINTMENT_CANCELLED" ->
                    "Hi {{clientName}}, your appointment '{{appointmentTitle}}' has been cancelled. {{reason}} Please contact us to reschedule. - Bostoneo Legal";
            case "CASE_UPDATE" ->
                    "Hi {{clientName}}, update on case #{{caseNumber}}: {{message}}. Log in for details. - Bostoneo Legal";
            case "PAYMENT_RECEIVED" ->
                    "Hi {{clientName}}, we received your payment of {{amount}}. Thank you! - Bostoneo Legal";
            case "DOCUMENT_READY" ->
                    "Hi {{clientName}}, a document is ready for your review. Log in to view. - Bostoneo Legal";
            case "GENERAL" ->
                    "{{message}}";
            default -> null;
        };

        if (template == null) {
            return null;
        }

        // Replace placeholders
        String message = template;
        for (Map.Entry<String, String> entry : params.entrySet()) {
            message = message.replace("{{" + entry.getKey() + "}}", entry.getValue() != null ? entry.getValue() : "");
        }

        return message;
    }

    /**
     * Mask phone number for logging (show last 4 digits only)
     */
    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) {
            return "****";
        }
        return "***" + phone.substring(phone.length() - 4);
    }
}
