package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.DocumentVersionDTO;
import com.bostoneo.bostoneosolutions.model.DocumentVersion;
import com.bostoneo.bostoneosolutions.util.CustomHttpResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Service interface for document version management
 */
public interface DocumentVersionService {
    
    /**
     * Get a specific version by its ID
     */
    CustomHttpResponse<DocumentVersion> getVersionById(Long id);
    
    /**
     * Get all versions for a document
     */
    CustomHttpResponse<List<DocumentVersion>> getVersionsByDocumentId(Long documentId);
    
    /**
     * Upload a new version of a document
     */
    CustomHttpResponse<DocumentVersion> uploadNewVersion(Long documentId, MultipartFile file, String comment, Long uploadedBy);
    
    /**
     * Download a specific version of a document
     */
    byte[] downloadVersion(Long documentId, Long versionId);
} 