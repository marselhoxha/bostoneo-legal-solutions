package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.exception.DocumentNotFoundException;
import com.bostoneo.bostoneosolutions.model.DocumentVersion;
import com.bostoneo.bostoneosolutions.model.LegalDocument;
import com.bostoneo.bostoneosolutions.repository.DocumentVersionRepository;
import com.bostoneo.bostoneosolutions.repository.LegalDocumentRepository;
import com.bostoneo.bostoneosolutions.service.DocumentVersionService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.repository.CaseAssignmentRepository;
import com.bostoneo.bostoneosolutions.model.CaseAssignment;
import com.bostoneo.bostoneosolutions.util.CustomHttpResponse;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.HashSet;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentVersionServiceImpl implements DocumentVersionService {

    private final DocumentVersionRepository versionRepository;
    private final LegalDocumentRepository documentRepository;
    private final NotificationService notificationService;
    private final CaseAssignmentRepository caseAssignmentRepository;
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    // Base directory for document storage
    private final String BASE_UPLOAD_DIR = System.getProperty("user.home") + "/bostoneosolutions/documents/";

    @Override
    public CustomHttpResponse<DocumentVersion> getVersionById(Long id) {
        log.info("Retrieving document version with ID: {}", id);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        Optional<DocumentVersion> versionOpt = versionRepository.findByIdAndOrganizationId(id, orgId);
        if (versionOpt.isEmpty()) {
            log.error("Document version with ID {} not found or access denied", id);
            throw new DocumentNotFoundException("Document version not found or access denied");
        }

        return new CustomHttpResponse<>(
            HttpStatus.OK.value(),
            "Document version retrieved successfully",
            versionOpt.get()
        );
    }

    @Override
    public CustomHttpResponse<List<DocumentVersion>> getVersionsByDocumentId(Long documentId) {
        log.info("Retrieving versions for document ID: {}", documentId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Check if document exists AND belongs to current organization
        if (!documentRepository.existsByIdAndOrganizationId(documentId, orgId)) {
            log.error("Document with ID {} not found or access denied", documentId);
            throw new DocumentNotFoundException("Document not found or access denied");
        }

        List<DocumentVersion> versions = versionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId);
        
        return new CustomHttpResponse<>(
            HttpStatus.OK.value(),
            "Document versions retrieved successfully", 
            versions
        );
    }

    @Override
    public CustomHttpResponse<DocumentVersion> uploadNewVersion(Long documentId, MultipartFile file, String comment, Long uploadedBy) {
        log.info("Uploading new version for document ID: {}", documentId);
        Long orgId = getRequiredOrganizationId();

        try {
            // SECURITY: Use tenant-filtered query
            Optional<LegalDocument> documentOpt = documentRepository.findByIdAndOrganizationId(documentId, orgId);
            if (documentOpt.isEmpty()) {
                log.error("Document with ID {} not found or access denied", documentId);
                throw new DocumentNotFoundException("Document not found or access denied");
            }

            LegalDocument document = documentOpt.get();
            
            // Determine the next version number
            Integer maxVersionNumber = versionRepository.findMaxVersionNumberByDocumentId(documentId);
            int nextVersionNumber = (maxVersionNumber == null) ? 1 : maxVersionNumber + 1;
            
            // Upload the file
            String fileName = file.getOriginalFilename();
            String fileType = file.getContentType();
            long fileSize = file.getSize();
            
            // Create version storage path
            String versionPath = createVersionStoragePath(documentId, nextVersionNumber);
            
            // Generate unique filename
            String uniqueFilename = UUID.randomUUID().toString();
            if (fileName != null && fileName.contains(".")) {
                uniqueFilename += fileName.substring(fileName.lastIndexOf("."));
            }
            
            // Save the file
            Path fullPath = Paths.get(versionPath, uniqueFilename);
            Files.write(fullPath, file.getBytes());
            log.info("Version file saved to: {}", fullPath);
            
            // Create and save the new version
            DocumentVersion newVersion = new DocumentVersion();
            newVersion.setDocumentId(documentId);
            newVersion.setVersionNumber(nextVersionNumber);
            newVersion.setFileName(fileName);
            newVersion.setFileUrl(fullPath.toString());
            newVersion.setChanges(comment);
            newVersion.setUploadedBy(uploadedBy);
            newVersion.setFileType(fileType);
            newVersion.setFileSize(fileSize);
            newVersion.setUploadedAt(LocalDateTime.now());
            
            DocumentVersion savedVersion = versionRepository.save(newVersion);
            
            // Update the document's main file information to point to the latest version
            document.setUrl(fullPath.toString());
            document.setFileName(fileName);
            document.setFileSize(fileSize);
            document.setFileType(fileType);
            document.setUpdatedAt(LocalDateTime.now());
            documentRepository.save(document);
            
            // Send document version update notifications
            try {
                String title = "Document Version Updated";
                String message = String.format("New version (v%d) of document \"%s\" has been uploaded",
                    nextVersionNumber, document.getTitle() != null ? document.getTitle() : document.getFileName());

                Set<Long> notificationUserIds = new HashSet<>();

                // SECURITY: Get users assigned to the case if this document is related to a case (with org filter)
                if (document.getCaseId() != null && document.getOrganizationId() != null) {
                    List<CaseAssignment> caseAssignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(document.getCaseId(), document.getOrganizationId());
                    for (CaseAssignment assignment : caseAssignments) {
                        if (assignment.getAssignedTo() != null) {
                            notificationUserIds.add(assignment.getAssignedTo().getId());
                        }
                    }
                }

                // Remove the user who uploaded the new version from notifications (don't notify yourself)
                if (uploadedBy != null) {
                    notificationUserIds.remove(uploadedBy);
                }

                // Send notifications to all collected users
                for (Long userId : notificationUserIds) {
                    notificationService.sendCrmNotification(title, message, userId,
                        "DOCUMENT_VERSION_UPDATED", Map.of("documentId", documentId,
                                                           "versionId", savedVersion.getId(),
                                                           "versionNumber", nextVersionNumber,
                                                           "fileName", fileName,
                                                           "caseId", document.getCaseId() != null ? document.getCaseId() : 0));
                }

                log.info("📧 Document version update notifications sent to {} users", notificationUserIds.size());
            } catch (Exception e) {
                log.error("Failed to send document version update notifications: {}", e.getMessage());
            }
            
            return new CustomHttpResponse<>(
                HttpStatus.CREATED.value(),
                "New document version uploaded successfully",
                savedVersion
            );
        } catch (IOException e) {
            log.error("Error uploading new version: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to upload new version", e);
        }
    }

    @Override
    public byte[] downloadVersion(Long documentId, Long versionId) {
        log.info("Downloading version {} for document {}", versionId, documentId);
        Long orgId = getRequiredOrganizationId();

        try {
            // SECURITY: Use tenant-filtered query
            Optional<DocumentVersion> versionOpt = versionRepository.findByIdAndOrganizationId(versionId, orgId);
            if (versionOpt.isEmpty()) {
                log.error("Document version with ID {} not found or access denied", versionId);
                throw new DocumentNotFoundException("Document version not found or access denied");
            }

            DocumentVersion version = versionOpt.get();
            
            // Verify that this version belongs to the specified document
            if (!version.getDocumentId().equals(documentId)) {
                log.error("Version {} does not belong to document {}", versionId, documentId);
                throw new IllegalArgumentException("Version does not belong to the specified document");
            }
            
            // Get the file path
            Path filePath = Paths.get(version.getFileUrl());
            if (!Files.exists(filePath)) {
                log.error("Version file not found at: {}", filePath);
                throw new IOException("Version file not found");
            }
            
            // Read and return the file
            return Files.readAllBytes(filePath);
        } catch (IOException e) {
            log.error("Error downloading version: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to download version", e);
        }
    }
    
    /**
     * Creates a structured path for version storage.
     * Format: BASE_DIR/documents/{documentId}/versions/{versionNumber}/
     */
    private String createVersionStoragePath(Long documentId, int versionNumber) throws IOException {
        // Create a structured path: BASE_DIR/documents/{documentId}/versions/{versionNumber}/
        Path path = Paths.get(
            BASE_UPLOAD_DIR,
            "documents",
            documentId.toString(),
            "versions",
            String.valueOf(versionNumber)
        );
        
        // Create directories if they don't exist
        Files.createDirectories(path);
        
        return path.toString();
    }
} 