package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.dto.CalendarEventDTO;
import com.bostoneo.bostoneosolutions.dto.filemanager.FileUploadResponseDTO;
import com.bostoneo.bostoneosolutions.enumeration.CaseRoleType;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.AppointmentRequest;
import com.bostoneo.bostoneosolutions.model.Attorney;
import com.bostoneo.bostoneosolutions.model.Client;
import com.bostoneo.bostoneosolutions.model.FileItem;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.CaseAssignment;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.model.Message;
import com.bostoneo.bostoneosolutions.model.MessageThread;
import com.bostoneo.bostoneosolutions.repository.AppointmentRequestRepository;
import com.bostoneo.bostoneosolutions.repository.AttorneyRepository;
import com.bostoneo.bostoneosolutions.repository.ClientRepository;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.repository.CalendarEventRepository;
import com.bostoneo.bostoneosolutions.repository.InvoiceRepository;
import com.bostoneo.bostoneosolutions.repository.FileItemRepository;
import com.bostoneo.bostoneosolutions.repository.CaseAssignmentRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.repository.MessageThreadRepository;
import com.bostoneo.bostoneosolutions.repository.MessageRepository;
import com.bostoneo.bostoneosolutions.repository.ThreadAttorneyStatusRepository;
import com.bostoneo.bostoneosolutions.model.ThreadAttorneyStatus;
import com.bostoneo.bostoneosolutions.service.CalendarEventService;
import com.bostoneo.bostoneosolutions.service.ClientPortalService;
import com.bostoneo.bostoneosolutions.service.FileManagerService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.service.CaseActivityService;
import com.bostoneo.bostoneosolutions.handler.AuthenticatedWebSocketHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class ClientPortalServiceImpl implements ClientPortalService {

    private final ClientRepository clientRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final CalendarEventRepository calendarEventRepository;
    private final CalendarEventService calendarEventService;
    private final InvoiceRepository invoiceRepository;
    private final FileManagerService fileManagerService;
    private final FileItemRepository fileItemRepository;
    private final CaseAssignmentRepository caseAssignmentRepository;
    private final NotificationService notificationService;
    private final CaseActivityService caseActivityService;
    private final AppointmentRequestRepository appointmentRequestRepository;
    private final UserRepository<User> userRepository;
    private final AttorneyRepository attorneyRepository;
    private final MessageThreadRepository messageThreadRepository;
    private final MessageRepository messageRepository;
    private final AuthenticatedWebSocketHandler webSocketHandler;
    private final ThreadAttorneyStatusRepository threadAttorneyStatusRepository;

    // =====================================================
    // CLIENT PROFILE
    // =====================================================

    @Override
    public ClientPortalProfileDTO getClientProfile(Long userId) {
        Client client = getClientByUserId(userId);
        return mapToProfileDTO(client);
    }

    @Override
    public ClientPortalProfileDTO updateClientProfile(Long userId, ClientPortalProfileDTO profileDTO) {
        Client client = getClientByUserId(userId);

        // Only allow updating certain fields
        if (profileDTO.getPhone() != null) {
            client.setPhone(profileDTO.getPhone());
        }
        if (profileDTO.getAddress() != null) {
            client.setAddress(profileDTO.getAddress());
        }

        clientRepository.save(client);
        return mapToProfileDTO(client);
    }

    // =====================================================
    // CASES
    // =====================================================

    @Override
    public Page<ClientPortalCaseDTO> getClientCases(Long userId, int page, int size) {
        Client client = getClientByUserId(userId);

        // Get cases where client name matches
        Page<LegalCase> cases = legalCaseRepository.findByClientNameIgnoreCase(client.getName(), PageRequest.of(page, size));

        List<ClientPortalCaseDTO> caseDTOs = cases.getContent().stream()
                .map(this::mapToCaseDTO)
                .collect(Collectors.toList());

        return new PageImpl<>(caseDTOs, PageRequest.of(page, size), cases.getTotalElements());
    }

    @Override
    public ClientPortalCaseDTO getClientCase(Long userId, Long caseId) {
        if (!verifyCaseAccess(userId, caseId)) {
            throw new ApiException("You do not have access to this case");
        }

        LegalCase legalCase = legalCaseRepository.findById(caseId)
                .orElseThrow(() -> new ApiException("Case not found"));

        return mapToCaseDTO(legalCase);
    }

    /**
     * Convert user ID to attorney ID from attorneys table
     */
    private Long getAttorneyIdFromUserId(Long assignedUserId) {
        return attorneyRepository.findByUserId(assignedUserId)
                .map(Attorney::getId)
                .orElseGet(() -> {
                    // Auto-create attorney record if it doesn't exist
                    log.info("Creating attorney record for user: {}", assignedUserId);
                    Attorney newAttorney = Attorney.builder()
                            .userId(assignedUserId)
                            .practiceAreas("[]")
                            .isActive(true)
                            .currentCaseLoad(0)
                            .maxCaseLoad(50)
                            .build();
                    Attorney saved = attorneyRepository.save(newAttorney);
                    return saved.getId();
                });
    }

    @Override
    public Long getCaseAttorneyId(Long userId, Long caseId) {
        if (!verifyCaseAccess(userId, caseId)) {
            throw new ApiException("You do not have access to this case");
        }

        // Find lead attorney for the case from case assignments
        List<CaseAssignment> assignments = caseAssignmentRepository.findActiveByCaseId(caseId);

        // First look for lead attorney
        for (CaseAssignment assignment : assignments) {
            if (assignment.getRoleType() == CaseRoleType.LEAD_ATTORNEY) {
                Long assignedUserId = assignment.getAssignedTo().getId();
                return getAttorneyIdFromUserId(assignedUserId);
            }
        }

        // If no lead attorney, return first supporting attorney or associate found
        for (CaseAssignment assignment : assignments) {
            if (assignment.getRoleType() == CaseRoleType.SUPPORTING_ATTORNEY ||
                assignment.getRoleType() == CaseRoleType.ASSOCIATE ||
                assignment.getRoleType() == CaseRoleType.CO_COUNSEL) {
                Long assignedUserId = assignment.getAssignedTo().getId();
                return getAttorneyIdFromUserId(assignedUserId);
            }
        }

        // If still nothing, return first assignment
        if (!assignments.isEmpty()) {
            Long assignedUserId = assignments.get(0).getAssignedTo().getId();
            return getAttorneyIdFromUserId(assignedUserId);
        }

        return null;
    }

    // =====================================================
    // DOCUMENTS
    // =====================================================

    @Override
    public Page<ClientPortalDocumentDTO> getClientDocuments(Long userId, int page, int size) {
        Client client = getClientByUserId(userId);

        // Get all cases for this client
        List<LegalCase> clientCases = legalCaseRepository.findAllByClientNameIgnoreCase(client.getName());

        if (clientCases.isEmpty()) {
            return new PageImpl<>(new ArrayList<>(), PageRequest.of(page, size), 0);
        }

        // Get case IDs
        List<Long> caseIds = clientCases.stream()
                .map(LegalCase::getId)
                .collect(Collectors.toList());

        // Get all documents for client's cases (only those shared with client)
        List<FileItem> allDocuments = new ArrayList<>();
        for (Long caseId : caseIds) {
            List<FileItem> caseDocuments = fileItemRepository.findSharedWithClientByCase(caseId);
            allDocuments.addAll(caseDocuments);
        }

        // Sort by creation date (newest first)
        allDocuments.sort((a, b) -> {
            if (a.getCreatedAt() == null) return 1;
            if (b.getCreatedAt() == null) return -1;
            return b.getCreatedAt().compareTo(a.getCreatedAt());
        });

        // Manual pagination
        int start = page * size;
        int end = Math.min(start + size, allDocuments.size());

        List<ClientPortalDocumentDTO> documents = allDocuments.subList(
                Math.min(start, allDocuments.size()),
                end
        ).stream()
                .map(this::mapToDocumentDTO)
                .collect(Collectors.toList());

        return new PageImpl<>(documents, PageRequest.of(page, size), allDocuments.size());
    }

    @Override
    public List<ClientPortalDocumentDTO> getCaseDocuments(Long userId, Long caseId) {
        if (!verifyCaseAccess(userId, caseId)) {
            throw new ApiException("You do not have access to this case");
        }

        // Only return documents that are shared with client
        List<FileItem> documents = fileItemRepository.findSharedWithClientByCase(caseId);

        return documents.stream()
                .map(this::mapToDocumentDTO)
                .collect(Collectors.toList());
    }

    @Override
    public ClientPortalDocumentDTO uploadDocument(Long userId, Long caseId, MultipartFile file, String title, String description) {
        if (!verifyCaseAccess(userId, caseId)) {
            throw new ApiException("You do not have access to this case");
        }

        Client client = getClientByUserId(userId);
        LegalCase legalCase = legalCaseRepository.findById(caseId)
                .orElseThrow(() -> new ApiException("Case not found"));

        try {
            // Upload file using FileManagerService
            FileUploadResponseDTO uploadResponse = fileManagerService.uploadFile(
                    file,
                    null, // folderId
                    caseId,
                    description,
                    null // tags
            );

            // Update the file item with additional info
            FileItem fileItem = fileItemRepository.findById(uploadResponse.getFileId())
                    .orElseThrow(() -> new ApiException("Failed to save document"));

            // Update with client-uploaded document info
            fileItem.setName(title);
            fileItem.setDocumentCategory("CLIENT_UPLOADED");
            fileItem.setDocumentStatus("pending_review");
            fileItem.setSharedWithClient(true);
            fileItem.setCreatedBy(userId);

            fileItem = fileItemRepository.save(fileItem);

            // Notify attorney(s) assigned to this case
            notifyAttorneyOfNewDocument(client, legalCase, fileItem);

            // Log case activity for recent activities feed on attorney dashboard
            try {
                String activityDescription = String.format(
                    "%s has uploaded a new document \"%s\" to case %s",
                    client.getName(),
                    title,
                    legalCase.getCaseNumber()
                );
                CreateActivityRequest activityRequest = new CreateActivityRequest();
                activityRequest.setCaseId(caseId);
                activityRequest.setActivityType("DOCUMENT_UPLOADED");
                activityRequest.setReferenceId(fileItem.getId());
                activityRequest.setReferenceType("document");
                activityRequest.setDescription(activityDescription);
                activityRequest.setUserId(userId);
                caseActivityService.createActivity(activityRequest);
            } catch (Exception e) {
                log.warn("Failed to log document upload activity: {}", e.getMessage());
            }

            log.info("Client {} uploaded document '{}' to case {}", client.getName(), title, caseId);

            return mapToDocumentDTO(fileItem);

        } catch (Exception e) {
            log.error("Error uploading document for client {}: {}", userId, e.getMessage(), e);
            throw new ApiException("Failed to upload document: " + e.getMessage());
        }
    }

    @Override
    public byte[] downloadDocument(Long userId, Long caseId, Long documentId) {
        if (!verifyCaseAccess(userId, caseId)) {
            throw new ApiException("You do not have access to this document");
        }

        // Verify document belongs to the case
        FileItem fileItem = fileItemRepository.findById(documentId)
                .orElseThrow(() -> new ApiException("Document not found"));

        if (!caseId.equals(fileItem.getCaseId())) {
            throw new ApiException("Document does not belong to this case");
        }

        try {
            String filePath = fileManagerService.getFilePath(documentId);
            return java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(filePath));
        } catch (Exception e) {
            log.error("Error downloading document {}: {}", documentId, e.getMessage());
            throw new ApiException("Failed to download document");
        }
    }

    private void notifyAttorneyOfNewDocument(Client client, LegalCase legalCase, FileItem document) {
        try {
            // Get attorneys assigned to this case
            List<CaseAssignment> assignments = caseAssignmentRepository.findActiveByCaseId(legalCase.getId());

            for (CaseAssignment assignment : assignments) {
                // Notify lead attorneys and co-counsel
                if (assignment.getRoleType() == CaseRoleType.LEAD_ATTORNEY ||
                    assignment.getRoleType() == CaseRoleType.CO_COUNSEL) {

                    Long attorneyUserId = assignment.getAssignedTo().getId();
                    String attorneyName = assignment.getAssignedTo().getFirstName();

                    String title = "New Document Uploaded by Client";
                    String message = String.format(
                            "%s has uploaded a new document \"%s\" to case %s - %s",
                            client.getName(),
                            document.getName(),
                            legalCase.getCaseNumber(),
                            legalCase.getTitle()
                    );

                    // Create notification data
                    Map<String, Object> notificationData = new HashMap<>();
                    notificationData.put("userId", attorneyUserId);
                    notificationData.put("title", title);
                    notificationData.put("message", message);
                    notificationData.put("type", "DOCUMENT_UPLOADED");
                    notificationData.put("priority", "NORMAL");
                    notificationData.put("triggeredByUserId", client.getUserId());
                    notificationData.put("triggeredByName", client.getName());
                    notificationData.put("entityId", document.getId());
                    notificationData.put("entityType", "DOCUMENT");
                    notificationData.put("url", "/file-manager?caseId=" + legalCase.getId() + "&fileId=" + document.getId());

                    notificationService.createUserNotification(notificationData);

                    log.info("Notification sent to attorney {} for new document upload", attorneyName);
                }
            }
        } catch (Exception e) {
            log.error("Failed to send notification for document upload: {}", e.getMessage());
            // Don't throw - notification failure shouldn't fail the upload
        }
    }

    private ClientPortalDocumentDTO mapToDocumentDTO(FileItem fileItem) {
        // Get case info
        String caseNumber = null;
        String caseName = null;
        if (fileItem.getCaseId() != null) {
            LegalCase legalCase = legalCaseRepository.findById(fileItem.getCaseId()).orElse(null);
            if (legalCase != null) {
                caseNumber = legalCase.getCaseNumber();
                caseName = legalCase.getTitle();
            }
        }

        return ClientPortalDocumentDTO.builder()
                .id(fileItem.getId())
                .caseId(fileItem.getCaseId())
                .caseNumber(caseNumber)
                .caseName(caseName)
                .title(fileItem.getName())
                .fileName(fileItem.getOriginalName())
                .fileType(fileItem.getMimeType())
                .category(fileItem.getDocumentCategory())
                .description(null) // FileItem doesn't have description
                .fileSize(fileItem.getSize())
                .uploadedAt(fileItem.getCreatedAt())
                .uploadedBy(fileItem.getCreatedBy() != null ? "Client" : "Attorney")
                .canDownload(true)
                .build();
    }

    // =====================================================
    // APPOINTMENTS
    // =====================================================

    @Override
    public List<ClientPortalAppointmentDTO> getClientAppointments(Long userId) {
        Client client = getClientByUserId(userId);

        // Get all appointments for this client
        List<AppointmentRequest> confirmed = appointmentRequestRepository
                .findByClientIdAndStatusOrderByPreferredDatetimeAsc(client.getId(), "CONFIRMED");

        // Also get pending appointments (awaiting attorney approval)
        List<AppointmentRequest> pending = appointmentRequestRepository
                .findByClientIdAndStatusOrderByPreferredDatetimeAsc(client.getId(), "PENDING");

        // Also get appointments with pending reschedule requests
        List<AppointmentRequest> pendingReschedule = appointmentRequestRepository
                .findByClientIdAndStatusOrderByPreferredDatetimeAsc(client.getId(), "PENDING_RESCHEDULE");

        List<AppointmentRequest> allAppointments = new ArrayList<>();
        allAppointments.addAll(confirmed);
        allAppointments.addAll(pending);
        allAppointments.addAll(pendingReschedule);

        return allAppointments.stream()
                .map(this::mapToAppointmentDTO)
                .collect(Collectors.toList());
    }

    @Override
    public ClientPortalAppointmentDTO requestAppointment(Long userId, ClientPortalAppointmentRequestDTO request) {
        Client client = getClientByUserId(userId);

        if (request.getCaseId() != null && !verifyCaseAccess(userId, request.getCaseId())) {
            throw new ApiException("You do not have access to this case");
        }

        // Find the attorney for this case
        Long attorneyId = null;
        if (request.getCaseId() != null) {
            List<CaseAssignment> assignments = caseAssignmentRepository.findActiveByCaseId(request.getCaseId());
            for (CaseAssignment assignment : assignments) {
                if (assignment.getRoleType() == CaseRoleType.LEAD_ATTORNEY) {
                    attorneyId = assignment.getAssignedTo().getId();
                    break;
                }
            }
            if (attorneyId == null && !assignments.isEmpty()) {
                // Use first available attorney if no lead attorney
                attorneyId = assignments.get(0).getAssignedTo().getId();
            }
        }

        if (attorneyId == null) {
            throw new ApiException("No attorney assigned to this case. Please contact your attorney directly.");
        }

        // Create appointment request
        AppointmentRequest appointmentRequest = AppointmentRequest.builder()
                .clientId(client.getId())
                .attorneyId(attorneyId)
                .caseId(request.getCaseId())
                .title(request.getTitle() != null ? request.getTitle() : "Client Appointment Request")
                .description(request.getDescription())
                .appointmentType(request.getType() != null ? request.getType() : "CONSULTATION")
                .preferredDatetime(request.getPreferredDateTime())
                .alternativeDatetime(request.getAlternativeDateTime())
                .isVirtual(request.isPreferVirtual())
                .notes(request.getNotes())
                .status("PENDING")
                .durationMinutes(30)
                .build();

        appointmentRequest = appointmentRequestRepository.save(appointmentRequest);

        log.info("Client {} requested appointment with attorney {} for case {}",
                client.getName(), attorneyId, request.getCaseId());

        // Notify attorney of new appointment request
        notifyAttorneyOfAppointmentRequest(client, appointmentRequest);

        return mapToAppointmentDTO(appointmentRequest);
    }

    @Override
    public void cancelAppointment(Long userId, Long appointmentId) {
        Client client = getClientByUserId(userId);

        AppointmentRequest appointment = appointmentRequestRepository.findById(appointmentId)
                .orElseThrow(() -> new ApiException("Appointment not found"));

        // Verify appointment belongs to this client
        if (!appointment.getClientId().equals(client.getId())) {
            throw new ApiException("You do not have permission to cancel this appointment");
        }

        // Check if appointment can be cancelled
        if (appointment.isCompleted()) {
            throw new ApiException("Cannot cancel a completed appointment");
        }
        if (appointment.isCancelled()) {
            throw new ApiException("Appointment is already cancelled");
        }

        // Cancel the appointment
        appointment.setStatus("CANCELLED");
        appointment.setCancelledBy("CLIENT");
        appointmentRequestRepository.save(appointment);

        log.info("Client {} cancelled appointment {}", client.getName(), appointmentId);

        // Send notification to attorney about cancellation
        sendCancellationNotificationToAttorney(appointment, client.getName());

        // Delete the calendar event if it exists
        deleteCalendarEventForAppointment(appointment);
    }

    @Override
    public ClientPortalAppointmentDTO rescheduleAppointment(Long userId, Long appointmentId, String newDateTime, String reason) {
        Client client = getClientByUserId(userId);

        AppointmentRequest appointment = appointmentRequestRepository.findById(appointmentId)
                .orElseThrow(() -> new ApiException("Appointment not found"));

        // Verify appointment belongs to this client
        if (!appointment.getClientId().equals(client.getId())) {
            throw new ApiException("You do not have permission to reschedule this appointment");
        }

        // Check if appointment can be rescheduled
        if (appointment.isCompleted()) {
            throw new ApiException("Cannot reschedule a completed appointment");
        }
        if (appointment.isCancelled()) {
            throw new ApiException("Cannot reschedule a cancelled appointment");
        }
        if (appointment.isPendingReschedule()) {
            throw new ApiException("A reschedule request is already pending for this appointment");
        }

        // Parse the new datetime
        LocalDateTime newDatetime = LocalDateTime.parse(newDateTime);

        // Store current confirmed time as backup (in case attorney declines)
        LocalDateTime currentConfirmedTime = appointment.getConfirmedDatetime() != null
                ? appointment.getConfirmedDatetime()
                : appointment.getPreferredDatetime();

        // Create reschedule REQUEST (not immediate update)
        appointment.setRequestedRescheduleTime(newDatetime);
        appointment.setRescheduleReason(reason);
        appointment.setOriginalConfirmedTime(currentConfirmedTime);
        appointment.setStatus("PENDING_RESCHEDULE");

        appointment = appointmentRequestRepository.save(appointment);

        log.info("Client {} requested reschedule for appointment {} from {} to {}",
                client.getName(), appointmentId, currentConfirmedTime, newDatetime);

        // Send notification to attorney about reschedule REQUEST
        sendRescheduleRequestNotificationToAttorney(appointment, client.getName(), currentConfirmedTime, newDatetime);

        return mapToAppointmentDTO(appointment);
    }

    /**
     * Send push notification to attorney when client requests to reschedule an appointment
     */
    private void sendRescheduleRequestNotificationToAttorney(AppointmentRequest appointment, String clientName, LocalDateTime oldDatetime, LocalDateTime newDatetime) {
        try {
            String oldDateStr = oldDatetime != null
                    ? oldDatetime.format(DateTimeFormatter.ofPattern("MMM d 'at' h:mm a"))
                    : "the original time";
            String newDateStr = newDatetime.format(DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy 'at' h:mm a"));

            String title = "Reschedule Request";
            String message = String.format(
                    "%s is requesting to reschedule their appointment from %s to %s. Please approve or decline.",
                    clientName,
                    oldDateStr,
                    newDateStr
            );

            // Send push notification via CRM notification (includes push, email, in-app)
            notificationService.sendCrmNotification(
                    title,
                    message,
                    appointment.getAttorneyId(),
                    "RESCHEDULE_REQUEST",
                    Map.of("appointmentId", appointment.getId(), "clientName", clientName,
                           "requestedTime", newDatetime.toString(), "originalTime", oldDatetime.toString())
            );

            log.info("Reschedule request notification sent to attorney {} for appointment {}", appointment.getAttorneyId(), appointment.getId());
        } catch (Exception e) {
            log.error("Failed to send reschedule request notification for appointment {}: {}", appointment.getId(), e.getMessage());
        }
    }

    /**
     * Update the calendar event when appointment is rescheduled
     */
    private void updateCalendarEventForReschedule(AppointmentRequest appointment, LocalDateTime newDatetime) {
        try {
            if (appointment.getCalendarEventId() != null) {
                log.info("Updating calendar event {} for rescheduled appointment {}", appointment.getCalendarEventId(), appointment.getId());

                // Calculate end time based on duration
                int duration = appointment.getDurationMinutes() != null ? appointment.getDurationMinutes() : 30;
                LocalDateTime endTime = newDatetime.plusMinutes(duration);

                // Create DTO with updated times
                CalendarEventDTO updateDTO = CalendarEventDTO.builder()
                        .startTime(newDatetime)
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
     * Send push notification to attorney when client cancels an appointment
     */
    private void sendCancellationNotificationToAttorney(AppointmentRequest appointment, String clientName) {
        try {
            // Format the date
            LocalDateTime appointmentTime = appointment.getConfirmedDatetime() != null ?
                    appointment.getConfirmedDatetime() : appointment.getPreferredDatetime();
            String dateStr = appointmentTime != null ?
                    appointmentTime.format(DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy 'at' h:mm a")) :
                    "the scheduled time";

            String title = "Appointment Cancelled";
            String message = String.format(
                    "%s has cancelled their appointment scheduled for %s.",
                    clientName,
                    dateStr
            );

            // Send push notification via CRM notification (includes push, email, in-app)
            notificationService.sendCrmNotification(
                    title,
                    message,
                    appointment.getAttorneyId(),
                    "APPOINTMENT_CANCELLED",
                    Map.of("appointmentId", appointment.getId(), "clientName", clientName)
            );

            log.info("Cancellation notification sent to attorney {} for appointment {}", appointment.getAttorneyId(), appointment.getId());
        } catch (Exception e) {
            log.error("Failed to send cancellation notification for appointment {}: {}", appointment.getId(), e.getMessage());
        }
    }

    /**
     * Delete the calendar event associated with an appointment
     */
    private void deleteCalendarEventForAppointment(AppointmentRequest appointment) {
        try {
            if (appointment.getCalendarEventId() != null) {
                log.info("Deleting calendar event {} for cancelled appointment {}", appointment.getCalendarEventId(), appointment.getId());
                calendarEventService.deleteEvent(appointment.getCalendarEventId());
                log.info("Successfully deleted calendar event for appointment {}", appointment.getId());
            } else {
                log.warn("No calendar event ID found for appointment {} - nothing to delete", appointment.getId());
            }
        } catch (Exception e) {
            log.error("Failed to delete calendar event for appointment {}: {}", appointment.getId(), e.getMessage());
        }
    }

    private ClientPortalAppointmentDTO mapToAppointmentDTO(AppointmentRequest appointment) {
        String caseNumber = null;
        if (appointment.getCaseId() != null) {
            LegalCase legalCase = legalCaseRepository.findById(appointment.getCaseId()).orElse(null);
            if (legalCase != null) {
                caseNumber = legalCase.getCaseNumber();
            }
        }

        // Get attorney name
        String attorneyName = null;
        if (appointment.getAttorneyId() != null) {
            User attorney = userRepository.get(appointment.getAttorneyId());
            if (attorney != null) {
                attorneyName = attorney.getFirstName() + " " + attorney.getLastName();
            }
        }

        LocalDateTime startTime = appointment.getConfirmedDatetime() != null
                ? appointment.getConfirmedDatetime()
                : appointment.getPreferredDatetime();
        LocalDateTime endTime = startTime != null
                ? startTime.plusMinutes(appointment.getDurationMinutes() != null ? appointment.getDurationMinutes() : 30)
                : null;

        return ClientPortalAppointmentDTO.builder()
                .id(appointment.getId())
                .caseId(appointment.getCaseId())
                .caseNumber(caseNumber)
                .title(appointment.getTitle())
                .description(appointment.getDescription())
                .type(appointment.getAppointmentType())
                .status(appointment.getStatus())
                .startTime(startTime)
                .endTime(endTime)
                .location(appointment.getLocation())
                .attorneyName(attorneyName)
                .isVirtual(Boolean.TRUE.equals(appointment.getIsVirtual()))
                .meetingLink(appointment.getMeetingLink())
                .requestedRescheduleTime(appointment.getRequestedRescheduleTime())
                .rescheduleReason(appointment.getRescheduleReason())
                .build();
    }

    private void notifyAttorneyOfAppointmentRequest(Client client, AppointmentRequest appointment) {
        try {
            String title = "New Appointment Request";
            String message = String.format(
                    "%s has requested an appointment for %s",
                    client.getName(),
                    appointment.getPreferredDatetime().format(java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy 'at' h:mm a"))
            );

            Map<String, Object> notificationData = new HashMap<>();
            notificationData.put("userId", appointment.getAttorneyId());
            notificationData.put("title", title);
            notificationData.put("message", message);
            notificationData.put("type", "APPOINTMENT_REQUEST");
            notificationData.put("priority", "HIGH");
            notificationData.put("triggeredByUserId", client.getUserId());
            notificationData.put("triggeredByName", client.getName());
            notificationData.put("entityId", appointment.getId());
            notificationData.put("entityType", "APPOINTMENT");
            notificationData.put("url", "/appointments?id=" + appointment.getId());

            notificationService.createUserNotification(notificationData);
            log.info("Notification sent to attorney {} for appointment request", appointment.getAttorneyId());
        } catch (Exception e) {
            log.error("Failed to send notification for appointment request: {}", e.getMessage());
        }
    }

    // =====================================================
    // MESSAGES
    // =====================================================

    @Override
    public List<ClientPortalMessageThreadDTO> getMessageThreads(Long userId) {
        Client client = getClientByUserId(userId);
        List<MessageThread> threads = messageThreadRepository.findByClientIdOrderByLastMessageAtDesc(client.getId());

        return threads.stream().map(thread -> mapToThreadDTO(thread, client.getName())).collect(Collectors.toList());
    }

    @Override
    public List<ClientPortalMessageDTO> getThreadMessages(Long userId, Long threadId) {
        Client client = getClientByUserId(userId);

        MessageThread thread = messageThreadRepository.findById(threadId)
                .orElseThrow(() -> new ApiException("Thread not found"));

        if (!thread.getClientId().equals(client.getId())) {
            throw new ApiException("You do not have access to this thread");
        }

        // Mark messages from attorney as read
        LocalDateTime readAt = LocalDateTime.now();
        int markedCount = messageRepository.markAsRead(threadId, Message.SenderType.ATTORNEY, readAt);
        thread.setUnreadByClient(0);
        messageThreadRepository.save(thread);

        // Notify ALL attorneys assigned to this case via WebSocket that their messages have been read
        if (markedCount > 0 && thread.getCaseId() != null) {
            try {
                Map<String, Object> wsMessage = new HashMap<>();
                wsMessage.put("type", "MESSAGE_READ");
                wsMessage.put("threadId", threadId);
                wsMessage.put("readAt", readAt.toString());
                wsMessage.put("readByClientId", client.getId());
                wsMessage.put("readByClientName", client.getName());

                List<Long> attorneyUserIds = getAssignedAttorneyUserIds(thread.getCaseId());
                for (Long attorneyUserId : attorneyUserIds) {
                    try {
                        webSocketHandler.sendNotificationToUser(attorneyUserId.toString(), wsMessage);
                    } catch (Exception e) {
                        log.warn("Failed to send read receipt to attorney {}: {}", attorneyUserId, e.getMessage());
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to send read receipt notification: {}", e.getMessage());
            }
        }

        List<Message> messages = messageRepository.findByThreadIdOrderByCreatedAtAsc(threadId);

        // Debug: Log read status of messages
        for (Message msg : messages) {
            log.debug("ClientPortal - Message {} (type: {}, senderId: {}) - isRead: {}, readAt: {}",
                msg.getId(), msg.getSenderType(), msg.getSenderId(), msg.getIsRead(), msg.getReadAt());
        }

        return messages.stream().map(this::mapToMessageDTO).collect(Collectors.toList());
    }

    @Override
    public ClientPortalMessageDTO sendMessage(Long userId, Long threadId, String content) {
        Client client = getClientByUserId(userId);

        MessageThread thread = messageThreadRepository.findById(threadId)
                .orElseThrow(() -> new ApiException("Thread not found"));

        if (!thread.getClientId().equals(client.getId())) {
            throw new ApiException("You do not have access to this thread");
        }

        Message message = Message.builder()
                .threadId(threadId)
                .senderId(userId)
                .senderType(Message.SenderType.CLIENT)
                .content(content)
                .isRead(false)
                .build();
        message = messageRepository.save(message);

        // Update thread (keep legacy field for backwards compatibility)
        thread.setLastMessageAt(message.getCreatedAt());
        thread.setLastMessageBy("CLIENT");
        thread.setUnreadByAttorney(thread.getUnreadByAttorney() + 1);
        messageThreadRepository.save(thread);

        // CRITICAL FIX: Increment unread count for ALL attorneys assigned to this case/thread
        // This ensures each attorney gets their own notification, not a shared one
        incrementUnreadForAllAttorneys(thread);

        // Notify attorney
        notifyAttorneyOfNewMessage(thread, client, content);

        // Send WebSocket notification for real-time update
        sendWebSocketNotification(thread, message, "ATTORNEY");

        log.info("Client {} sent message in thread {}", client.getName(), threadId);
        return mapToMessageDTO(message);
    }

    /**
     * Increment unread count for ALL attorneys associated with a thread.
     * This includes the thread owner and all attorneys assigned to the case.
     */
    private void incrementUnreadForAllAttorneys(MessageThread thread) {
        // Get all attorney user IDs for this thread
        List<Long> attorneyUserIds = getAttorneyUserIdsForThread(thread);

        for (Long attorneyUserId : attorneyUserIds) {
            ThreadAttorneyStatus status = threadAttorneyStatusRepository
                    .findByThreadIdAndAttorneyUserId(thread.getId(), attorneyUserId)
                    .orElse(null);

            if (status != null) {
                status.incrementUnread();
                threadAttorneyStatusRepository.save(status);
            } else {
                // Create new status record with unread=1
                status = ThreadAttorneyStatus.builder()
                        .threadId(thread.getId())
                        .attorneyUserId(attorneyUserId)
                        .unreadCount(1)
                        .build();
                threadAttorneyStatusRepository.save(status);
            }
        }
        log.debug("Incremented unread count for {} attorneys on thread {}",
                attorneyUserIds.size(), thread.getId());
    }

    @Override
    public ClientPortalMessageThreadDTO startNewThread(Long userId, Long caseId, String subject, String initialMessage) {
        if (!verifyCaseAccess(userId, caseId)) {
            throw new ApiException("You do not have access to this case");
        }

        Client client = getClientByUserId(userId);
        LegalCase legalCase = legalCaseRepository.findById(caseId)
                .orElseThrow(() -> new ApiException("Case not found"));

        // Find lead attorney for this case
        Long attorneyId = null;
        List<CaseAssignment> assignments = caseAssignmentRepository.findActiveByCaseId(caseId);
        for (CaseAssignment assignment : assignments) {
            if (assignment.getRoleType() == CaseRoleType.LEAD_ATTORNEY) {
                attorneyId = assignment.getAssignedTo().getId();
                break;
            }
        }
        if (attorneyId == null && !assignments.isEmpty()) {
            attorneyId = assignments.get(0).getAssignedTo().getId();
        }

        // Create thread
        MessageThread thread = MessageThread.builder()
                .caseId(caseId)
                .clientId(client.getId())
                .attorneyId(attorneyId)
                .subject(subject)
                .status(MessageThread.ThreadStatus.OPEN)
                .lastMessageBy("CLIENT")
                .unreadByClient(0)
                .unreadByAttorney(1)
                .build();
        thread = messageThreadRepository.save(thread);

        // Create initial message
        Message message = Message.builder()
                .threadId(thread.getId())
                .senderId(userId)
                .senderType(Message.SenderType.CLIENT)
                .content(initialMessage)
                .isRead(false)
                .build();
        message = messageRepository.save(message);

        // Update thread with message time
        thread.setLastMessageAt(message.getCreatedAt());
        messageThreadRepository.save(thread);

        // Notify attorney
        notifyAttorneyOfNewMessage(thread, client, initialMessage);

        // Send WebSocket notification for real-time update
        sendWebSocketNotification(thread, message, "ATTORNEY");

        log.info("Client {} started new message thread for case {}", client.getName(), caseId);
        return mapToThreadDTO(thread, client.getName());
    }

    @Override
    public void deleteThread(Long userId, Long threadId) {
        Client client = getClientByUserId(userId);

        MessageThread thread = messageThreadRepository.findById(threadId)
                .orElseThrow(() -> new ApiException("Thread not found"));

        if (!thread.getClientId().equals(client.getId())) {
            throw new ApiException("You do not have access to this thread");
        }

        // Delete all messages in the thread first (due to FK constraint)
        messageRepository.deleteByThreadId(threadId);

        // Delete the thread
        messageThreadRepository.delete(thread);

        log.info("Client {} deleted message thread {}", client.getName(), threadId);
    }

    private ClientPortalMessageThreadDTO mapToThreadDTO(MessageThread thread, String clientName) {
        String caseNumber = null;
        if (thread.getCaseId() != null) {
            LegalCase legalCase = legalCaseRepository.findById(thread.getCaseId()).orElse(null);
            if (legalCase != null) {
                caseNumber = legalCase.getCaseNumber();
            }
        }

        // Get attorney count, name, and image for client view
        // If multiple attorneys assigned, show "Your Legal Team"
        String attorneyName = "Your Legal Team";
        String attorneyImageUrl = null;
        int attorneyCount = 0;
        if (thread.getCaseId() != null) {
            List<Long> attorneyUserIds = getAssignedAttorneyUserIds(thread.getCaseId());
            attorneyCount = attorneyUserIds.size();
            if (attorneyCount == 1) {
                // Single attorney - show their name and image
                User attorney = userRepository.get(attorneyUserIds.get(0));
                if (attorney != null) {
                    attorneyName = attorney.getFirstName() + " " + attorney.getLastName();
                    // Ensure empty strings are treated as null
                    String imgUrl = attorney.getImageUrl();
                    attorneyImageUrl = (imgUrl != null && !imgUrl.trim().isEmpty()) ? imgUrl : null;
                }
            }
            // If count > 1 or 0, keep "Your Legal Team" with no specific image
        } else if (thread.getAttorneyId() != null) {
            // Fallback to thread owner if no case
            User attorney = userRepository.get(thread.getAttorneyId());
            if (attorney != null) {
                attorneyName = attorney.getFirstName() + " " + attorney.getLastName();
                // Ensure empty strings are treated as null
                String imgUrl = attorney.getImageUrl();
                attorneyImageUrl = (imgUrl != null && !imgUrl.trim().isEmpty()) ? imgUrl : null;
                attorneyCount = 1;
            }
        }

        // Get last message for preview
        List<Message> messages = messageRepository.findByThreadIdOrderByCreatedAtDesc(thread.getId());
        String lastMessage = messages.isEmpty() ? "" : messages.get(0).getContent();
        Long lastSenderId = messages.isEmpty() ? null : messages.get(0).getSenderId();
        String lastSenderType = messages.isEmpty() ? "" : messages.get(0).getSenderType().name();
        String lastSenderName = "";
        if (!messages.isEmpty()) {
            if (messages.get(0).getSenderType() == Message.SenderType.CLIENT) {
                lastSenderName = clientName;
            } else {
                // Get the actual attorney name who sent the message
                User sender = userRepository.get(messages.get(0).getSenderId());
                lastSenderName = sender != null ? (sender.getFirstName() + " " + sender.getLastName()) : attorneyName;
            }
        }

        return ClientPortalMessageThreadDTO.builder()
                .id(thread.getId())
                .caseId(thread.getCaseId())
                .caseNumber(caseNumber)
                .subject(thread.getSubject())
                .channel(thread.getChannel())
                .lastMessage(lastMessage.length() > 100 ? lastMessage.substring(0, 100) + "..." : lastMessage)
                .lastSenderId(lastSenderId)
                .lastSenderName(lastSenderName)
                .lastSenderType(lastSenderType)
                .lastMessageAt(thread.getLastMessageAt())
                .unreadCount(thread.getUnreadByClient())
                .totalMessages(messages.size())
                .status(thread.getStatus().name())
                .clientName(clientName)
                .attorneyName(attorneyName)
                .attorneyImageUrl(attorneyImageUrl)
                .attorneyCount(attorneyCount)
                .build();
    }

    private ClientPortalMessageDTO mapToMessageDTO(Message message) {
        String senderName = "Unknown";
        String senderImageUrl = null;

        if (message.getSenderType() == Message.SenderType.CLIENT) {
            Client client = clientRepository.findByUserId(message.getSenderId());
            if (client != null) {
                senderName = client.getName();
                // Get client image - try Client first, then fallback to User
                senderImageUrl = client.getImageUrl();
                if (senderImageUrl == null || senderImageUrl.trim().isEmpty()) {
                    User clientUser = userRepository.get(message.getSenderId());
                    if (clientUser != null) {
                        senderImageUrl = clientUser.getImageUrl();
                    }
                }
            }
        } else {
            User user = userRepository.get(message.getSenderId());
            if (user != null) {
                senderName = user.getFirstName() + " " + user.getLastName();
                String imgUrl = user.getImageUrl();
                senderImageUrl = (imgUrl != null && !imgUrl.trim().isEmpty()) ? imgUrl : null;
            }
        }

        return ClientPortalMessageDTO.builder()
                .id(message.getId())
                .threadId(message.getThreadId())
                .senderId(message.getSenderId())
                .senderName(senderName)
                .senderImageUrl(senderImageUrl)
                .senderType(message.getSenderType().name())
                .channel(message.getChannel())
                .content(message.getContent())
                .sentAt(message.getCreatedAt())
                .isRead(Boolean.TRUE.equals(message.getIsRead()))
                .readAt(message.getReadAt())
                .hasAttachment(Boolean.TRUE.equals(message.getHasAttachment()))
                .build();
    }

    private void notifyAttorneyOfNewMessage(MessageThread thread, Client client, String messagePreview) {
        if (thread.getCaseId() == null) return;

        try {
            String preview = messagePreview.length() > 50 ? messagePreview.substring(0, 50) + "..." : messagePreview;

            // Notify ALL attorneys assigned to this case
            List<Long> attorneyUserIds = getAssignedAttorneyUserIds(thread.getCaseId());
            for (Long attorneyUserId : attorneyUserIds) {
                try {
                    Map<String, Object> notificationData = new HashMap<>();
                    notificationData.put("userId", attorneyUserId);
                    notificationData.put("title", "New Message from " + client.getName());
                    notificationData.put("message", preview);
                    notificationData.put("type", "CLIENT_MESSAGE");
                    notificationData.put("priority", "NORMAL");
                    notificationData.put("triggeredByUserId", client.getUserId());
                    notificationData.put("triggeredByName", client.getName());
                    notificationData.put("entityId", thread.getId());
                    notificationData.put("entityType", "MESSAGE_THREAD");
                    notificationData.put("url", "/messages?threadId=" + thread.getId());

                    notificationService.createUserNotification(notificationData);
                } catch (Exception e) {
                    log.warn("Failed to notify attorney {}: {}", attorneyUserId, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Failed to send message notification: {}", e.getMessage());
        }
    }

    // =====================================================
    // INVOICES & BILLING
    // =====================================================

    @Override
    public Page<ClientPortalInvoiceDTO> getClientInvoices(Long userId, int page, int size) {
        Client client = getClientByUserId(userId);

        Pageable pageable = PageRequest.of(page, size, Sort.by("issueDate").descending());
        Page<com.bostoneo.bostoneosolutions.model.Invoice> invoices = invoiceRepository.findByClientId(client.getId(), pageable);

        List<ClientPortalInvoiceDTO> dtos = invoices.getContent().stream()
            .map(this::mapToClientPortalInvoiceDTO)
            .collect(Collectors.toList());

        return new PageImpl<>(dtos, pageable, invoices.getTotalElements());
    }

    @Override
    public ClientPortalInvoiceDTO getInvoice(Long userId, Long invoiceId) {
        Client client = getClientByUserId(userId);

        com.bostoneo.bostoneosolutions.model.Invoice invoice = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new ApiException("Invoice not found"));

        // Verify invoice belongs to this client
        if (!invoice.getClientId().equals(client.getId())) {
            throw new ApiException("Invoice not found");
        }

        return mapToClientPortalInvoiceDTO(invoice);
    }

    private ClientPortalInvoiceDTO mapToClientPortalInvoiceDTO(com.bostoneo.bostoneosolutions.model.Invoice invoice) {
        return ClientPortalInvoiceDTO.builder()
            .id(invoice.getId())
            .invoiceNumber(invoice.getInvoiceNumber())
            .caseId(invoice.getLegalCaseId())
            .caseName(invoice.getCaseName())
            .amount(invoice.getTotalAmount())
            .amountPaid(invoice.getTotalPaid() != null ? invoice.getTotalPaid() : BigDecimal.ZERO)
            .balanceDue(invoice.getBalanceDue() != null ? invoice.getBalanceDue() : invoice.getTotalAmount())
            .status(invoice.getStatus() != null ? invoice.getStatus().name() : "DRAFT")
            .invoiceDate(invoice.getIssueDate())
            .dueDate(invoice.getDueDate())
            .description(invoice.getNotes())
            .canPayOnline(true)
            .build();
    }

    // =====================================================
    // DASHBOARD
    // =====================================================

    @Override
    public ClientPortalDashboardDTO getDashboardData(Long userId) {
        Client client = getClientByUserId(userId);

        // Get client's cases
        List<LegalCase> clientCases = legalCaseRepository.findAllByClientNameIgnoreCase(client.getName());

        int activeCases = (int) clientCases.stream()
                .filter(c -> c.getStatus() != null && !c.getStatus().name().equals("CLOSED"))
                .count();
        int closedCases = clientCases.size() - activeCases;

        // Count documents shared with client
        List<Long> caseIds = clientCases.stream()
                .map(LegalCase::getId)
                .collect(Collectors.toList());

        int totalDocuments = 0;
        int recentDocuments = 0;
        if (!caseIds.isEmpty()) {
            List<FileItem> sharedDocuments = fileItemRepository.findByCaseIdInAndSharedWithClientTrue(caseIds);
            totalDocuments = sharedDocuments.size();

            // Count documents from last 30 days
            LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
            recentDocuments = (int) sharedDocuments.stream()
                    .filter(d -> d.getCreatedAt() != null && d.getCreatedAt().isAfter(thirtyDaysAgo))
                    .count();
        }

        // Count upcoming appointments
        List<AppointmentRequest> upcomingAppts = appointmentRequestRepository
                .findUpcomingByClientId(client.getId(), LocalDateTime.now());
        int upcomingAppointmentsCount = upcomingAppts.size();

        // Get next appointment
        ClientPortalAppointmentDTO nextAppointment = null;
        if (!upcomingAppts.isEmpty()) {
            nextAppointment = mapToAppointmentDTO(upcomingAppts.get(0));
        }

        // Build recent cases list
        List<ClientPortalCaseDTO> recentCases = clientCases.stream()
                .sorted((a, b) -> {
                    if (a.getCreatedAt() == null) return 1;
                    if (b.getCreatedAt() == null) return -1;
                    return b.getCreatedAt().compareTo(a.getCreatedAt());
                })
                .limit(5)
                .map(this::mapToCaseDTO)
                .collect(Collectors.toList());

        return ClientPortalDashboardDTO.builder()
                .clientName(client.getName())
                .clientEmail(client.getEmail())
                .clientImageUrl(client.getImageUrl())
                .totalCases(clientCases.size())
                .activeCases(activeCases)
                .closedCases(closedCases)
                .totalDocuments(totalDocuments)
                .recentDocuments(recentDocuments)
                .upcomingAppointments(upcomingAppointmentsCount)
                .nextAppointment(nextAppointment)
                .unreadMessages(0) // TODO: Count unread
                .totalOutstanding(BigDecimal.ZERO) // TODO: Calculate from invoices
                .pendingInvoices(0)
                .recentActivity(new ArrayList<>()) // TODO: Get recent activity
                .recentCases(recentCases)
                .build();
    }

    // =====================================================
    // SECURITY
    // =====================================================

    @Override
    public boolean verifyClientAccess(Long userId, Long clientId) {
        Client client = clientRepository.findByUserId(userId);
        return client != null && client.getId().equals(clientId);
    }

    @Override
    public boolean verifyCaseAccess(Long userId, Long caseId) {
        Client client = clientRepository.findByUserId(userId);
        if (client == null) {
            return false;
        }

        // Check if case belongs to this client
        LegalCase legalCase = legalCaseRepository.findById(caseId).orElse(null);
        if (legalCase == null) {
            return false;
        }

        // Check if client name matches
        return client.getName().equalsIgnoreCase(legalCase.getClientName());
    }

    @Override
    public Long getClientIdForUser(Long userId) {
        Client client = clientRepository.findByUserId(userId);
        return client != null ? client.getId() : null;
    }

    // =====================================================
    // HELPER METHODS
    // =====================================================

    private Client getClientByUserId(Long userId) {
        Client client = clientRepository.findByUserId(userId);
        if (client == null) {
            throw new ApiException("Client profile not found for this user");
        }
        return client;
    }

    private ClientPortalProfileDTO mapToProfileDTO(Client client) {
        return ClientPortalProfileDTO.builder()
                .id(client.getId())
                .userId(client.getUserId())
                .name(client.getName())
                .email(client.getEmail())
                .phone(client.getPhone())
                .address(client.getAddress())
                .type(client.getType())
                .status(client.getStatus())
                .imageUrl(client.getImageUrl())
                .build();
    }

    private ClientPortalCaseDTO mapToCaseDTO(LegalCase legalCase) {
        // Convert Date to LocalDateTime properly
        LocalDateTime openDate = null;
        if (legalCase.getFilingDate() != null) {
            // java.sql.Date doesn't support toInstant(), so convert via getTime()
            openDate = LocalDateTime.ofInstant(
                    java.time.Instant.ofEpochMilli(legalCase.getFilingDate().getTime()),
                    java.time.ZoneId.systemDefault()
            );
        } else if (legalCase.getCreatedAt() != null) {
            openDate = LocalDateTime.ofInstant(
                    java.time.Instant.ofEpochMilli(legalCase.getCreatedAt().getTime()),
                    java.time.ZoneId.systemDefault()
            );
        }

        LocalDateTime lastUpdated = legalCase.getUpdatedAt() != null
                ? LocalDateTime.ofInstant(
                        java.time.Instant.ofEpochMilli(legalCase.getUpdatedAt().getTime()),
                        java.time.ZoneId.systemDefault()
                )
                : null;

        // Get all assigned attorneys
        String attorneyName = null;
        List<String> assignedAttorneys = new ArrayList<>();
        try {
            List<CaseAssignment> assignments = caseAssignmentRepository.findActiveByCaseId(legalCase.getId());
            String leadAttorneyName = null;
            for (CaseAssignment assignment : assignments) {
                String fullName = assignment.getAssignedTo().getFirstName() + " " + assignment.getAssignedTo().getLastName();
                assignedAttorneys.add(fullName);
                if (assignment.getRoleType() == CaseRoleType.LEAD_ATTORNEY && leadAttorneyName == null) {
                    leadAttorneyName = fullName;
                }
            }
            // Set display name: single attorney shows their name, multiple shows "Your Legal Team"
            if (assignedAttorneys.size() == 1) {
                attorneyName = assignedAttorneys.get(0);
            } else if (assignedAttorneys.size() > 1) {
                attorneyName = leadAttorneyName != null ? leadAttorneyName : "Your Legal Team";
            }
        } catch (Exception e) {
            log.warn("Could not get attorney for case {}: {}", legalCase.getId(), e.getMessage());
        }

        // Get document count (only shared documents for client portal)
        int documentCount = 0;
        try {
            List<FileItem> documents = fileItemRepository.findSharedWithClientByCase(legalCase.getId());
            documentCount = documents != null ? documents.size() : 0;
        } catch (Exception e) {
            log.warn("Could not get document count for case {}: {}", legalCase.getId(), e.getMessage());
        }

        return ClientPortalCaseDTO.builder()
                .id(legalCase.getId())
                .caseNumber(legalCase.getCaseNumber())
                .title(legalCase.getTitle())
                .type(legalCase.getType())
                .status(legalCase.getStatus() != null ? legalCase.getStatus().name() : null)
                .description(legalCase.getDescription())
                .attorneyName(attorneyName)
                .assignedAttorneys(assignedAttorneys)
                .openDate(openDate)
                .lastUpdated(lastUpdated)
                .documentCount(documentCount)
                .upcomingAppointments(0) // TODO: Get from calendar events
                .build();
    }

    private void sendWebSocketNotification(MessageThread thread, Message message, String recipientType) {
        try {
            // Get sender info for the notification
            String senderName = "Unknown";
            String senderImageUrl = null;
            if (message.getSenderType() == Message.SenderType.CLIENT) {
                Client client = clientRepository.findByUserId(message.getSenderId());
                if (client != null) {
                    senderName = client.getName();
                    senderImageUrl = client.getImageUrl();
                    // Fallback to user image if client image is empty
                    if (senderImageUrl == null || senderImageUrl.isEmpty()) {
                        User clientUser = userRepository.get(message.getSenderId());
                        if (clientUser != null) senderImageUrl = clientUser.getImageUrl();
                    }
                }
            } else {
                User user = userRepository.get(message.getSenderId());
                if (user != null) {
                    senderName = user.getFirstName() + " " + user.getLastName();
                    senderImageUrl = user.getImageUrl();
                }
            }

            Map<String, Object> wsMessage = new HashMap<>();
            wsMessage.put("type", "NEW_MESSAGE");
            wsMessage.put("threadId", thread.getId());
            wsMessage.put("messageId", message.getId());
            wsMessage.put("content", message.getContent());
            wsMessage.put("senderId", message.getSenderId());
            wsMessage.put("senderType", message.getSenderType().name());
            wsMessage.put("senderName", senderName);
            wsMessage.put("senderImageUrl", senderImageUrl);
            wsMessage.put("sentAt", message.getCreatedAt().toString());

            if ("ATTORNEY".equals(recipientType)) {
                // Notify ALL attorneys (thread owner + case assignments)
                List<Long> attorneyUserIds = getAttorneyUserIdsForThread(thread);
                for (Long attorneyUserId : attorneyUserIds) {
                    try {
                        webSocketHandler.sendNotificationToUser(attorneyUserId.toString(), wsMessage);
                        log.debug("WebSocket notification sent to attorney user {}", attorneyUserId);
                    } catch (Exception e) {
                        log.warn("Failed to send WebSocket to attorney {}: {}", attorneyUserId, e.getMessage());
                    }
                }
            } else {
                // Notify client
                Client client = clientRepository.findById(thread.getClientId()).orElse(null);
                if (client != null && client.getUserId() != null) {
                    webSocketHandler.sendNotificationToUser(client.getUserId().toString(), wsMessage);
                    log.debug("WebSocket notification sent to client user {}", client.getUserId());
                }
            }
        } catch (Exception e) {
            log.error("Failed to send WebSocket notification: {}", e.getMessage());
        }
    }

    /**
     * Get all attorney user IDs assigned to a case.
     * Used for notifications and display purposes.
     */
    private List<Long> getAssignedAttorneyUserIds(Long caseId) {
        List<Long> attorneyUserIds = new ArrayList<>();
        if (caseId == null) return attorneyUserIds;

        try {
            List<CaseAssignment> assignments = caseAssignmentRepository.findActiveByCaseId(caseId);
            for (CaseAssignment assignment : assignments) {
                if (assignment.getAssignedTo() != null) {
                    attorneyUserIds.add(assignment.getAssignedTo().getId());
                }
            }
        } catch (Exception e) {
            log.warn("Failed to get assigned attorneys for case {}: {}", caseId, e.getMessage());
        }

        return attorneyUserIds;
    }

    /**
     * Get all attorney user IDs that should be notified for a thread.
     * Includes both case assignments AND the thread owner.
     * Used specifically for WebSocket message notifications.
     */
    private List<Long> getAttorneyUserIdsForThread(MessageThread thread) {
        java.util.Set<Long> attorneyUserIds = new java.util.HashSet<>();

        // Always include the thread owner
        if (thread.getAttorneyId() != null) {
            attorneyUserIds.add(thread.getAttorneyId());
        }

        // Include all attorneys assigned to the case
        if (thread.getCaseId() != null) {
            attorneyUserIds.addAll(getAssignedAttorneyUserIds(thread.getCaseId()));
        }

        return new ArrayList<>(attorneyUserIds);
    }
}
