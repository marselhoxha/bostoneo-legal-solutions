package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.config.TwilioConfig;
import com.bostoneo.bostoneosolutions.dto.CommunicationLogDTO;
import com.bostoneo.bostoneosolutions.dto.IncomingSmsDTO;
import com.bostoneo.bostoneosolutions.dto.SmsRequestDTO;
import com.bostoneo.bostoneosolutions.dto.SmsResponseDTO;
import com.bostoneo.bostoneosolutions.model.CommunicationLog;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import com.bostoneo.bostoneosolutions.service.CommunicationLogService;
import com.bostoneo.bostoneosolutions.service.IncomingSmsService;
import com.bostoneo.bostoneosolutions.service.TwilioService;
import com.twilio.security.RequestValidator;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static java.time.LocalDateTime.now;

/**
 * REST Controller for SMS/WhatsApp communications and communication logs
 */
@RestController
@RequestMapping("/api/communications")
@RequiredArgsConstructor
@Slf4j
public class CommunicationController {

    private final TwilioService twilioService;
    private final CommunicationLogService communicationLogService;
    private final IncomingSmsService incomingSmsService;
    private final TwilioConfig twilioConfig;
    private final OrganizationRepository organizationRepository;

    /**
     * Send an SMS message
     */
    @PostMapping("/sms/send")
    public ResponseEntity<HttpResponse> sendSms(
            @RequestBody SmsRequestDTO request,
            @AuthenticationPrincipal UserDetails userDetails) {

        log.info("SMS send request received. To: {}, UserId: {}",
                maskPhone(request.getTo()), request.getUserId());

        // Set sender info if available
        if (userDetails != null) {
            request.setSentByUserName(userDetails.getUsername());
        }

        SmsResponseDTO response = twilioService.sendSms(request.getTo(), request.getMessage());

        // Log the communication
        if (twilioConfig.isConfigured()) {
            CommunicationLog logEntry = communicationLogService.logSms(
                    request, response, twilioConfig.getPhoneNumber());
            response.setCommunicationLogId(logEntry.getId());
        }

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("result", response))
                        .message(response.isSuccess() ? "SMS sent successfully" : "Failed to send SMS")
                        .status(response.isSuccess() ? HttpStatus.OK : HttpStatus.BAD_REQUEST)
                        .statusCode(response.isSuccess() ? HttpStatus.OK.value() : HttpStatus.BAD_REQUEST.value())
                        .build()
        );
    }

    /**
     * Send SMS using a template
     */
    @PostMapping("/sms/send-template")
    public ResponseEntity<HttpResponse> sendTemplatedSms(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserDetails userDetails) {

        String to = (String) request.get("to");
        String templateCode = (String) request.get("templateCode");
        @SuppressWarnings("unchecked")
        Map<String, String> params = (Map<String, String>) request.get("params");

        log.info("Templated SMS request. To: {}, Template: {}", maskPhone(to), templateCode);

        SmsResponseDTO response = twilioService.sendTemplatedSms(to, templateCode, params);

        // Log the communication
        if (twilioConfig.isConfigured()) {
            SmsRequestDTO logRequest = SmsRequestDTO.builder()
                    .to(to)
                    .templateCode(templateCode)
                    .sentByUserName(userDetails != null ? userDetails.getUsername() : null)
                    .build();
            communicationLogService.logSms(logRequest, response, twilioConfig.getPhoneNumber());
        }

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("result", response))
                        .message(response.isSuccess() ? "SMS sent successfully" : "Failed to send SMS")
                        .status(response.isSuccess() ? HttpStatus.OK : HttpStatus.BAD_REQUEST)
                        .statusCode(response.isSuccess() ? HttpStatus.OK.value() : HttpStatus.BAD_REQUEST.value())
                        .build()
        );
    }

    /**
     * Send WhatsApp message
     */
    @PostMapping("/whatsapp/send")
    public ResponseEntity<HttpResponse> sendWhatsApp(
            @RequestBody SmsRequestDTO request,
            @AuthenticationPrincipal UserDetails userDetails) {

        log.info("WhatsApp send request received. To: {}", maskPhone(request.getTo()));

        if (userDetails != null) {
            request.setSentByUserName(userDetails.getUsername());
        }

        SmsResponseDTO response = twilioService.sendWhatsApp(request.getTo(), request.getMessage());

        // Log the communication
        if (twilioConfig.isWhatsAppConfigured()) {
            CommunicationLog logEntry = communicationLogService.logWhatsApp(
                    request, response, twilioConfig.getWhatsappNumber());
            response.setCommunicationLogId(logEntry.getId());
        }

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("result", response))
                        .message(response.isSuccess() ? "WhatsApp message sent" : "Failed to send WhatsApp message")
                        .status(response.isSuccess() ? HttpStatus.OK : HttpStatus.BAD_REQUEST)
                        .statusCode(response.isSuccess() ? HttpStatus.OK.value() : HttpStatus.BAD_REQUEST.value())
                        .build()
        );
    }

    /**
     * Get communication logs by client
     */
    @GetMapping("/logs/client/{clientId}")
    public ResponseEntity<HttpResponse> getLogsByClient(
            @PathVariable Long clientId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<CommunicationLogDTO> logs = communicationLogService.getByClientId(clientId, pageable);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of(
                                "logs", logs.getContent(),
                                "totalElements", logs.getTotalElements(),
                                "totalPages", logs.getTotalPages(),
                                "currentPage", logs.getNumber()
                        ))
                        .message("Communication logs retrieved")
                        .status(HttpStatus.OK)
                        .statusCode(HttpStatus.OK.value())
                        .build()
        );
    }

    /**
     * Get communication logs by case
     */
    @GetMapping("/logs/case/{caseId}")
    public ResponseEntity<HttpResponse> getLogsByCase(
            @PathVariable Long caseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<CommunicationLogDTO> logs = communicationLogService.getByCaseId(caseId, pageable);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of(
                                "logs", logs.getContent(),
                                "totalElements", logs.getTotalElements(),
                                "totalPages", logs.getTotalPages(),
                                "currentPage", logs.getNumber()
                        ))
                        .message("Communication logs retrieved")
                        .status(HttpStatus.OK)
                        .statusCode(HttpStatus.OK.value())
                        .build()
        );
    }

    /**
     * Get recent communications for a client
     */
    @GetMapping("/logs/client/{clientId}/recent")
    public ResponseEntity<HttpResponse> getRecentLogsByClient(@PathVariable Long clientId) {
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("logs", communicationLogService.getRecentByClientId(clientId)))
                        .message("Recent communication logs retrieved")
                        .status(HttpStatus.OK)
                        .statusCode(HttpStatus.OK.value())
                        .build()
        );
    }

    /**
     * Get communication statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<HttpResponse> getStatistics(
            @RequestParam(defaultValue = "30") int days) {

        LocalDateTime since = LocalDateTime.now().minusDays(days);
        Map<String, Object> stats = communicationLogService.getStatistics(since);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("statistics", stats))
                        .message("Communication statistics retrieved")
                        .status(HttpStatus.OK)
                        .statusCode(HttpStatus.OK.value())
                        .build()
        );
    }

    /**
     * Search communication logs
     */
    @GetMapping("/logs/search")
    public ResponseEntity<HttpResponse> searchLogs(
            @RequestParam String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<CommunicationLogDTO> logs = communicationLogService.search(query, pageable);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of(
                                "logs", logs.getContent(),
                                "totalElements", logs.getTotalElements(),
                                "totalPages", logs.getTotalPages(),
                                "currentPage", logs.getNumber()
                        ))
                        .message("Search results retrieved")
                        .status(HttpStatus.OK)
                        .statusCode(HttpStatus.OK.value())
                        .build()
        );
    }

    /**
     * Check Twilio service status
     */
    @GetMapping("/status")
    public ResponseEntity<HttpResponse> getServiceStatus() {
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of(
                                "smsEnabled", twilioService.isAvailable(),
                                "whatsappEnabled", twilioConfig.isWhatsAppConfigured(),
                                "failedCount", communicationLogService.getFailedCount()
                        ))
                        .message("Service status retrieved")
                        .status(HttpStatus.OK)
                        .statusCode(HttpStatus.OK.value())
                        .build()
        );
    }

    /**
     * Twilio webhook for incoming SMS messages.
     * This endpoint receives SMS from clients when they reply to our messages.
     * Twilio sends form-urlencoded POST requests.
     *
     * SECURITY: This endpoint validates Twilio signature and sets tenant context from phone number.
     */
    @PostMapping(value = "/webhook/incoming", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<String> handleIncomingSms(
            HttpServletRequest request,
            @RequestHeader(value = "X-Twilio-Signature", required = false) String twilioSignature,
            @RequestParam("MessageSid") String messageSid,
            @RequestParam("AccountSid") String accountSid,
            @RequestParam("From") String from,
            @RequestParam("To") String to,
            @RequestParam("Body") String body,
            @RequestParam(value = "SmsSid", required = false) String smsSid,
            @RequestParam(value = "MessagingServiceSid", required = false) String messagingServiceSid,
            @RequestParam(value = "FromCity", required = false) String fromCity,
            @RequestParam(value = "FromState", required = false) String fromState,
            @RequestParam(value = "FromZip", required = false) String fromZip,
            @RequestParam(value = "FromCountry", required = false) String fromCountry,
            @RequestParam(value = "ToCity", required = false) String toCity,
            @RequestParam(value = "ToState", required = false) String toState,
            @RequestParam(value = "ToZip", required = false) String toZip,
            @RequestParam(value = "ToCountry", required = false) String toCountry,
            @RequestParam(value = "NumMedia", required = false) Integer numMedia,
            @RequestParam(value = "NumSegments", required = false) Integer numSegments,
            @RequestParam(value = "MediaContentType0", required = false) String mediaContentType0,
            @RequestParam(value = "MediaUrl0", required = false) String mediaUrl0,
            @RequestParam(value = "ApiVersion", required = false) String apiVersion) {

        log.info("Incoming SMS webhook received. From: {}, To: {}, MessageSid: {}", maskPhone(from), maskPhone(to), messageSid);

        try {
            // SECURITY: Verify Twilio signature if auth token is configured
            String authToken = twilioConfig.getAuthToken();
            if (authToken != null && !authToken.isEmpty()) {
                if (twilioSignature == null || twilioSignature.isEmpty()) {
                    log.error("SECURITY: Twilio webhook received without X-Twilio-Signature header");
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .contentType(MediaType.APPLICATION_XML)
                            .body("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Message>Unauthorized</Message></Response>");
                }

                // Build params map for signature validation
                Map<String, String> params = new HashMap<>();
                params.put("MessageSid", messageSid);
                params.put("AccountSid", accountSid);
                params.put("From", from);
                params.put("To", to);
                params.put("Body", body);
                if (smsSid != null) params.put("SmsSid", smsSid);
                if (messagingServiceSid != null) params.put("MessagingServiceSid", messagingServiceSid);
                if (fromCity != null) params.put("FromCity", fromCity);
                if (fromState != null) params.put("FromState", fromState);
                if (fromZip != null) params.put("FromZip", fromZip);
                if (fromCountry != null) params.put("FromCountry", fromCountry);
                if (toCity != null) params.put("ToCity", toCity);
                if (toState != null) params.put("ToState", toState);
                if (toZip != null) params.put("ToZip", toZip);
                if (toCountry != null) params.put("ToCountry", toCountry);
                if (numMedia != null) params.put("NumMedia", numMedia.toString());
                if (numSegments != null) params.put("NumSegments", numSegments.toString());
                if (mediaContentType0 != null) params.put("MediaContentType0", mediaContentType0);
                if (mediaUrl0 != null) params.put("MediaUrl0", mediaUrl0);
                if (apiVersion != null) params.put("ApiVersion", apiVersion);

                String requestUrl = request.getRequestURL().toString();
                RequestValidator validator = new RequestValidator(authToken);

                if (!validator.validate(requestUrl, params, twilioSignature)) {
                    log.error("SECURITY: Twilio webhook signature verification FAILED for URL: {}", requestUrl);
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .contentType(MediaType.APPLICATION_XML)
                            .body("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Message>Invalid signature</Message></Response>");
                }
                log.debug("Twilio webhook signature verified successfully");
            } else {
                log.warn("SECURITY: Twilio auth token not configured - signature verification skipped");
            }

            // SECURITY: Set tenant context from the "To" phone number (organization's Twilio number)
            String normalizedTo = to.replaceAll("[^+0-9]", "");
            Optional<Organization> orgOpt = organizationRepository.findByTwilioPhoneNumber(to, normalizedTo);

            if (orgOpt.isPresent()) {
                TenantContext.setCurrentTenant(orgOpt.get().getId());
                log.info("Set tenant context to organization {} for Twilio number {}", orgOpt.get().getId(), maskPhone(to));
            } else {
                log.warn("SECURITY: No organization found for Twilio phone number: {} - cannot set tenant context", maskPhone(to));
                // Continue processing but log the issue - the service will handle missing context
            }

            // Build the DTO from webhook parameters
            IncomingSmsDTO incomingSms = IncomingSmsDTO.builder()
                    .messageSid(messageSid)
                    .smsSid(smsSid)
                    .accountSid(accountSid)
                    .messagingServiceSid(messagingServiceSid)
                    .from(from)
                    .fromCity(fromCity)
                    .fromState(fromState)
                    .fromZip(fromZip)
                    .fromCountry(fromCountry)
                    .to(to)
                    .toCity(toCity)
                    .toState(toState)
                    .toZip(toZip)
                    .toCountry(toCountry)
                    .body(body)
                    .numMedia(numMedia)
                    .numSegments(numSegments)
                    .mediaContentType0(mediaContentType0)
                    .mediaUrl0(mediaUrl0)
                    .apiVersion(apiVersion)
                    .build();

            // Process the incoming SMS
            CommunicationLog commLog = incomingSmsService.processIncomingSms(incomingSms);
            log.info("Incoming SMS processed successfully. CommLog ID: {}", commLog.getId());

            // Return TwiML response (empty response means no auto-reply)
            String twimlResponse = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>";
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_XML)
                    .body(twimlResponse);

        } catch (Exception e) {
            log.error("Error processing incoming SMS: {}", e.getMessage(), e);
            // Still return OK to Twilio to prevent retries
            String twimlResponse = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>";
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_XML)
                    .body(twimlResponse);
        } finally {
            // Clear tenant context after processing
            TenantContext.clear();
        }
    }

    /**
     * Twilio webhook for status updates.
     * SECURITY: Validates Twilio signature before processing.
     */
    @PostMapping(value = "/webhook/status", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<String> handleStatusWebhook(
            HttpServletRequest request,
            @RequestHeader(value = "X-Twilio-Signature", required = false) String twilioSignature,
            @RequestParam("MessageSid") String messageSid,
            @RequestParam("MessageStatus") String messageStatus,
            @RequestParam(value = "ErrorCode", required = false) String errorCode,
            @RequestParam(value = "ErrorMessage", required = false) String errorMessage,
            @RequestParam(value = "To", required = false) String to,
            @RequestParam(value = "From", required = false) String from) {

        log.info("Twilio status webhook received. SID: {}, Status: {}", messageSid, messageStatus);

        try {
            // SECURITY: Verify Twilio signature if auth token is configured
            String authToken = twilioConfig.getAuthToken();
            if (authToken != null && !authToken.isEmpty()) {
                if (twilioSignature == null || twilioSignature.isEmpty()) {
                    log.error("SECURITY: Twilio status webhook received without X-Twilio-Signature header");
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Unauthorized");
                }

                Map<String, String> params = new HashMap<>();
                params.put("MessageSid", messageSid);
                params.put("MessageStatus", messageStatus);
                if (errorCode != null) params.put("ErrorCode", errorCode);
                if (errorMessage != null) params.put("ErrorMessage", errorMessage);
                if (to != null) params.put("To", to);
                if (from != null) params.put("From", from);

                String requestUrl = request.getRequestURL().toString();
                RequestValidator validator = new RequestValidator(authToken);

                if (!validator.validate(requestUrl, params, twilioSignature)) {
                    log.error("SECURITY: Twilio status webhook signature verification FAILED");
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Invalid signature");
                }
                log.debug("Twilio status webhook signature verified successfully");
            }

            communicationLogService.updateStatus(messageSid, messageStatus.toUpperCase(), errorCode, errorMessage);

            return ResponseEntity.ok("OK");
        } catch (Exception e) {
            log.error("Error processing Twilio status webhook: {}", e.getMessage(), e);
            return ResponseEntity.ok("OK"); // Still return OK to prevent retries
        }
    }

    /**
     * TEST ENDPOINT: Simulate an incoming SMS for development/testing.
     * This allows testing the two-way SMS flow without needing actual Twilio or ngrok.
     *
     * Usage: POST /api/communications/test/simulate-incoming-sms
     * Body: { "fromPhone": "+15551234567", "message": "Test message from client" }
     */
    @PostMapping("/test/simulate-incoming-sms")
    public ResponseEntity<HttpResponse> simulateIncomingSms(
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal UserDetails userDetails) {

        String fromPhone = request.get("fromPhone");
        String message = request.get("message");

        if (fromPhone == null || fromPhone.isEmpty()) {
            return ResponseEntity.badRequest().body(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("fromPhone is required")
                            .status(HttpStatus.BAD_REQUEST)
                            .statusCode(HttpStatus.BAD_REQUEST.value())
                            .build()
            );
        }

        if (message == null || message.isEmpty()) {
            message = "Test SMS message";
        }

        log.info("Simulating incoming SMS from: {}", maskPhone(fromPhone));

        try {
            // Build a simulated IncomingSmsDTO
            IncomingSmsDTO simulatedSms = IncomingSmsDTO.builder()
                    .messageSid("SIM_" + System.currentTimeMillis())
                    .accountSid("TEST_ACCOUNT")
                    .from(fromPhone)
                    .to(twilioConfig.getPhoneNumber() != null ? twilioConfig.getPhoneNumber() : "+15551234567")
                    .body(message)
                    .fromCity("Test City")
                    .fromState("MA")
                    .build();

            // Process the simulated SMS
            CommunicationLog commLog = incomingSmsService.processIncomingSms(simulatedSms);

            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(Map.of(
                                    "communicationLogId", commLog.getId(),
                                    "clientId", commLog.getClientId() != null ? commLog.getClientId() : "UNMATCHED",
                                    "status", commLog.getStatus(),
                                    "message", "Simulated SMS processed successfully"
                            ))
                            .message("Simulated incoming SMS processed")
                            .status(HttpStatus.OK)
                            .statusCode(HttpStatus.OK.value())
                            .build()
            );

        } catch (Exception e) {
            log.error("Error simulating incoming SMS: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Error processing simulated SMS: " + e.getMessage())
                            .status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .statusCode(HttpStatus.INTERNAL_SERVER_ERROR.value())
                            .build()
            );
        }
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return "***" + phone.substring(phone.length() - 4);
    }
}
