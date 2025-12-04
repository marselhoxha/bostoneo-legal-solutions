package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.ClientPortalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.OK;
import static org.springframework.http.HttpStatus.CREATED;

/**
 * Controller for Client Portal API endpoints.
 * All endpoints require ROLE_CLIENT and are scoped to the authenticated client's data only.
 */
@RestController
@RequestMapping("/api/client-portal")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasRole('ROLE_CLIENT')")
public class ClientPortalController {

    private final ClientPortalService clientPortalService;

    // =====================================================
    // DASHBOARD
    // =====================================================

    @GetMapping("/dashboard")
    public ResponseEntity<HttpResponse> getDashboard(@AuthenticationPrincipal(expression = "id") Long userId) {
        log.info("Client {} accessing dashboard", userId);
        ClientPortalDashboardDTO dashboard = clientPortalService.getDashboardData(userId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("dashboard", dashboard))
                        .message("Dashboard data retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    // =====================================================
    // PROFILE
    // =====================================================

    @GetMapping("/profile")
    public ResponseEntity<HttpResponse> getProfile(@AuthenticationPrincipal(expression = "id") Long userId) {
        log.info("Client {} accessing profile", userId);
        ClientPortalProfileDTO profile = clientPortalService.getClientProfile(userId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("profile", profile))
                        .message("Profile retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PutMapping("/profile")
    public ResponseEntity<HttpResponse> updateProfile(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @RequestBody ClientPortalProfileDTO profileDTO) {
        log.info("Client {} updating profile", userId);
        ClientPortalProfileDTO updatedProfile = clientPortalService.updateClientProfile(userId, profileDTO);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("profile", updatedProfile))
                        .message("Profile updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    // =====================================================
    // CASES
    // =====================================================

    @GetMapping("/cases")
    public ResponseEntity<HttpResponse> getCases(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        log.info("Client {} fetching cases, page: {}, size: {}", userId, page, size);
        Page<ClientPortalCaseDTO> cases = clientPortalService.getClientCases(userId, page, size);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of(
                                "cases", cases.getContent(),
                                "page", cases.getNumber(),
                                "totalPages", cases.getTotalPages(),
                                "totalElements", cases.getTotalElements()
                        ))
                        .message("Cases retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/cases/{caseId}")
    public ResponseEntity<HttpResponse> getCase(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long caseId) {
        log.info("Client {} fetching case {}", userId, caseId);
        ClientPortalCaseDTO caseDTO = clientPortalService.getClientCase(userId, caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("case", caseDTO))
                        .message("Case retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/cases/{caseId}/attorney")
    public ResponseEntity<HttpResponse> getCaseAttorney(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long caseId) {
        log.info("Client {} fetching attorney for case {}", userId, caseId);
        Long attorneyId = clientPortalService.getCaseAttorneyId(userId, caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("attorneyId", attorneyId))
                        .message("Case attorney retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    // =====================================================
    // DOCUMENTS
    // =====================================================

    @GetMapping("/documents")
    public ResponseEntity<HttpResponse> getDocuments(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        log.info("Client {} fetching documents", userId);
        Page<ClientPortalDocumentDTO> documents = clientPortalService.getClientDocuments(userId, page, size);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of(
                                "documents", documents.getContent(),
                                "page", documents.getNumber(),
                                "totalPages", documents.getTotalPages(),
                                "totalElements", documents.getTotalElements()
                        ))
                        .message("Documents retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/cases/{caseId}/documents")
    public ResponseEntity<HttpResponse> getCaseDocuments(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long caseId) {
        log.info("Client {} fetching documents for case {}", userId, caseId);
        List<ClientPortalDocumentDTO> documents = clientPortalService.getCaseDocuments(userId, caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("documents", documents))
                        .message("Case documents retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping("/cases/{caseId}/documents")
    public ResponseEntity<HttpResponse> uploadDocument(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long caseId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("title") String title,
            @RequestParam(value = "description", required = false) String description) {
        log.info("Client {} uploading document to case {}", userId, caseId);
        ClientPortalDocumentDTO document = clientPortalService.uploadDocument(userId, caseId, file, title, description);

        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("document", document))
                        .message("Document uploaded successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    // =====================================================
    // APPOINTMENTS
    // =====================================================

    @GetMapping("/appointments")
    public ResponseEntity<HttpResponse> getAppointments(@AuthenticationPrincipal(expression = "id") Long userId) {
        log.info("Client {} fetching appointments", userId);
        List<ClientPortalAppointmentDTO> appointments = clientPortalService.getClientAppointments(userId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointments", appointments))
                        .message("Appointments retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping("/appointments/request")
    public ResponseEntity<HttpResponse> requestAppointment(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @RequestBody ClientPortalAppointmentRequestDTO request) {
        log.info("Client {} requesting appointment", userId);
        ClientPortalAppointmentDTO appointment = clientPortalService.requestAppointment(userId, request);

        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointment", appointment))
                        .message("Appointment request submitted successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @DeleteMapping("/appointments/{appointmentId}")
    public ResponseEntity<HttpResponse> cancelAppointment(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long appointmentId) {
        log.info("Client {} cancelling appointment {}", userId, appointmentId);
        clientPortalService.cancelAppointment(userId, appointmentId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Appointment cancelled successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PutMapping("/appointments/{appointmentId}/reschedule")
    public ResponseEntity<HttpResponse> rescheduleAppointment(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long appointmentId,
            @RequestBody RescheduleRequestDTO request) {
        log.info("Client {} rescheduling appointment {}", userId, appointmentId);
        ClientPortalAppointmentDTO appointment = clientPortalService.rescheduleAppointment(
                userId, appointmentId, request.getNewDateTime(), request.getReason());

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointment", appointment))
                        .message("Appointment rescheduled successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    // =====================================================
    // MESSAGES
    // =====================================================

    @GetMapping("/messages")
    public ResponseEntity<HttpResponse> getMessageThreads(@AuthenticationPrincipal(expression = "id") Long userId) {
        log.info("Client {} fetching message threads", userId);
        List<ClientPortalMessageThreadDTO> threads = clientPortalService.getMessageThreads(userId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("threads", threads))
                        .message("Message threads retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/messages/{threadId}")
    public ResponseEntity<HttpResponse> getThreadMessages(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long threadId) {
        log.info("Client {} fetching messages for thread {}", userId, threadId);
        List<ClientPortalMessageDTO> messages = clientPortalService.getThreadMessages(userId, threadId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("messages", messages))
                        .message("Messages retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping("/messages/{threadId}")
    public ResponseEntity<HttpResponse> sendMessage(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long threadId,
            @RequestBody String content) {
        log.info("Client {} sending message to thread {}", userId, threadId);
        ClientPortalMessageDTO message = clientPortalService.sendMessage(userId, threadId, content);

        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("message", message))
                        .message("Message sent successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @PostMapping("/messages/new")
    public ResponseEntity<HttpResponse> startNewThread(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @RequestParam Long caseId,
            @RequestParam String subject,
            @RequestBody String initialMessage) {
        log.info("Client {} starting new message thread for case {}", userId, caseId);
        ClientPortalMessageThreadDTO thread = clientPortalService.startNewThread(userId, caseId, subject, initialMessage);

        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("thread", thread))
                        .message("Message thread created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    // =====================================================
    // INVOICES
    // =====================================================

    @GetMapping("/invoices")
    public ResponseEntity<HttpResponse> getInvoices(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        log.info("Client {} fetching invoices", userId);
        Page<ClientPortalInvoiceDTO> invoices = clientPortalService.getClientInvoices(userId, page, size);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of(
                                "invoices", invoices.getContent(),
                                "page", invoices.getNumber(),
                                "totalPages", invoices.getTotalPages(),
                                "totalElements", invoices.getTotalElements()
                        ))
                        .message("Invoices retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/invoices/{invoiceId}")
    public ResponseEntity<HttpResponse> getInvoice(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long invoiceId) {
        log.info("Client {} fetching invoice {}", userId, invoiceId);
        ClientPortalInvoiceDTO invoice = clientPortalService.getInvoice(userId, invoiceId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("invoice", invoice))
                        .message("Invoice retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}
