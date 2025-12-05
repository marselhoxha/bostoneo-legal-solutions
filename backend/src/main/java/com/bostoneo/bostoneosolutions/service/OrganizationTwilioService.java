package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.SmsResponseDTO;
import com.bostoneo.bostoneosolutions.model.Organization;

import java.util.Map;

/**
 * Service for managing Twilio subaccounts and organization-specific communications.
 * Each organization (law firm) can have its own Twilio subaccount with dedicated phone number.
 */
public interface OrganizationTwilioService {

    /**
     * Provision a new Twilio subaccount for an organization
     * @param organizationId The organization ID
     * @param friendlyName A friendly name for the subaccount (usually org name)
     * @return The updated organization with Twilio settings
     */
    Organization provisionSubaccount(Long organizationId, String friendlyName);

    /**
     * Purchase and assign a phone number to an organization's subaccount
     * @param organizationId The organization ID
     * @param areaCode Preferred area code (e.g., "617" for Boston)
     * @return The purchased phone number
     */
    String purchasePhoneNumber(Long organizationId, String areaCode);

    /**
     * Deprovision (close) an organization's Twilio subaccount
     * @param organizationId The organization ID
     */
    void deprovisionSubaccount(Long organizationId);

    /**
     * Send SMS using the organization's Twilio subaccount
     * @param organizationId The organization ID
     * @param to Recipient phone number
     * @param message The message content
     * @return SmsResponseDTO with status
     */
    SmsResponseDTO sendSms(Long organizationId, String to, String message);

    /**
     * Send SMS using organization context (auto-detect organization from user)
     * @param organization The organization entity
     * @param to Recipient phone number
     * @param message The message content
     * @return SmsResponseDTO with status
     */
    SmsResponseDTO sendSms(Organization organization, String to, String message);

    /**
     * Send templated SMS using the organization's Twilio subaccount
     * @param organizationId The organization ID
     * @param to Recipient phone number
     * @param templateCode The template code
     * @param params Template parameters
     * @return SmsResponseDTO with status
     */
    SmsResponseDTO sendTemplatedSms(Long organizationId, String to, String templateCode, Map<String, String> params);

    /**
     * Send WhatsApp message using the organization's Twilio subaccount
     * @param organizationId The organization ID
     * @param to Recipient WhatsApp number
     * @param message The message content
     * @return SmsResponseDTO with status
     */
    SmsResponseDTO sendWhatsApp(Long organizationId, String to, String message);

    /**
     * Get Twilio usage statistics for an organization
     * @param organizationId The organization ID
     * @return Map of usage statistics
     */
    Map<String, Object> getUsageStats(Long organizationId);

    /**
     * Check if an organization has Twilio configured and enabled
     * @param organizationId The organization ID
     * @return true if Twilio is configured for the organization
     */
    boolean isTwilioConfigured(Long organizationId);

    /**
     * Test SMS sending for an organization (send test message)
     * @param organizationId The organization ID
     * @param testPhoneNumber Phone number to send test to
     * @return SmsResponseDTO with status
     */
    SmsResponseDTO sendTestSms(Long organizationId, String testPhoneNumber);

    /**
     * Update Twilio settings for an organization (manual configuration)
     * @param organizationId The organization ID
     * @param subaccountSid Twilio subaccount SID
     * @param authToken Twilio auth token
     * @param phoneNumber Twilio phone number
     * @param whatsappNumber Twilio WhatsApp number (optional)
     * @return The updated organization
     */
    Organization updateTwilioSettings(Long organizationId, String subaccountSid, String authToken,
                                       String phoneNumber, String whatsappNumber);

    /**
     * Disable Twilio for an organization
     * @param organizationId The organization ID
     * @return The updated organization
     */
    Organization disableTwilio(Long organizationId);
}
