package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.CaseActivityDTO;
import com.bostoneo.bostoneosolutions.dto.DocumentDTO;
import com.bostoneo.bostoneosolutions.dto.DocumentVersionDTO;
import com.bostoneo.bostoneosolutions.dto.LegalCaseDTO;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface LegalCaseService {
    // Create and Update
    LegalCaseDTO createCase(LegalCaseDTO caseDTO);
    LegalCaseDTO updateCase(Long id, LegalCaseDTO caseDTO);
    
    // Retrieve
    LegalCaseDTO getCase(Long id);
    LegalCaseDTO getCaseByNumber(String caseNumber);
    Page<LegalCaseDTO> getAllCases(int page, int size);
    Page<LegalCaseDTO> searchCasesByTitle(String title, int page, int size);
    Page<LegalCaseDTO> searchCasesByClientName(String clientName, int page, int size);
    Page<LegalCaseDTO> getCasesByStatus(CaseStatus status, int page, int size);
    Page<LegalCaseDTO> getCasesByType(String type, int page, int size);
    
    // Delete
    void deleteCase(Long id);
    
    // Status Management
    LegalCaseDTO updateCaseStatus(Long id, CaseStatus status);
    
    // Document Management
    List<DocumentDTO> getCaseDocuments(Long caseId);
    DocumentDTO uploadDocument(Long caseId, MultipartFile file, String title, String type, String category, String description, String tags, UserDTO user);
    DocumentDTO getDocument(Long caseId, Long documentId);
    void deleteDocument(Long caseId, Long documentId);
    Resource downloadDocument(Long caseId, Long documentId);
    DocumentVersionDTO uploadNewDocumentVersion(Long caseId, Long documentId, MultipartFile file, String notes);
    List<DocumentVersionDTO> getDocumentVersions(Long caseId, Long documentId);
    Resource downloadDocumentVersion(Long caseId, Long documentId, Long versionId);
    
    // Case Activities
    List<CaseActivityDTO> getCaseActivities(Long caseId);
    CaseActivityDTO logCaseActivity(CaseActivityDTO activityDTO);
} 