package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.AppointmentRequestDTO;
import org.springframework.data.domain.Page;

import java.util.List;

public interface AppointmentRequestService {

    // Client operations
    AppointmentRequestDTO createAppointmentRequest(AppointmentRequestDTO request);
    Page<AppointmentRequestDTO> getClientAppointments(Long clientId, int page, int size);
    List<AppointmentRequestDTO> getClientUpcomingAppointments(Long clientId);
    List<AppointmentRequestDTO> getClientPendingAppointments(Long clientId);
    AppointmentRequestDTO cancelAppointmentByClient(Long appointmentId, Long clientId, String reason);

    // Attorney operations
    Page<AppointmentRequestDTO> getAttorneyAppointments(Long attorneyId, int page, int size);
    List<AppointmentRequestDTO> getAttorneyPendingRequests(Long attorneyId);
    List<AppointmentRequestDTO> getAttorneyUpcomingAppointments(Long attorneyId);
    long countAttorneyPendingRequests(Long attorneyId);
    AppointmentRequestDTO confirmAppointment(Long appointmentId, Long attorneyId, AppointmentRequestDTO confirmationDetails);
    AppointmentRequestDTO rescheduleAppointment(Long appointmentId, Long attorneyId, AppointmentRequestDTO rescheduleDetails);
    AppointmentRequestDTO approveReschedule(Long appointmentId, Long attorneyId);
    AppointmentRequestDTO declineReschedule(Long appointmentId, Long attorneyId, String reason);
    List<AppointmentRequestDTO> getAttorneyPendingRescheduleRequests(Long attorneyId);
    AppointmentRequestDTO cancelAppointmentByAttorney(Long appointmentId, Long attorneyId, String reason);
    AppointmentRequestDTO completeAppointment(Long appointmentId, Long attorneyId, String notes);

    // Case operations
    List<AppointmentRequestDTO> getAppointmentsByCase(Long caseId);

    // General operations
    AppointmentRequestDTO getAppointmentById(Long id);

    // Reminder operations
    void processAppointmentReminders();
}
