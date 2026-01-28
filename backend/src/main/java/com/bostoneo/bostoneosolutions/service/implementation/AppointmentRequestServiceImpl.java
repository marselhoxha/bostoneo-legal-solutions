package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.AppointmentRequestDTO;
import com.bostoneo.bostoneosolutions.dto.CalendarEventDTO;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.AppointmentRequest;
import com.bostoneo.bostoneosolutions.model.Client;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.repository.AppointmentRequestRepository;
import com.bostoneo.bostoneosolutions.repository.ClientRepository;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.service.AppointmentRequestService;
import com.bostoneo.bostoneosolutions.service.CalendarEventService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AppointmentRequestServiceImpl implements AppointmentRequestService {

    private final AppointmentRequestRepository appointmentRequestRepository;
    private final ClientRepository clientRepository;
    private final UserRepository userRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final CalendarEventService calendarEventService;
    private final NotificationService notificationService;
    private final TenantService tenantService;
    private final OrganizationRepository organizationRepository;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    // =====================================================
    // CLIENT OPERATIONS
    // =====================================================

    @Override
    public AppointmentRequestDTO createAppointmentRequest(AppointmentRequestDTO request) {
        log.info("Creating appointment request for client: {}", request.getClientId());
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query to validate client exists
        Client client = clientRepository.findByIdAndOrganizationId(request.getClientId(), orgId)
                .orElseThrow(() -> new ApiException("Client not found or access denied"));

        // Validate attorney exists
        User attorney = userRepository.get(request.getAttorneyId());
        if (attorney == null) {
            throw new ApiException("Attorney not found");
        }

        // Validate case if provided
        if (request.getCaseId() != null) {
            // SECURITY: Use tenant-filtered query
            legalCaseRepository.findByIdAndOrganizationId(request.getCaseId(), orgId)
                    .orElseThrow(() -> new ApiException("Case not found or access denied"));
        }

        // Check for conflicts - SECURITY: Use tenant-filtered query
        List<AppointmentRequest> conflicts = appointmentRequestRepository.findConflictingAppointmentsByOrganization(
                orgId,
                request.getAttorneyId(),
                request.getPreferredDatetime(),
                request.getPreferredDatetime().plusMinutes(request.getDurationMinutes() != null ? request.getDurationMinutes() : 30)
        );

        if (!conflicts.isEmpty()) {
            throw new ApiException("The selected time slot is no longer available. Please choose another time.");
        }

        AppointmentRequest appointment = AppointmentRequest.builder()
                .organizationId(orgId) // SECURITY: Set organization ID
                .clientId(request.getClientId())
                .attorneyId(request.getAttorneyId())
                .caseId(request.getCaseId())
                .title(request.getTitle())
                .description(request.getDescription())
                .appointmentType(request.getAppointmentType() != null ? request.getAppointmentType() : "CLIENT_MEETING")
                .preferredDatetime(request.getPreferredDatetime())
                .alternativeDatetime(request.getAlternativeDatetime())
                .durationMinutes(request.getDurationMinutes() != null ? request.getDurationMinutes() : 30)
                .isVirtual(request.getIsVirtual() != null ? request.getIsVirtual() : false)
                .location(request.getLocation())
                .notes(request.getNotes())
                .status("PENDING")
                .build();

        AppointmentRequest saved = appointmentRequestRepository.save(appointment);
        log.info("Appointment request created with ID: {}", saved.getId());

        return toDTO(saved);
    }

    @Override
    public Page<AppointmentRequestDTO> getClientAppointments(Long clientId, int page, int size) {
        log.info("Getting appointments for client: {}", clientId);
        Long orgId = getRequiredOrganizationId();
        Pageable pageable = PageRequest.of(page, size);
        return appointmentRequestRepository.findByOrganizationIdAndClientIdOrderByPreferredDatetimeDesc(orgId, clientId, pageable)
                .map(this::toDTO);
    }

    @Override
    public List<AppointmentRequestDTO> getClientUpcomingAppointments(Long clientId) {
        log.info("Getting upcoming appointments for client: {}", clientId);
        Long orgId = getRequiredOrganizationId();
        return appointmentRequestRepository.findUpcomingByOrganizationAndClientId(orgId, clientId, LocalDateTime.now())
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<AppointmentRequestDTO> getClientPendingAppointments(Long clientId) {
        log.info("Getting pending appointments for client: {}", clientId);
        Long orgId = getRequiredOrganizationId();
        return appointmentRequestRepository.findByOrganizationIdAndClientIdAndStatusOrderByPreferredDatetimeAsc(orgId, clientId, "PENDING")
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public AppointmentRequestDTO cancelAppointmentByClient(Long appointmentId, Long clientId, String reason) {
        log.info("Client {} cancelling appointment: {}", clientId, appointmentId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        AppointmentRequest appointment = appointmentRequestRepository.findByIdAndOrganizationId(appointmentId, orgId)
                .orElseThrow(() -> new ApiException("Appointment not found or access denied"));

        if (!appointment.getClientId().equals(clientId)) {
            throw new ApiException("You don't have permission to cancel this appointment");
        }

        if ("CANCELLED".equals(appointment.getStatus()) || "COMPLETED".equals(appointment.getStatus())) {
            throw new ApiException("Cannot cancel an appointment that is already " + appointment.getStatus().toLowerCase());
        }

        appointment.setStatus("CANCELLED");
        appointment.setCancelledBy("CLIENT");
        appointment.setCancellationReason(reason);

        AppointmentRequest savedAppointment = appointmentRequestRepository.save(appointment);

        // Send notification to attorney about cancellation
        sendCancellationNotificationToAttorney(savedAppointment, reason);

        // Cancel/delete the calendar event if it exists
        cancelCalendarEvent(savedAppointment);

        return toDTO(savedAppointment);
    }

    /**
     * Send notification to attorney when client cancels an appointment
     */
    private void sendCancellationNotificationToAttorney(AppointmentRequest appointment, String reason) {
        try {
            // Get client name
            Client client = clientRepository.findByIdAndOrganizationId(appointment.getClientId(), appointment.getOrganizationId()).orElse(null);
            String clientName = client != null ? client.getName() : "A client";

            // Format the date
            LocalDateTime appointmentTime = appointment.getConfirmedDatetime() != null ?
                    appointment.getConfirmedDatetime() : appointment.getPreferredDatetime();
            String dateStr = appointmentTime != null ?
                    appointmentTime.format(DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy 'at' h:mm a")) :
                    "the scheduled time";

            String title = "Appointment Cancelled";
            String message = String.format(
                    "%s has cancelled their appointment scheduled for %s.%s",
                    clientName,
                    dateStr,
                    reason != null && !reason.isEmpty() ? " Reason: " + reason : ""
            );

            // Send push notification via CRM notification (includes push, email, in-app)
            notificationService.sendCrmNotification(
                    title,
                    message,
                    appointment.getAttorneyId(),
                    "APPOINTMENT_CANCELLED",
                    Map.of("appointmentId", appointment.getId(), "clientName", clientName)
            );

            log.info("Cancellation push notification sent to attorney {} for appointment {}", appointment.getAttorneyId(), appointment.getId());
        } catch (Exception e) {
            log.error("Failed to send cancellation notification for appointment {}: {}", appointment.getId(), e.getMessage());
        }
    }

    /**
     * Cancel/delete the calendar event associated with an appointment
     */
    private void cancelCalendarEvent(AppointmentRequest appointment) {
        try {
            if (appointment.getCalendarEventId() != null) {
                log.info("Deleting calendar event {} for cancelled appointment {}", appointment.getCalendarEventId(), appointment.getId());
                calendarEventService.deleteEvent(appointment.getCalendarEventId());
                log.info("Successfully deleted calendar event {} for appointment {}", appointment.getCalendarEventId(), appointment.getId());
            } else {
                log.warn("No calendar event ID found for appointment {} - nothing to delete", appointment.getId());
            }
        } catch (Exception e) {
            log.error("Failed to delete calendar event {} for appointment {}: {}", appointment.getCalendarEventId(), appointment.getId(), e.getMessage());
        }
    }

    // =====================================================
    // ATTORNEY OPERATIONS
    // =====================================================

    @Override
    public Page<AppointmentRequestDTO> getAttorneyAppointments(Long attorneyId, int page, int size) {
        log.info("Getting appointments for attorney: {}", attorneyId);
        Long orgId = getRequiredOrganizationId();
        Pageable pageable = PageRequest.of(page, size);
        return appointmentRequestRepository.findByOrganizationIdAndAttorneyIdOrderByPreferredDatetimeDesc(orgId, attorneyId, pageable)
                .map(this::toDTO);
    }

    @Override
    public List<AppointmentRequestDTO> getAttorneyPendingRequests(Long attorneyId) {
        log.info("Getting pending requests for attorney: {}", attorneyId);
        Long orgId = getRequiredOrganizationId();
        return appointmentRequestRepository.findByOrganizationIdAndAttorneyIdAndStatusOrderByCreatedAtAsc(orgId, attorneyId, "PENDING")
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<AppointmentRequestDTO> getAttorneyUpcomingAppointments(Long attorneyId) {
        log.info("Getting upcoming appointments for attorney: {}", attorneyId);
        Long orgId = getRequiredOrganizationId();
        return appointmentRequestRepository.findUpcomingByOrganizationAndAttorneyId(orgId, attorneyId, LocalDateTime.now())
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public long countAttorneyPendingRequests(Long attorneyId) {
        Long orgId = getRequiredOrganizationId();
        return appointmentRequestRepository.countByOrganizationIdAndAttorneyIdAndStatus(orgId, attorneyId, "PENDING");
    }

    @Override
    public AppointmentRequestDTO confirmAppointment(Long appointmentId, Long attorneyId, AppointmentRequestDTO confirmationDetails) {
        log.info("Attorney {} confirming appointment: {}", attorneyId, appointmentId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        AppointmentRequest appointment = appointmentRequestRepository.findByIdAndOrganizationId(appointmentId, orgId)
                .orElseThrow(() -> new ApiException("Appointment not found or access denied"));

        if (!appointment.getAttorneyId().equals(attorneyId)) {
            throw new ApiException("You don't have permission to confirm this appointment");
        }

        if (!"PENDING".equals(appointment.getStatus())) {
            throw new ApiException("Can only confirm pending appointments");
        }

        // Set confirmation details
        LocalDateTime confirmedTime = confirmationDetails.getConfirmedDatetime() != null
                ? confirmationDetails.getConfirmedDatetime()
                : appointment.getPreferredDatetime();

        appointment.setStatus("CONFIRMED");
        appointment.setConfirmedDatetime(confirmedTime);
        appointment.setAttorneyNotes(confirmationDetails.getAttorneyNotes());

        if (confirmationDetails.getMeetingLink() != null) {
            appointment.setMeetingLink(confirmationDetails.getMeetingLink());
        }
        if (confirmationDetails.getLocation() != null) {
            appointment.setLocation(confirmationDetails.getLocation());
        }

        // Create calendar event
        try {
            CalendarEventDTO calendarEvent = createCalendarEventForAppointment(appointment);
            appointment.setCalendarEventId(calendarEvent.getId());
        } catch (Exception e) {
            log.error("Failed to create calendar event for appointment {}: {}", appointmentId, e.getMessage());
        }

        AppointmentRequest savedAppointment = appointmentRequestRepository.save(appointment);

        // Send confirmation notification to client
        sendConfirmationNotificationToClient(savedAppointment);

        return toDTO(savedAppointment);
    }

    /**
     * Send notification to client when attorney confirms an appointment
     */
    private void sendConfirmationNotificationToClient(AppointmentRequest appointment) {
        try {
            // Get client's user ID
            // SECURITY: Use tenant-filtered query
            Client client = clientRepository.findByIdAndOrganizationId(appointment.getClientId(), appointment.getOrganizationId())
                    .orElse(null);
            if (client == null || client.getUserId() == null) {
                log.warn("Could not find client or client user ID for appointment {}", appointment.getId());
                return;
            }

            // Get attorney name
            User attorney = userRepository.get(appointment.getAttorneyId());
            String attorneyName = attorney != null ?
                    attorney.getFirstName() + " " + attorney.getLastName() : "Your Attorney";

            // Format the confirmed date
            LocalDateTime confirmedTime = appointment.getConfirmedDatetime() != null ?
                    appointment.getConfirmedDatetime() : appointment.getPreferredDatetime();
            String dateStr = confirmedTime != null ?
                    confirmedTime.format(DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy 'at' h:mm a")) :
                    "the scheduled time";

            // Build meeting details
            String meetingDetails = "";
            if (appointment.getIsVirtual() != null && appointment.getIsVirtual()) {
                meetingDetails = appointment.getMeetingLink() != null ?
                        " A meeting link will be provided." : " Virtual meeting details will be shared.";
            } else if (appointment.getLocation() != null && !appointment.getLocation().isEmpty()) {
                meetingDetails = " Location: " + appointment.getLocation();
            }

            // Create notification
            Map<String, Object> notificationData = new HashMap<>();
            notificationData.put("userId", client.getUserId());
            notificationData.put("title", "Appointment Confirmed");
            notificationData.put("message", String.format(
                    "%s has confirmed your appointment for %s.%s",
                    attorneyName,
                    dateStr,
                    meetingDetails
            ));
            notificationData.put("type", "APPOINTMENT");
            notificationData.put("priority", "HIGH");
            notificationData.put("entityId", appointment.getId());
            notificationData.put("entityType", "APPOINTMENT");
            notificationData.put("url", "/client/appointments");

            notificationService.createUserNotification(notificationData);
            log.info("Confirmation notification sent to client {} for appointment {}", client.getUserId(), appointment.getId());
        } catch (Exception e) {
            log.error("Failed to send confirmation notification for appointment {}: {}", appointment.getId(), e.getMessage());
            // Don't throw - notification failure shouldn't fail the confirmation
        }
    }

    @Override
    public AppointmentRequestDTO rescheduleAppointment(Long appointmentId, Long attorneyId, AppointmentRequestDTO rescheduleDetails) {
        log.info("Attorney {} rescheduling appointment: {}", attorneyId, appointmentId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        AppointmentRequest appointment = appointmentRequestRepository.findByIdAndOrganizationId(appointmentId, orgId)
                .orElseThrow(() -> new ApiException("Appointment not found or access denied"));

        if (!appointment.getAttorneyId().equals(attorneyId)) {
            throw new ApiException("You don't have permission to reschedule this appointment");
        }

        if ("CANCELLED".equals(appointment.getStatus()) || "COMPLETED".equals(appointment.getStatus())) {
            throw new ApiException("Cannot reschedule an appointment that is " + appointment.getStatus().toLowerCase());
        }

        // Check for conflicts with new time - SECURITY: Use tenant-filtered query
        List<AppointmentRequest> conflicts = appointmentRequestRepository.findConflictingAppointmentsByOrganization(
                orgId,
                attorneyId,
                rescheduleDetails.getConfirmedDatetime(),
                rescheduleDetails.getConfirmedDatetime().plusMinutes(appointment.getDurationMinutes())
        );

        // Exclude current appointment from conflict check
        conflicts = conflicts.stream()
                .filter(c -> !c.getId().equals(appointmentId))
                .collect(Collectors.toList());

        if (!conflicts.isEmpty()) {
            throw new ApiException("The selected time slot is not available");
        }

        appointment.setStatus("RESCHEDULED");
        appointment.setConfirmedDatetime(rescheduleDetails.getConfirmedDatetime());
        if (rescheduleDetails.getAttorneyNotes() != null) {
            appointment.setAttorneyNotes(rescheduleDetails.getAttorneyNotes());
        }

        return toDTO(appointmentRequestRepository.save(appointment));
    }

    @Override
    public AppointmentRequestDTO approveReschedule(Long appointmentId, Long attorneyId) {
        log.info("Attorney {} approving reschedule for appointment: {}", attorneyId, appointmentId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        AppointmentRequest appointment = appointmentRequestRepository.findByIdAndOrganizationId(appointmentId, orgId)
                .orElseThrow(() -> new ApiException("Appointment not found or access denied"));

        if (!appointment.getAttorneyId().equals(attorneyId)) {
            throw new ApiException("You don't have permission to approve this reschedule request");
        }

        if (!"PENDING_RESCHEDULE".equals(appointment.getStatus())) {
            throw new ApiException("This appointment does not have a pending reschedule request");
        }

        if (appointment.getRequestedRescheduleTime() == null) {
            throw new ApiException("No requested reschedule time found");
        }

        // Move requested time to confirmed time
        LocalDateTime newTime = appointment.getRequestedRescheduleTime();
        appointment.setConfirmedDatetime(newTime);
        appointment.setPreferredDatetime(newTime);
        appointment.setStatus("CONFIRMED");

        // Clear reschedule request fields
        appointment.setRequestedRescheduleTime(null);
        appointment.setRescheduleReason(null);
        appointment.setOriginalConfirmedTime(null);

        AppointmentRequest savedAppointment = appointmentRequestRepository.save(appointment);

        // Update the calendar event with new time
        updateCalendarEventForApprovedReschedule(savedAppointment, newTime);

        // Send notification to client about approval
        sendRescheduleApprovedNotificationToClient(savedAppointment);

        return toDTO(savedAppointment);
    }

    @Override
    public AppointmentRequestDTO declineReschedule(Long appointmentId, Long attorneyId, String reason) {
        log.info("Attorney {} declining reschedule for appointment: {}", attorneyId, appointmentId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        AppointmentRequest appointment = appointmentRequestRepository.findByIdAndOrganizationId(appointmentId, orgId)
                .orElseThrow(() -> new ApiException("Appointment not found or access denied"));

        if (!appointment.getAttorneyId().equals(attorneyId)) {
            throw new ApiException("You don't have permission to decline this reschedule request");
        }

        if (!"PENDING_RESCHEDULE".equals(appointment.getStatus())) {
            throw new ApiException("This appointment does not have a pending reschedule request");
        }

        // Restore original confirmed time (calendar event stays unchanged)
        if (appointment.getOriginalConfirmedTime() != null) {
            appointment.setConfirmedDatetime(appointment.getOriginalConfirmedTime());
        }
        appointment.setStatus("CONFIRMED");

        // Clear reschedule request fields
        appointment.setRequestedRescheduleTime(null);
        appointment.setRescheduleReason(null);
        appointment.setOriginalConfirmedTime(null);

        AppointmentRequest savedAppointment = appointmentRequestRepository.save(appointment);

        // Send notification to client about decline
        sendRescheduleDeclinedNotificationToClient(savedAppointment, reason);

        return toDTO(savedAppointment);
    }

    @Override
    public List<AppointmentRequestDTO> getAttorneyPendingRescheduleRequests(Long attorneyId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        List<AppointmentRequest> pendingReschedules = appointmentRequestRepository
                .findByOrganizationIdAndAttorneyIdAndStatusOrderByCreatedAtAsc(orgId, attorneyId, "PENDING_RESCHEDULE");
        return pendingReschedules.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * Update the calendar event when a reschedule is approved
     */
    private void updateCalendarEventForApprovedReschedule(AppointmentRequest appointment, LocalDateTime newTime) {
        try {
            if (appointment.getCalendarEventId() != null) {
                log.info("Updating calendar event {} for approved reschedule of appointment {}",
                        appointment.getCalendarEventId(), appointment.getId());

                int duration = appointment.getDurationMinutes() != null ? appointment.getDurationMinutes() : 30;
                LocalDateTime endTime = newTime.plusMinutes(duration);

                CalendarEventDTO updateDTO = CalendarEventDTO.builder()
                        .startTime(newTime)
                        .endTime(endTime)
                        .build();

                calendarEventService.updateEvent(appointment.getCalendarEventId(), updateDTO);
                log.info("Successfully updated calendar event for appointment {}", appointment.getId());
            } else {
                log.warn("No calendar event ID found for appointment {} - nothing to update", appointment.getId());
            }
        } catch (Exception e) {
            log.error("Failed to update calendar event for appointment {}: {}", appointment.getId(), e.getMessage());
        }
    }

    /**
     * Send notification to client when reschedule is approved
     */
    private void sendRescheduleApprovedNotificationToClient(AppointmentRequest appointment) {
        try {
            Client client = clientRepository.findByIdAndOrganizationId(appointment.getClientId(), appointment.getOrganizationId()).orElse(null);
            if (client == null || client.getUserId() == null) {
                log.warn("Could not find client or client user ID for appointment {}", appointment.getId());
                return;
            }

            User attorney = userRepository.get(appointment.getAttorneyId());
            String attorneyName = attorney != null ?
                    attorney.getFirstName() + " " + attorney.getLastName() : "Your Attorney";

            String dateStr = appointment.getConfirmedDatetime() != null ?
                    appointment.getConfirmedDatetime().format(DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy 'at' h:mm a")) :
                    "the requested time";

            Map<String, Object> notificationData = new HashMap<>();
            notificationData.put("userId", client.getUserId());
            notificationData.put("title", "Reschedule Approved");
            notificationData.put("message", String.format(
                    "%s has approved your reschedule request. Your appointment is now confirmed for %s.",
                    attorneyName,
                    dateStr
            ));
            notificationData.put("type", "APPOINTMENT");
            notificationData.put("priority", "HIGH");
            notificationData.put("entityId", appointment.getId());
            notificationData.put("entityType", "APPOINTMENT");
            notificationData.put("url", "/client/appointments");

            notificationService.createUserNotification(notificationData);
            log.info("Reschedule approved notification sent to client {} for appointment {}",
                    client.getUserId(), appointment.getId());
        } catch (Exception e) {
            log.error("Failed to send reschedule approved notification for appointment {}: {}",
                    appointment.getId(), e.getMessage());
        }
    }

    /**
     * Send notification to client when reschedule is declined
     */
    private void sendRescheduleDeclinedNotificationToClient(AppointmentRequest appointment, String reason) {
        try {
            Client client = clientRepository.findByIdAndOrganizationId(appointment.getClientId(), appointment.getOrganizationId()).orElse(null);
            if (client == null || client.getUserId() == null) {
                log.warn("Could not find client or client user ID for appointment {}", appointment.getId());
                return;
            }

            User attorney = userRepository.get(appointment.getAttorneyId());
            String attorneyName = attorney != null ?
                    attorney.getFirstName() + " " + attorney.getLastName() : "Your Attorney";

            String dateStr = appointment.getConfirmedDatetime() != null ?
                    appointment.getConfirmedDatetime().format(DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy 'at' h:mm a")) :
                    "the original time";

            Map<String, Object> notificationData = new HashMap<>();
            notificationData.put("userId", client.getUserId());
            notificationData.put("title", "Reschedule Request Declined");
            notificationData.put("message", String.format(
                    "%s has declined your reschedule request.%s Your original appointment for %s remains unchanged.",
                    attorneyName,
                    reason != null && !reason.isEmpty() ? " Reason: " + reason + "." : "",
                    dateStr
            ));
            notificationData.put("type", "APPOINTMENT");
            notificationData.put("priority", "HIGH");
            notificationData.put("entityId", appointment.getId());
            notificationData.put("entityType", "APPOINTMENT");
            notificationData.put("url", "/client/appointments");

            notificationService.createUserNotification(notificationData);
            log.info("Reschedule declined notification sent to client {} for appointment {}",
                    client.getUserId(), appointment.getId());
        } catch (Exception e) {
            log.error("Failed to send reschedule declined notification for appointment {}: {}",
                    appointment.getId(), e.getMessage());
        }
    }

    @Override
    public AppointmentRequestDTO cancelAppointmentByAttorney(Long appointmentId, Long attorneyId, String reason) {
        log.info("Attorney {} cancelling appointment: {}", attorneyId, appointmentId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        AppointmentRequest appointment = appointmentRequestRepository.findByIdAndOrganizationId(appointmentId, orgId)
                .orElseThrow(() -> new ApiException("Appointment not found or access denied"));

        if (!appointment.getAttorneyId().equals(attorneyId)) {
            throw new ApiException("You don't have permission to cancel this appointment");
        }

        if ("CANCELLED".equals(appointment.getStatus()) || "COMPLETED".equals(appointment.getStatus())) {
            throw new ApiException("Cannot cancel an appointment that is already " + appointment.getStatus().toLowerCase());
        }

        appointment.setStatus("CANCELLED");
        appointment.setCancelledBy("ATTORNEY");
        appointment.setCancellationReason(reason);

        AppointmentRequest savedAppointment = appointmentRequestRepository.save(appointment);

        // Send notification to client about declined appointment
        sendDeclineNotificationToClient(savedAppointment, reason);

        // Cancel/delete the calendar event if it exists
        cancelCalendarEvent(savedAppointment);

        return toDTO(savedAppointment);
    }

    /**
     * Send notification to client when attorney declines/cancels an appointment
     */
    private void sendDeclineNotificationToClient(AppointmentRequest appointment, String reason) {
        try {
            // Get client's user ID
            // SECURITY: Use tenant-filtered query
            Client client = clientRepository.findByIdAndOrganizationId(appointment.getClientId(), appointment.getOrganizationId())
                    .orElse(null);
            if (client == null || client.getUserId() == null) {
                log.warn("Could not find client or client user ID for appointment {}", appointment.getId());
                return;
            }

            // Get attorney name
            User attorney = userRepository.get(appointment.getAttorneyId());
            String attorneyName = attorney != null ?
                    attorney.getFirstName() + " " + attorney.getLastName() : "Your Attorney";

            // Format the date
            String dateStr = appointment.getPreferredDatetime() != null ?
                    appointment.getPreferredDatetime().format(DateTimeFormatter.ofPattern("MMMM d, yyyy 'at' h:mm a")) :
                    "the requested time";

            // Create notification
            Map<String, Object> notificationData = new HashMap<>();
            notificationData.put("userId", client.getUserId());
            notificationData.put("title", "Appointment Request Declined");
            notificationData.put("message", String.format(
                    "%s has declined your appointment request for %s.%s Please schedule a new appointment at your convenience.",
                    attorneyName,
                    dateStr,
                    reason != null && !reason.isEmpty() ? " Reason: " + reason + "." : ""
            ));
            notificationData.put("type", "APPOINTMENT");
            notificationData.put("priority", "HIGH");
            notificationData.put("entityId", appointment.getId());
            notificationData.put("entityType", "APPOINTMENT");
            notificationData.put("url", "/client/appointments");

            notificationService.createUserNotification(notificationData);
            log.info("Decline notification sent to client {} for appointment {}", client.getUserId(), appointment.getId());
        } catch (Exception e) {
            log.error("Failed to send decline notification for appointment {}: {}", appointment.getId(), e.getMessage());
            // Don't throw - notification failure shouldn't fail the cancellation
        }
    }

    @Override
    public AppointmentRequestDTO completeAppointment(Long appointmentId, Long attorneyId, String notes) {
        log.info("Attorney {} completing appointment: {}", attorneyId, appointmentId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        AppointmentRequest appointment = appointmentRequestRepository.findByIdAndOrganizationId(appointmentId, orgId)
                .orElseThrow(() -> new ApiException("Appointment not found or access denied"));

        if (!appointment.getAttorneyId().equals(attorneyId)) {
            throw new ApiException("You don't have permission to complete this appointment");
        }

        if (!"CONFIRMED".equals(appointment.getStatus())) {
            throw new ApiException("Can only complete confirmed appointments");
        }

        appointment.setStatus("COMPLETED");
        if (notes != null) {
            appointment.setAttorneyNotes(notes);
        }

        return toDTO(appointmentRequestRepository.save(appointment));
    }

    // =====================================================
    // CASE OPERATIONS
    // =====================================================

    @Override
    public List<AppointmentRequestDTO> getAppointmentsByCase(Long caseId) {
        log.info("Getting appointments for case: {}", caseId);
        Long orgId = getRequiredOrganizationId();
        return appointmentRequestRepository.findByOrganizationIdAndCaseIdOrderByPreferredDatetimeDesc(orgId, caseId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    // =====================================================
    // GENERAL OPERATIONS
    // =====================================================

    @Override
    public AppointmentRequestDTO getAppointmentById(Long id) {
        log.info("Getting appointment by ID: {}", id);
        Long orgId = getRequiredOrganizationId();
        return appointmentRequestRepository.findByIdAndOrganizationId(id, orgId)
                .map(this::toDTO)
                .orElseThrow(() -> new ApiException("Appointment not found or access denied"));
    }

    // =====================================================
    // REMINDER OPERATIONS
    // =====================================================

    @Override
    public void processAppointmentReminders() {
        log.debug("Processing appointment reminders...");

        // TENANT ISOLATED: Process each organization separately
        LocalDateTime now = LocalDateTime.now();
        List<Organization> organizations = organizationRepository.findAll();

        for (Organization org : organizations) {
            // Process 24-hour reminders
            LocalDateTime twentyFourHoursFromNow = now.plusHours(24);
            LocalDateTime twentyThreeHoursFromNow = now.plusHours(23);
            List<AppointmentRequest> needing24hReminder = appointmentRequestRepository
                    .findNeedingReminder24hByOrganizationId(org.getId(), twentyThreeHoursFromNow, twentyFourHoursFromNow);

            for (AppointmentRequest appointment : needing24hReminder) {
                try {
                    send24HourReminder(appointment);
                    appointment.setReminder24hSent(true);
                    appointmentRequestRepository.save(appointment);
                    log.info("Sent 24-hour reminder for appointment: {}", appointment.getId());
                } catch (Exception e) {
                    log.error("Failed to send 24-hour reminder for appointment {}: {}", appointment.getId(), e.getMessage());
                }
            }

            // Process 1-hour reminders
            LocalDateTime oneHourFromNow = now.plusHours(1);
            LocalDateTime fiftyMinutesFromNow = now.plusMinutes(50);
            List<AppointmentRequest> needing1hReminder = appointmentRequestRepository
                    .findNeedingReminder1hByOrganizationId(org.getId(), fiftyMinutesFromNow, oneHourFromNow);

            for (AppointmentRequest appointment : needing1hReminder) {
                try {
                    send1HourReminder(appointment);
                    appointment.setReminder1hSent(true);
                    appointmentRequestRepository.save(appointment);
                    log.info("Sent 1-hour reminder for appointment: {}", appointment.getId());
                } catch (Exception e) {
                    log.error("Failed to send 1-hour reminder for appointment {}: {}", appointment.getId(), e.getMessage());
                }
            }
        }

        log.debug("Finished processing appointment reminders");
    }

    private void send24HourReminder(AppointmentRequest appointment) {
        // TODO: Implement email/notification sending
        log.info("Would send 24-hour reminder for appointment {} to client {} and attorney {}",
                appointment.getId(), appointment.getClientId(), appointment.getAttorneyId());
    }

    private void send1HourReminder(AppointmentRequest appointment) {
        // TODO: Implement email/notification sending
        log.info("Would send 1-hour reminder for appointment {} to client {} and attorney {}",
                appointment.getId(), appointment.getClientId(), appointment.getAttorneyId());
    }

    // =====================================================
    // HELPER METHODS
    // =====================================================

    private CalendarEventDTO createCalendarEventForAppointment(AppointmentRequest appointment) {
        CalendarEventDTO eventDTO = new CalendarEventDTO();

        // Build title with case information for better context
        // SECURITY: Use tenant-filtered query
        String eventTitle = appointment.getTitle();
        if (appointment.getCaseId() != null && appointment.getOrganizationId() != null) {
            LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(appointment.getCaseId(), appointment.getOrganizationId()).orElse(null);
            if (legalCase != null) {
                // Format: "Client Meeting - Case Title (CASE-NUMBER)"
                eventTitle = String.format("%s - %s (%s)",
                        appointment.getTitle(),
                        legalCase.getTitle(),
                        legalCase.getCaseNumber());
            }
        }

        // Get client name for description
        String clientInfo = "";
        if (appointment.getClientId() != null) {
            Client client = clientRepository.findByIdAndOrganizationId(appointment.getClientId(), appointment.getOrganizationId()).orElse(null);
            if (client != null) {
                clientInfo = "Client: " + client.getName() + "\n";
            }
        }

        eventDTO.setTitle(eventTitle);
        eventDTO.setDescription(clientInfo + (appointment.getDescription() != null ? appointment.getDescription() : ""));
        eventDTO.setStartTime(appointment.getConfirmedDatetime());
        eventDTO.setEndTime(appointment.getConfirmedDatetime().plusMinutes(appointment.getDurationMinutes()));
        eventDTO.setEventType("CLIENT_MEETING");
        eventDTO.setStatus("SCHEDULED");
        eventDTO.setLocation(appointment.getIsVirtual() != null && appointment.getIsVirtual()
                ? (appointment.getMeetingLink() != null ? appointment.getMeetingLink() : "Virtual Meeting")
                : appointment.getLocation());
        eventDTO.setCaseId(appointment.getCaseId());
        eventDTO.setUserId(appointment.getAttorneyId());
        eventDTO.setReminderMinutes(60); // 1 hour before reminder

        // Auto-enable reminders for both email and push notifications
        eventDTO.setEmailNotification(true);
        eventDTO.setPushNotification(true);

        // Note: We only create calendar event for attorney. Client gets the "Appointment Confirmed" notification
        // which is more informative than the generic "Calendar Event Created" notification.
        CalendarEventDTO createdEvent = calendarEventService.createEvent(eventDTO);
        log.info("Created calendar event {} for appointment {}", createdEvent.getId(), appointment.getId());
        return createdEvent;
    }

    private AppointmentRequestDTO toDTO(AppointmentRequest entity) {
        AppointmentRequestDTO dto = AppointmentRequestDTO.builder()
                .id(entity.getId())
                .calendarEventId(entity.getCalendarEventId())
                .caseId(entity.getCaseId())
                .clientId(entity.getClientId())
                .attorneyId(entity.getAttorneyId())
                .title(entity.getTitle())
                .description(entity.getDescription())
                .appointmentType(entity.getAppointmentType())
                .preferredDatetime(entity.getPreferredDatetime())
                .alternativeDatetime(entity.getAlternativeDatetime())
                .durationMinutes(entity.getDurationMinutes())
                .isVirtual(entity.getIsVirtual())
                .meetingLink(entity.getMeetingLink())
                .location(entity.getLocation())
                .status(entity.getStatus())
                .notes(entity.getNotes())
                .attorneyNotes(entity.getAttorneyNotes())
                .confirmedDatetime(entity.getConfirmedDatetime())
                .cancelledBy(entity.getCancelledBy())
                .cancellationReason(entity.getCancellationReason())
                .requestedRescheduleTime(entity.getRequestedRescheduleTime())
                .rescheduleReason(entity.getRescheduleReason())
                .originalConfirmedTime(entity.getOriginalConfirmedTime())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();

        // Enrich with names - SECURITY: Use tenant-filtered queries
        Long orgId = entity.getOrganizationId();
        if (entity.getClient() != null) {
            dto.setClientName(entity.getClient().getName());
        } else if (entity.getClientId() != null && orgId != null) {
            clientRepository.findByIdAndOrganizationId(entity.getClientId(), orgId)
                    .ifPresent(client -> dto.setClientName(client.getName()));
        }

        if (entity.getAttorneyId() != null) {
            User attorney = userRepository.get(entity.getAttorneyId());
            if (attorney != null) {
                dto.setAttorneyName(attorney.getFirstName() + " " + attorney.getLastName());
            }
        }

        if (entity.getLegalCase() != null) {
            dto.setCaseNumber(entity.getLegalCase().getCaseNumber());
        } else if (entity.getCaseId() != null && orgId != null) {
            legalCaseRepository.findByIdAndOrganizationId(entity.getCaseId(), orgId)
                    .ifPresent(legalCase -> dto.setCaseNumber(legalCase.getCaseNumber()));
        }

        return dto;
    }
}
