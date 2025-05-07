package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.LegalDocumentDTO;
import com.***REMOVED***.***REMOVED***solutions.model.LegalDocument;
import com.***REMOVED***.***REMOVED***solutions.util.CustomHttpResponse;
import org.springframework.data.domain.Page;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface LegalDocumentService {
    CustomHttpResponse<List<LegalDocument>> getAllDocuments();
    CustomHttpResponse<Page<LegalDocument>> getDocumentsPaged(int page, int size);
    CustomHttpResponse<LegalDocument> getDocumentById(Long id);
    CustomHttpResponse<List<LegalDocument>> getDocumentsByCaseId(Long caseId);
    CustomHttpResponse<LegalDocument> createDocument(LegalDocumentDTO document);
    CustomHttpResponse<LegalDocument> updateDocument(Long id, LegalDocumentDTO document);
    CustomHttpResponse<Void> deleteDocument(Long id);
    CustomHttpResponse<LegalDocument> uploadDocument(MultipartFile file, String documentData);
    byte[] downloadDocument(Long id);
} 
 
 