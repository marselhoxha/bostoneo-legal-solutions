package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for incoming SMS from Twilio webhook.
 * Twilio sends these parameters via form-urlencoded POST.
 *
 * @see <a href="https://www.twilio.com/docs/messaging/guides/webhook-request">Twilio Webhook Request</a>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncomingSmsDTO {

    // Message identifiers
    private String messageSid;
    private String smsSid;
    private String accountSid;
    private String messagingServiceSid;

    // Sender info
    private String from;          // Sender's phone number (E.164 format)
    private String fromCity;
    private String fromState;
    private String fromZip;
    private String fromCountry;

    // Recipient info
    private String to;            // Your Twilio number that received the message
    private String toCity;
    private String toState;
    private String toZip;
    private String toCountry;

    // Message content
    private String body;          // The message text
    private Integer numMedia;     // Number of media attachments
    private Integer numSegments;  // Number of SMS segments

    // Media attachments (if any) - Twilio sends MediaUrl0, MediaUrl1, etc.
    private String mediaContentType0;
    private String mediaUrl0;
    private String mediaContentType1;
    private String mediaUrl1;
    private String mediaContentType2;
    private String mediaUrl2;

    // API version
    private String apiVersion;

    /**
     * Check if the message has any media attachments
     */
    public boolean hasMedia() {
        return numMedia != null && numMedia > 0;
    }

    /**
     * Get the sender's phone number in a normalized format
     */
    public String getNormalizedFrom() {
        if (from == null) return null;
        // Remove any non-digit characters except +
        return from.replaceAll("[^+\\d]", "");
    }
}
