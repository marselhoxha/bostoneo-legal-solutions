package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.dto.filemanager.FileUploadResponseDTO;
import com.bostoneo.bostoneosolutions.enumeration.CaseRoleType;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.Client;
import com.bostoneo.bostoneosolutions.model.FileItem;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.CaseAssignment;
import com.bostoneo.bostoneosolutions.repository.ClientRepository;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.repository.CalendarEventRepository;
import com.bostoneo.bostoneosolutions.repository.InvoiceRepository;
import com.bostoneo.bostoneosolutions.repository.FileItemRepository;
import com.bostoneo.bostoneosolutions.repository.CaseAssignmentRepository;
import com.bostoneo.bostoneosolutions.service.ClientPortalService;
import com.bostoneo.bostoneosolutions.service.FileManagerService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.service.CaseActivityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
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
    private final InvoiceRepository invoiceRepository;
    private final FileManagerService fileManagerService;
    private final FileItemRepository fileItemRepository;
    private final CaseAssignmentRepository caseAssignmentRepository;
    private final NotificationService notificationService;
    private final CaseActivityService caseActivityService;

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

        // Get cases for this client
        List<LegalCase> clientCases = legalCaseRepository.findAllByClientNameIgnoreCase(client.getName());
        List<Long> caseIds = clientCases.stream().map(LegalCase::getId).collect(Collectors.toList());

        if (caseIds.isEmpty()) {
            return new ArrayList<>();
        }

        // Get events for client's cases
        // TODO: Filter events by case IDs
        return new ArrayList<>();
    }

    @Override
    public ClientPortalAppointmentDTO requestAppointment(Long userId, ClientPortalAppointmentRequestDTO request) {
        if (request.getCaseId() != null && !verifyCaseAccess(userId, request.getCaseId())) {
            throw new ApiException("You do not have access to this case");
        }

        // TODO: Create appointment request
        throw new ApiException("Appointment request not yet implemented");
    }

    @Override
    public void cancelAppointment(Long userId, Long appointmentId) {
        // TODO: Verify appointment belongs to client and cancel
        throw new ApiException("Appointment cancellation not yet implemented");
    }

    // =====================================================
    // MESSAGES
    // =====================================================

    @Override
    public List<ClientPortalMessageThreadDTO> getMessageThreads(Long userId) {
        // TODO: Implement message threads
        return new ArrayList<>();
    }

    @Override
    public List<ClientPortalMessageDTO> getThreadMessages(Long userId, Long threadId) {
        // TODO: Implement thread messages
        return new ArrayList<>();
    }

    @Override
    public ClientPortalMessageDTO sendMessage(Long userId, Long threadId, String content) {
        // TODO: Implement send message
        throw new ApiException("Messaging not yet implemented");
    }

    @Override
    public ClientPortalMessageThreadDTO startNewThread(Long userId, Long caseId, String subject, String initialMessage) {
        if (!verifyCaseAccess(userId, caseId)) {
            throw new ApiException("You do not have access to this case");
        }

        // TODO: Implement new thread
        throw new ApiException("Messaging not yet implemented");
    }

    // =====================================================
    // INVOICES & BILLING
    // =====================================================

    @Override
    public Page<ClientPortalInvoiceDTO> getClientInvoices(Long userId, int page, int size) {
        Client client = getClientByUserId(userId);

        // TODO: Get invoices for client
        return new PageImpl<>(new ArrayList<>(), PageRequest.of(page, size), 0);
    }

    @Override
    public ClientPortalInvoiceDTO getInvoice(Long userId, Long invoiceId) {
        // TODO: Verify invoice belongs to client and return
        throw new ApiException("Invoice retrieval not yet implemented");
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
                .upcomingAppointments(0) // TODO: Count appointments
                .nextAppointment(null)
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

        // Get lead attorney name
        String attorneyName = null;
        try {
            List<CaseAssignment> assignments = caseAssignmentRepository.findActiveByCaseId(legalCase.getId());
            for (CaseAssignment assignment : assignments) {
                if (assignment.getRoleType() == CaseRoleType.LEAD_ATTORNEY) {
                    attorneyName = assignment.getAssignedTo().getFirstName() + " " + assignment.getAssignedTo().getLastName();
                    break;
                }
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
                .openDate(openDate)
                .lastUpdated(lastUpdated)
                .documentCount(documentCount)
                .upcomingAppointments(0) // TODO: Get from calendar events
                .build();
    }
}
