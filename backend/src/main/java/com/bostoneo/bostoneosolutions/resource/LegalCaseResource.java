package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.dto.LegalCaseDTO;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.dto.CaseActivityDTO;
import com.bostoneo.bostoneosolutions.dto.CaseDocumentDTO;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.LegalCaseService;
import com.bostoneo.bostoneosolutions.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.data.domain.Page;

import java.util.Optional;
import java.util.Set;
import java.util.HashSet;
import java.util.List;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;
import static org.springframework.http.HttpStatus.FORBIDDEN;

@RestController
@RequestMapping(path = "/legal-case")
@RequiredArgsConstructor
@Slf4j
public class LegalCaseResource {
    private final LegalCaseService legalCaseService;
    private final UserService userService;

    @GetMapping("/list")
    public ResponseEntity<HttpResponse> getCases(
            @RequestParam Optional<Integer> page,
            @RequestParam Optional<Integer> size) {
        
        log.info("Getting all cases (public access for testing)");
        
        // Return all cases for testing purposes
        Page<LegalCaseDTO> casePage = legalCaseService.getAllCases(page.orElse(0), size.orElse(10));
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("cases", casePage.getContent(),
                                "page", casePage))
                        .message("Legal cases retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping("/create")
    @AuditLog(action = "CREATE", entityType = "LEGAL_CASE", description = "Created new legal case")
    public ResponseEntity<HttpResponse> createCase(
            @AuthenticationPrincipal UserDTO user,
            @RequestBody @Valid LegalCaseDTO legalCaseDTO) {
        return ResponseEntity.created(null)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "case", legalCaseService.createCase(legalCaseDTO)))
                        .message("Legal case created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<HttpResponse> getCase(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("id") Long id) {
        
        // Use the service method that handles role-based access
        LegalCaseDTO caseDto = legalCaseService.getCaseForUser(id, user.getId(), user.getRoles());
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "case", caseDto))
                        .message("Legal case retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/get/number/{caseNumber}")
    public ResponseEntity<HttpResponse> getCaseByNumber(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("caseNumber") String caseNumber) {
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "case", legalCaseService.getCaseByNumber(caseNumber)))
                        .message("Legal case retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/search/title")
    public ResponseEntity<HttpResponse> searchCasesByTitle(
            @AuthenticationPrincipal UserDTO user,
            @RequestParam String title,
            @RequestParam Optional<Integer> page,
            @RequestParam Optional<Integer> size) {
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "page", legalCaseService.searchCasesByTitle(title, page.orElse(0), size.orElse(10))))
                        .message("Legal cases retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/search/client")
    public ResponseEntity<HttpResponse> searchCasesByClientName(
            @AuthenticationPrincipal UserDTO user,
            @RequestParam String clientName,
            @RequestParam Optional<Integer> page,
            @RequestParam Optional<Integer> size) {
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "page", legalCaseService.searchCasesByClientName(clientName, page.orElse(0), size.orElse(10))))
                        .message("Legal cases retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/client/{clientId}")
    public ResponseEntity<HttpResponse> getCasesByClientId(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("clientId") Long clientId,
            @RequestParam Optional<Integer> page,
            @RequestParam Optional<Integer> size) {
        
        log.info("Getting cases for client ID: {}", clientId);
        
        // Check if user has appropriate permissions
        boolean isAdmin = user.getRoles() != null && 
            (user.getRoles().contains("ROLE_ADMIN") || 
             user.getRoles().contains("ROLE_ATTORNEY") ||
             user.getRoles().contains("MANAGING_PARTNER") ||
             user.getRoles().contains("SENIOR_PARTNER") ||
             user.getRoles().contains("EQUITY_PARTNER") ||
             user.getRoles().contains("OF_COUNSEL"));
        
        if (!isAdmin) {
            return ResponseEntity.status(FORBIDDEN)
                    .body(HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Insufficient permissions to view client cases")
                            .status(FORBIDDEN)
                            .statusCode(FORBIDDEN.value())
                            .build());
        }
        
        // Get cases filtered by client ID
        Page<LegalCaseDTO> cases = legalCaseService.getCasesByClientId(clientId, page.orElse(0), size.orElse(100));
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "page", cases))
                        .message("Legal cases retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<HttpResponse> getCasesByStatus(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("status") CaseStatus status,
            @RequestParam Optional<Integer> page,
            @RequestParam Optional<Integer> size) {
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "page", legalCaseService.getCasesByStatus(status, page.orElse(0), size.orElse(10))))
                        .message("Legal cases retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/type/{type}")
    public ResponseEntity<HttpResponse> getCasesByType(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("type") String type,
            @RequestParam Optional<Integer> page,
            @RequestParam Optional<Integer> size) {
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "page", legalCaseService.getCasesByType(type, page.orElse(0), size.orElse(10))))
                        .message("Legal cases retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PutMapping("/update/{id}")
    @AuditLog(action = "UPDATE", entityType = "LEGAL_CASE", description = "Updated legal case information")
    public ResponseEntity<HttpResponse> updateCase(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("id") Long id,
            @RequestBody @Valid LegalCaseDTO legalCaseDTO) {
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "case", legalCaseService.updateCase(id, legalCaseDTO)))
                        .message("Legal case updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PutMapping("/status/{id}/{status}")
    @AuditLog(action = "UPDATE", entityType = "LEGAL_CASE", description = "Updated legal case status")
    public ResponseEntity<HttpResponse> updateCaseStatus(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("id") Long id,
            @PathVariable("status") CaseStatus status) {
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "case", legalCaseService.updateCaseStatus(id, status)))
                        .message("Legal case status updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @DeleteMapping("/delete/{id}")
    @AuditLog(action = "DELETE", entityType = "LEGAL_CASE", description = "Deleted legal case")
    public ResponseEntity<Void> deleteCase(@PathVariable Long id) {
        legalCaseService.deleteCase(id);
        return ResponseEntity.noContent().build();
    }

    // Document Management Endpoints
    
    @GetMapping("/{id}/documents")
    public ResponseEntity<HttpResponse> getCaseDocuments(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("id") Long id) {
        
        // Use the service method that handles role-based document filtering
        List<CaseDocumentDTO> documents = legalCaseService.getCaseDocumentsForUser(id, user.getId(), user.getRoles());
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("documents", documents))
                        .message("Case documents retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @PostMapping("/{id}/documents")
    @AuditLog(action = "CREATE", entityType = "DOCUMENT", description = "Uploaded new case document")
    public ResponseEntity<HttpResponse> uploadDocument(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("id") Long id,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "tags", required = false) String tags) {
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "document", legalCaseService.uploadDocument(id, file, title, type, category, description, tags, user)))
                        .message("Document uploaded successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @GetMapping("/{caseId}/documents/{documentId}")
    public ResponseEntity<HttpResponse> getDocument(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("caseId") Long caseId,
            @PathVariable("documentId") Long documentId) {
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "document", legalCaseService.getDocument(caseId, documentId)))
                        .message("Document retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @DeleteMapping("/{caseId}/documents/{documentId}")
    @AuditLog(action = "DELETE", entityType = "DOCUMENT", description = "Deleted case document")
    public ResponseEntity<HttpResponse> deleteDocument(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("caseId") Long caseId,
            @PathVariable("documentId") Long documentId) {
        
        legalCaseService.deleteDocument(caseId, documentId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail())))
                        .message("Document deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @GetMapping("/{caseId}/documents/{documentId}/download")
    @AuditLog(action = "DOWNLOAD", entityType = "DOCUMENT", description = "Downloaded case document")
    public ResponseEntity<Resource> downloadDocument(
            @PathVariable("caseId") Long caseId,
            @PathVariable("documentId") Long documentId,
            @RequestParam(value = "preview", defaultValue = "false") boolean preview) {
        
        Resource resource = legalCaseService.downloadDocument(caseId, documentId);
        
        // Skip audit logging for preview requests
        if (preview) {
            // Remove the audit annotation effect for preview
            // This is handled by conditional aspect logic
        }
        
        // Determine content type based on file extension
        String contentType = "application/octet-stream"; // fallback
        String filename = resource.getFilename();
        
        if (filename != null) {
            String extension = filename.toLowerCase();
            if (extension.endsWith(".pdf")) {
                contentType = "application/pdf";
            } else if (extension.endsWith(".png")) {
                contentType = "image/png";
            } else if (extension.endsWith(".jpg") || extension.endsWith(".jpeg")) {
                contentType = "image/jpeg";
            } else if (extension.endsWith(".gif")) {
                contentType = "image/gif";
            } else if (extension.endsWith(".doc")) {
                contentType = "application/msword";
            } else if (extension.endsWith(".docx")) {
                contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            } else if (extension.endsWith(".txt")) {
                contentType = "text/plain";
            } else if (extension.endsWith(".html") || extension.endsWith(".htm")) {
                contentType = "text/html";
            }
        }
        
        String headerValue = preview ? "inline; filename=\"" + filename + "\"" : "attachment; filename=\"" + filename + "\"";
        
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, headerValue)
                .body(resource);
    }
    
    @PostMapping("/{caseId}/documents/{documentId}/versions")
    @AuditLog(action = "CREATE", entityType = "DOCUMENT", description = "Created new document version")
    public ResponseEntity<HttpResponse> uploadNewVersion(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("caseId") Long caseId,
            @PathVariable("documentId") Long documentId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "notes", required = false) String notes) {
        
        UserDTO fullUser = userService.getUserByEmail(user.getEmail());
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", fullUser,
                                "version", legalCaseService.uploadNewDocumentVersion(caseId, documentId, file, notes, fullUser.getId())))
                        .message("New document version uploaded successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @GetMapping("/{caseId}/documents/{documentId}/versions")
    public ResponseEntity<HttpResponse> getDocumentVersions(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("caseId") Long caseId,
            @PathVariable("documentId") Long documentId) {
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "versions", legalCaseService.getDocumentVersions(caseId, documentId)))
                        .message("Document versions retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @GetMapping("/{caseId}/documents/{documentId}/versions/{versionId}/download")
    @AuditLog(action = "DOWNLOAD", entityType = "DOCUMENT", description = "Downloaded document version")
    public ResponseEntity<Resource> downloadDocumentVersion(
            @PathVariable("caseId") Long caseId,
            @PathVariable("documentId") Long documentId,
            @PathVariable("versionId") Long versionId) {
        
        Resource resource = legalCaseService.downloadDocumentVersion(caseId, documentId, versionId);
        
        // Determine content type based on file extension
        String contentType = "application/octet-stream"; // fallback
        String filename = resource.getFilename();
        
        if (filename != null) {
            String extension = filename.toLowerCase();
            if (extension.endsWith(".pdf")) {
                contentType = "application/pdf";
            } else if (extension.endsWith(".png")) {
                contentType = "image/png";
            } else if (extension.endsWith(".jpg") || extension.endsWith(".jpeg")) {
                contentType = "image/jpeg";
            } else if (extension.endsWith(".gif")) {
                contentType = "image/gif";
            } else if (extension.endsWith(".doc")) {
                contentType = "application/msword";
            } else if (extension.endsWith(".docx")) {
                contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            } else if (extension.endsWith(".txt")) {
                contentType = "text/plain";
            } else if (extension.endsWith(".html") || extension.endsWith(".htm")) {
                contentType = "text/html";
            }
        }
        
        String headerValue = "attachment; filename=\"" + filename + "\"";
        
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, headerValue)
                .body(resource);
    }
    
    // Case Activities Endpoints
    
    @GetMapping("/{id}/activities")
    public ResponseEntity<HttpResponse> getCaseActivities(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("id") Long id) {
        
        // Use the service method that handles role-based activity filtering
        List<CaseActivityDTO> activities = legalCaseService.getCaseActivitiesForUser(id, user.getId(), user.getRoles());
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "activities", activities))
                        .message("Case activities retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @PostMapping("/{id}/activities")
    @AuditLog(action = "CREATE", entityType = "LEGAL_CASE", description = "Added case activity entry")
    public ResponseEntity<HttpResponse> logCaseActivity(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("id") Long id,
            @RequestBody CaseActivityDTO activityDTO) {
        
        activityDTO.setCaseId(id);
        activityDTO.setUserId(user.getId());
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "activity", legalCaseService.logCaseActivity(activityDTO)))
                        .message("Activity logged successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
} 