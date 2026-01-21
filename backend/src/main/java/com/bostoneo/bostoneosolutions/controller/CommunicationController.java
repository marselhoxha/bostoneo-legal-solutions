package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.config.TwilioConfig;
import com.bostoneo.bostoneosolutions.dto.CommunicationLogDTO;
import com.bostoneo.bostoneosolutions.dto.IncomingSmsDTO;
import com.bostoneo.bostoneosolutions.dto.SmsRequestDTO;
import com.bostoneo.bostoneosolutions.dto.SmsResponseDTO;
import com.bostoneo.bostoneosolutions.model.CommunicationLog;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.CommunicationLogService;
import com.bostoneo.bostoneosolutions.service.IncomingSmsService;
import com.bostoneo.bostoneosolutions.service.TwilioService;
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
import java.util.Map;

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
     */
    @PostMapping(value = "/webhook/incoming", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<String> handleIncomingSms(
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

        log.info("Incoming SMS webhook received. From: {}, MessageSid: {}", maskPhone(from), messageSid);

        try {
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
            log.error("Error processing incoming SMS: {}", e.getMessage());
            // Still return OK to Twilio to prevent retries
            String twimlResponse = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>";
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_XML)
                    .body(twimlResponse);
        }
    }

    /**
     * Twilio webhook for status updates
     */
    @PostMapping("/webhook/status")
    public ResponseEntity<String> handleStatusWebhook(
            @RequestParam("MessageSid") String messageSid,
            @RequestParam("MessageStatus") String messageStatus,
            @RequestParam(value = "ErrorCode", required = false) String errorCode,
            @RequestParam(value = "ErrorMessage", required = false) String errorMessage) {

        log.info("Twilio status webhook received. SID: {}, Status: {}", messageSid, messageStatus);

        communicationLogService.updateStatus(messageSid, messageStatus.toUpperCase(), errorCode, errorMessage);

        return ResponseEntity.ok("OK");
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
