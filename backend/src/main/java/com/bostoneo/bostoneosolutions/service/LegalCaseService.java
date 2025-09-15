package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.CaseActivityDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.CaseDocumentDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.DocumentDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.DocumentVersionDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.LegalCaseDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.UserDTO;
import com.***REMOVED***.***REMOVED***solutions.enumeration.CaseStatus;
import com.***REMOVED***.***REMOVED***solutions.model.LegalCase;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.web.multipart.MultipartFile;

import java.util.Collection;
import java.util.List;

public interface LegalCaseService {
    // Create and Update
    LegalCaseDTO createCase(LegalCaseDTO caseDTO);
    LegalCaseDTO updateCase(Long id, LegalCaseDTO caseDTO);
    
    // Retrieve
    LegalCaseDTO getCase(Long id);
    
    // Add role-based case retrieval
    LegalCaseDTO getCaseForUser(Long id, Long userId, Collection<String> roles);
    
    LegalCaseDTO getCaseByNumber(String caseNumber);
    Page<LegalCaseDTO> getAllCases(int page, int size);
    Page<LegalCaseDTO> getCasesForUser(Long userId, int page, int size);
    Page<LegalCaseDTO> searchCasesByTitle(String title, int page, int size);
    Page<LegalCaseDTO> searchCasesByClientName(String clientName, int page, int size);
    Page<LegalCaseDTO> getCasesByStatus(CaseStatus status, int page, int size);
    Page<LegalCaseDTO> getCasesByType(String type, int page, int size);
    Page<LegalCaseDTO> getCasesByClientId(Long clientId, int page, int size);
    
    // Delete
    void deleteCase(Long id);
    
    // Status Management
    LegalCaseDTO updateCaseStatus(Long id, CaseStatus status);
    
    // Document Management
    List<DocumentDTO> getCaseDocuments(Long caseId);
    
    // Add role-based document filtering
    List<CaseDocumentDTO> getCaseDocumentsForUser(Long caseId, Long userId, Collection<String> roles);
    
    DocumentDTO uploadDocument(Long caseId, MultipartFile file, String title, String type, String category, String description, String tags, UserDTO user);
    DocumentDTO getDocument(Long caseId, Long documentId);
    void deleteDocument(Long caseId, Long documentId);
    Resource downloadDocument(Long caseId, Long documentId);
    DocumentVersionDTO uploadNewDocumentVersion(Long caseId, Long documentId, MultipartFile file, String notes, Long uploadedBy);
    List<DocumentVersionDTO> getDocumentVersions(Long caseId, Long documentId);
    Resource downloadDocumentVersion(Long caseId, Long documentId, Long versionId);
    
    // Case Activities
    List<CaseActivityDTO> getCaseActivities(Long caseId);
    
    // Add role-based activity filtering
    List<CaseActivityDTO> getCaseActivitiesForUser(Long caseId, Long userId, Collection<String> roles);
    
    CaseActivityDTO logCaseActivity(CaseActivityDTO activityDTO);
} 