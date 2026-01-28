package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.LegalDocumentDTO;
import com.bostoneo.bostoneosolutions.enumeration.DocumentStatus;
import com.bostoneo.bostoneosolutions.enumeration.DocumentType;
import com.bostoneo.bostoneosolutions.model.LegalDocument;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.repository.LegalDocumentRepository;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.service.LegalDocumentService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.util.CustomHttpResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
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
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class LegalDocumentServiceImpl implements LegalDocumentService {

    private final LegalDocumentRepository documentRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;
    private final TenantService tenantService;

    // Base directory for document storage
    private final String BASE_UPLOAD_DIR = System.getProperty("user.home") + "/bostoneosolutions/documents/";

    /**
     * Get the current organization ID from tenant context.
     * Throws RuntimeException if no organization context is available.
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public CustomHttpResponse<List<LegalDocument>> getAllDocuments() {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        List<LegalDocument> documents = documentRepository.findByOrganizationId(orgId);
        return new CustomHttpResponse<>(200, "Documents retrieved successfully", documents);
    }

    @Override
    public CustomHttpResponse<Page<LegalDocument>> getDocumentsPaged(int page, int size) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Page<LegalDocument> documents = documentRepository.findByOrganizationId(orgId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt"))
        );
        return new CustomHttpResponse<>(200, "Documents retrieved successfully", documents);
    }

    @Override
    public CustomHttpResponse<LegalDocument> getDocumentById(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify document belongs to current organization
        LegalDocument document = documentRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new EntityNotFoundException("Document not found with id: " + id));
        return new CustomHttpResponse<>(200, "Document retrieved successfully", document);
    }

    @Override
    public CustomHttpResponse<List<LegalDocument>> getDocumentsByCaseId(Long caseId) {
        try {
            log.info("Fetching documents for case ID: {}", caseId);
            Long orgId = getRequiredOrganizationId();

            if (caseId == null) {
                throw new IllegalArgumentException("Case ID cannot be null");
            }

            // SECURITY: Use tenant-filtered query
            List<LegalDocument> documents = documentRepository.findByCaseIdAndOrganizationId(caseId, orgId);
            log.info("Found {} documents for case ID: {}", documents.size(), caseId);

            return new CustomHttpResponse<>(200, "Case documents retrieved successfully", documents);
        } catch (Exception e) {
            log.error("Error fetching documents for case ID {}: {}", caseId, e.getMessage(), e);
            throw new RuntimeException("Failed to fetch documents for case ID: " + caseId + ". Error: " + e.getMessage(), e);
        }
    }

    @Override
    public CustomHttpResponse<LegalDocument> createDocument(LegalDocumentDTO documentDTO) {
        Long orgId = getRequiredOrganizationId();

        LegalDocument document = new LegalDocument();
        BeanUtils.copyProperties(documentDTO, document);
        document.setOrganizationId(orgId);  // SECURITY: Set organization context
        if (document.getStatus() == null) {
            document.setStatus(DocumentStatus.DRAFT);
        }
        if (document.getType() == null) {
            document.setType(DocumentType.OTHER);
        }
        LegalDocument savedDocument = documentRepository.save(document);
        return new CustomHttpResponse<>(200, "Document created successfully", savedDocument);
    }

    @Override
    public CustomHttpResponse<LegalDocument> updateDocument(Long id, LegalDocumentDTO documentDTO) {
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify document belongs to current organization
        LegalDocument existingDocument = documentRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new EntityNotFoundException("Document not found with id: " + id));

        // Don't update these fields
        String url = existingDocument.getUrl();
        String fileName = existingDocument.getFileName();
        String fileType = existingDocument.getFileType();
        Long fileSize = existingDocument.getFileSize();
        
        BeanUtils.copyProperties(documentDTO, existingDocument);
        
        // Restore values that shouldn't be updated
        existingDocument.setId(id);
        existingDocument.setUrl(url);
        existingDocument.setFileName(fileName);
        existingDocument.setFileType(fileType);
        existingDocument.setFileSize(fileSize);
        
        LegalDocument updatedDocument = documentRepository.save(existingDocument);
        return new CustomHttpResponse<>(200, "Document updated successfully", updatedDocument);
    }

    @Override
    public CustomHttpResponse<Void> deleteDocument(Long id) {
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify document belongs to current organization
        LegalDocument document = documentRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new EntityNotFoundException("Document not found with id: " + id));
        
        // Delete the physical file if it exists
        try {
            Path filePath = Paths.get(document.getUrl());
            Files.deleteIfExists(filePath);
            
            // Delete the directory if it's empty
            Path parentDir = filePath.getParent();
            if (Files.exists(parentDir) && Files.isDirectory(parentDir)) {
                try {
                    if (Files.list(parentDir).count() == 0) {
                        Files.delete(parentDir);
                    }
                } catch (IOException e) {
                    log.warn("Could not delete empty directory: {}", parentDir);
                }
            }
        } catch (IOException e) {
            log.error("Error deleting document file: {}", e.getMessage());
        }
        
        documentRepository.deleteById(id);
        return new CustomHttpResponse<>(200, "Document deleted successfully", null);
    }

    @Override
    public CustomHttpResponse<LegalDocument> uploadDocument(MultipartFile file, String documentData) {
        try {
            Long orgId = getRequiredOrganizationId();
            log.info("📄 DOCUMENT UPLOAD STARTED - File: {}, Size: {} bytes, OrgId: {}", file.getOriginalFilename(), file.getSize(), orgId);
            log.info("📄 Document data received: {}", documentData);

            // Parse document data
            LegalDocumentDTO documentDTO = objectMapper.readValue(documentData, LegalDocumentDTO.class);
            log.info("📄 Parsed document DTO - Case ID: {}, Uploaded by: {}", documentDTO.getCaseId(), documentDTO.getUploadedBy());
            
            // Create document storage structure
            String documentPath = createDocumentStoragePath(documentDTO.getCaseId());
            
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
            log.info("File saved to: {}", fullPath);
            
            // Create and save document metadata
            LegalDocument document = new LegalDocument();
            BeanUtils.copyProperties(documentDTO, document);

            // SECURITY: Set organization context
            document.setOrganizationId(orgId);

            // Set file properties
            document.setUrl(fullPath.toString());
            document.setFileName(originalFilename);
            document.setFileType(file.getContentType());
            document.setFileSize(file.getSize());

            // Set default values if needed
            if (document.getStatus() == null) {
                document.setStatus(DocumentStatus.DRAFT);
            }
            if (document.getType() == null) {
                document.setType(DocumentType.OTHER);
            }
            
            LegalDocument savedDocument = documentRepository.save(document);
            log.info("📄 Document metadata saved: ID={}, CaseID={}, FileName={}", savedDocument.getId(), savedDocument.getCaseId(), savedDocument.getFileName());
            
            // Send notification for document upload
            try {
                log.info("🔔 Starting notification process for document upload...");
                if (savedDocument.getCaseId() != null && savedDocument.getOrganizationId() != null) {
                    log.info("🔔 Looking up case with ID: {}", savedDocument.getCaseId());
                    // SECURITY: Use tenant-filtered query
                    LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(savedDocument.getCaseId(), savedDocument.getOrganizationId()).orElse(null);
                    if (legalCase != null) {
                        log.info("🔔 Found case: {}", legalCase.getTitle());
                        String title = "Document Uploaded";
                        String message = String.format("New document \"%s\" has been uploaded to case \"%s\"", 
                            savedDocument.getFileName(), legalCase.getTitle());
                        
                        // Send notification to users (using hardcoded user ID for now, can be enhanced later)
                        Long notificationUserId = 1L; // Replace with actual logic to determine recipients
                        log.info("🔔 Sending notification to user ID: {} with title: '{}' and message: '{}'", notificationUserId, title, message);
                        
                        notificationService.sendCrmNotification(title, message, notificationUserId, 
                            "DOCUMENT_UPLOAD", Map.of("documentId", savedDocument.getId(), "caseId", legalCase.getId()));
                        
                        log.info("✅ Document upload notification sent successfully for document ID: {}", savedDocument.getId());
                    } else {
                        log.warn("⚠️ Could not find case with ID: {}, notification will not be sent", savedDocument.getCaseId());
                    }
                } else {
                    log.warn("⚠️ Document has no case ID, notification will not be sent");
                }
            } catch (Exception e) {
                log.error("❌ Failed to send document upload notification for document ID: {}", savedDocument.getId(), e);
            }
            
            return new CustomHttpResponse<>(200, "Document uploaded successfully", savedDocument);
        } catch (Exception e) {
            log.error("Error uploading document: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to upload document", e);
        }
    }

    @Override
    public byte[] downloadDocument(Long id) {
        try {
            Long orgId = getRequiredOrganizationId();

            // SECURITY: Verify document belongs to current organization
            LegalDocument document = documentRepository.findByIdAndOrganizationId(id, orgId)
                    .orElseThrow(() -> new EntityNotFoundException("Document not found with id: " + id));
            
            Path filePath = Paths.get(document.getUrl());
            if (!Files.exists(filePath)) {
                throw new IOException("File not found at path: " + filePath);
            }
            
            return Files.readAllBytes(filePath);
        } catch (IOException e) {
            log.error("Error downloading document: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to download document", e);
        }
    }
    
    /**
     * Creates a structured path for document storage based on case ID.
     * Format: BASE_DIR/cases/{caseId}/documents/{year}/{month}/
     * 
     * @param caseId The ID of the legal case
     * @return The path string where the document should be stored
     */
    private String createDocumentStoragePath(Long caseId) throws IOException {
        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter yearFormatter = DateTimeFormatter.ofPattern("yyyy");
        DateTimeFormatter monthFormatter = DateTimeFormatter.ofPattern("MM");
        
        String year = now.format(yearFormatter);
        String month = now.format(monthFormatter);
        
        // Create a structured path: BASE_DIR/cases/{caseId}/documents/{year}/{month}/
        Path path = Paths.get(
            BASE_UPLOAD_DIR,
            "cases", 
            caseId.toString(), 
            "documents",
            year,
            month
        );
        
        // Create directories if they don't exist
        Files.createDirectories(path);
        
        return path.toString();
    }
}

 
 