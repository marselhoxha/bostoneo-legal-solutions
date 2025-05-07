package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.CaseActivityDTO;
import com.bostoneo.bostoneosolutions.dto.DocumentDTO;
import com.bostoneo.bostoneosolutions.dto.DocumentVersionDTO;
import com.bostoneo.bostoneosolutions.dto.LegalCaseDTO;
import com.bostoneo.bostoneosolutions.dto.LegalDocumentDTO;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.dto.CreateActivityRequest;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.enumeration.DocumentStatus;
import com.bostoneo.bostoneosolutions.enumeration.DocumentType;
import com.bostoneo.bostoneosolutions.enumeration.DocumentCategory;
import com.bostoneo.bostoneosolutions.exception.LegalCaseException;
import com.bostoneo.bostoneosolutions.dtomapper.LegalCaseDTOMapper;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.LegalDocument;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.model.DocumentVersion;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.repository.DocumentVersionRepository;
import com.bostoneo.bostoneosolutions.service.LegalCaseService;
import com.bostoneo.bostoneosolutions.service.LegalDocumentService;
import com.bostoneo.bostoneosolutions.service.UserService;
import com.bostoneo.bostoneosolutions.service.CaseActivityService;
import com.bostoneo.bostoneosolutions.util.CustomHttpResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class LegalCaseServiceImpl implements LegalCaseService {

    private final LegalCaseRepository legalCaseRepository;
    private final LegalCaseDTOMapper legalCaseDTOMapper;
    private final LegalDocumentService documentService;
    private final ObjectMapper objectMapper;
    private final UserService userService;
    private final DocumentVersionRepository documentVersionRepository;
    private final CaseActivityService caseActivityService;

    @Override
    public LegalCaseDTO createCase(LegalCaseDTO caseDTO) {
        LegalCase legalCase = legalCaseDTOMapper.toEntity(caseDTO);
        legalCase = legalCaseRepository.save(legalCase);
        return legalCaseDTOMapper.toDTO(legalCase);
    }

    @Override
    public LegalCaseDTO updateCase(Long id, LegalCaseDTO caseDTO) {
        LegalCase existingCase = legalCaseRepository.findById(id)
            .orElseThrow(() -> new LegalCaseException("Case not found with id: " + id));
        
        // Update fields from DTO
        existingCase.setTitle(caseDTO.getTitle());
        existingCase.setClientName(caseDTO.getClientName());
        existingCase.setClientEmail(caseDTO.getClientEmail());
        existingCase.setClientPhone(caseDTO.getClientPhone());
        existingCase.setClientAddress(caseDTO.getClientAddress());
        existingCase.setStatus(caseDTO.getStatus());
        existingCase.setPriority(caseDTO.getPriority());
        existingCase.setType(caseDTO.getType());
        existingCase.setDescription(caseDTO.getDescription());
        
        // Update court info
        existingCase.setCourtName(caseDTO.getCourtName());
        existingCase.setCourtroom(caseDTO.getCourtroom());
        existingCase.setJudgeName(caseDTO.getJudgeName());
        
        // Update important dates
        existingCase.setFilingDate(caseDTO.getFilingDate());
        existingCase.setNextHearing(caseDTO.getNextHearing());
        existingCase.setTrialDate(caseDTO.getTrialDate());
        
        // Update billing info
        existingCase.setHourlyRate(caseDTO.getHourlyRate());
        existingCase.setTotalHours(caseDTO.getTotalHours());
        existingCase.setTotalAmount(caseDTO.getTotalAmount());
        existingCase.setPaymentStatus(caseDTO.getPaymentStatus());
        
        existingCase = legalCaseRepository.save(existingCase);
        return legalCaseDTOMapper.toDTO(existingCase);
    }

    @Override
    public LegalCaseDTO getCase(Long id) {
        LegalCase legalCase = legalCaseRepository.findById(id)
            .orElseThrow(() -> new LegalCaseException("Case not found with id: " + id));
        return legalCaseDTOMapper.toDTO(legalCase);
    }

    @Override
    public LegalCaseDTO getCaseByNumber(String caseNumber) {
        LegalCase legalCase = legalCaseRepository.findByCaseNumber(caseNumber)
            .orElseThrow(() -> new LegalCaseException("Case not found with number: " + caseNumber));
        return legalCaseDTOMapper.toDTO(legalCase);
    }

    @Override
    public Page<LegalCaseDTO> getAllCases(int page, int size) {
        Page<LegalCase> cases = legalCaseRepository.findAll(PageRequest.of(page, size));
        return cases.map(legalCaseDTOMapper::toDTO);
    }

    @Override
    public Page<LegalCaseDTO> searchCasesByTitle(String title, int page, int size) {
        Page<LegalCase> cases = legalCaseRepository.findByTitleContainingIgnoreCase(title, PageRequest.of(page, size));
        return cases.map(legalCaseDTOMapper::toDTO);
    }

    @Override
    public Page<LegalCaseDTO> searchCasesByClientName(String clientName, int page, int size) {
        Page<LegalCase> cases = legalCaseRepository.findByClientNameContainingIgnoreCase(clientName, PageRequest.of(page, size));
        return cases.map(legalCaseDTOMapper::toDTO);
    }

    @Override
    public Page<LegalCaseDTO> getCasesByStatus(CaseStatus status, int page, int size) {
        Page<LegalCase> cases = legalCaseRepository.findByStatus(status, PageRequest.of(page, size));
        return cases.map(legalCaseDTOMapper::toDTO);
    }

    @Override
    public Page<LegalCaseDTO> getCasesByType(String type, int page, int size) {
        Page<LegalCase> cases = legalCaseRepository.findByType(type, PageRequest.of(page, size));
        return cases.map(legalCaseDTOMapper::toDTO);
    }

    @Override
    public void deleteCase(Long id) {
        if (!legalCaseRepository.existsById(id)) {
            throw new LegalCaseException("Case not found with id: " + id);
        }
        legalCaseRepository.deleteById(id);
    }

    @Override
    public LegalCaseDTO updateCaseStatus(Long id, CaseStatus status) {
        LegalCase legalCase = legalCaseRepository.findById(id)
            .orElseThrow(() -> new LegalCaseException("Case not found with id: " + id));
        legalCase.setStatus(status);
        legalCase = legalCaseRepository.save(legalCase);
        return legalCaseDTOMapper.toDTO(legalCase);
    }
    
    // Document Management methods
    
    @Override
    public List<DocumentDTO> getCaseDocuments(Long caseId) {
        // Check if case exists
        legalCaseRepository.findById(caseId)
            .orElseThrow(() -> new LegalCaseException("Case not found with id: " + caseId));
            
        log.info("Getting documents for case: {}", caseId);
        
        try {
            CustomHttpResponse<List<LegalDocument>> response = documentService.getDocumentsByCaseId(caseId);
            
            if (response.getStatusCode() != 200 || response.getData() == null) {
                throw new RuntimeException("Failed to retrieve case documents: " + response.getMessage());
            }
            
            // Convert to DTOs with user information
            return response.getData().stream().map(doc -> {
                DocumentDTO dto = new DocumentDTO();
                dto.setId(doc.getId().toString());
                dto.setTitle(doc.getTitle());
                dto.setType(doc.getType().name());
                
                // Safely convert category to string, handling null values
                if (doc.getCategory() != null) {
                    dto.setCategory(doc.getCategory().name());
                } else {
                    dto.setCategory("OTHER");
                }
                
                dto.setFileName(doc.getFileName());
                dto.setDescription(doc.getDescription());
                dto.setTags(doc.getTags());
                dto.setUploadedAt(doc.getUploadedAt());
                
                // Add user information if available
                if (doc.getUploadedBy() != null) {
                    try {
                        UserDTO userDTO = userService.getUserById(doc.getUploadedBy());
                        if (userDTO != null) {
                            dto.setUploadedBy(userDTO);
                        }
                    } catch (Exception e) {
                        log.warn("Could not retrieve user information for document {}: {}", doc.getId(), e.getMessage());
                    }
                }
                
                return dto;
            }).collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Error fetching documents for case {}: {}", caseId, e.getMessage(), e);
            throw new RuntimeException("Failed to fetch documents", e);
        }
    }
    
    @Override
    public DocumentDTO uploadDocument(Long caseId, MultipartFile file, String title, 
                                    String type, String category, String description, String tags, UserDTO user) {
        // Check if case exists
        LegalCase legalCase = legalCaseRepository.findById(caseId)
            .orElseThrow(() -> new LegalCaseException("Case not found with id: " + caseId));
            
        log.info("Uploading document for case: {}", caseId);
        
        try {
            // Create DocumentDTO to pass to the document service
            LegalDocumentDTO documentDTO = new LegalDocumentDTO();
            documentDTO.setTitle(title != null ? title : "Untitled Document");
            documentDTO.setType(type != null ? DocumentType.valueOf(type) : DocumentType.OTHER);
            
            // Convert string category to enum safely
            try {
                documentDTO.setCategory(category != null ? DocumentCategory.valueOf(category) : DocumentCategory.OTHER);
            } catch (IllegalArgumentException e) {
                log.warn("Invalid category: {}. Using OTHER instead.", category);
                documentDTO.setCategory(DocumentCategory.OTHER);
            }
            
            documentDTO.setStatus(DocumentStatus.FINAL);
            documentDTO.setCaseId(caseId);
            documentDTO.setDescription(description);

            // Set the user who is uploading the document
            if (user != null && user.getId() != null) {
                documentDTO.setUploadedBy(user.getId());
            }

            // Convert tags string to List if provided
            if (tags != null && !tags.isEmpty()) {
                List<String> tagList = Arrays.asList(tags.split(","));
                documentDTO.setTags(tagList);
            }
            
            // Convert to JSON string
            String documentDataJson = objectMapper.writeValueAsString(documentDTO);
            
            // Call the document service to handle the file upload and metadata storage
            CustomHttpResponse<LegalDocument> response = documentService.uploadDocument(file, documentDataJson);
            
            if (response.getStatusCode() != 200 || response.getData() == null) {
                throw new RuntimeException("Failed to upload document: " + response.getMessage());
            }
            
            // Convert the saved LegalDocument to DocumentDTO for the response
            LegalDocument savedDocument = response.getData();
            
            // Create initial version record
            DocumentVersion initialVersion = new DocumentVersion();
            initialVersion.setDocumentId(savedDocument.getId());
            initialVersion.setVersionNumber(1);
            initialVersion.setFileName(savedDocument.getFileName());
            initialVersion.setFileUrl(savedDocument.getUrl());
            initialVersion.setFileType(savedDocument.getFileType());
            initialVersion.setFileSize(savedDocument.getFileSize());
            initialVersion.setChanges("Initial version");
            if (user != null && user.getId() != null) {
                initialVersion.setUploadedBy(user.getId());
            }
            
            // Save version metadata
            DocumentVersion savedVersion = documentVersionRepository.save(initialVersion);
            log.info("Initial document version metadata saved: {}", savedVersion);
            
            DocumentDTO resultDTO = new DocumentDTO();
            resultDTO.setId(savedDocument.getId().toString());
            resultDTO.setTitle(savedDocument.getTitle());
            resultDTO.setType(savedDocument.getType().name());
            resultDTO.setCategory(savedDocument.getCategory() != null ? savedDocument.getCategory().name() : "OTHER");
            resultDTO.setDescription(savedDocument.getDescription());
            resultDTO.setFileName(savedDocument.getFileName());
            resultDTO.setFileUrl(savedDocument.getUrl());
            resultDTO.setTags(savedDocument.getTags());
            resultDTO.setUploadedAt(savedDocument.getUploadedAt());
            resultDTO.setCurrentVersion(1);
            
            // Set uploaded by information
            resultDTO.setUploadedBy(user);
            
            // Convert version record to DTO
            DocumentVersionDTO versionDTO = new DocumentVersionDTO();
            versionDTO.setId(savedVersion.getId().toString());
            versionDTO.setVersionNumber(savedVersion.getVersionNumber());
            versionDTO.setFileName(savedVersion.getFileName());
            versionDTO.setFileUrl(savedVersion.getFileUrl());
            versionDTO.setUploadedAt(savedVersion.getUploadedAt());
            versionDTO.setChanges(savedVersion.getChanges());
            versionDTO.setUploadedBy(user);
            
            resultDTO.setVersions(Collections.singletonList(versionDTO));
            
            // Log case activity for document upload
            CaseActivityDTO activityDTO = new CaseActivityDTO();
            activityDTO.setCaseId(caseId);
            activityDTO.setActivityType("DOCUMENT_ADDED");
            activityDTO.setDescription("Document \"" + savedDocument.getTitle() + "\" was uploaded");
            activityDTO.setCreatedAt(LocalDateTime.now());
            if (user != null && user.getId() != null) {
                activityDTO.setUserId(user.getId());
            }
            
            // Add metadata about the document
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("documentId", savedDocument.getId().toString());
            metadata.put("documentTitle", savedDocument.getTitle());
            metadata.put("documentType", savedDocument.getType().name());
            activityDTO.setMetadata(metadata);
            
            // Log the activity
            logCaseActivity(activityDTO);
            
            return resultDTO;
        } catch (Exception e) {
            log.error("Error in document upload process: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to upload document", e);
        }
    }
    
    @Override
    public DocumentDTO getDocument(Long caseId, Long documentId) {
        // Check if case exists
        legalCaseRepository.findById(caseId)
            .orElseThrow(() -> new LegalCaseException("Case not found with id: " + caseId));
            
        log.info("Retrieving document with id: {} for case: {}", documentId, caseId);
        
        CustomHttpResponse<LegalDocument> response = documentService.getDocumentById(documentId);
        
        if (response.getStatusCode() != 200 || response.getData() == null) {
            throw new RuntimeException("Document not found with id: " + documentId);
        }
        
        LegalDocument document = response.getData();
        
        // Verify the document belongs to the specified case
        if (!document.getCaseId().equals(caseId)) {
            throw new LegalCaseException("Document does not belong to the specified case");
        }
        
        // Convert to DTO
        DocumentDTO dto = new DocumentDTO();
        dto.setId(document.getId().toString());
        dto.setTitle(document.getTitle());
        dto.setType(document.getType().name());
        dto.setCategory(document.getCategory() != null ? document.getCategory().name() : "OTHER");
        dto.setFileName(document.getFileName());
        dto.setFileUrl(document.getUrl());
        dto.setDescription(document.getDescription());
        dto.setTags(document.getTags());
        dto.setUploadedAt(document.getUploadedAt());
        
        // Add user information if available
        if (document.getUploadedBy() != null) {
            try {
                UserDTO userDTO = userService.getUserById(document.getUploadedBy());
                if (userDTO != null) {
                    dto.setUploadedBy(userDTO);
                }
            } catch (Exception e) {
                log.warn("Could not retrieve user information for document {}: {}", document.getId(), e.getMessage());
            }
        }
        
        return dto;
    }
    
    @Override
    public void deleteDocument(Long caseId, Long documentId) {
        // Check if case exists
        legalCaseRepository.findById(caseId)
            .orElseThrow(() -> new LegalCaseException("Case not found with id: " + caseId));
            
        // Check if document exists and belongs to the case
        CustomHttpResponse<LegalDocument> docResponse = documentService.getDocumentById(documentId);
        if (docResponse.getStatusCode() != 200 || docResponse.getData() == null) {
            throw new RuntimeException("Document not found with id: " + documentId);
        }
        
        LegalDocument document = docResponse.getData();
        if (!document.getCaseId().equals(caseId)) {
            throw new LegalCaseException("Document does not belong to the specified case");
        }
        
        log.info("Deleting document with id: {} for case: {}", documentId, caseId);
        
        // Delete document using the document service
        CustomHttpResponse<Void> response = documentService.deleteDocument(documentId);
        if (response.getStatusCode() != 200) {
            throw new RuntimeException("Failed to delete document: " + response.getMessage());
        }
        
        log.info("Document deleted successfully: {}", documentId);
    }
    
    @Override
    public Resource downloadDocument(Long caseId, Long documentId) {
        // Check if case exists
        legalCaseRepository.findById(caseId)
            .orElseThrow(() -> new LegalCaseException("Case not found with id: " + caseId));
            
        log.info("Downloading document with id: {} for case: {}", documentId, caseId);
        
        try {
            // Get the document metadata
            CustomHttpResponse<LegalDocument> docResponse = documentService.getDocumentById(documentId);
            if (docResponse.getStatusCode() != 200 || docResponse.getData() == null) {
                throw new RuntimeException("Document not found with id: " + documentId);
            }
            
            LegalDocument document = docResponse.getData();
            
            // Verify the document belongs to the specified case
            if (!document.getCaseId().equals(caseId)) {
                throw new LegalCaseException("Document does not belong to the specified case");
            }
            
            // Retrieve the actual document file
            byte[] documentBytes = documentService.downloadDocument(documentId);
            
            // Return as resource
            return new ByteArrayResource(documentBytes) {
                @Override
                public String getFilename() {
                    return document.getFileName();
                }
            };
        } catch (Exception e) {
            log.error("Error downloading document: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to download document", e);
        }
    }
    
    @Override
    public DocumentVersionDTO uploadNewDocumentVersion(Long caseId, Long documentId, 
                                                    MultipartFile file, String notes) {
        // Check if case exists
        legalCaseRepository.findById(caseId)
            .orElseThrow(() -> new LegalCaseException("Case not found with id: " + caseId));
            
        log.info("Uploading new version for document: {} in case: {}", documentId, caseId);
        
        try {
            // Get the document metadata
            CustomHttpResponse<LegalDocument> docResponse = documentService.getDocumentById(documentId);
            if (docResponse.getStatusCode() != 200 || docResponse.getData() == null) {
                throw new RuntimeException("Document not found with id: " + documentId);
            }
            
            LegalDocument document = docResponse.getData();
            
            // Verify the document belongs to the specified case
            if (!document.getCaseId().equals(caseId)) {
                throw new LegalCaseException("Document does not belong to the specified case");
            }
            
            // Get the next version number
            Integer maxVersion = documentVersionRepository.findMaxVersionNumberByDocumentId(documentId);
            int nextVersion = (maxVersion != null) ? maxVersion + 1 : 1;
            
            // Create storage path for the new version
            String documentPath = createDocumentVersionStoragePath(caseId, documentId);
            
            // Generate a unique filename with original extension preserved
            String originalFilename = file.getOriginalFilename();
            String fileExtension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                fileExtension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String uniqueFilename = UUID.randomUUID() + fileExtension;
            
            // Full path where the file will be stored
            Path fullPath = Paths.get(documentPath, uniqueFilename);
            
            // Save the file
            Files.write(fullPath, file.getBytes());
            log.info("Version file saved to: {}", fullPath);
            
            // Create document version entity
            DocumentVersion version = new DocumentVersion();
            version.setDocumentId(documentId);
            version.setVersionNumber(nextVersion);
            version.setFileName(originalFilename != null ? originalFilename : document.getFileName());
            version.setFileUrl(fullPath.toString());
            version.setChanges(notes);
            version.setFileType(file.getContentType());
            version.setFileSize(file.getSize());
            
            // If user context is available
            // version.setUploadedBy(userId);
            
            // Save version metadata
            DocumentVersion savedVersion = documentVersionRepository.save(version);
            log.info("Document version metadata saved: {}", savedVersion);
            
            // Convert to DTO
            DocumentVersionDTO versionDTO = new DocumentVersionDTO();
            versionDTO.setId(savedVersion.getId().toString());
            versionDTO.setVersionNumber(savedVersion.getVersionNumber());
            versionDTO.setFileName(savedVersion.getFileName());
            versionDTO.setFileUrl(savedVersion.getFileUrl());
            versionDTO.setUploadedAt(savedVersion.getUploadedAt());
            versionDTO.setChanges(savedVersion.getChanges());
            
            // Add user information if available
            if (savedVersion.getUploadedBy() != null) {
                try {
                    UserDTO userDTO = userService.getUserById(savedVersion.getUploadedBy());
                    if (userDTO != null) {
                        versionDTO.setUploadedBy(userDTO);
                    }
                } catch (Exception e) {
                    log.warn("Could not retrieve user information for version: {}", e.getMessage());
                }
            }
            
            return versionDTO;
        } catch (Exception e) {
            log.error("Error uploading document version: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to upload new document version", e);
        }
    }
    
    @Override
    public List<DocumentVersionDTO> getDocumentVersions(Long caseId, Long documentId) {
        // Check if case exists
        legalCaseRepository.findById(caseId)
            .orElseThrow(() -> new LegalCaseException("Case not found with id: " + caseId));
            
        // Check if document exists and belongs to the case
        CustomHttpResponse<LegalDocument> docResponse = documentService.getDocumentById(documentId);
        if (docResponse.getStatusCode() != 200 || docResponse.getData() == null) {
            throw new RuntimeException("Document not found with id: " + documentId);
        }
        
        LegalDocument document = docResponse.getData();
        if (!document.getCaseId().equals(caseId)) {
            throw new LegalCaseException("Document does not belong to the specified case");
        }
            
        log.info("Getting versions for document: {} in case: {}", documentId, caseId);
        
        // Get all versions for this document
        List<DocumentVersion> versions = documentVersionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId);
        
        // Convert to DTOs
        return versions.stream().map(version -> {
            DocumentVersionDTO dto = new DocumentVersionDTO();
            dto.setId(version.getId().toString());
            dto.setVersionNumber(version.getVersionNumber());
            dto.setFileName(version.getFileName());
            dto.setFileUrl(version.getFileUrl());
            dto.setUploadedAt(version.getUploadedAt());
            dto.setChanges(version.getChanges());
            
            // Add user information if available
            if (version.getUploadedBy() != null) {
                try {
                    UserDTO userDTO = userService.getUserById(version.getUploadedBy());
                    if (userDTO != null) {
                        dto.setUploadedBy(userDTO);
                    }
                } catch (Exception e) {
                    log.warn("Could not retrieve user information for version: {}", e.getMessage());
                }
            }
            
            return dto;
        }).collect(Collectors.toList());
    }
    
    @Override
    public Resource downloadDocumentVersion(Long caseId, Long documentId, Long versionId) {
        // Check if case exists
        legalCaseRepository.findById(caseId)
            .orElseThrow(() -> new LegalCaseException("Case not found with id: " + caseId));
            
        // Check if document exists and belongs to the case
        CustomHttpResponse<LegalDocument> docResponse = documentService.getDocumentById(documentId);
        if (docResponse.getStatusCode() != 200 || docResponse.getData() == null) {
            throw new RuntimeException("Document not found with id: " + documentId);
        }
        
        LegalDocument document = docResponse.getData();
        if (!document.getCaseId().equals(caseId)) {
            throw new LegalCaseException("Document does not belong to the specified case");
        }
            
        log.info("Downloading version {} of document: {} for case: {}", versionId, documentId, caseId);
        
        try {
            // Get the version entity
            DocumentVersion version = documentVersionRepository.findById(versionId)
                .orElseThrow(() -> new EntityNotFoundException("Version not found with id: " + versionId));
            
            // Verify the version belongs to the specified document
            if (!version.getDocumentId().equals(documentId)) {
                throw new RuntimeException("Version does not belong to the specified document");
            }
            
            // Read the file
            Path filePath = Paths.get(version.getFileUrl());
            if (!Files.exists(filePath)) {
                throw new IOException("Version file not found at path: " + filePath);
            }
            
            byte[] fileContent = Files.readAllBytes(filePath);
            
            // Return as resource
            return new ByteArrayResource(fileContent) {
                @Override
                public String getFilename() {
                    return version.getFileName();
                }
            };
        } catch (Exception e) {
            log.error("Error downloading document version: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to download document version", e);
        }
    }
    
    /**
     * Creates a structured path for document version storage
     * Format: BASE_DIR/cases/{caseId}/documents/{documentId}/versions/
     */
    private String createDocumentVersionStoragePath(Long caseId, Long documentId) throws IOException {
        // Create a structured path: BASE_DIR/cases/{caseId}/documents/{documentId}/versions/
        Path path = Paths.get(
            System.getProperty("user.home") + "/bostoneosolutions/documents/",
            "cases", 
            caseId.toString(), 
            "documents",
            documentId.toString(),
            "versions"
        );
        
        // Create directories if they don't exist
        Files.createDirectories(path);
        
        return path.toString();
    }
    
    // Case Activities methods
    
    @Override
    public List<CaseActivityDTO> getCaseActivities(Long caseId) {
        // Check if case exists
        legalCaseRepository.findById(caseId)
            .orElseThrow(() -> new LegalCaseException("Case not found with id: " + caseId));
            
        log.info("Getting activities for case: {}", caseId);
        
        // Use the dedicated service to get activities
        return caseActivityService.getActivitiesByCaseId(caseId);
    }
    
    @Override
    public CaseActivityDTO logCaseActivity(CaseActivityDTO activityDTO) {
        log.info("Logging activity for case: {}", activityDTO.getCaseId());
        
        // Convert DTO to request
        CreateActivityRequest request = new CreateActivityRequest();
        request.setCaseId(activityDTO.getCaseId());
        request.setActivityType(activityDTO.getActivityType());
        request.setReferenceId(activityDTO.getReferenceId());
        request.setReferenceType(activityDTO.getReferenceType());
        request.setDescription(activityDTO.getDescription());
        request.setMetadata((Map<String, Object>)activityDTO.getMetadata());
        
        // Create the activity using the service
        return caseActivityService.createActivity(request);
    }
} 