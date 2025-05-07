package com.***REMOVED***.***REMOVED***solutions.resource;

import com.***REMOVED***.***REMOVED***solutions.dto.LegalCaseDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.UserDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.CaseActivityDTO;
import com.***REMOVED***.***REMOVED***solutions.enumeration.CaseStatus;
import com.***REMOVED***.***REMOVED***solutions.model.HttpResponse;
import com.***REMOVED***.***REMOVED***solutions.service.LegalCaseService;
import com.***REMOVED***.***REMOVED***solutions.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.util.Optional;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

@RestController
@RequestMapping(path = "/legal-case")
@RequiredArgsConstructor
public class LegalCaseResource {
    private final LegalCaseService legalCaseService;
    private final UserService userService;

    @GetMapping("/list")
    public ResponseEntity<HttpResponse> getCases(
            @AuthenticationPrincipal UserDTO user,
            @RequestParam Optional<Integer> page,
            @RequestParam Optional<Integer> size) {
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "page", legalCaseService.getAllCases(page.orElse(0), size.orElse(10))))
                        .message("Legal cases retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping("/create")
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
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "case", legalCaseService.getCase(id)))
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
    public ResponseEntity<Void> deleteCase(@PathVariable Long id) {
        legalCaseService.deleteCase(id);
        return ResponseEntity.noContent().build();
    }

    // Document Management Endpoints
    
    @GetMapping("/{id}/documents")
    public ResponseEntity<HttpResponse> getCaseDocuments(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("documents", legalCaseService.getCaseDocuments(id)))
                        .message("Case documents retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @PostMapping("/{id}/documents")
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
    public ResponseEntity<Resource> downloadDocument(
            @PathVariable("caseId") Long caseId,
            @PathVariable("documentId") Long documentId) {
        
        Resource resource = legalCaseService.downloadDocument(caseId, documentId);
        String contentType = "application/octet-stream";
        String headerValue = "attachment; filename=\"" + resource.getFilename() + "\"";
        
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, headerValue)
                .body(resource);
    }
    
    @PostMapping("/{caseId}/documents/{documentId}/versions")
    public ResponseEntity<HttpResponse> uploadNewVersion(
            @AuthenticationPrincipal UserDTO user,
            @PathVariable("caseId") Long caseId,
            @PathVariable("documentId") Long documentId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "notes", required = false) String notes) {
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "version", legalCaseService.uploadNewDocumentVersion(caseId, documentId, file, notes)))
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
    public ResponseEntity<Resource> downloadDocumentVersion(
            @PathVariable("caseId") Long caseId,
            @PathVariable("documentId") Long documentId,
            @PathVariable("versionId") Long versionId) {
        
        Resource resource = legalCaseService.downloadDocumentVersion(caseId, documentId, versionId);
        String contentType = "application/octet-stream";
        String headerValue = "attachment; filename=\"" + resource.getFilename() + "\"";
        
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
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()),
                                "activities", legalCaseService.getCaseActivities(id)))
                        .message("Case activities retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
    
    @PostMapping("/{id}/activities")
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