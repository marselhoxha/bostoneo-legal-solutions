package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.AppointmentRequestDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.AppointmentRequestService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

@RestController
@RequestMapping("/api/appointments")
@RequiredArgsConstructor
@Slf4j
public class AppointmentRequestController {

    private final AppointmentRequestService appointmentRequestService;

    // =====================================================
    // CLIENT ENDPOINTS
    // =====================================================

    /**
     * Client creates an appointment request
     */
    @PostMapping("/request")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> createAppointmentRequest(
            @RequestBody AppointmentRequestDTO request) {
        log.info("Creating appointment request for client: {}", request.getClientId());

        AppointmentRequestDTO created = appointmentRequestService.createAppointmentRequest(request);

        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointment", created))
                        .message("Appointment request created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    /**
     * Get client's appointments
     */
    @GetMapping("/client/{clientId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getClientAppointments(
            @PathVariable Long clientId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        log.info("Getting appointments for client: {}", clientId);

        Page<AppointmentRequestDTO> appointments = appointmentRequestService.getClientAppointments(clientId, page, size);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of(
                                "appointments", appointments.getContent(),
                                "currentPage", appointments.getNumber(),
                                "totalItems", appointments.getTotalElements(),
                                "totalPages", appointments.getTotalPages()
                        ))
                        .message("Client appointments retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get client's upcoming appointments
     */
    @GetMapping("/client/{clientId}/upcoming")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getClientUpcomingAppointments(@PathVariable Long clientId) {
        log.info("Getting upcoming appointments for client: {}", clientId);

        List<AppointmentRequestDTO> appointments = appointmentRequestService.getClientUpcomingAppointments(clientId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointments", appointments))
                        .message("Upcoming appointments retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get client's pending appointment requests
     */
    @GetMapping("/client/{clientId}/pending")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getClientPendingAppointments(@PathVariable Long clientId) {
        log.info("Getting pending appointments for client: {}", clientId);

        List<AppointmentRequestDTO> appointments = appointmentRequestService.getClientPendingAppointments(clientId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointments", appointments))
                        .message("Pending appointments retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Client cancels an appointment
     */
    @PostMapping("/{id}/cancel/client")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> cancelAppointmentByClient(
            @PathVariable Long id,
            @RequestParam Long clientId,
            @RequestBody(required = false) Map<String, String> body) {
        log.info("Client {} cancelling appointment: {}", clientId, id);

        String reason = body != null ? body.get("reason") : null;
        AppointmentRequestDTO cancelled = appointmentRequestService.cancelAppointmentByClient(id, clientId, reason);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointment", cancelled))
                        .message("Appointment cancelled successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    // =====================================================
    // ATTORNEY ENDPOINTS
    // =====================================================

    /**
     * Get attorney's appointments
     */
    @GetMapping("/attorney")
    @PreAuthorize("hasAnyRole('ATTORNEY', 'ADMIN')")
    public ResponseEntity<HttpResponse> getAttorneyAppointments(
            @AuthenticationPrincipal(expression = "id") Long attorneyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        log.info("Getting appointments for attorney: {}", attorneyId);

        Page<AppointmentRequestDTO> appointments = appointmentRequestService.getAttorneyAppointments(attorneyId, page, size);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of(
                                "appointments", appointments.getContent(),
                                "currentPage", appointments.getNumber(),
                                "totalItems", appointments.getTotalElements(),
                                "totalPages", appointments.getTotalPages()
                        ))
                        .message("Attorney appointments retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get attorney's pending requests
     */
    @GetMapping("/attorney/pending")
    @PreAuthorize("hasAnyRole('ATTORNEY', 'ADMIN')")
    public ResponseEntity<HttpResponse> getAttorneyPendingRequests(
            @AuthenticationPrincipal(expression = "id") Long attorneyId) {
        log.info("Getting pending requests for attorney: {}", attorneyId);

        List<AppointmentRequestDTO> appointments = appointmentRequestService.getAttorneyPendingRequests(attorneyId);
        long count = appointmentRequestService.countAttorneyPendingRequests(attorneyId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointments", appointments, "count", count))
                        .message("Pending requests retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get attorney's upcoming appointments
     */
    @GetMapping("/attorney/upcoming")
    @PreAuthorize("hasAnyRole('ATTORNEY', 'ADMIN')")
    public ResponseEntity<HttpResponse> getAttorneyUpcomingAppointments(
            @AuthenticationPrincipal(expression = "id") Long attorneyId) {
        log.info("Getting upcoming appointments for attorney: {}", attorneyId);

        List<AppointmentRequestDTO> appointments = appointmentRequestService.getAttorneyUpcomingAppointments(attorneyId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointments", appointments))
                        .message("Upcoming appointments retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Attorney confirms an appointment
     */
    @PostMapping("/{id}/confirm")
    @PreAuthorize("hasAnyRole('ATTORNEY', 'ADMIN')")
    public ResponseEntity<HttpResponse> confirmAppointment(
            @PathVariable Long id,
            @AuthenticationPrincipal(expression = "id") Long attorneyId,
            @RequestBody AppointmentRequestDTO confirmationDetails) {
        log.info("Attorney {} confirming appointment: {}", attorneyId, id);

        AppointmentRequestDTO confirmed = appointmentRequestService.confirmAppointment(id, attorneyId, confirmationDetails);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointment", confirmed))
                        .message("Appointment confirmed successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Attorney reschedules an appointment
     */
    @PostMapping("/{id}/reschedule")
    @PreAuthorize("hasAnyRole('ATTORNEY', 'ADMIN')")
    public ResponseEntity<HttpResponse> rescheduleAppointment(
            @PathVariable Long id,
            @AuthenticationPrincipal(expression = "id") Long attorneyId,
            @RequestBody AppointmentRequestDTO rescheduleDetails) {
        log.info("Attorney {} rescheduling appointment: {}", attorneyId, id);

        AppointmentRequestDTO rescheduled = appointmentRequestService.rescheduleAppointment(id, attorneyId, rescheduleDetails);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointment", rescheduled))
                        .message("Appointment rescheduled successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Attorney approves a client's reschedule request
     */
    @PostMapping("/{id}/approve-reschedule")
    @PreAuthorize("hasAnyRole('ATTORNEY', 'ADMIN')")
    public ResponseEntity<HttpResponse> approveReschedule(
            @PathVariable Long id,
            @AuthenticationPrincipal(expression = "id") Long attorneyId) {
        log.info("Attorney {} approving reschedule for appointment: {}", attorneyId, id);

        AppointmentRequestDTO approved = appointmentRequestService.approveReschedule(id, attorneyId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointment", approved))
                        .message("Reschedule request approved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Attorney declines a client's reschedule request
     */
    @PostMapping("/{id}/decline-reschedule")
    @PreAuthorize("hasAnyRole('ATTORNEY', 'ADMIN')")
    public ResponseEntity<HttpResponse> declineReschedule(
            @PathVariable Long id,
            @AuthenticationPrincipal(expression = "id") Long attorneyId,
            @RequestBody(required = false) Map<String, String> body) {
        log.info("Attorney {} declining reschedule for appointment: {}", attorneyId, id);

        String reason = body != null ? body.get("reason") : null;
        AppointmentRequestDTO declined = appointmentRequestService.declineReschedule(id, attorneyId, reason);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointment", declined))
                        .message("Reschedule request declined")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get attorney's pending reschedule requests
     */
    @GetMapping("/attorney/pending-reschedules")
    @PreAuthorize("hasAnyRole('ATTORNEY', 'ADMIN')")
    public ResponseEntity<HttpResponse> getAttorneyPendingRescheduleRequests(
            @AuthenticationPrincipal(expression = "id") Long attorneyId) {
        log.info("Getting pending reschedule requests for attorney: {}", attorneyId);

        List<AppointmentRequestDTO> pendingReschedules = appointmentRequestService.getAttorneyPendingRescheduleRequests(attorneyId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointments", pendingReschedules, "count", pendingReschedules.size()))
                        .message("Pending reschedule requests retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Attorney cancels an appointment
     */
    @PostMapping("/{id}/cancel/attorney")
    @PreAuthorize("hasAnyRole('ATTORNEY', 'ADMIN')")
    public ResponseEntity<HttpResponse> cancelAppointmentByAttorney(
            @PathVariable Long id,
            @AuthenticationPrincipal(expression = "id") Long attorneyId,
            @RequestBody(required = false) Map<String, String> body) {
        log.info("Attorney {} cancelling appointment: {}", attorneyId, id);

        String reason = body != null ? body.get("reason") : null;
        AppointmentRequestDTO cancelled = appointmentRequestService.cancelAppointmentByAttorney(id, attorneyId, reason);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointment", cancelled))
                        .message("Appointment cancelled successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Attorney marks appointment as completed
     */
    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAnyRole('ATTORNEY', 'ADMIN')")
    public ResponseEntity<HttpResponse> completeAppointment(
            @PathVariable Long id,
            @AuthenticationPrincipal(expression = "id") Long attorneyId,
            @RequestBody(required = false) Map<String, String> body) {
        log.info("Attorney {} completing appointment: {}", attorneyId, id);

        String notes = body != null ? body.get("notes") : null;
        AppointmentRequestDTO completed = appointmentRequestService.completeAppointment(id, attorneyId, notes);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointment", completed))
                        .message("Appointment marked as completed")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    // =====================================================
    // CASE ENDPOINTS
    // =====================================================

    /**
     * Get appointments for a case
     */
    @GetMapping("/case/{caseId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getAppointmentsByCase(@PathVariable Long caseId) {
        log.info("Getting appointments for case: {}", caseId);

        List<AppointmentRequestDTO> appointments = appointmentRequestService.getAppointmentsByCase(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointments", appointments))
                        .message("Case appointments retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    // =====================================================
    // GENERAL ENDPOINTS
    // =====================================================

    /**
     * Get appointment by ID
     */
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getAppointmentById(@PathVariable Long id) {
        log.info("Getting appointment by ID: {}", id);

        AppointmentRequestDTO appointment = appointmentRequestService.getAppointmentById(id);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("appointment", appointment))
                        .message("Appointment retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}
