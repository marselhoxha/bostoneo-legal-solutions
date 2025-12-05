package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.SmsRequestDTO;
import com.bostoneo.bostoneosolutions.dto.SmsResponseDTO;

import java.util.Map;

/**
 * Service interface for Twilio communications (SMS, WhatsApp, Voice)
 */
public interface TwilioService {

    /**
     * Send a simple SMS message
     * @param to Recipient phone number (E.164 format preferred, e.g., +1234567890)
     * @param message The message content
     * @return SmsResponseDTO with status and message SID
     */
    SmsResponseDTO sendSms(String to, String message);

    /**
     * Send SMS using a template
     * @param to Recipient phone number
     * @param templateCode Template identifier
     * @param params Template parameters to substitute
     * @return SmsResponseDTO with status and message SID
     */
    SmsResponseDTO sendTemplatedSms(String to, String templateCode, Map<String, String> params);

    /**
     * Send a WhatsApp message
     * @param to Recipient WhatsApp number (E.164 format)
     * @param message The message content
     * @return SmsResponseDTO with status and message SID
     */
    SmsResponseDTO sendWhatsApp(String to, String message);

    /**
     * Send SMS with full request details (includes logging)
     * @param request Full SMS request with user/client/case context
     * @return SmsResponseDTO with status and message SID
     */
    SmsResponseDTO sendSmsWithContext(SmsRequestDTO request);

    /**
     * Send appointment reminder SMS
     * @param to Recipient phone number
     * @param clientName Client's name
     * @param appointmentTitle Title of the appointment
     * @param appointmentDate Formatted date string
     * @param appointmentTime Formatted time string
     * @return SmsResponseDTO with status
     */
    SmsResponseDTO sendAppointmentReminder(String to, String clientName, String appointmentTitle,
                                           String appointmentDate, String appointmentTime);

    /**
     * Send appointment confirmation SMS
     * @param to Recipient phone number
     * @param clientName Client's name
     * @param appointmentTitle Title of the appointment
     * @param appointmentDate Formatted date string
     * @param appointmentTime Formatted time string
     * @param attorneyName Attorney's name
     * @return SmsResponseDTO with status
     */
    SmsResponseDTO sendAppointmentConfirmation(String to, String clientName, String appointmentTitle,
                                               String appointmentDate, String appointmentTime, String attorneyName);

    /**
     * Send appointment cancellation SMS
     * @param to Recipient phone number
     * @param clientName Client's name
     * @param appointmentTitle Title of the appointment
     * @param reason Cancellation reason
     * @return SmsResponseDTO with status
     */
    SmsResponseDTO sendAppointmentCancellation(String to, String clientName, String appointmentTitle, String reason);

    /**
     * Send case update SMS
     * @param to Recipient phone number
     * @param clientName Client's name
     * @param caseNumber Case number
     * @param updateMessage Brief update message
     * @return SmsResponseDTO with status
     */
    SmsResponseDTO sendCaseUpdate(String to, String clientName, String caseNumber, String updateMessage);

    /**
     * Check if Twilio service is available
     * @return true if Twilio is configured and enabled
     */
    boolean isAvailable();

    /**
     * Validate and format phone number to E.164 format
     * @param phoneNumber Raw phone number
     * @return Formatted phone number or null if invalid
     */
    String formatPhoneNumber(String phoneNumber);
}
