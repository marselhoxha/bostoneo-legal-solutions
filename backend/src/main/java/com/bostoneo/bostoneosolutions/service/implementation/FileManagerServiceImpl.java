package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.dto.filemanager.*;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.repository.*;
import com.bostoneo.bostoneosolutions.model.CaseAssignment;
import com.bostoneo.bostoneosolutions.model.Role;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.FileItem;
import com.bostoneo.bostoneosolutions.model.Folder;
import com.bostoneo.bostoneosolutions.model.FileVersion;
import com.bostoneo.bostoneosolutions.model.FileAccessLog;
import com.bostoneo.bostoneosolutions.repository.CaseAssignmentRepository;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.repository.FileItemRepository;
import com.bostoneo.bostoneosolutions.repository.FolderRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.repository.FileVersionRepository;
import com.bostoneo.bostoneosolutions.repository.FileCommentRepository;
import com.bostoneo.bostoneosolutions.repository.FileTagRepository;
import com.bostoneo.bostoneosolutions.repository.FileShareRepository;
import com.bostoneo.bostoneosolutions.repository.FileAccessLogRepository;
import com.bostoneo.bostoneosolutions.service.FileManagerService;
import com.bostoneo.bostoneosolutions.service.FileStorageService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.service.RoleService;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class FileManagerServiceImpl implements FileManagerService {
    
    private Long getCurrentUserId() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                Object principal = authentication.getPrincipal();
                if (principal instanceof UserDTO) {
                    return ((UserDTO) principal).getId();
                } else if (principal instanceof UserPrincipal) {
                    return ((UserPrincipal) principal).getUser().getId();
                }
            }
        } catch (Exception e) {
            log.warn("Could not get current user from security context: {}", e.getMessage());
        }
        // SECURITY: Throw exception instead of returning hardcoded ID
        // A hardcoded fallback could allow unauthenticated operations to be attributed to wrong user
        throw new RuntimeException("Authentication required - could not determine current user");
    }

    private String getCurrentUserName() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                Object principal = authentication.getPrincipal();
                if (principal instanceof UserDTO) {
                    UserDTO user = (UserDTO) principal;
                    return user.getFirstName() + " " + user.getLastName();
                } else if (principal instanceof UserPrincipal) {
                    User user = ((UserPrincipal) principal).getUser();
                    return user.getFirstName() + " " + user.getLastName();
                }
            }
            // Fallback: get user from database
            Long userId = getCurrentUserId();
            if (userId != null) {
                User user = userRepository.get(userId);
                if (user != null) {
                    return user.getFirstName() + " " + user.getLastName();
                }
            }
        } catch (Exception e) {
            log.debug("Could not get current user name: {}", e.getMessage());
        }
        return "A user";
    }

    private final FileItemRepository fileItemRepository;
    private final FolderRepository folderRepository;
    private final FileVersionRepository fileVersionRepository;
    private final FileCommentRepository fileCommentRepository;
    private final FileTagRepository fileTagRepository;
    private final FileShareRepository fileShareRepository;
    private final FileAccessLogRepository fileAccessLogRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final FileStorageService fileStorageService;
    private final UserRepository<User> userRepository;
    private final NotificationService notificationService;
    private final CaseAssignmentRepository caseAssignmentRepository;
    private final RoleService roleService;
    private final TenantService tenantService;

    /**
     * Get the current organization ID from tenant context.
     * Throws RuntimeException if no organization context is available.
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<FileItemDTO> getFiles(Pageable pageable, Long folderId, Long caseId, String search, String fileType) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting files with pagination: page={}, size={}, folderId={}, caseId={}, search={}, fileType={}", 
                pageable.getPageNumber(), pageable.getPageSize(), folderId, caseId, search, fileType);
        
        Page<FileItem> filesPage;
        
        if (StringUtils.hasText(search)) {
            // SECURITY: Use tenant-filtered search
            filesPage = fileItemRepository.searchByNameOrDescriptionAndOrganizationId(search, orgId, pageable);
        } else if (caseId != null && caseId == -1L) {
            // Special case: -1 means personal files (no case association)
            Long currentUserId = getCurrentUserId();
            filesPage = fileItemRepository.findPersonalDocumentsByOrganization(currentUserId, folderId, orgId, pageable);
        } else if (folderId != null || caseId != null || StringUtils.hasText(fileType)) {
            // Handle media file type specially
            if ("media".equalsIgnoreCase(fileType)) {
                // SECURITY: Use tenant-filtered query
                filesPage = fileItemRepository.findMediaFilesByOrganization(orgId, pageable);
            } else {
                String mimeTypePattern = null;
                if (StringUtils.hasText(fileType)) {
                    mimeTypePattern = getMimeTypePattern(fileType);
                }
                // SECURITY: Use tenant-filtered query
                filesPage = fileItemRepository.findWithFiltersByOrganization(folderId, caseId, mimeTypePattern, null, null, null, orgId, pageable);
            }
        } else {
            // SECURITY: Use tenant-filtered query
            filesPage = fileItemRepository.findByDeletedFalseAndOrganizationId(orgId, pageable);
        }
        
        List<FileItemDTO> fileItemDTOs = filesPage.getContent().stream()
                .map(this::convertToFileItemDTO)
                .collect(Collectors.toList());
        
        return new PageImpl<>(fileItemDTOs, pageable, filesPage.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public FileItemDTO getFile(Long fileId) {
        log.info("Getting file with ID: {}", fileId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify file belongs to current organization
        FileItem fileItem = fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found with ID: " + fileId));

        if (fileItem.getDeleted()) {
            throw new RuntimeException("File has been deleted");
        }

        return convertToFileItemDTO(fileItem);
    }
    
    @Override
    @Transactional(readOnly = true)
    public String getFilePath(Long fileId) {
        log.info("Getting file path for file ID: {}", fileId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify file belongs to current organization
        FileItem fileItem = fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found with ID: " + fileId));

        if (fileItem.getDeleted()) {
            throw new RuntimeException("File has been deleted");
        }

        // Return the stored file path
        return fileItem.getFilePath();
    }

    @Override
    public FileUploadResponseDTO uploadFile(MultipartFile file, Long folderId, Long caseId, String description, String tags, String documentCategory, String documentType) {
        log.info("Uploading file: {} to folder: {}, case: {}, category: {}, type: {}", file.getOriginalFilename(), folderId, caseId, documentCategory, documentType);

        try {
            // Build the folder path
            String folderPath = buildFolderPath(folderId);
            log.info("Built folder path: '{}'", folderPath);

            // Use original filename
            String fileName = file.getOriginalFilename();
            log.info("Original filename: '{}'", fileName);

            // Build the subdirectory path based on folder hierarchy
            String subdirectory = folderPath.isEmpty() ? "documents" : folderPath;
            log.info("Subdirectory for storage: '{}'", subdirectory);

            // Check if file already exists and generate unique name if needed
            String finalFileName = fileName;
            int counter = 1;
            while (fileExistsInFolder(folderId, finalFileName)) {
                String nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
                String extension = fileName.substring(fileName.lastIndexOf('.'));
                finalFileName = nameWithoutExt + "_" + counter + extension;
                counter++;
            }
            log.info("Final filename to store: '{}'", finalFileName);

            // Store the physical file
            log.info("About to call fileStorageService.storeFile with subdirectory='{}', fileName='{}'", subdirectory, finalFileName);
            String storedFilePath = fileStorageService.storeFile(file, subdirectory, finalFileName);
            log.info("File storage returned path: '{}'", storedFilePath);

            // Create database records in a separate transaction
            FileItem fileItem;
            try {
                fileItem = createFileRecord(finalFileName, file, storedFilePath, folderId, caseId, tags, documentCategory, documentType);
            } catch (Exception dbException) {
                // Clean up the uploaded file if database operations fail
                try {
                    fileStorageService.deleteFile(storedFilePath);
                } catch (Exception cleanupException) {
                    log.warn("Failed to clean up uploaded file after database error: {}", cleanupException.getMessage());
                }
                throw dbException;
            }
            
            // Note: Notifications for case-related document uploads are handled by the calling service
            // (e.g., ClientPortalServiceImpl.notifyAttorneyOfNewDocument()) to provide better context
            // about who uploaded the document and with proper formatting.
            log.info("📄 File uploaded successfully - ID: {}, Name: '{}', Case ID: {}",
                fileItem.getId(), fileItem.getOriginalName(), caseId);
            
            return FileUploadResponseDTO.builder()
                    .fileId(fileItem.getId())
                    .fileName(fileItem.getOriginalName())
                    .fileSize(fileItem.getSize())
                    .success(true)
                    .message("File uploaded successfully")
                    .build();
            
        } catch (Exception e) {
            log.error("Error uploading file: {}", e.getMessage(), e);
            return FileUploadResponseDTO.builder()
                    .success(false)
                    .message("Failed to upload file: " + e.getMessage())
                    .build();
        }
    }
    
    private FileItem createFileRecord(String fileName, MultipartFile file, String storedFilePath,
                                     Long folderId, Long caseId, String tags, String documentCategory, String documentType) {
        try {
            log.info("Creating file record for: {}", fileName);
            Long currentUserId = getCurrentUserId();
            Long orgId = getRequiredOrganizationId();
            log.info("Current user ID: {}, Organization ID: {}", currentUserId, orgId);

            FileItem fileItem = FileItem.builder()
                    .organizationId(orgId)  // SECURITY: Set organization context
                    .name(fileName)
                    .originalName(file.getOriginalFilename())
                    .size(file.getSize())
                    .mimeType(file.getContentType())
                    .extension(getFileExtension(file.getOriginalFilename()))
                    .filePath(storedFilePath)
                    .folderId(folderId)
                    .caseId(caseId)
                    .createdBy(currentUserId)
                    .starred(false)  // Explicitly set starred to false for new files
                    .documentCategory(documentCategory)
                    .documentStatus(documentType) // Store document type in documentStatus field
                    .build();
            
            log.info("Saving file item to database");
            fileItem = fileItemRepository.save(fileItem);
            log.info("File item saved with ID: {}", fileItem.getId());
            
            // Create initial version
            log.info("Creating initial file version");
            FileVersion initialVersion = FileVersion.builder()
                    .fileId(fileItem.getId())
                    .versionNumber(1)
                    .fileName(file.getOriginalFilename())
                    .filePath(storedFilePath)
                    .fileSize(file.getSize())
                    .mimeType(file.getContentType())
                    .isCurrent(true)
                    .createdBy(currentUserId)
                    .uploadedBy(currentUserId)
                    .build();
            
            fileVersionRepository.save(initialVersion);
            log.info("File version saved");
            
            // Add tags if provided
            if (StringUtils.hasText(tags)) {
                log.info("Adding tags: {}", tags);
                String[] tagArray = tags.split(",");
                for (String tagName : tagArray) {
                    if (StringUtils.hasText(tagName.trim())) {
                        FileTag tag = FileTag.builder()
                                .organizationId(orgId)
                                .fileId(fileItem.getId())
                                .tagName(tagName.trim())
                                .createdBy(currentUserId)
                                .build();
                        fileTagRepository.save(tag);
                    }
                }
                log.info("Tags added successfully");
            }
            
            log.info("Logging file access");
            logFileAccess(fileItem.getId(), FileAccessLog.ActionType.UPLOAD, true, null);
            log.info("File record creation completed successfully");
            
            return fileItem;
        } catch (Exception e) {
            log.error("Error in createFileRecord: {}", e.getMessage(), e);
            throw e;
        }
    }

    @Override
    public FileItemDTO updateFile(Long fileId, UpdateFileRequestDTO request) {
        log.info("Updating file with ID: {}", fileId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify file belongs to current organization
        FileItem fileItem = fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found with ID: " + fileId));
        
        if (StringUtils.hasText(request.getName())) {
            fileItem.setOriginalName(request.getName());
        }
        if (request.getCaseId() != null) {
            fileItem.setCaseId(request.getCaseId());
        }
        if (request.getFolderId() != null) {
            fileItem.setFolderId(request.getFolderId());
        }
        
        fileItem = fileItemRepository.save(fileItem);
        return convertToFileItemDTO(fileItem);
    }

    @Override
    public void deleteFile(Long fileId) {
        log.info("Soft deleting file with ID: {}", fileId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify file belongs to current organization
        FileItem fileItem = fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found with ID: " + fileId));
        
        if (Boolean.TRUE.equals(fileItem.getDeleted())) {
            log.warn("File {} is already deleted", fileId);
            return;
        }
        
        fileItem.setDeleted(true);
        fileItem.setDeletedAt(LocalDateTime.now());
        fileItemRepository.save(fileItem);
        
        log.info("File {} soft deleted at {}", fileId, fileItem.getDeletedAt());
        logFileAccess(fileId, FileAccessLog.ActionType.DELETE, true, null);
    }

    @Override
    @Transactional
    public FileItemDTO restoreFile(Long fileId) {
        log.info("Restoring file with ID: {}", fileId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify file belongs to current organization
        FileItem fileItem = fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found with ID: " + fileId));
        
        if (!Boolean.TRUE.equals(fileItem.getDeleted())) {
            log.warn("File {} is not deleted, cannot restore", fileId);
            throw new RuntimeException("File is not deleted and cannot be restored");
        }
        
        fileItem.setDeleted(false);
        fileItem.setDeletedAt(null);
        fileItem = fileItemRepository.save(fileItem);
        
        log.info("File {} restored successfully", fileId);
        logFileAccess(fileId, FileAccessLog.ActionType.VIEW, true, "File restored");
        
        return convertToFileItemDTO(fileItem);
    }

    @Override
    @Transactional
    public void permanentlyDeleteFile(Long fileId) {
        log.info("Permanently deleting file with ID: {}", fileId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify file belongs to current organization
        FileItem fileItem = fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found with ID: " + fileId));
        
        log.info("Found file: {} (deleted: {})", fileItem.getName(), fileItem.getDeleted());
        
        if (!Boolean.TRUE.equals(fileItem.getDeleted())) {
            log.warn("File {} is not soft deleted, cannot permanently delete", fileId);
            throw new RuntimeException("File must be soft deleted before permanent deletion");
        }
        
        String filePath = fileItem.getFilePath();
        
        try {
            // Delete related data first to avoid foreign key constraints
            // SECURITY: Use tenant-filtered delete
            log.info("Deleting file access logs for file ID: {}", fileId);
            fileAccessLogRepository.deleteByFileIdAndOrganizationId(fileId, orgId);
            log.info("Deleted file access logs");
            
            log.info("Deleting file comments for file ID: {}", fileId);
            fileCommentRepository.deleteByFileIdAndOrganizationId(fileId, orgId);
            log.info("Deleted file comments");
            
            log.info("Deleting file tags for file ID: {}", fileId);
            fileTagRepository.deleteByOrganizationIdAndFileId(orgId, fileId);
            log.info("Deleted file tags");

            log.info("Deleting file shares for file ID: {}", fileId);
            fileShareRepository.deleteByFileIdAndOrganizationId(fileId, orgId);
            log.info("Deleted file shares");
            
            log.info("Deleting file versions for file ID: {}", fileId);
            fileVersionRepository.deleteByFileIdAndOrganizationId(fileId, orgId);
            log.info("Deleted file versions");
            
            // Now delete the file item
            log.info("Deleting file item from database");
            fileItemRepository.delete(fileItem);
            fileItemRepository.flush(); // Force the delete to happen immediately
            
            log.info("File {} deleted from database", fileId);
            
            // Delete physical file
            try {
                fileStorageService.deleteFile(filePath);
                log.info("Physical file deleted: {}", filePath);
            } catch (Exception e) {
                log.warn("Failed to delete physical file {}: {}", filePath, e.getMessage());
                // Continue even if physical file deletion fails
            }
            
            log.info("File {} permanently deleted successfully", fileId);
            
        } catch (Exception e) {
            log.error("Error permanently deleting file {}: {}", fileId, e.getMessage(), e);
            throw new RuntimeException("Failed to permanently delete file: " + e.getMessage(), e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<FileItemDTO> getDeletedFiles(Pageable pageable) {
        log.info("Getting deleted files with pagination: page={}, size={}",
                pageable.getPageNumber(), pageable.getPageSize());
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        Page<FileItem> deletedFiles = fileItemRepository.findByDeletedTrueAndOrganizationIdOrderByDeletedAtDesc(orgId, pageable);
        
        List<FileItemDTO> fileItemDTOs = deletedFiles.getContent().stream()
                .map(this::convertToFileItemDTO)
                .collect(Collectors.toList());
        
        return new PageImpl<>(fileItemDTOs, pageable, deletedFiles.getTotalElements());
    }
    
    @Override
    @Transactional
    public void moveFile(Long fileId, Long targetFolderId) {
        log.info("Moving file {} to folder {}", fileId, targetFolderId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify file belongs to current organization
        FileItem fileItem = fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found with ID: " + fileId));
        
        if (fileItem.getDeleted()) {
            throw new RuntimeException("Cannot move a deleted file");
        }
        
        fileItem.setFolderId(targetFolderId);
        fileItemRepository.save(fileItem);
        
        logFileAccess(fileId, FileAccessLog.ActionType.EDIT, true, null);
    }
    
    @Override
    @Transactional
    public void copyFile(Long fileId, Long targetFolderId) {
        log.info("Copying file {} to folder {}", fileId, targetFolderId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify file belongs to current organization
        FileItem originalFile = fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found with ID: " + fileId));
        
        if (originalFile.getDeleted()) {
            throw new RuntimeException("Cannot copy a deleted file");
        }
        
        // Create a copy of the file with a new name  
        String newFileName = "copy_" + System.currentTimeMillis() + "_" + originalFile.getOriginalName();
        String newFilePath = originalFile.getFilePath().replace(originalFile.getOriginalName(), newFileName);
        
        // Create new file record with organization context
        FileItem newFile = FileItem.builder()
                .organizationId(orgId)  // SECURITY: Set organization context
                .name(originalFile.getName() + " (Copy)")
                .originalName(originalFile.getOriginalName())
                .size(originalFile.getSize())
                .mimeType(originalFile.getMimeType())
                .extension(originalFile.getExtension())
                .filePath(newFilePath)
                .folderId(targetFolderId)
                .createdBy(getCurrentUserId())
                .caseId(originalFile.getCaseId())
                .departmentId(originalFile.getDepartmentId())
                .practiceArea(originalFile.getPracticeArea())
                .documentCategory(originalFile.getDocumentCategory())
                .documentStatus(originalFile.getDocumentStatus())
                .tags(originalFile.getTags())
                .starred(false)
                .sharedWithClient(false)
                .deleted(false)
                .build();
        
        fileItemRepository.save(newFile);
        
        logFileAccess(newFile.getId(), FileAccessLog.ActionType.UPLOAD, true, null);
    }

    @Override
    @Transactional
    public FileItemDTO toggleFileStar(Long fileId) {
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify file belongs to current organization
        FileItem fileItem = fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found with ID: " + fileId));
        
        log.info("[STAR DEBUG] File {} - DB current starred: {} (raw: {})", 
                fileId, fileItem.getStarred(), fileItem.getStarred());
        
        if (Boolean.TRUE.equals(fileItem.getDeleted())) {
            throw new RuntimeException("Cannot star a deleted file");
        }
        
        // Toggle the starred status - ensure non-null
        boolean currentStarred = fileItem.getStarred() != null ? fileItem.getStarred() : false;
        boolean newStarredStatus = !currentStarred;
        
        log.info("[STAR DEBUG] File {} - Toggling: {} -> {}", fileId, currentStarred, newStarredStatus);
        
        // Update the entity directly and save
        fileItem.setStarred(newStarredStatus);
        fileItem = fileItemRepository.save(fileItem);
        
        log.info("[STAR DEBUG] File {} - After save: starred={}", fileId, fileItem.getStarred());
        
        return convertToFileItemDTO(fileItem);
    }

    @Override
    @Transactional
    public FileItemDTO toggleShareWithClient(Long fileId) {
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify file belongs to current organization
        FileItem fileItem = fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found with ID: " + fileId));

        log.info("[SHARE DEBUG] File {} - DB current sharedWithClient: {}",
                fileId, fileItem.getSharedWithClient());

        if (Boolean.TRUE.equals(fileItem.getDeleted())) {
            throw new RuntimeException("Cannot share a deleted file");
        }

        // Toggle the sharedWithClient status - ensure non-null
        boolean currentShared = fileItem.getSharedWithClient() != null ? fileItem.getSharedWithClient() : false;
        boolean newSharedStatus = !currentShared;

        log.info("[SHARE DEBUG] File {} - Toggling sharedWithClient: {} -> {}", fileId, currentShared, newSharedStatus);

        // Update the entity directly and save
        fileItem.setSharedWithClient(newSharedStatus);
        fileItem = fileItemRepository.save(fileItem);

        log.info("[SHARE DEBUG] File {} - After save: sharedWithClient={}", fileId, fileItem.getSharedWithClient());

        return convertToFileItemDTO(fileItem);
    }

    @Override
    @Transactional
    public FolderDTO getRootFolder() {
        log.info("Getting root folder");

        // Use tenant-filtered query - throw exception if no organization context
        List<Folder> rootFolders = tenantService.getCurrentOrganizationId()
            .map(orgId -> folderRepository.findRootFoldersByOrganization(orgId))
            .orElseThrow(() -> new RuntimeException("Organization context required"));

        if (rootFolders.isEmpty()) {
            // Create default root folder
            Folder rootFolder = Folder.builder()
                    .name("Root")
                    .createdBy(getCurrentUserId())
                    .build();
            rootFolder = folderRepository.save(rootFolder);
            return convertToFolderDTO(rootFolder);
        }

        return convertToFolderDTO(rootFolders.get(0));
    }
    
    @Override
    @Transactional(readOnly = true)
    public List<FolderDTO> getRootFolders() {
        log.info("Getting personal root folders for current user");
        
        Long userId = getCurrentUserId();
        
        // Get only personal folders (no case_id) that belong to current user or are shared
        List<Folder> personalFolders = folderRepository.findPersonalRootFolders(userId);
        
        return personalFolders.stream()
                .map(this::convertToFolderDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public FolderDTO getFolder(Long folderId) {
        log.info("Getting folder with ID: {}", folderId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        Folder folder = folderRepository.findByIdAndOrganizationId(folderId, orgId)
                .orElseThrow(() -> new RuntimeException("Folder not found or access denied: " + folderId));

        return convertToFolderDTO(folder);
    }
    
    @Override
    @Transactional(readOnly = true)
    public List<FolderDTO> getSubfolders(Long parentFolderId) {
        log.info("Getting subfolders for parent folder ID: {}", parentFolderId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify parent folder belongs to current organization (if not root)
        if (parentFolderId != null && !folderRepository.existsByIdAndOrganizationId(parentFolderId, orgId)) {
            throw new RuntimeException("Folder not found or access denied: " + parentFolderId);
        }

        // SECURITY: Use tenant-filtered query directly
        List<Folder> subfolders = folderRepository.findByParentFolderIdAndDeletedFalseAndOrganizationId(parentFolderId, orgId);

        return subfolders.stream()
                .map(this::convertToFolderDTO)
                .collect(Collectors.toList());
    }
    
    @Override
    @Transactional(readOnly = true)
    public List<FolderDTO> getPersonalSubfolders(Long parentFolderId) {
        log.info("Getting personal subfolders for parent folder ID: {}", parentFolderId);
        
        Long currentUserId = getCurrentUserId();
        
        // Use repository method that filters by user
        List<Folder> subfolders = folderRepository.findPersonalSubfolders(parentFolderId, currentUserId);
        
        return subfolders.stream()
                .map(this::convertToFolderDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public FolderDTO createFolder(CreateFolderRequestDTO request) {
        log.info("Creating folder: {} with parentId: {}, caseId: {}", 
                request.getName(), request.getParentFolderIdValue(), request.getCaseId());
        
        Long orgId = getRequiredOrganizationId();
        Long parentFolderId = request.getParentFolderIdValue();
        // SECURITY: Check for existing folder only within current organization using tenant-filtered query
        Optional<Folder> existingFolder = folderRepository.findByNameAndParentAndOrganizationId(request.getName(), parentFolderId, orgId);
        if (existingFolder.isPresent()) {
            log.warn("Folder already exists: {} in parent: {}", request.getName(), parentFolderId);
            // Return existing folder instead of throwing error
            return convertToFolderDTO(existingFolder.get());
        }
        
        Folder folder = Folder.builder()
                .name(request.getName())
                .parentFolderId(parentFolderId)
                .caseId(request.getCaseId())
                .createdBy(getCurrentUserId())
                .build();
        
        folder = folderRepository.save(folder);
        log.info("Successfully created folder: {} with ID: {}", folder.getName(), folder.getId());
        
        return convertToFolderDTO(folder);
    }

    @Override
    public FolderDTO updateFolder(Long folderId, UpdateFolderRequestDTO request) {
        log.info("Updating folder with ID: {}", folderId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        Folder folder = folderRepository.findByIdAndOrganizationId(folderId, orgId)
                .orElseThrow(() -> new RuntimeException("Folder not found or access denied: " + folderId));
        
        if (StringUtils.hasText(request.getName())) {
            folder.setName(request.getName());
        }
        
        folder = folderRepository.save(folder);
        return convertToFolderDTO(folder);
    }

    @Override
    @Transactional
    public void deleteFolder(Long folderId) {
        log.info("Deleting folder with ID: {}", folderId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        Folder folder = folderRepository.findByIdAndOrganizationId(folderId, orgId)
                .orElseThrow(() -> new RuntimeException("Folder not found or access denied: " + folderId));

        // Recursively delete all contents first (with org filter)
        deleteFolderContentsRecursively(folderId, orgId);

        // Now delete the folder itself
        folder.setDeleted(true);
        folderRepository.save(folder);

        log.info("Successfully deleted folder with ID: {}", folderId);
    }

    private void deleteFolderContentsRecursively(Long folderId, Long orgId) {
        log.debug("Deleting contents of folder with ID: {}", folderId);

        // SECURITY: First, delete all files in this folder using tenant-filtered query
        List<FileItem> files = fileItemRepository.findByFolderIdAndDeletedFalseAndOrganizationId(folderId, orgId);
        for (FileItem file : files) {
            log.debug("Soft deleting file: {} (ID: {})", file.getName(), file.getId());
            file.setDeleted(true);
            file.setDeletedAt(LocalDateTime.now());
            fileItemRepository.save(file);
        }

        // SECURITY: Then, recursively delete all subfolders using tenant-filtered query
        List<Folder> subFolders = folderRepository.findByParentFolderIdAndDeletedFalseAndOrganizationId(folderId, orgId);
        for (Folder subFolder : subFolders) {
            log.debug("Recursively deleting subfolder: {} (ID: {})", subFolder.getName(), subFolder.getId());
            deleteFolderContentsRecursively(subFolder.getId(), orgId); // Recursive call with org filter
            subFolder.setDeleted(true);
            folderRepository.save(subFolder);
        }
    }
    
    @Override
    @Transactional
    public void moveFolder(Long folderId, Long targetFolderId) {
        log.info("Moving folder {} to folder {}", folderId, targetFolderId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        Folder folder = folderRepository.findByIdAndOrganizationId(folderId, orgId)
                .orElseThrow(() -> new RuntimeException("Folder not found or access denied: " + folderId));
        
        if (folder.getDeleted()) {
            throw new RuntimeException("Cannot move a deleted folder");
        }
        
        // Prevent moving folder into itself or its descendants
        if (folderId.equals(targetFolderId)) {
            throw new RuntimeException("Cannot move folder into itself");
        }
        
        folder.setParentFolderId(targetFolderId);
        folderRepository.save(folder);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CaseDTO> getActiveCases(Pageable pageable) {
        log.info("Getting active cases");
        Long orgId = getRequiredOrganizationId();

        List<CaseStatus> activeStatuses = Arrays.asList(
            CaseStatus.ACTIVE,
            CaseStatus.OPEN,
            CaseStatus.IN_PROGRESS
        );

        // SECURITY: Use tenant-filtered query
        Page<LegalCase> casesPage = legalCaseRepository.findByOrganizationIdAndStatusIn(orgId, activeStatuses, pageable);

        List<CaseDTO> caseDTOs = casesPage.getContent().stream()
                .map(this::convertToCaseDTO)
                .collect(Collectors.toList());

        return new PageImpl<>(caseDTOs, pageable, casesPage.getTotalElements());
    }
    
    @Override
    @Transactional(readOnly = true)
    public Page<CaseDTO> getCases(List<String> statuses, String search, Pageable pageable) {
        log.info("Getting cases with filters - statuses: {}, search: {}", statuses, search);
        Long orgId = getRequiredOrganizationId();

        Page<LegalCase> casesPage;

        if (statuses != null && !statuses.isEmpty()) {
            List<CaseStatus> caseStatuses = statuses.stream()
                    .map(CaseStatus::valueOf)
                    .collect(Collectors.toList());

            if (search != null && !search.trim().isEmpty()) {
                // SECURITY: Use tenant-filtered query
                casesPage = legalCaseRepository.searchCasesByOrganizationAndStatus(orgId, caseStatuses, search.trim(), pageable);
            } else {
                // SECURITY: Use tenant-filtered query
                casesPage = legalCaseRepository.findByOrganizationIdAndStatusIn(orgId, caseStatuses, pageable);
            }
        } else {
            if (search != null && !search.trim().isEmpty()) {
                // SECURITY: Use tenant-filtered query
                casesPage = legalCaseRepository.searchCasesByOrganization(orgId, search.trim(), pageable);
            } else {
                // SECURITY: Use tenant-filtered query
                casesPage = legalCaseRepository.findByOrganizationId(orgId, pageable);
            }
        }

        List<CaseDTO> caseDTOs = casesPage.getContent().stream()
                .map(this::convertToCaseDTO)
                .collect(Collectors.toList());

        return new PageImpl<>(caseDTOs, pageable, casesPage.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public List<FileItemDTO> getCaseFiles(Long caseId) {
        log.info("Getting files for case ID: {}", caseId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        List<FileItem> files = fileItemRepository.findByCaseIdAndDeletedFalseAndOrganizationId(caseId, orgId);

        return files.stream()
                .map(this::convertToFileItemDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<FolderDTO> getCaseFolders(Long caseId) {
        log.info("Getting root folders for case ID: {}", caseId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        List<Folder> folders = folderRepository.findRootFoldersByCaseIdAndOrganization(orgId, caseId);

        return folders.stream()
                .map(this::convertToFolderDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<FileVersionDTO> getFileVersions(Long fileId) {
        log.info("Getting versions for file ID: {}", fileId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        List<FileVersion> versions = fileVersionRepository.findByOrganizationIdAndFileIdAndIsDeletedFalseOrderByVersionNumberDesc(orgId, fileId);

        return versions.stream()
                .map(this::convertToFileVersionDTO)
                .collect(Collectors.toList());
    }

    @Override
    public FileVersionDTO uploadFileVersion(Long fileId, MultipartFile file, String comment) {
        log.info("Uploading new version for file ID: {}", fileId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        FileItem fileItem = fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found or access denied: " + fileId));
        
        if (Boolean.TRUE.equals(fileItem.getDeleted())) {
            throw new RuntimeException("Cannot upload version for deleted file");
        }
        
        try {
            // Build the folder path for storage
            String folderPath = buildFolderPath(fileItem.getFolderId());
            String subdirectory = folderPath.isEmpty() ? "documents" : folderPath;
            
            // Use original filename for the new version
            String fileName = file.getOriginalFilename();
            
            // Store the physical file
            String storedFilePath = fileStorageService.storeFile(file, subdirectory, fileName);
            log.info("New version file stored at: {}", storedFilePath);
            
            Integer highestVersion = fileVersionRepository.findHighestVersionNumberIncludingDeleted(fileId);
            Integer newVersionNumber = (highestVersion != null ? highestVersion : 0) + 1;

            // Mark all previous versions as not current - SECURITY: Use tenant-filtered query
            List<FileVersion> existingVersions = fileVersionRepository.findByOrganizationIdAndFileIdAndIsDeletedFalseOrderByVersionNumberDesc(orgId, fileId);
            for (FileVersion version : existingVersions) {
                version.setIsCurrent(false);
                fileVersionRepository.save(version);
            }
            
            // Create new version record
            FileVersion newVersion = FileVersion.builder()
                    .fileId(fileId)
                    .versionNumber(newVersionNumber)
                    .fileName(fileName)
                    .filePath(storedFilePath)
                    .fileSize(file.getSize())
                    .mimeType(file.getContentType())
                    .isCurrent(true)
                    .changeNotes(comment)
                    .createdBy(getCurrentUserId())
                    .uploadedBy(getCurrentUserId())
                    .build();
            
            newVersion = fileVersionRepository.save(newVersion);
            
            // Update main file item to point to the new version
            fileItem.setVersion(newVersionNumber);
            fileItem.setSize(file.getSize());
            fileItem.setName(fileName); // Update name in case it changed
            fileItem.setFilePath(storedFilePath); // IMPORTANT: Update the file path to the new version
            fileItem.setUpdatedAt(LocalDateTime.now());
            fileItemRepository.save(fileItem);
            
            log.info("Successfully uploaded version {} for file ID: {}", newVersionNumber, fileId);
            
            logFileAccess(fileId, FileAccessLog.ActionType.VERSION_CREATE, true, null);
            
            // Send document version update notifications
            try {
                String title = "Document Version Updated";
                String message = String.format("New version (v%d) of document \"%s\" has been uploaded",
                    newVersionNumber, fileName != null ? fileName : fileItem.getName());

                Set<Long> notificationUserIds = new HashSet<>();

                // SECURITY: Get users assigned to the case if this file is related to a case (with org filter)
                if (fileItem.getCaseId() != null && fileItem.getOrganizationId() != null) {
                    List<CaseAssignment> caseAssignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(fileItem.getCaseId(), fileItem.getOrganizationId());
                    for (CaseAssignment assignment : caseAssignments) {
                        if (assignment.getAssignedTo() != null) {
                            notificationUserIds.add(assignment.getAssignedTo().getId());
                        }
                    }
                }

                // Remove the user who uploaded the new version from notifications (don't notify yourself)
                Long uploadedBy = getCurrentUserId();
                if (uploadedBy != null) {
                    notificationUserIds.remove(uploadedBy);
                }

                // Send notifications to all collected users
                for (Long userId : notificationUserIds) {
                    notificationService.sendCrmNotification(title, message, userId,
                        "DOCUMENT_VERSION_UPDATED", Map.of("fileId", fileId,
                                                           "versionId", newVersion.getId(),
                                                           "versionNumber", newVersionNumber,
                                                           "fileName", fileName != null ? fileName : fileItem.getName(),
                                                           "caseId", fileItem.getCaseId() != null ? fileItem.getCaseId() : 0));
                }

                log.info("📧 Document version update notifications sent to {} users", notificationUserIds.size());
            } catch (Exception e) {
                log.error("Failed to send document version update notifications: {}", e.getMessage());
            }
            
            return convertToFileVersionDTO(newVersion);
            
        } catch (Exception e) {
            log.error("Failed to upload file version for file ID {}: {}", fileId, e.getMessage(), e);
            throw new RuntimeException("Failed to upload file version: " + e.getMessage(), e);
        }
    }

    @Override
    public FileVersionDTO getFileVersion(Long fileId, Long versionId) {
        log.info("Getting version {} for file ID: {}", versionId, fileId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: First verify the file belongs to this organization
        fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found or access denied: " + fileId));

        // SECURITY: Use tenant-filtered query for version
        FileVersion version = fileVersionRepository.findByIdAndOrganizationId(versionId, orgId)
                .orElseThrow(() -> new RuntimeException("Version not found or access denied: " + versionId));

        if (!version.getFileId().equals(fileId)) {
            throw new RuntimeException("Version does not belong to the specified file");
        }

        return convertToFileVersionDTO(version);
    }

    @Override
    public byte[] downloadFileVersion(Long versionId) {
        log.info("Downloading version with ID: {}", versionId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        FileVersion version = fileVersionRepository.findByIdAndOrganizationId(versionId, orgId)
                .orElseThrow(() -> new RuntimeException("Version not found or access denied: " + versionId));

        try {
            Resource resource = fileStorageService.loadFileAsResource(version.getFilePath());
            return resource.getInputStream().readAllBytes();
        } catch (Exception e) {
            log.error("Failed to download version {}: {}", versionId, e.getMessage());
            throw new RuntimeException("Failed to download file version", e);
        }
    }

    @Override
    @Transactional
    public void restoreFileVersion(Long fileId, Long versionId) {
        log.info("Restoring version {} as new current version for file ID: {}", versionId, fileId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: First verify the file belongs to this organization
        fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found or access denied: " + fileId));

        // SECURITY: Use tenant-filtered query for version
        FileVersion versionToRestore = fileVersionRepository.findByIdAndOrganizationId(versionId, orgId)
                .orElseThrow(() -> new RuntimeException("Version not found or access denied: " + versionId));

        if (!versionToRestore.getFileId().equals(fileId)) {
            throw new RuntimeException("Version does not belong to the specified file");
        }
        
        if (versionToRestore.getIsDeleted()) {
            throw new RuntimeException("Cannot restore deleted version");
        }
        
        // IMPROVED APPROACH: Handle the constraint properly
        // The constraint 'unique_current_version' appears to enforce uniqueness on (file_id, is_current)
        // This means we can only have ONE record with is_current=true and ONE with is_current=false per file

        // Step 1: Find the highest version number (including deleted versions)
        Integer highestVersionNumber = fileVersionRepository.findHighestVersionNumberIncludingDeleted(fileId);
        if (highestVersionNumber == null) {
            // Fallback: get from all versions - SECURITY: Use tenant-filtered query
            List<FileVersion> allVersions = fileVersionRepository.findByOrganizationIdAndFileIdOrderByVersionNumberDesc(orgId, fileId);
            highestVersionNumber = allVersions.stream()
                    .map(FileVersion::getVersionNumber)
                    .max(Integer::compareTo)
                    .orElse(0);
        }

        Integer nextVersionNumber = highestVersionNumber + 1;
        log.info("Creating new version {} for file {}", nextVersionNumber, fileId);

        // Step 2: Mark all existing versions as non-current (since we fixed the DB constraint) - SECURITY: Use tenant-filtered query
        List<FileVersion> activeVersions = fileVersionRepository.findByOrganizationIdAndFileIdAndIsDeletedFalseOrderByVersionNumberDesc(orgId, fileId);
        log.info("Found {} active versions for file {}", activeVersions.size(), fileId);
        
        for (FileVersion version : activeVersions) {
            if (version.getIsCurrent()) {
                log.info("Marking version {} as non-current", version.getVersionNumber());
                version.setIsCurrent(false);
                fileVersionRepository.save(version);
            }
        }
        
        // Flush to ensure changes are committed
        fileVersionRepository.flush();
        
        // Step 3: Create the new version
        FileVersion newCurrentVersion = FileVersion.builder()
                .fileId(fileId)
                .versionNumber(nextVersionNumber)
                .fileName(versionToRestore.getFileName())
                .fileSize(versionToRestore.getFileSize())
                .mimeType(versionToRestore.getMimeType())
                .filePath(versionToRestore.getFilePath())
                .uploadedAt(LocalDateTime.now())
                .uploadedBy(getCurrentUserId())
                .createdBy(getCurrentUserId())
                .changeNotes("Restored from version " + versionToRestore.getVersionNumber())
                .isCurrent(true)
                .isDeleted(false)
                .checksum(versionToRestore.getChecksum())
                .build();
        
        try {
            log.info("Saving new version {} as current", nextVersionNumber);
            FileVersion savedVersion = fileVersionRepository.save(newCurrentVersion);
            log.info("Successfully saved version with ID: {} and number: {}", 
                savedVersion.getId(), savedVersion.getVersionNumber());
            newCurrentVersion = savedVersion;
        } catch (Exception e) {
            log.error("Failed to save version: {}", e.getMessage());
            
            // If we still get a constraint violation, it means the constraint is different than we think
            // Let's try to understand what's happening
            log.error("Constraint violation details:");
            log.error("Tried to insert: fileId={}, versionNumber={}, isCurrent={}", 
                fileId, nextVersionNumber, true);
            
            // Log more details about the constraint violation
            log.error("This might be due to the unique constraint on (file_id, is_current)");
            
            throw new RuntimeException("Failed to create new version: " + e.getMessage(), e);
        }
        
        // Update the file item - already verified organization at method start
        FileItem fileItem = fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found or access denied: " + fileId));

        fileItem.setVersion(newCurrentVersion.getVersionNumber());
        fileItem.setSize(newCurrentVersion.getFileSize());
        fileItem.setName(newCurrentVersion.getFileName());
        fileItem.setFilePath(newCurrentVersion.getFilePath());
        fileItem.setUpdatedAt(LocalDateTime.now());
        fileItemRepository.save(fileItem);
        
        logFileAccess(fileId, FileAccessLog.ActionType.VERSION_RESTORE, true, 
            "Restored version " + versionToRestore.getVersionNumber() + " as new version " + nextVersionNumber);
        
        log.info("Successfully created new version {} by restoring version {} for file ID: {}", 
            nextVersionNumber, versionToRestore.getVersionNumber(), fileId);
    }

    @Override
    @Transactional
    public void deleteFileVersion(Long fileId, Long versionId) {
        log.info("Deleting version {} of file ID: {}", versionId, fileId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: First verify the file belongs to this organization
        fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found or access denied: " + fileId));

        // SECURITY: Use tenant-filtered query for version
        FileVersion version = fileVersionRepository.findByIdAndOrganizationId(versionId, orgId)
                .orElseThrow(() -> new RuntimeException("Version not found or access denied: " + versionId));

        if (!version.getFileId().equals(fileId)) {
            throw new RuntimeException("Version does not belong to the specified file");
        }
        
        if (version.getIsCurrent()) {
            throw new RuntimeException("Cannot delete the current version");
        }
        
        // Soft delete the version
        version.setIsDeleted(true);
        fileVersionRepository.save(version);
        
        log.info("Successfully deleted version {} of file ID: {}", versionId, fileId);
    }

    @Override
    public FileVersionDTO replaceFileContent(Long fileId, MultipartFile file, String comment) {
        log.info("Replacing content for file ID: {}", fileId);
        return uploadFileVersion(fileId, file, comment);
    }

    @Override
    @Transactional(readOnly = true)
    public List<FilePermissionDTO> getFilePermissions(Long fileId) {
        log.info("Getting permissions for file ID: {}", fileId);
        
        // TODO: Implement file permissions
        return Arrays.asList();
    }

    @Override
    public void shareFile(Long fileId, ShareFileRequestDTO request) {
        log.info("Sharing file ID: {} with request: {}", fileId, request);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        FileItem fileItem = fileItemRepository.findByIdAndOrganizationId(fileId, orgId)
                .orElseThrow(() -> new RuntimeException("File not found or access denied: " + fileId));
        
        FileShare fileShare = FileShare.builder()
                .organizationId(orgId)
                .fileId(fileId)
                .sharedWithUserId(request.getSharedWithUserId())
                .sharedWithEmail(request.getSharedWithEmail())
                .shareToken(generateShareToken())
                .shareType(FileShare.ShareType.valueOf(request.getShareType()))
                .accessLevel(FileShare.AccessLevel.valueOf(request.getAccessLevel()))
                .expiresAt(request.getExpiresAt())
                .maxDownloads(request.getMaxDownloads())
                // .shareMessage(request.getMessage()) // Column doesn't exist in DB
                .createdBy(getCurrentUserId())
                .build();
        
        fileShareRepository.save(fileShare);
        
        logFileAccess(fileId, FileAccessLog.ActionType.SHARE, true, null);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<FileItemDTO> searchFiles(String query, Pageable pageable, String fileType, Long caseId) {
        log.info("Searching files with query: {}, fileType: {}, caseId: {}", query, fileType, caseId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered search
        Page<FileItem> searchResults = fileItemRepository.searchByNameOrDescriptionAndOrganizationId(query, orgId, pageable);

        List<FileItemDTO> resultDTOs = searchResults.getContent().stream()
                .map(this::convertToFileItemDTO)
                .collect(Collectors.toList());

        return new PageImpl<>(resultDTOs, pageable, searchResults.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public FileManagerStatsDTO getStats() {
        log.info("Getting file manager statistics");
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered queries
        Long totalFiles = fileItemRepository.countActiveFilesByOrganization(orgId);
        Long totalFolders = folderRepository.countByOrganization(orgId); // SECURITY: Tenant-filtered
        Long totalSize = fileItemRepository.getTotalStorageSizeByOrganization(orgId);
        // SECURITY: Use tenant-filtered query
        Long recentUploads = fileAccessLogRepository.countAccessesSinceByOrganization(orgId, LocalDateTime.now().minusDays(7));
        
        // Calculate storage values
        Long usedSpace = totalSize != null ? totalSize : 0L;
        Long maxSpace = 10L * 1024L * 1024L * 1024L; // 10GB default limit
        Long availableSpace = maxSpace - usedSpace;
        Double usagePercentage = (usedSpace > 0 && maxSpace > 0) ? 
            (double) usedSpace / maxSpace * 100 : 0.0;
        
        return FileManagerStatsDTO.builder()
                .totalFiles(totalFiles != null ? totalFiles.intValue() : 0)
                .totalFolders(totalFolders != null ? totalFolders.intValue() : 0)
                .totalStorageSize(usedSpace)
                .totalSize(usedSpace)
                .usedSpace(usedSpace)
                .availableSpace(availableSpace)
                .usagePercentage(usagePercentage)
                .formattedTotalSize(formatFileSize(usedSpace))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<FileItemDTO> getRecentFiles(int limit) {
        log.info("Getting recent files with limit: {}", limit);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        List<FileItem> recentFiles = fileItemRepository.findRecentFilesByOrganization(orgId, LocalDateTime.now().minusDays(30));

        return recentFiles.stream()
                .limit(limit)
                .map(this::convertToFileItemDTO)
                .collect(Collectors.toList());
    }
    
    @Override
    @Transactional(readOnly = true)
    public List<FileItemDTO> getStarredFiles() {
        log.info("Getting starred files");
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        List<FileItem> starredFiles = fileItemRepository.findStarredFilesByOrganization(orgId);

        return starredFiles.stream()
                .map(this::convertToFileItemDTO)
                .collect(Collectors.toList());
    }

    // Helper conversion methods
    private FileItemDTO convertToFileItemDTO(FileItem fileItem) {
        // Get case name if file is associated with a case
        String caseName = null;
        if (fileItem.getCaseId() != null && fileItem.getLegalCase() != null) {
            caseName = fileItem.getLegalCase().getTitle();
        }

        // Get creator name
        String createdByName = null;
        if (fileItem.getCreatedBy() != null && fileItem.getCreatedByUser() != null) {
            createdByName = fileItem.getCreatedByUser().getFirstName() + " " + fileItem.getCreatedByUser().getLastName();
        }

        return FileItemDTO.builder()
                .id(fileItem.getId())
                .name(fileItem.getOriginalName()) // Use original name for display
                .originalName(fileItem.getOriginalName())
                .size(fileItem.getSize())
                .formattedSize(fileItem.getFormattedSize())
                .mimeType(fileItem.getMimeType())
                .extension(fileItem.getExtension())
                .icon(fileItem.getIcon())
                .iconColor(fileItem.getIconColor())
                .fileType(fileItem.getFileType())
                .folderId(fileItem.getFolderId())
                .caseId(fileItem.getCaseId())
                .caseName(caseName)
                .createdById(fileItem.getCreatedBy())
                .createdByName(createdByName)
                .createdAt(fileItem.getCreatedAt())
                .updatedAt(fileItem.getUpdatedAt())
                .version(fileItem.getVersion())
                .starred(fileItem.getStarred() != null ? fileItem.getStarred() : false)
                .sharedWithClient(fileItem.getSharedWithClient() != null ? fileItem.getSharedWithClient() : false)
                .deleted(fileItem.getDeleted() != null ? fileItem.getDeleted() : false)
                .deletedAt(fileItem.getDeletedAt())
                .documentCategory(fileItem.getDocumentCategory())
                .documentStatus(fileItem.getDocumentStatus())
                .canEdit(true)
                .canDelete(true)
                .downloadUrl(fileItem.getDownloadUrl())
                .previewUrl(fileItem.getPreviewUrl())
                .build();
    }
    
    private FolderDTO convertToFolderDTO(Folder folder) {
        // Calculate folder statistics
        Integer fileCount = calculateFileCount(folder.getId());
        Integer subfolderCount = calculateSubfolderCount(folder.getId());
        Long totalSize = calculateFolderSize(folder.getId());
        
        return FolderDTO.builder()
                .id(folder.getId())
                .name(folder.getName())
                .parentFolderId(folder.getParentFolderId())
                .caseId(folder.getCaseId())
                .createdAt(folder.getCreatedAt())
                .updatedAt(folder.getUpdatedAt())
                .fileCount(fileCount)
                .folderCount(subfolderCount)
                .size(totalSize)
                .canEdit(true)
                .canDelete(fileCount == 0 && subfolderCount == 0)
                .canShare(true)
                .hasChildren(subfolderCount > 0)
                .build();
    }
    
    private Integer calculateFileCount(Long folderId) {
        try {
            return Math.toIntExact(fileItemRepository.countByFolderIdAndDeletedFalse(folderId));
        } catch (Exception e) {
            log.warn("Error calculating file count for folder {}: {}", folderId, e.getMessage());
            return 0;
        }
    }
    
    private Integer calculateSubfolderCount(Long folderId) {
        try {
            Long orgId = getRequiredOrganizationId();
            // SECURITY: Use tenant-filtered query
            List<Folder> subfolders = folderRepository.findByParentFolderIdAndDeletedFalseAndOrganizationId(folderId, orgId);
            return subfolders.size();
        } catch (Exception e) {
            log.warn("Error calculating subfolder count for folder {}: {}", folderId, e.getMessage());
            return 0;
        }
    }

    private Long calculateFolderSize(Long folderId) {
        try {
            Long orgId = getRequiredOrganizationId();
            // Get direct files size
            Long directFilesSize = fileItemRepository.sumSizeByFolderIdAndDeletedFalse(folderId);
            if (directFilesSize == null) {
                directFilesSize = 0L;
            }

            // SECURITY: Get subfolders using tenant-filtered query and their sizes recursively
            List<Folder> subfolders = folderRepository.findByParentFolderIdAndDeletedFalseAndOrganizationId(folderId, orgId);
            Long subfoldersSize = subfolders.stream()
                    .mapToLong(subfolder -> calculateFolderSize(subfolder.getId()))
                    .sum();

            return directFilesSize + subfoldersSize;
        } catch (Exception e) {
            log.warn("Error calculating folder size for folder {}: {}", folderId, e.getMessage());
            return 0L;
        }
    }
    
    private FileVersionDTO convertToFileVersionDTO(FileVersion version) {
        // Get uploaded by user information
        String uploadedByName = "Unknown";
        if (version.getUploadedBy() != null) {
            uploadedByName = getUserDisplayName(version.getUploadedBy());
        }
        
        return FileVersionDTO.builder()
                .id(version.getId())
                .fileId(version.getFileId())
                .versionNumber(version.getVersionNumber().toString())
                .fileName(version.getFileName())
                .fileSize(version.getFileSize())
                .formattedSize(version.getFormattedSize())
                .mimeType(version.getMimeType())
                .uploadedById(version.getUploadedBy())
                .uploadedByName(uploadedByName)
                .isCurrent(version.getIsCurrent())
                .uploadedAt(version.getUploadedAt())
                .comment(version.getChangeNotes())
                .downloadUrl(version.getDownloadUrl())
                .build();
    }
    
    private CaseDTO convertToCaseDTO(LegalCase legalCase) {
        return CaseDTO.builder()
                .id(legalCase.getId())
                .caseNumber(legalCase.getCaseNumber())
                .title(legalCase.getTitle())
                .status(legalCase.getStatus() != null ? legalCase.getStatus().name() : "OPEN")
                .clientName(legalCase.getClientName())
                .createdAt(legalCase.getCreatedAt() != null ? 
                    legalCase.getCreatedAt().toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime() : null)
                .updatedAt(legalCase.getUpdatedAt() != null ? 
                    legalCase.getUpdatedAt().toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime() : null)
                .build();
    }
    
    private FileSearchResultDTO convertToFileSearchResultDTO(FileItem fileItem) {
        return FileSearchResultDTO.builder()
                .id(fileItem.getId())
                .name(fileItem.getName())
                .originalName(fileItem.getOriginalName())
                .size(fileItem.getSize())
                .mimeType(fileItem.getMimeType())
                .extension(fileItem.getExtension())
                .icon(fileItem.getIcon())
                .iconColor(fileItem.getIconColor())
                .fileType(fileItem.getFileType())
                .folderId(fileItem.getFolderId())
                .createdAt(fileItem.getCreatedAt())
                .downloadUrl(fileItem.getDownloadUrl())
                .build();
    }
    
    // Helper methods
    private String getMimeTypePattern(String fileType) {
        switch (fileType.toLowerCase()) {
            case "media": return "media"; // Special case for media files
            case "image": return "image/%";
            case "document": return "%document%";
            case "pdf": return "application/pdf";
            case "video": return "video/%";
            case "audio": return "audio/%";
            default: return "%" + fileType + "%";
        }
    }
    
    
    /**
     * Build the full folder path by traversing up the parent folders
     */
    private String buildFolderPath(Long folderId) {
        if (folderId == null) {
            return "";
        }

        Long orgId = getRequiredOrganizationId();
        List<String> pathSegments = new ArrayList<>();
        // SECURITY: Use tenant-filtered query
        Folder currentFolder = folderRepository.findByIdAndOrganizationId(folderId, orgId).orElse(null);

        while (currentFolder != null) {
            pathSegments.add(0, currentFolder.getName());
            if (currentFolder.getParentFolderId() != null) {
                // SECURITY: Use tenant-filtered query
                currentFolder = folderRepository.findByIdAndOrganizationId(currentFolder.getParentFolderId(), orgId).orElse(null);
            } else {
                currentFolder = null;
            }
        }

        return String.join("/", pathSegments);
    }
    
    /**
     * Check if a file with the given name already exists in the folder - TENANT FILTERED
     */
    private boolean fileExistsInFolder(Long folderId, String fileName) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        List<FileItem> existingFiles = fileItemRepository.findByFolderIdAndDeletedFalseAndOrganizationId(folderId, orgId);
        return existingFiles.stream()
                .anyMatch(file -> fileName.equals(file.getOriginalName()));
    }
    
    private String getFileExtension(String fileName) {
        int lastDot = fileName.lastIndexOf('.');
        return lastDot > 0 ? fileName.substring(lastDot + 1) : "";
    }
    
    private String generateFilePath(String fileName) {
        return "/uploads/" + fileName;
    }
    
    
    private String generateShareToken() {
        return java.util.UUID.randomUUID().toString();
    }
    
    private void logFileAccess(Long fileId, FileAccessLog.ActionType actionType, boolean success, String errorMessage) {
        try {
            Long orgId = getRequiredOrganizationId();
            FileAccessLog accessLog = FileAccessLog.builder()
                    .organizationId(orgId)  // SECURITY: Set organization ID for tenant isolation
                    .fileId(fileId)
                    .userId(getCurrentUserId())
                    .actionType(actionType)
                    .downloadSuccess(success)
                    .errorMessage(errorMessage)
                    .accessMethod("web")
                    .build();

            fileAccessLogRepository.save(accessLog);
        } catch (Exception e) {
            log.warn("Failed to log file access: {}", e.getMessage());
        }
    }
    
    private String formatFileSize(Long bytes) {
        if (bytes == null || bytes == 0) return "0 B";
        
        final String[] units = new String[] { "B", "KB", "MB", "GB", "TB" };
        int digitGroups = (int) (Math.log10(bytes) / Math.log10(1024));
        
        return String.format("%.2f %s", bytes / Math.pow(1024, digitGroups), units[digitGroups]);
    }
    
    private String getUserDisplayName(Long userId) {
        if (userId == null) {
            return "Unknown";
        }
        
        try {
            User user = userRepository.get(userId);
            if (user != null) {
                String firstName = user.getFirstName();
                String lastName = user.getLastName();
                String email = user.getEmail();
                
                // Build display name from available information
                if (firstName != null && lastName != null) {
                    return firstName + " " + lastName;
                } else if (firstName != null) {
                    return firstName;
                } else if (email != null) {
                    return email;
                } else {
                    return "User " + userId;
                }
            }
        } catch (Exception e) {
            log.warn("Failed to get user display name for user ID {}: {}", userId, e.getMessage());
        }
        
        return "Unknown";
    }
}