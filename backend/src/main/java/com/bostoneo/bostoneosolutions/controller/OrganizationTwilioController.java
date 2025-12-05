package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.SmsResponseDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.service.OrganizationTwilioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

import static java.time.LocalDateTime.now;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/organizations/{organizationId}/twilio")
@RequiredArgsConstructor
@Slf4j
public class OrganizationTwilioController {

    private final OrganizationTwilioService organizationTwilioService;

    /**
     * Provision a new Twilio subaccount for an organization
     */
    @PostMapping("/provision")
    @PreAuthorize("hasRole('ROLE_SYSADMIN') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<HttpResponse> provisionSubaccount(
            @PathVariable Long organizationId,
            @RequestParam(required = false) String friendlyName) {

        log.info("Provisioning Twilio subaccount for organization ID: {}", organizationId);
        Organization org = organizationTwilioService.provisionSubaccount(organizationId, friendlyName);

        return ResponseEntity.status(CREATED).body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of(
                                "organization", org,
                                "subaccountSid", org.getTwilioSubaccountSid()
                        ))
                        .message("Twilio subaccount provisioned successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build()
        );
    }

    /**
     * Purchase a phone number for an organization
     */
    @PostMapping("/purchase-number")
    @PreAuthorize("hasRole('ROLE_SYSADMIN') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<HttpResponse> purchasePhoneNumber(
            @PathVariable Long organizationId,
            @RequestParam(required = false, defaultValue = "617") String areaCode) {

        log.info("Purchasing phone number for organization ID: {} with area code: {}", organizationId, areaCode);
        String phoneNumber = organizationTwilioService.purchasePhoneNumber(organizationId, areaCode);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("phoneNumber", phoneNumber))
                        .message("Phone number purchased successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Deprovision (close) an organization's Twilio subaccount
     */
    @DeleteMapping("/deprovision")
    @PreAuthorize("hasRole('ROLE_SYSADMIN')")
    public ResponseEntity<HttpResponse> deprovisionSubaccount(@PathVariable Long organizationId) {
        log.info("Deprovisioning Twilio subaccount for organization ID: {}", organizationId);
        organizationTwilioService.deprovisionSubaccount(organizationId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Twilio subaccount deprovisioned successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get Twilio status and usage for an organization
     */
    @GetMapping("/status")
    @PreAuthorize("hasRole('ROLE_SYSADMIN') or hasRole('ROLE_ADMIN') or hasAuthority('organization:read')")
    public ResponseEntity<HttpResponse> getTwilioStatus(@PathVariable Long organizationId) {
        Map<String, Object> stats = organizationTwilioService.getUsageStats(organizationId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(stats)
                        .message("Twilio status retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Send a test SMS from an organization's Twilio account
     */
    @PostMapping("/test-sms")
    @PreAuthorize("hasRole('ROLE_SYSADMIN') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<HttpResponse> sendTestSms(
            @PathVariable Long organizationId,
            @RequestParam String phoneNumber) {

        log.info("Sending test SMS for organization ID: {} to: {}", organizationId, phoneNumber);
        SmsResponseDTO response = organizationTwilioService.sendTestSms(organizationId, phoneNumber);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("smsResponse", response))
                        .message(response.isSuccess() ? "Test SMS sent successfully" : "Failed to send test SMS")
                        .status(response.isSuccess() ? OK : BAD_REQUEST)
                        .statusCode(response.isSuccess() ? OK.value() : BAD_REQUEST.value())
                        .build()
        );
    }

    /**
     * Manually update Twilio settings for an organization
     * (for cases where subaccount is created externally)
     */
    @PutMapping("/settings")
    @PreAuthorize("hasRole('ROLE_SYSADMIN') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<HttpResponse> updateTwilioSettings(
            @PathVariable Long organizationId,
            @RequestParam String subaccountSid,
            @RequestParam String authToken,
            @RequestParam String phoneNumber,
            @RequestParam(required = false) String whatsappNumber) {

        log.info("Updating Twilio settings for organization ID: {}", organizationId);
        Organization org = organizationTwilioService.updateTwilioSettings(
                organizationId, subaccountSid, authToken, phoneNumber, whatsappNumber);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("organization", org))
                        .message("Twilio settings updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Disable Twilio for an organization
     */
    @PutMapping("/disable")
    @PreAuthorize("hasRole('ROLE_SYSADMIN') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<HttpResponse> disableTwilio(@PathVariable Long organizationId) {
        log.info("Disabling Twilio for organization ID: {}", organizationId);
        Organization org = organizationTwilioService.disableTwilio(organizationId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("organization", org))
                        .message("Twilio disabled successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Enable Twilio for an organization (if already configured)
     */
    @PutMapping("/enable")
    @PreAuthorize("hasRole('ROLE_SYSADMIN') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<HttpResponse> enableTwilio(@PathVariable Long organizationId) {
        log.info("Enabling Twilio for organization ID: {}", organizationId);

        // Re-enable by updating settings (this will set enabled to true)
        Map<String, Object> stats = organizationTwilioService.getUsageStats(organizationId);

        if (stats.get("twilioConfigured").equals(false)) {
            return ResponseEntity.status(BAD_REQUEST).body(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Twilio is not configured for this organization. Please configure settings first.")
                            .status(BAD_REQUEST)
                            .statusCode(BAD_REQUEST.value())
                            .build()
            );
        }

        // Get current settings and re-apply to enable
        Organization org = organizationTwilioService.updateTwilioSettings(
                organizationId,
                (String) stats.get("subaccountSid"),
                null, // Keep existing token
                (String) stats.get("phoneNumber"),
                (String) stats.get("whatsappNumber")
        );

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("organization", org))
                        .message("Twilio enabled successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }
}
