package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.*;
import org.springframework.data.domain.Page;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Service interface for Client Portal operations.
 * All methods ensure data is scoped to the authenticated client only.
 */
public interface ClientPortalService {

    // =====================================================
    // CLIENT PROFILE
    // =====================================================

    /**
     * Get the client record associated with the logged-in user
     */
    ClientPortalProfileDTO getClientProfile(Long userId);

    /**
     * Update client profile information
     */
    ClientPortalProfileDTO updateClientProfile(Long userId, ClientPortalProfileDTO profileDTO);

    // =====================================================
    // CASES
    // =====================================================

    /**
     * Get all cases for the authenticated client
     */
    Page<ClientPortalCaseDTO> getClientCases(Long userId, int page, int size);

    /**
     * Get a specific case - only if it belongs to the client
     */
    ClientPortalCaseDTO getClientCase(Long userId, Long caseId);

    // =====================================================
    // DOCUMENTS
    // =====================================================

    /**
     * Get all documents for the client's cases
     */
    Page<ClientPortalDocumentDTO> getClientDocuments(Long userId, int page, int size);

    /**
     * Get documents for a specific case - only if case belongs to client
     */
    List<ClientPortalDocumentDTO> getCaseDocuments(Long userId, Long caseId);

    /**
     * Upload a document to a case - only if case belongs to client
     */
    ClientPortalDocumentDTO uploadDocument(Long userId, Long caseId, MultipartFile file, String title, String description);

    /**
     * Download a document - only if it belongs to client's case
     */
    byte[] downloadDocument(Long userId, Long caseId, Long documentId);

    // =====================================================
    // APPOINTMENTS
    // =====================================================

    /**
     * Get all appointments for the client
     */
    List<ClientPortalAppointmentDTO> getClientAppointments(Long userId);

    /**
     * Request a new appointment
     */
    ClientPortalAppointmentDTO requestAppointment(Long userId, ClientPortalAppointmentRequestDTO request);

    /**
     * Cancel an appointment - only if it belongs to client
     */
    void cancelAppointment(Long userId, Long appointmentId);

    // =====================================================
    // MESSAGES
    // =====================================================

    /**
     * Get message threads for the client
     */
    List<ClientPortalMessageThreadDTO> getMessageThreads(Long userId);

    /**
     * Get messages in a thread
     */
    List<ClientPortalMessageDTO> getThreadMessages(Long userId, Long threadId);

    /**
     * Send a message
     */
    ClientPortalMessageDTO sendMessage(Long userId, Long threadId, String content);

    /**
     * Start a new message thread
     */
    ClientPortalMessageThreadDTO startNewThread(Long userId, Long caseId, String subject, String initialMessage);

    // =====================================================
    // INVOICES & BILLING
    // =====================================================

    /**
     * Get all invoices for the client
     */
    Page<ClientPortalInvoiceDTO> getClientInvoices(Long userId, int page, int size);

    /**
     * Get a specific invoice - only if it belongs to client
     */
    ClientPortalInvoiceDTO getInvoice(Long userId, Long invoiceId);

    // =====================================================
    // DASHBOARD
    // =====================================================

    /**
     * Get dashboard summary data for the client
     */
    ClientPortalDashboardDTO getDashboardData(Long userId);

    // =====================================================
    // SECURITY
    // =====================================================

    /**
     * Verify that the logged-in user has access to the specified client
     */
    boolean verifyClientAccess(Long userId, Long clientId);

    /**
     * Verify that the logged-in user has access to the specified case
     */
    boolean verifyCaseAccess(Long userId, Long caseId);

    /**
     * Get the client ID for the logged-in user
     */
    Long getClientIdForUser(Long userId);
}
