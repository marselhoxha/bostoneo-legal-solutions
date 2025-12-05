package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.config.TwilioConfig;
import com.bostoneo.bostoneosolutions.dto.SmsResponseDTO;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import com.bostoneo.bostoneosolutions.service.OrganizationTwilioService;
import com.twilio.Twilio;
import com.twilio.rest.api.v2010.Account;
import com.twilio.rest.api.v2010.account.IncomingPhoneNumber;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.rest.api.v2010.account.AvailablePhoneNumberCountry;
import com.twilio.rest.api.v2010.account.availablephonenumbercountry.Local;
import com.twilio.type.PhoneNumber;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Implementation of OrganizationTwilioService for multi-tenant Twilio communications.
 * Uses Twilio subaccounts to isolate each organization's communications.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class OrganizationTwilioServiceImpl implements OrganizationTwilioService {

    private final TwilioConfig twilioConfig;
    private final OrganizationRepository organizationRepository;

    // E.164 phone number pattern
    private static final Pattern E164_PATTERN = Pattern.compile("^\\+[1-9]\\d{1,14}$");

    @Override
    public Organization provisionSubaccount(Long organizationId, String friendlyName) {
        log.info("Provisioning Twilio subaccount for organization ID: {}", organizationId);

        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ApiException("Organization not found: " + organizationId));

        if (org.getTwilioSubaccountSid() != null && !org.getTwilioSubaccountSid().isEmpty()) {
            throw new ApiException("Organization already has a Twilio subaccount");
        }

        try {
            // Initialize with master account credentials
            initMasterAccount();

            // Create subaccount
            Account subaccount = Account.creator()
                    .setFriendlyName(friendlyName != null ? friendlyName : org.getName())
                    .create();

            log.info("Created Twilio subaccount: {} for org: {}", subaccount.getSid(), org.getName());

            // Update organization with subaccount details
            org.setTwilioSubaccountSid(subaccount.getSid());
            org.setTwilioAuthTokenEncrypted(subaccount.getAuthToken()); // TODO: Encrypt this
            org.setTwilioFriendlyName(friendlyName != null ? friendlyName : org.getName());
            org.setTwilioEnabled(true);
            org.setTwilioProvisionedAt(LocalDateTime.now());

            return organizationRepository.save(org);

        } catch (com.twilio.exception.ApiException e) {
            log.error("Twilio API error creating subaccount: {} (Code: {})", e.getMessage(), e.getCode());
            throw new ApiException("Failed to create Twilio subaccount: " + e.getMessage());
        } catch (Exception e) {
            log.error("Error creating Twilio subaccount: {}", e.getMessage());
            throw new ApiException("Failed to create Twilio subaccount: " + e.getMessage());
        }
    }

    @Override
    public String purchasePhoneNumber(Long organizationId, String areaCode) {
        log.info("Purchasing phone number for organization ID: {} with area code: {}", organizationId, areaCode);

        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ApiException("Organization not found: " + organizationId));

        if (!org.isTwilioConfigured()) {
            throw new ApiException("Twilio is not configured for this organization. Please provision a subaccount first.");
        }

        try {
            // Initialize with subaccount credentials
            initSubaccount(org);

            // Search for available numbers
            var availableNumbers = Local.reader("US")
                    .setAreaCode(areaCode != null ? Integer.parseInt(areaCode) : null)
                    .setSmsEnabled(true)
                    .setVoiceEnabled(true)
                    .limit(1)
                    .read();

            if (!availableNumbers.iterator().hasNext()) {
                throw new ApiException("No phone numbers available for area code: " + areaCode);
            }

            Local availableNumber = availableNumbers.iterator().next();

            // Purchase the number
            IncomingPhoneNumber purchasedNumber = IncomingPhoneNumber.creator(availableNumber.getPhoneNumber())
                    .setFriendlyName(org.getName() + " - Main Line")
                    .create();

            log.info("Purchased phone number: {} for org: {}", purchasedNumber.getPhoneNumber(), org.getName());

            // Update organization
            org.setTwilioPhoneNumber(purchasedNumber.getPhoneNumber().toString());
            organizationRepository.save(org);

            return purchasedNumber.getPhoneNumber().toString();

        } catch (com.twilio.exception.ApiException e) {
            log.error("Twilio API error purchasing phone number: {} (Code: {})", e.getMessage(), e.getCode());
            throw new ApiException("Failed to purchase phone number: " + e.getMessage());
        } catch (Exception e) {
            log.error("Error purchasing phone number: {}", e.getMessage());
            throw new ApiException("Failed to purchase phone number: " + e.getMessage());
        }
    }

    @Override
    public void deprovisionSubaccount(Long organizationId) {
        log.info("Deprovisioning Twilio subaccount for organization ID: {}", organizationId);

        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ApiException("Organization not found: " + organizationId));

        if (org.getTwilioSubaccountSid() == null || org.getTwilioSubaccountSid().isEmpty()) {
            throw new ApiException("Organization does not have a Twilio subaccount");
        }

        try {
            // Initialize with master account
            initMasterAccount();

            // Close the subaccount (sets status to closed)
            Account.updater(org.getTwilioSubaccountSid())
                    .setStatus(Account.Status.CLOSED)
                    .update();

            log.info("Closed Twilio subaccount: {} for org: {}", org.getTwilioSubaccountSid(), org.getName());

            // Clear organization Twilio settings
            org.setTwilioSubaccountSid(null);
            org.setTwilioAuthTokenEncrypted(null);
            org.setTwilioPhoneNumber(null);
            org.setTwilioWhatsappNumber(null);
            org.setTwilioFriendlyName(null);
            org.setTwilioEnabled(false);
            org.setTwilioProvisionedAt(null);

            organizationRepository.save(org);

        } catch (com.twilio.exception.ApiException e) {
            log.error("Twilio API error deprovisioning subaccount: {} (Code: {})", e.getMessage(), e.getCode());
            throw new ApiException("Failed to deprovision Twilio subaccount: " + e.getMessage());
        }
    }

    @Override
    public SmsResponseDTO sendSms(Long organizationId, String to, String message) {
        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ApiException("Organization not found: " + organizationId));
        return sendSms(org, to, message);
    }

    @Override
    public SmsResponseDTO sendSms(Organization org, String to, String message) {
        if (!org.isTwilioConfigured()) {
            log.warn("Twilio not configured for organization: {}", org.getName());
            return SmsResponseDTO.failure("Twilio not configured for this organization", "TWILIO_NOT_CONFIGURED");
        }

        if (!org.getSmsEnabled()) {
            log.warn("SMS disabled for organization: {}", org.getName());
            return SmsResponseDTO.failure("SMS is disabled for this organization", "SMS_DISABLED");
        }

        String formattedPhone = formatPhoneNumber(to);
        if (formattedPhone == null) {
            return SmsResponseDTO.failure("Invalid phone number format", "INVALID_PHONE");
        }

        try {
            // Initialize with organization's subaccount
            initSubaccount(org);

            Message twilioMessage = Message.creator(
                    new PhoneNumber(formattedPhone),
                    new PhoneNumber(org.getTwilioPhoneNumber()),
                    message
            ).create();

            log.info("SMS sent via org '{}'. SID: {}, To: {}, Status: {}",
                    org.getName(), twilioMessage.getSid(), maskPhone(formattedPhone), twilioMessage.getStatus());

            return SmsResponseDTO.success(twilioMessage.getSid(), twilioMessage.getStatus().toString());

        } catch (com.twilio.exception.ApiException e) {
            log.error("Twilio API error (org: {}): {} (Code: {})", org.getName(), e.getMessage(), e.getCode());
            return SmsResponseDTO.failure(e.getMessage(), String.valueOf(e.getCode()));
        } catch (Exception e) {
            log.error("Error sending SMS (org: {}): {}", org.getName(), e.getMessage());
            return SmsResponseDTO.failure(e.getMessage(), "UNKNOWN_ERROR");
        }
    }

    @Override
    public SmsResponseDTO sendTemplatedSms(Long organizationId, String to, String templateCode, Map<String, String> params) {
        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ApiException("Organization not found: " + organizationId));

        String message = buildMessageFromTemplate(org, templateCode, params);
        if (message == null) {
            return SmsResponseDTO.failure("Template not found: " + templateCode, "TEMPLATE_NOT_FOUND");
        }

        return sendSms(org, to, message);
    }

    @Override
    public SmsResponseDTO sendWhatsApp(Long organizationId, String to, String message) {
        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ApiException("Organization not found: " + organizationId));

        if (!org.canSendWhatsapp()) {
            return SmsResponseDTO.failure("WhatsApp not configured for this organization", "WHATSAPP_NOT_CONFIGURED");
        }

        String formattedPhone = formatPhoneNumber(to);
        if (formattedPhone == null) {
            return SmsResponseDTO.failure("Invalid phone number format", "INVALID_PHONE");
        }

        try {
            initSubaccount(org);

            Message twilioMessage = Message.creator(
                    new PhoneNumber("whatsapp:" + formattedPhone),
                    new PhoneNumber("whatsapp:" + org.getTwilioWhatsappNumber()),
                    message
            ).create();

            log.info("WhatsApp sent via org '{}'. SID: {}, To: {}",
                    org.getName(), twilioMessage.getSid(), maskPhone(formattedPhone));

            return SmsResponseDTO.success(twilioMessage.getSid(), twilioMessage.getStatus().toString());

        } catch (com.twilio.exception.ApiException e) {
            log.error("Twilio WhatsApp error (org: {}): {} (Code: {})", org.getName(), e.getMessage(), e.getCode());
            return SmsResponseDTO.failure(e.getMessage(), String.valueOf(e.getCode()));
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getUsageStats(Long organizationId) {
        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ApiException("Organization not found: " + organizationId));

        Map<String, Object> stats = new HashMap<>();
        stats.put("organizationId", organizationId);
        stats.put("organizationName", org.getName());
        stats.put("twilioEnabled", org.getTwilioEnabled());
        stats.put("twilioConfigured", org.isTwilioConfigured());
        stats.put("phoneNumber", org.getTwilioPhoneNumber());
        stats.put("whatsappNumber", org.getTwilioWhatsappNumber());
        stats.put("provisionedAt", org.getTwilioProvisionedAt());

        // TODO: Fetch actual usage from Twilio API
        // For now, return basic info
        stats.put("smsEnabled", org.getSmsEnabled());
        stats.put("whatsappEnabled", org.getWhatsappEnabled());

        return stats;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isTwilioConfigured(Long organizationId) {
        return organizationRepository.findById(organizationId)
                .map(Organization::isTwilioConfigured)
                .orElse(false);
    }

    @Override
    public SmsResponseDTO sendTestSms(Long organizationId, String testPhoneNumber) {
        String testMessage = "Test message from Bostoneo Legal Platform. If you received this, SMS is configured correctly!";
        return sendSms(organizationId, testPhoneNumber, testMessage);
    }

    @Override
    public Organization updateTwilioSettings(Long organizationId, String subaccountSid, String authToken,
                                              String phoneNumber, String whatsappNumber) {
        log.info("Manually updating Twilio settings for organization ID: {}", organizationId);

        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ApiException("Organization not found: " + organizationId));

        org.setTwilioSubaccountSid(subaccountSid);
        org.setTwilioAuthTokenEncrypted(authToken); // TODO: Encrypt
        org.setTwilioPhoneNumber(phoneNumber);
        org.setTwilioWhatsappNumber(whatsappNumber);
        org.setTwilioEnabled(true);
        org.setTwilioProvisionedAt(LocalDateTime.now());

        return organizationRepository.save(org);
    }

    @Override
    public Organization disableTwilio(Long organizationId) {
        log.info("Disabling Twilio for organization ID: {}", organizationId);

        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ApiException("Organization not found: " + organizationId));

        org.setTwilioEnabled(false);
        return organizationRepository.save(org);
    }

    // ==================== Private Helper Methods ====================

    /**
     * Initialize Twilio with master account credentials (for subaccount management)
     */
    private void initMasterAccount() {
        Twilio.init(twilioConfig.getAccountSid(), twilioConfig.getAuthToken());
    }

    /**
     * Initialize Twilio with organization's subaccount credentials
     */
    private void initSubaccount(Organization org) {
        if (org.getTwilioSubaccountSid() == null || org.getTwilioAuthTokenEncrypted() == null) {
            throw new ApiException("Twilio subaccount not configured for organization: " + org.getName());
        }
        Twilio.init(org.getTwilioSubaccountSid(), org.getTwilioAuthTokenEncrypted());
    }

    /**
     * Build message from template, using organization's custom templates if available
     */
    private String buildMessageFromTemplate(Organization org, String templateCode, Map<String, String> params) {
        String template = null;

        // Check for organization-specific templates first
        switch (templateCode.toUpperCase()) {
            case "SIGNATURE_REQUEST":
                template = org.getSmsTemplateSignatureRequest();
                if (template == null || template.isEmpty()) {
                    template = "Hi {signer_name}, {org_name} has sent you a document to sign: '{doc_title}'. Please sign by {expiry_date}. Sign here: {signing_link}";
                }
                break;
            case "SIGNATURE_REMINDER":
                template = org.getSmsTemplateSignatureReminder();
                if (template == null || template.isEmpty()) {
                    template = "Reminder: You have a document '{doc_title}' from {org_name} pending your signature. Expires on {expiry_date}. Sign now: {signing_link}";
                }
                break;
            case "SIGNATURE_COMPLETED":
                template = org.getSmsTemplateSignatureCompleted();
                if (template == null || template.isEmpty()) {
                    template = "Good news! The document '{doc_title}' has been signed by all parties. You can download your copy from your portal.";
                }
                break;
            case "APPOINTMENT_REMINDER":
                template = "Hi {clientName}, reminder: {appointmentTitle} on {date} at {time}. - {org_name}";
                break;
            case "CASE_UPDATE":
                template = "Hi {clientName}, update on case #{caseNumber}: {message}. Log in for details. - {org_name}";
                break;
            default:
                return null;
        }

        // Replace placeholders
        String message = template;

        // Add organization name to params if not present
        if (!params.containsKey("org_name")) {
            params.put("org_name", org.getName());
        }

        for (Map.Entry<String, String> entry : params.entrySet()) {
            message = message.replace("{" + entry.getKey() + "}", entry.getValue() != null ? entry.getValue() : "");
        }

        return message;
    }

    /**
     * Format phone number to E.164 format
     */
    private String formatPhoneNumber(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
            return null;
        }

        String cleaned = phoneNumber.trim();
        boolean hasPlus = cleaned.startsWith("+");
        cleaned = cleaned.replaceAll("[^\\d]", "");

        if (cleaned.isEmpty()) {
            return null;
        }

        if (hasPlus) {
            String e164 = "+" + cleaned;
            if (E164_PATTERN.matcher(e164).matches()) {
                return e164;
            }
        }

        // Assume US number if 10 digits
        if (cleaned.length() == 10) {
            return "+1" + cleaned;
        }

        // If 11 digits starting with 1, assume US
        if (cleaned.length() == 11 && cleaned.startsWith("1")) {
            return "+" + cleaned;
        }

        String withPlus = "+" + cleaned;
        if (E164_PATTERN.matcher(withPlus).matches()) {
            return withPlus;
        }

        return null;
    }

    /**
     * Mask phone number for logging
     */
    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) {
            return "****";
        }
        return "***" + phone.substring(phone.length() - 4);
    }
}
