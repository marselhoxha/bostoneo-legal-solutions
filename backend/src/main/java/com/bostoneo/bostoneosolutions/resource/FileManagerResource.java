package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.dto.filemanager.*;
import com.bostoneo.bostoneosolutions.service.FileManagerService;
import com.bostoneo.bostoneosolutions.service.FileStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.Resource;

import java.io.IOException;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/file-manager")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "File Manager", description = "File and folder management operations")
public class FileManagerResource {
    
    private final FileManagerService fileManagerService;
    private final FileStorageService fileStorageService;
    
    // File operations
    
    @GetMapping("/files")
    @Operation(summary = "Get files with pagination and filtering")
    // @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<Page<FileItemDTO>> getFiles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String direction,
            @RequestParam(required = false) Long folderId,
            @RequestParam(required = false) Long caseId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String fileType,
            @RequestParam(required = false) String context) {
        
        Sort.Direction sortDirection = direction.equalsIgnoreCase("ASC") ? 
            Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(sortDirection, sortBy));
        
        // If context is "personal", ensure we only get files without caseId
        if ("personal".equals(context)) {
            caseId = -1L; // Use -1 as a marker for "no case"
        }
        
        Page<FileItemDTO> files = fileManagerService.getFiles(
            pageable, folderId, caseId, search, fileType);
        return ResponseEntity.ok(files);
    }
    
    @GetMapping("/files/{fileId}")
    @Operation(summary = "Get file details")
    // @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<FileItemDTO> getFile(@PathVariable Long fileId) {
        try {
            FileItemDTO file = fileManagerService.getFile(fileId);
            return ResponseEntity.ok(file);
        } catch (RuntimeException e) {
            log.error("Error retrieving file {}: {}", fileId, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }
    
    @PostMapping(value = "/files/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload a file")
    // @PreAuthorize("hasAuthority('DOCUMENT:CREATE') or hasRole('ROLE_USER')")
    public ResponseEntity<FileUploadResponseDTO> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) Long folderId,
            @RequestParam(required = false) Long caseId,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) String tags) {
        
        // Validate file
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(
                FileUploadResponseDTO.builder()
                    .success(false)
                    .message("File cannot be empty")
                    .build());
        }
        
        // Validate file size (100MB limit)
        if (file.getSize() > 100 * 1024 * 1024) {
            return ResponseEntity.badRequest().body(
                FileUploadResponseDTO.builder()
                    .success(false)
                    .message("File size cannot exceed 100MB")
                    .build());
        }
        
        // Validate file type
        String filename = file.getOriginalFilename();
        if (filename == null || filename.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(
                FileUploadResponseDTO.builder()
                    .success(false)
                    .message("File must have a valid name")
                    .build());
        }
        
        try {
            FileUploadResponseDTO response = fileManagerService.uploadFile(file, folderId, caseId, description, tags);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            log.error("Error uploading file: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(
                FileUploadResponseDTO.builder()
                    .success(false)
                    .message("Failed to upload file: " + e.getMessage())
                    .build());
        }
    }
    
    @PutMapping("/files/{fileId}")
    @Operation(summary = "Update file metadata")
    // @PreAuthorize("hasAuthority('DOCUMENT:EDIT') or hasRole('ROLE_USER')")
    public ResponseEntity<FileItemDTO> updateFile(
            @PathVariable Long fileId,
            @Valid @RequestBody UpdateFileRequestDTO request) {
        
        FileItemDTO updatedFile = fileManagerService.updateFile(fileId, request);
        return ResponseEntity.ok(updatedFile);
    }
    
    @PutMapping("/files/{fileId}/content")
    @Operation(summary = "Replace file content (creates new version)")
    // @PreAuthorize("hasAuthority('DOCUMENT:EDIT') or hasRole('ROLE_USER')")
    public ResponseEntity<FileVersionDTO> replaceFileContent(
            @PathVariable Long fileId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String comment) {
        
        FileVersionDTO version = fileManagerService.replaceFileContent(fileId, file, comment);
        return ResponseEntity.ok(version);
    }
    
    @DeleteMapping("/files/{fileId}")
    @Operation(summary = "Soft delete a file")
    // @PreAuthorize("hasAuthority('DOCUMENT:DELETE') or hasRole('ROLE_USER')")
    public ResponseEntity<Map<String, String>> deleteFile(@PathVariable Long fileId) {
        fileManagerService.deleteFile(fileId);
        return ResponseEntity.ok(Map.of("message", "File deleted successfully"));
    }

    @PostMapping("/files/{fileId}/restore")
    @Operation(summary = "Restore a deleted file")
    // @PreAuthorize("hasAuthority('DOCUMENT:RESTORE') or hasRole('ROLE_USER')")
    public ResponseEntity<FileItemDTO> restoreFile(@PathVariable Long fileId) {
        try {
            FileItemDTO restoredFile = fileManagerService.restoreFile(fileId);
            return ResponseEntity.ok(restoredFile);
        } catch (RuntimeException e) {
            log.error("Error restoring file {}: {}", fileId, e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/files/{fileId}/permanent")
    @Operation(summary = "Permanently delete a file")
    // @PreAuthorize("hasAuthority('DOCUMENT:PERMANENT_DELETE') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<Map<String, String>> permanentlyDeleteFile(@PathVariable Long fileId) {
        log.info("Permanent delete endpoint called for file ID: {}", fileId);
        try {
            fileManagerService.permanentlyDeleteFile(fileId);
            log.info("File {} permanently deleted successfully via endpoint", fileId);
            return ResponseEntity.ok(Map.of("message", "File permanently deleted"));
        } catch (RuntimeException e) {
            log.error("Error permanently deleting file {}: {}", fileId, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/files/deleted")
    @Operation(summary = "Get deleted files")
    // @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<Page<FileItemDTO>> getDeletedFiles(
            @PageableDefault(size = 20, sort = "deletedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<FileItemDTO> deletedFiles = fileManagerService.getDeletedFiles(pageable);
        return ResponseEntity.ok(deletedFiles);
    }
    
    @GetMapping("/files/{fileId}/test-path")
    @Operation(summary = "Test file path resolution")
    public ResponseEntity<Map<String, Object>> testFilePath(@PathVariable Long fileId) {
        try {
            FileItemDTO fileItem = fileManagerService.getFile(fileId);
            String filePath = fileManagerService.getFilePath(fileId);
            
            // Test if we can find the file
            boolean fileExists = false;
            String actualPath = "";
            try {
                Resource resource = fileStorageService.loadFileAsResource(filePath);
                fileExists = resource.exists();
                actualPath = resource.getURI().toString();
            } catch (Exception e) {
                actualPath = "Error: " + e.getMessage();
            }
            
            Map<String, Object> result = Map.of(
                "fileId", fileId,
                "fileName", fileItem.getOriginalName(),
                "storedPath", filePath,
                "fileExists", fileExists,
                "actualPath", actualPath
            );
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = Map.of(
                "error", e.getClass().getSimpleName(),
                "message", e.getMessage()
            );
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    @GetMapping("/files/{fileId}/download")
    @Operation(summary = "Download a file")
    // @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<byte[]> downloadFile(@PathVariable Long fileId) {
        try {
            log.info("Downloading file with ID: {}", fileId);
            
            // Get file information
            FileItemDTO fileItem = fileManagerService.getFile(fileId);
            log.info("Found file: {} with original name: {}", fileItem.getName(), fileItem.getOriginalName());
            
            String filePath = fileManagerService.getFilePath(fileId);
            log.info("File path from database: {}", filePath);
            
            // Load file from storage
            Resource resource = fileStorageService.loadFileAsResource(filePath);
            log.info("Resource loaded: {} exists: {} readable: {}", 
                    resource.getURI(), resource.exists(), resource.isReadable());
            
            // Read file content as InputStream to handle large files better
            byte[] fileContent = resource.getInputStream().readAllBytes();
            log.info("Successfully read {} bytes from file", fileContent.length);
            
            // Determine content type
            String contentType = fileItem.getMimeType();
            if (contentType == null || contentType.isEmpty()) {
                // Try to detect from file extension
                String fileName = fileItem.getOriginalName().toLowerCase();
                if (fileName.endsWith(".pdf")) contentType = "application/pdf";
                else if (fileName.endsWith(".png")) contentType = "image/png";
                else if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) contentType = "image/jpeg";
                else if (fileName.endsWith(".gif")) contentType = "image/gif";
                else if (fileName.endsWith(".doc")) contentType = "application/msword";
                else if (fileName.endsWith(".docx")) contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                else if (fileName.endsWith(".xls")) contentType = "application/vnd.ms-excel";
                else if (fileName.endsWith(".xlsx")) contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                else contentType = "application/octet-stream";
            }
            
            // Set proper headers for preview (not attachment)
            String contentDisposition = "inline; filename=\"" + fileItem.getOriginalName() + "\"";
            
            return ResponseEntity.ok()
                .header("Content-Disposition", contentDisposition)
                .header("Content-Type", contentType)
                .header("Access-Control-Expose-Headers", "Content-Disposition")
                .body(fileContent);
                
        } catch (IOException e) {
            log.error("Error downloading file {}: {}", fileId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (RuntimeException e) {
            log.error("Runtime error accessing file {}: {}", fileId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        } catch (Exception e) {
            log.error("Unexpected error accessing file {}: {}", fileId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // Bulk operations
    
    @PostMapping("/bulk/delete")
    @Operation(summary = "Delete multiple files and folders")
    // @PreAuthorize("hasAuthority('DOCUMENT:DELETE') or hasRole('ROLE_USER')")
    public ResponseEntity<Map<String, Object>> bulkDelete(@RequestBody Map<String, List<Long>> request) {
        List<Long> fileIds = request.get("fileIds");
        List<Long> folderIds = request.get("folderIds");
        
        int deletedFiles = 0;
        int deletedFolders = 0;
        List<String> errors = new java.util.ArrayList<>();
        
        // Delete files
        if (fileIds != null) {
            for (Long fileId : fileIds) {
                try {
                    fileManagerService.deleteFile(fileId);
                    deletedFiles++;
                } catch (Exception e) {
                    errors.add("Failed to delete file " + fileId + ": " + e.getMessage());
                }
            }
        }
        
        // Delete folders
        if (folderIds != null) {
            for (Long folderId : folderIds) {
                try {
                    fileManagerService.deleteFolder(folderId);
                    deletedFolders++;
                } catch (Exception e) {
                    errors.add("Failed to delete folder " + folderId + ": " + e.getMessage());
                }
            }
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("deletedFiles", deletedFiles);
        response.put("deletedFolders", deletedFolders);
        response.put("errors", errors);
        response.put("success", errors.isEmpty());
        
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/bulk/move")
    @Operation(summary = "Move multiple files and folders")
    // @PreAuthorize("hasAuthority('DOCUMENT:EDIT') or hasRole('ROLE_USER')")
    public ResponseEntity<Map<String, Object>> bulkMove(@RequestBody Map<String, Object> request) {
        List<Long> fileIds = (List<Long>) request.get("fileIds");
        List<Long> folderIds = (List<Long>) request.get("folderIds");
        Long targetFolderId = ((Number) request.get("targetFolderId")).longValue();
        
        int movedFiles = 0;
        int movedFolders = 0;
        List<String> errors = new java.util.ArrayList<>();
        
        // Move files
        if (fileIds != null) {
            for (Long fileId : fileIds) {
                try {
                    fileManagerService.moveFile(fileId, targetFolderId);
                    movedFiles++;
                } catch (Exception e) {
                    errors.add("Failed to move file " + fileId + ": " + e.getMessage());
                }
            }
        }
        
        // Move folders
        if (folderIds != null) {
            for (Long folderId : folderIds) {
                try {
                    fileManagerService.moveFolder(folderId, targetFolderId);
                    movedFolders++;
                } catch (Exception e) {
                    errors.add("Failed to move folder " + folderId + ": " + e.getMessage());
                }
            }
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("movedFiles", movedFiles);
        response.put("movedFolders", movedFolders);
        response.put("errors", errors);
        response.put("success", errors.isEmpty());
        
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/bulk/copy")
    @Operation(summary = "Copy multiple files")
    // @PreAuthorize("hasAuthority('DOCUMENT:CREATE') or hasRole('ROLE_USER')")
    public ResponseEntity<Map<String, Object>> bulkCopy(@RequestBody Map<String, Object> request) {
        List<Long> fileIds = (List<Long>) request.get("fileIds");
        Long targetFolderId = request.get("targetFolderId") != null ? 
            ((Number) request.get("targetFolderId")).longValue() : null;
        
        int copiedFiles = 0;
        List<String> errors = new java.util.ArrayList<>();
        
        if (fileIds != null) {
            for (Long fileId : fileIds) {
                try {
                    fileManagerService.copyFile(fileId, targetFolderId);
                    copiedFiles++;
                } catch (Exception e) {
                    errors.add("Failed to copy file " + fileId + ": " + e.getMessage());
                }
            }
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("copiedFiles", copiedFiles);
        response.put("errors", errors);
        response.put("success", errors.isEmpty());
        
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/files/bulk/restore")
    @Operation(summary = "Restore multiple deleted files")
    // @PreAuthorize("hasAuthority('DOCUMENT:RESTORE') or hasRole('ROLE_USER')")
    public ResponseEntity<Map<String, Object>> bulkRestoreFiles(@RequestBody Map<String, List<Long>> request) {
        List<Long> fileIds = request.get("fileIds");
        
        int restoredFiles = 0;
        List<String> errors = new java.util.ArrayList<>();
        
        if (fileIds != null) {
            for (Long fileId : fileIds) {
                try {
                    fileManagerService.restoreFile(fileId);
                    restoredFiles++;
                } catch (Exception e) {
                    errors.add("Failed to restore file " + fileId + ": " + e.getMessage());
                }
            }
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("restoredFiles", restoredFiles);
        response.put("errors", errors);
        response.put("success", errors.isEmpty());
        
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/files/bulk/permanent-delete")
    @Operation(summary = "Permanently delete multiple files")
    // @PreAuthorize("hasAuthority('DOCUMENT:PERMANENT_DELETE') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<Map<String, Object>> bulkPermanentlyDeleteFiles(@RequestBody Map<String, List<Long>> request) {
        log.info("Bulk permanent delete request received: {}", request);
        List<Long> fileIds = request.get("fileIds");
        
        int deletedFiles = 0;
        List<String> errors = new java.util.ArrayList<>();
        
        if (fileIds != null) {
            log.info("Processing {} files for permanent deletion", fileIds.size());
            for (Long fileId : fileIds) {
                try {
                    log.debug("Permanently deleting file ID: {}", fileId);
                    fileManagerService.permanentlyDeleteFile(fileId);
                    deletedFiles++;
                    log.info("Successfully deleted file ID: {}", fileId);
                } catch (Exception e) {
                    log.error("Failed to permanently delete file {}: {}", fileId, e.getMessage(), e);
                    errors.add("Failed to permanently delete file " + fileId + ": " + e.getMessage());
                }
            }
        } else {
            log.warn("No file IDs provided for bulk permanent deletion");
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("deletedFiles", deletedFiles);
        response.put("errors", errors);
        response.put("success", errors.isEmpty());
        
        log.info("Bulk permanent delete completed. Deleted: {}, Errors: {}", deletedFiles, errors.size());
        
        return ResponseEntity.ok(response);
    }
    
    // Folder operations
    
    @GetMapping("/folders/root")
    @Operation(summary = "Get root folders")
    // @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<List<FolderDTO>> getRootFolders() {
        List<FolderDTO> rootFolders = fileManagerService.getRootFolders();
        return ResponseEntity.ok(rootFolders);
    }
    
    @GetMapping("/folders/{folderId}")
    @Operation(summary = "Get folder details and contents")
    // @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<FolderDTO> getFolder(@PathVariable Long folderId) {
        FolderDTO folder = fileManagerService.getFolder(folderId);
        return ResponseEntity.ok(folder);
    }
    
    @GetMapping("/folders/{folderId}/contents")
    @Operation(summary = "Get folder contents including subfolders and files")
    // @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<Map<String, Object>> getFolderContents(
            @PathVariable Long folderId,
            @RequestParam(required = false) String context) {
        
        // Get subfolders based on context
        List<FolderDTO> subfolders;
        if ("personal".equals(context)) {
            subfolders = fileManagerService.getPersonalSubfolders(folderId);
        } else {
            subfolders = fileManagerService.getSubfolders(folderId);
        }
        
        // If context is "personal", pass -1L as caseId to get only files without case association
        Long caseId = "personal".equals(context) ? -1L : null;
        
        Page<FileItemDTO> files = fileManagerService.getFiles(PageRequest.of(0, 50), folderId, caseId, null, null);
        
        Map<String, Object> contents = new HashMap<>();
        contents.put("folders", subfolders);
        contents.put("files", files.getContent());
        
        return ResponseEntity.ok(contents);
    }
    
    @PostMapping("/folders")
    @Operation(summary = "Create a new folder")
    // @PreAuthorize("hasAuthority('DOCUMENT:CREATE') or hasRole('ROLE_USER')")
    public ResponseEntity<FolderDTO> createFolder(@Valid @RequestBody CreateFolderRequestDTO request) {
        FolderDTO folder = fileManagerService.createFolder(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(folder);
    }
    
    @PutMapping("/folders/{folderId}")
    @Operation(summary = "Update folder")
    // @PreAuthorize("hasAuthority('DOCUMENT:EDIT') or hasRole('ROLE_USER')")
    public ResponseEntity<FolderDTO> updateFolder(
            @PathVariable Long folderId,
            @Valid @RequestBody UpdateFolderRequestDTO request) {
        
        FolderDTO folder = fileManagerService.updateFolder(folderId, request);
        return ResponseEntity.ok(folder);
    }
    
    @DeleteMapping("/folders/{folderId}")
    @Operation(summary = "Delete a folder")
    // @PreAuthorize("hasAuthority('DOCUMENT:DELETE') or hasRole('ROLE_USER')")
    public ResponseEntity<Map<String, String>> deleteFolder(@PathVariable Long folderId) {
        fileManagerService.deleteFolder(folderId);
        return ResponseEntity.ok(Map.of("message", "Folder deleted successfully"));
    }
    
    // Case-related operations
    
    @GetMapping("/cases/active")
    @Operation(summary = "Get active cases for file organization")
    // @PreAuthorize("hasAuthority('CASE:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<Page<CaseDTO>> getActiveCases(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<CaseDTO> cases = fileManagerService.getActiveCases(pageable);
        return ResponseEntity.ok(cases);
    }
    
    @GetMapping("/cases")
    @Operation(summary = "Get cases with optional status and search filters")
    // @PreAuthorize("hasAuthority('CASE:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<Page<CaseDTO>> getCases(
            @RequestParam(required = false) List<String> statuses,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection) {
        
        Sort.Direction direction = Sort.Direction.fromString(sortDirection);
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        Page<CaseDTO> cases = fileManagerService.getCases(statuses, search, pageable);
        return ResponseEntity.ok(cases);
    }
    
    @GetMapping("/cases/{caseId}/files")
    @Operation(summary = "Get files for a specific case")
    // @PreAuthorize("hasAuthority('CASE:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<List<FileItemDTO>> getCaseFiles(@PathVariable Long caseId) {
        List<FileItemDTO> files = fileManagerService.getCaseFiles(caseId);
        return ResponseEntity.ok(files);
    }
    
    @GetMapping("/cases/{caseId}/folders")
    @Operation(summary = "Get folders for a specific case")
    // @PreAuthorize("hasAuthority('CASE:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<List<FolderDTO>> getCaseFolders(@PathVariable Long caseId) {
        List<FolderDTO> folders = fileManagerService.getCaseFolders(caseId);
        return ResponseEntity.ok(folders);
    }
    
    @GetMapping("/folders/personal")
    @Operation(summary = "Get personal folders only (not case-related)")
    // @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<List<FolderDTO>> getPersonalFolders() {
        List<FolderDTO> folders = fileManagerService.getRootFolders();
        return ResponseEntity.ok(folders);
    }
    
    // File versioning
    
    @GetMapping("/files/{fileId}/versions")
    @Operation(summary = "Get file version history")
    // @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<List<FileVersionDTO>> getFileVersions(@PathVariable Long fileId) {
        List<FileVersionDTO> versions = fileManagerService.getFileVersions(fileId);
        return ResponseEntity.ok(versions);
    }
    
    @PostMapping("/files/{fileId}/versions")
    @Operation(summary = "Upload a new version of a file")
    // @PreAuthorize("hasAuthority('DOCUMENT:EDIT') or hasRole('ROLE_USER')")
    public ResponseEntity<FileVersionDTO> uploadFileVersion(
            @PathVariable Long fileId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String comment) {
        
        FileVersionDTO version = fileManagerService.uploadFileVersion(fileId, file, comment);
        return ResponseEntity.status(HttpStatus.CREATED).body(version);
    }
    
    @GetMapping("/files/{fileId}/versions/{versionId}/download")
    @Operation(summary = "Download a specific version of a file")
    // @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<byte[]> downloadFileVersion(
            @PathVariable Long fileId,
            @PathVariable Long versionId) {
        
        try {
            log.info("Downloading version {} of file {}", versionId, fileId);
            
            FileVersionDTO version = fileManagerService.getFileVersion(fileId, versionId);
            if (version == null) {
                return ResponseEntity.notFound().build();
            }
            
            byte[] fileContent = fileManagerService.downloadFileVersion(versionId);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentDispositionFormData("attachment", version.getFileName());
            headers.setContentType(MediaType.parseMediaType(version.getMimeType()));
            headers.setContentLength(fileContent.length);
            
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(fileContent);
                    
        } catch (Exception e) {
            log.error("Error downloading file version: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @PutMapping("/files/{fileId}/versions/{versionId}/restore")
    @Operation(summary = "Restore a version as the current version")
    // @PreAuthorize("hasAuthority('DOCUMENT:EDIT') or hasRole('ROLE_USER')")
    public ResponseEntity<Map<String, String>> restoreFileVersion(
            @PathVariable Long fileId,
            @PathVariable Long versionId) {
        
        try {
            fileManagerService.restoreFileVersion(fileId, versionId);
            return ResponseEntity.ok(Map.of("message", "Version restored successfully"));
        } catch (Exception e) {
            log.error("Error restoring file version: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
    
    @DeleteMapping("/files/{fileId}/versions/{versionId}")
    @Operation(summary = "Delete a specific version of a file")
    // @PreAuthorize("hasAuthority('DOCUMENT:DELETE') or hasRole('ROLE_USER')")
    public ResponseEntity<Map<String, String>> deleteFileVersion(
            @PathVariable Long fileId,
            @PathVariable Long versionId) {
        
        try {
            fileManagerService.deleteFileVersion(fileId, versionId);
            return ResponseEntity.ok(Map.of("message", "Version deleted successfully"));
        } catch (Exception e) {
            log.error("Error deleting file version: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
    
    // File sharing and permissions
    
    @GetMapping("/files/{fileId}/permissions")
    @Operation(summary = "Get file permissions")
    // @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<List<FilePermissionDTO>> getFilePermissions(@PathVariable Long fileId) {
        List<FilePermissionDTO> permissions = fileManagerService.getFilePermissions(fileId);
        return ResponseEntity.ok(permissions);
    }
    
    @PostMapping("/files/{fileId}/share")
    @Operation(summary = "Share file with users")
    // @PreAuthorize("hasAuthority('DOCUMENT:SHARE') or hasRole('ROLE_USER')")
    public ResponseEntity<Map<String, String>> shareFile(
            @PathVariable Long fileId,
            @Valid @RequestBody ShareFileRequestDTO request) {
        
        fileManagerService.shareFile(fileId, request);
        return ResponseEntity.ok(Map.of("message", "File shared successfully"));
    }
    
    // Search and analytics
    
    @GetMapping("/search")
    @Operation(summary = "Search files and folders")
    // @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<Page<FileItemDTO>> searchFiles(
            @RequestParam String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String fileType,
            @RequestParam(required = false) Long caseId) {
        
        // Validate search query
        if (query == null || query.trim().length() < 3) {
            return ResponseEntity.badRequest().build();
        }
        
        // Validate pagination parameters
        if (page < 0 || size <= 0 || size > 100) {
            return ResponseEntity.badRequest().build();
        }
        
        try {
            Pageable pageable = PageRequest.of(page, size);
            Page<FileItemDTO> results = fileManagerService.searchFiles(query, pageable, fileType, caseId);
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            log.error("Error searching files with query '{}': {}", query, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    @GetMapping("/stats")
    @Operation(summary = "Get file manager statistics")
    // @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<FileManagerStatsDTO> getStats() {
        FileManagerStatsDTO stats = fileManagerService.getStats();
        return ResponseEntity.ok(stats);
    }
    
    // Recent activity
    
    @GetMapping("/recent")
    @Operation(summary = "Get recent files")
    // @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<List<FileItemDTO>> getRecentFiles(
            @RequestParam(defaultValue = "10") int limit) {
        
        List<FileItemDTO> recentFiles = fileManagerService.getRecentFiles(limit);
        return ResponseEntity.ok(recentFiles);
    }
    
    @GetMapping("/starred")
    @Operation(summary = "Get starred files")
    // @PreAuthorize("hasAuthority('DOCUMENT:VIEW') or hasRole('ROLE_USER')")
    public ResponseEntity<List<FileItemDTO>> getStarredFiles() {
        List<FileItemDTO> starredFiles = fileManagerService.getStarredFiles();
        return ResponseEntity.ok(starredFiles);
    }
    
    @PostMapping("/files/{fileId}/star")
    @Operation(summary = "Toggle star status of a file")
    // @PreAuthorize("hasAuthority('DOCUMENT:EDIT') or hasRole('ROLE_USER')")
    public ResponseEntity<FileItemDTO> toggleFileStar(@PathVariable Long fileId) {
        try {
            FileItemDTO updatedFile = fileManagerService.toggleFileStar(fileId);
            return ResponseEntity.ok(updatedFile);
        } catch (RuntimeException e) {
            log.error("Error toggling star for file {}: {}", fileId, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/files/{fileId}/share-with-client")
    @Operation(summary = "Toggle share with client status of a file")
    // @PreAuthorize("hasAuthority('DOCUMENT:SHARE') or hasRole('ROLE_USER')")
    public ResponseEntity<FileItemDTO> toggleShareWithClient(@PathVariable Long fileId) {
        try {
            FileItemDTO updatedFile = fileManagerService.toggleShareWithClient(fileId);
            return ResponseEntity.ok(updatedFile);
        } catch (RuntimeException e) {
            log.error("Error toggling share with client for file {}: {}", fileId, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }
}