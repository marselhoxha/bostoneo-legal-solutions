package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.LegalCaseDTO;
import com.***REMOVED***.***REMOVED***solutions.enumeration.CaseStatus;
import com.***REMOVED***.***REMOVED***solutions.model.LegalCase;
import org.springframework.data.domain.Page;

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
} 