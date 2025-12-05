package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.config.TwilioConfig;
import com.bostoneo.bostoneosolutions.dto.CommunicationLogDTO;
import com.bostoneo.bostoneosolutions.dto.SmsRequestDTO;
import com.bostoneo.bostoneosolutions.dto.SmsResponseDTO;
import com.bostoneo.bostoneosolutions.model.CommunicationLog;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.CommunicationLogService;
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

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return "***" + phone.substring(phone.length() - 4);
    }
}
