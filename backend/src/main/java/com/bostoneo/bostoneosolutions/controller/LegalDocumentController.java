package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.dto.DocumentVersionDTO;
import com.bostoneo.bostoneosolutions.dto.LegalDocumentDTO;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.DocumentVersion;
import com.bostoneo.bostoneosolutions.model.LegalDocument;
import com.bostoneo.bostoneosolutions.service.DocumentVersionService;
import com.bostoneo.bostoneosolutions.service.LegalDocumentService;
import com.bostoneo.bostoneosolutions.service.UserService;
import com.bostoneo.bostoneosolutions.util.CustomHttpResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/legal/documents")
@RequiredArgsConstructor
public class LegalDocumentController {

    private final LegalDocumentService documentService;
    private final DocumentVersionService versionService;
    private final UserService userService;
    private final ObjectMapper objectMapper;

    @GetMapping
    @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<CustomHttpResponse<List<LegalDocument>>> getAllDocuments() {
        return ResponseEntity.ok(documentService.getAllDocuments());
    }

    @GetMapping("/paged")
    @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<CustomHttpResponse<Page<LegalDocument>>> getDocumentsPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(documentService.getDocumentsPaged(page, size));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<CustomHttpResponse<LegalDocument>> getDocumentById(@PathVariable Long id) {
        return ResponseEntity.ok(documentService.getDocumentById(id));
    }

    @GetMapping("/case/{caseId}")
    @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<CustomHttpResponse<List<LegalDocument>>> getDocumentsByCaseId(@PathVariable Long caseId) {
        return ResponseEntity.ok(documentService.getDocumentsByCaseId(caseId));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('DOCUMENT:CREATE') or hasRole('ROLE_USER')")
    @AuditLog(action = "CREATE", entityType = "DOCUMENT", description = "Created new document")
    public ResponseEntity<CustomHttpResponse<LegalDocument>> createDocument(@RequestBody LegalDocumentDTO document) {
        return ResponseEntity.ok(documentService.createDocument(document));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('DOCUMENT:EDIT') or hasRole('ROLE_USER')")
    @AuditLog(action = "UPDATE", entityType = "DOCUMENT", description = "Updated document")
    public ResponseEntity<CustomHttpResponse<LegalDocument>> updateDocument(
            @PathVariable Long id,
            @RequestBody LegalDocumentDTO document) {
        return ResponseEntity.ok(documentService.updateDocument(id, document));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('DOCUMENT:DELETE') or hasRole('ROLE_USER')")
    @AuditLog(action = "DELETE", entityType = "DOCUMENT", description = "Deleted document")
    public ResponseEntity<CustomHttpResponse<Void>> deleteDocument(@PathVariable Long id) {
        return ResponseEntity.ok(documentService.deleteDocument(id));
    }

    @PostMapping("/upload")
    @PreAuthorize("hasAuthority('DOCUMENT:CREATE') or hasRole('ROLE_USER')")
    @AuditLog(action = "CREATE", entityType = "DOCUMENT", description = "Uploaded document file")
    public ResponseEntity<CustomHttpResponse<LegalDocument>> uploadDocument(
            @AuthenticationPrincipal UserDTO userDetails,
            @RequestParam("file") MultipartFile file,
            @RequestParam("data") String documentData) {
        
        // Get the full user details
        UserDTO user = userService.getUserByEmail(userDetails.getEmail());
        
        // Extract document data and inject the user ID
        try {
            LegalDocumentDTO docDTO = objectMapper.readValue(documentData, LegalDocumentDTO.class);
            docDTO.setUploadedBy(user.getId());
            String updatedDocumentData = objectMapper.writeValueAsString(docDTO);
            
            return ResponseEntity.ok(documentService.uploadDocument(file, updatedDocumentData));
        } catch (Exception e) {
            throw new RuntimeException("Failed to process document data", e);
        }
    }

    @GetMapping("/{id}/download")
    @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<byte[]> downloadDocument(@PathVariable Long id) {
        byte[] documentBytes = documentService.downloadDocument(id);
        LegalDocument document = documentService.getDocumentById(id).getData();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDispositionFormData("attachment", document.getFileName());

        return ResponseEntity.ok()
                .headers(headers)
                .body(documentBytes);
    }

    // Document Version endpoints

    /**
     * Get all versions of a document
     */
    @GetMapping("/{id}/versions")
    @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<CustomHttpResponse<List<DocumentVersion>>> getDocumentVersions(@PathVariable Long id) {
        return ResponseEntity.ok(versionService.getVersionsByDocumentId(id));
    }

    /**
     * Upload a new version of a document
     */
    @PostMapping("/{id}/versions")
    @PreAuthorize("hasAuthority('DOCUMENT:CREATE') or hasRole('ROLE_USER')")
    public ResponseEntity<CustomHttpResponse<DocumentVersion>> uploadNewVersion(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDTO userDetails,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "comment", required = false) String comment) {

        // Get the full user details
        UserDTO user = userService.getUserByEmail(userDetails.getEmail());

        return ResponseEntity.ok(versionService.uploadNewVersion(id, file, comment, user.getId()));
    }

    /**
     * Download a specific version of a document
     */
    @GetMapping("/{documentId}/versions/{versionId}")
    @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<byte[]> downloadDocumentVersion(
            @PathVariable Long documentId,
            @PathVariable Long versionId) {

        DocumentVersion version = versionService.getVersionById(versionId).getData();
        byte[] versionBytes = versionService.downloadVersion(documentId, versionId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDispositionFormData("attachment", version.getFileName());

        return ResponseEntity.ok()
                .headers(headers)
                .body(versionBytes);
    }
} 
 
 