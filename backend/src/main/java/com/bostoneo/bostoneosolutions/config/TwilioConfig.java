package com.bostoneo.bostoneosolutions.config;

import com.twilio.Twilio;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Twilio configuration class for SMS, WhatsApp, and Voice communications.
 *
 * In multi-tenant mode:
 * - Master account credentials are used to manage subaccounts
 * - Each organization has its own subaccount with dedicated phone number
 *
 * In single-tenant mode (default org):
 * - Uses the master account directly for sending messages
 */
@Configuration
@Getter
@Slf4j
public class TwilioConfig {

    // Master account credentials (used for subaccount management and default org)
    @Value("${twilio.account-sid}")
    private String accountSid;

    @Value("${twilio.auth-token}")
    private String authToken;

    // Default phone number (for single-tenant / default org)
    @Value("${twilio.phone-number}")
    private String phoneNumber;

    @Value("${twilio.whatsapp-number:}")
    private String whatsappNumber;

    @Value("${twilio.enabled:true}")
    private boolean enabled;

    // Multi-tenant settings
    @Value("${twilio.multi-tenant:false}")
    private boolean multiTenant;

    @PostConstruct
    public void initTwilio() {
        if (enabled && accountSid != null && authToken != null) {
            try {
                Twilio.init(accountSid, authToken);
                log.info("Twilio SDK initialized successfully (Master Account). Phone: {}, Multi-tenant: {}",
                        maskPhoneNumber(phoneNumber), multiTenant);
            } catch (Exception e) {
                log.error("Failed to initialize Twilio SDK: {}", e.getMessage());
            }
        } else {
            log.warn("Twilio is disabled or credentials not configured");
        }
    }

    /**
     * Re-initialize Twilio with master account credentials
     * (Used after sending messages via subaccounts)
     */
    public void reinitMasterAccount() {
        if (enabled && accountSid != null && authToken != null) {
            Twilio.init(accountSid, authToken);
        }
    }

    /**
     * Check if Twilio is properly configured and enabled
     */
    public boolean isConfigured() {
        return enabled &&
               accountSid != null && !accountSid.isEmpty() &&
               authToken != null && !authToken.isEmpty() &&
               phoneNumber != null && !phoneNumber.isEmpty();
    }

    /**
     * Check if WhatsApp is configured
     */
    public boolean isWhatsAppConfigured() {
        return isConfigured() && whatsappNumber != null && !whatsappNumber.isEmpty();
    }

    /**
     * Mask phone number for logging (show last 4 digits only)
     */
    private String maskPhoneNumber(String phone) {
        if (phone == null || phone.length() < 4) {
            return "****";
        }
        return "***" + phone.substring(phone.length() - 4);
    }
}
