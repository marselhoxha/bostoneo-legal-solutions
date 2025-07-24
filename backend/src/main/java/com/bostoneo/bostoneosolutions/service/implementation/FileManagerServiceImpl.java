package com.***REMOVED***.***REMOVED***solutions.service.implementation;

import com.***REMOVED***.***REMOVED***solutions.dto.filemanager.*;
import com.***REMOVED***.***REMOVED***solutions.model.*;
import com.***REMOVED***.***REMOVED***solutions.repository.*;
import com.***REMOVED***.***REMOVED***solutions.service.FileManagerService;
import com.***REMOVED***.***REMOVED***solutions.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class FileManagerServiceImpl implements FileManagerService {
    
    private Long getCurrentUserId() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated() && 
                !authentication.getName().equals("anonymousUser")) {
                String subject = authentication.getName();
                return Long.parseLong(subject);
            }
        } catch (Exception e) {
            log.debug("Could not get current user from security context: {}", e.getMessage());
        }
        return 1L; // Default fallback
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

    @Override
    @Transactional(readOnly = true)
    public Page<FileItemDTO> getFiles(Pageable pageable, Long folderId, Long caseId, String search, String fileType) {
        log.info("Getting files with pagination: page={}, size={}, folderId={}, caseId={}, search={}, fileType={}", 
                pageable.getPageNumber(), pageable.getPageSize(), folderId, caseId, search, fileType);
        
        Page<FileItem> filesPage;
        
        if (StringUtils.hasText(search)) {
            filesPage = fileItemRepository.searchByNameOrDescription(search, pageable);
        } else if (caseId != null && caseId == -1L) {
            // Special case: -1 means personal files (no case association)
            Long currentUserId = getCurrentUserId();
            filesPage = fileItemRepository.findPersonalDocuments(currentUserId, folderId, pageable);
        } else if (folderId != null || caseId != null || StringUtils.hasText(fileType)) {
            // Handle media file type specially
            if ("media".equalsIgnoreCase(fileType)) {
                filesPage = fileItemRepository.findMediaFiles(pageable);
            } else {
                String mimeTypePattern = null;
                if (StringUtils.hasText(fileType)) {
                    mimeTypePattern = getMimeTypePattern(fileType);
                }
                filesPage = fileItemRepository.findWithFilters(folderId, caseId, mimeTypePattern, null, null, null, pageable);
            }
        } else {
            filesPage = fileItemRepository.findByDeletedFalse(pageable);
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
        
        FileItem fileItem = fileItemRepository.findById(fileId)
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
        
        FileItem fileItem = fileItemRepository.findById(fileId)
                .orElseThrow(() -> new RuntimeException("File not found with ID: " + fileId));
        
        if (fileItem.getDeleted()) {
            throw new RuntimeException("File has been deleted");
        }
        
        // Return the stored file path
        return fileItem.getFilePath();
    }

    @Override
    public FileUploadResponseDTO uploadFile(MultipartFile file, Long folderId, Long caseId, String description, String tags) {
        log.info("Uploading file: {} to folder: {}, case: {}", file.getOriginalFilename(), folderId, caseId);
        
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
                fileItem = createFileRecord(finalFileName, file, storedFilePath, folderId, caseId, tags);
            } catch (Exception dbException) {
                // Clean up the uploaded file if database operations fail
                try {
                    fileStorageService.deleteFile(storedFilePath);
                } catch (Exception cleanupException) {
                    log.warn("Failed to clean up uploaded file after database error: {}", cleanupException.getMessage());
                }
                throw dbException;
            }
            
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
                                     Long folderId, Long caseId, String tags) {
        try {
            log.info("Creating file record for: {}", fileName);
            Long currentUserId = getCurrentUserId();
            log.info("Current user ID: {}", currentUserId);
            
            FileItem fileItem = FileItem.builder()
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
        
        FileItem fileItem = fileItemRepository.findById(fileId)
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
        
        FileItem fileItem = fileItemRepository.findById(fileId)
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
        
        FileItem fileItem = fileItemRepository.findById(fileId)
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
        
        FileItem fileItem = fileItemRepository.findById(fileId)
                .orElseThrow(() -> new RuntimeException("File not found with ID: " + fileId));
        
        log.info("Found file: {} (deleted: {})", fileItem.getName(), fileItem.getDeleted());
        
        if (!Boolean.TRUE.equals(fileItem.getDeleted())) {
            log.warn("File {} is not soft deleted, cannot permanently delete", fileId);
            throw new RuntimeException("File must be soft deleted before permanent deletion");
        }
        
        String filePath = fileItem.getFilePath();
        
        try {
            // Delete related data first to avoid foreign key constraints
            log.info("Deleting file access logs for file ID: {}", fileId);
            fileAccessLogRepository.deleteByFileId(fileId);
            log.info("Deleted file access logs");
            
            log.info("Deleting file comments for file ID: {}", fileId);
            fileCommentRepository.deleteByFileId(fileId);
            log.info("Deleted file comments");
            
            log.info("Deleting file tags for file ID: {}", fileId);
            fileTagRepository.deleteByFileId(fileId);
            log.info("Deleted file tags");
            
            log.info("Deleting file shares for file ID: {}", fileId);
            fileShareRepository.deleteByFileId(fileId);
            log.info("Deleted file shares");
            
            log.info("Deleting file versions for file ID: {}", fileId);
            fileVersionRepository.deleteByFileId(fileId);
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
        
        Page<FileItem> deletedFiles = fileItemRepository.findByDeletedTrueOrderByDeletedAtDesc(pageable);
        
        List<FileItemDTO> fileItemDTOs = deletedFiles.getContent().stream()
                .map(this::convertToFileItemDTO)
                .collect(Collectors.toList());
        
        return new PageImpl<>(fileItemDTOs, pageable, deletedFiles.getTotalElements());
    }
    
    @Override
    @Transactional
    public void moveFile(Long fileId, Long targetFolderId) {
        log.info("Moving file {} to folder {}", fileId, targetFolderId);
        
        FileItem fileItem = fileItemRepository.findById(fileId)
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
        
        FileItem originalFile = fileItemRepository.findById(fileId)
                .orElseThrow(() -> new RuntimeException("File not found with ID: " + fileId));
        
        if (originalFile.getDeleted()) {
            throw new RuntimeException("Cannot copy a deleted file");
        }
        
        // Create a copy of the file with a new name  
        String newFileName = "copy_" + System.currentTimeMillis() + "_" + originalFile.getOriginalName();
        String newFilePath = originalFile.getFilePath().replace(originalFile.getOriginalName(), newFileName);
        
        // Create new file record
        FileItem newFile = FileItem.builder()
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
        // Get the current file state
        FileItem fileItem = fileItemRepository.findById(fileId)
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
    public FolderDTO getRootFolder() {
        log.info("Getting root folder");
        
        List<Folder> rootFolders = folderRepository.findRootFolders();
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
        
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new RuntimeException("Folder not found with ID: " + folderId));
        
        return convertToFolderDTO(folder);
    }
    
    @Override
    @Transactional(readOnly = true)
    public List<FolderDTO> getSubfolders(Long parentFolderId) {
        log.info("Getting subfolders for parent folder ID: {}", parentFolderId);
        
        List<Folder> subfolders = folderRepository.findByParentFolderIdAndDeletedFalse(parentFolderId);
        
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
        
        Long parentFolderId = request.getParentFolderIdValue();
        Optional<Folder> existingFolder = folderRepository.findByNameAndParent(request.getName(), parentFolderId);
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
        
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new RuntimeException("Folder not found with ID: " + folderId));
        
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
        
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new RuntimeException("Folder not found with ID: " + folderId));
        
        // Recursively delete all contents first
        deleteFolderContentsRecursively(folderId);
        
        // Now delete the folder itself
        folder.setDeleted(true);
        folderRepository.save(folder);
        
        log.info("Successfully deleted folder with ID: {}", folderId);
    }
    
    private void deleteFolderContentsRecursively(Long folderId) {
        log.debug("Deleting contents of folder with ID: {}", folderId);
        
        // First, delete all files in this folder
        List<FileItem> files = fileItemRepository.findByFolderIdAndDeletedFalse(folderId);
        for (FileItem file : files) {
            log.debug("Soft deleting file: {} (ID: {})", file.getName(), file.getId());
            file.setDeleted(true);
            file.setDeletedAt(LocalDateTime.now());
            fileItemRepository.save(file);
        }
        
        // Then, recursively delete all subfolders
        List<Folder> subFolders = folderRepository.findByParentFolderIdAndDeletedFalse(folderId);
        for (Folder subFolder : subFolders) {
            log.debug("Recursively deleting subfolder: {} (ID: {})", subFolder.getName(), subFolder.getId());
            deleteFolderContentsRecursively(subFolder.getId()); // Recursive call
            subFolder.setDeleted(true);
            folderRepository.save(subFolder);
        }
    }
    
    @Override
    @Transactional
    public void moveFolder(Long folderId, Long targetFolderId) {
        log.info("Moving folder {} to folder {}", folderId, targetFolderId);
        
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new RuntimeException("Folder not found with ID: " + folderId));
        
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
        
        Page<LegalCase> casesPage = legalCaseRepository.findAll(pageable);
        
        List<CaseDTO> caseDTOs = casesPage.getContent().stream()
                .map(this::convertToCaseDTO)
                .collect(Collectors.toList());
        
        return new PageImpl<>(caseDTOs, pageable, casesPage.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public List<FileItemDTO> getCaseFiles(Long caseId) {
        log.info("Getting files for case ID: {}", caseId);
        
        List<FileItem> files = fileItemRepository.findByCaseIdAndDeletedFalse(caseId);
        
        return files.stream()
                .map(this::convertToFileItemDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<FolderDTO> getCaseFolders(Long caseId) {
        log.info("Getting root folders for case ID: {}", caseId);
        
        // Get only root folders associated with this case
        List<Folder> folders = folderRepository.findRootFoldersByCaseId(caseId);
        
        return folders.stream()
                .map(this::convertToFolderDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<FileVersionDTO> getFileVersions(Long fileId) {
        log.info("Getting versions for file ID: {}", fileId);
        
        List<FileVersion> versions = fileVersionRepository.findByFileIdAndIsDeletedFalseOrderByVersionNumberDesc(fileId);
        
        return versions.stream()
                .map(this::convertToFileVersionDTO)
                .collect(Collectors.toList());
    }

    @Override
    public FileVersionDTO uploadFileVersion(Long fileId, MultipartFile file, String comment) {
        log.info("Uploading new version for file ID: {}", fileId);
        
        FileItem fileItem = fileItemRepository.findById(fileId)
                .orElseThrow(() -> new RuntimeException("File not found with ID: " + fileId));
        
        Integer latestVersion = fileVersionRepository.findLatestVersionNumber(fileId);
        Integer newVersionNumber = (latestVersion != null ? latestVersion : 0) + 1;
        
        // Mark all previous versions as not current
        List<FileVersion> existingVersions = fileVersionRepository.findByFileIdAndIsDeletedFalseOrderByVersionNumberDesc(fileId);
        for (FileVersion version : existingVersions) {
            version.setIsCurrent(false);
            fileVersionRepository.save(version);
        }
        
        FileVersion newVersion = FileVersion.builder()
                .fileId(fileId)
                .versionNumber(newVersionNumber)
                .fileName(file.getOriginalFilename())
                .filePath(generateFilePath(file.getOriginalFilename()))
                .fileSize(file.getSize())
                .mimeType(file.getContentType())
                .isCurrent(true)
                .changeNotes(comment)
                .createdBy(getCurrentUserId())
                .uploadedBy(getCurrentUserId())
                .build();
        
        newVersion = fileVersionRepository.save(newVersion);
        
        // Update file item version
        fileItem.setVersion(newVersionNumber);
        fileItem.setSize(file.getSize());
        fileItemRepository.save(fileItem);
        
        logFileAccess(fileId, FileAccessLog.ActionType.VERSION_CREATE, true, null);
        
        return convertToFileVersionDTO(newVersion);
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
        
        FileItem fileItem = fileItemRepository.findById(fileId)
                .orElseThrow(() -> new RuntimeException("File not found with ID: " + fileId));
        
        FileShare fileShare = FileShare.builder()
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
        
        Page<FileItem> searchResults = fileItemRepository.searchByNameOrDescription(query, pageable);
        
        List<FileItemDTO> resultDTOs = searchResults.getContent().stream()
                .map(this::convertToFileItemDTO)
                .collect(Collectors.toList());
        
        return new PageImpl<>(resultDTOs, pageable, searchResults.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public FileManagerStatsDTO getStats() {
        log.info("Getting file manager statistics");
        
        Long totalFiles = fileItemRepository.countActiveFiles();
        Long totalFolders = folderRepository.countActiveFolders();
        Long totalSize = fileItemRepository.getTotalStorageSize();
        Long recentUploads = fileAccessLogRepository.countAccessesSince(LocalDateTime.now().minusDays(7));
        
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
        
        List<FileItem> recentFiles = fileItemRepository.findRecentFiles(LocalDateTime.now().minusDays(30));
        
        return recentFiles.stream()
                .limit(limit)
                .map(this::convertToFileItemDTO)
                .collect(Collectors.toList());
    }
    
    @Override
    @Transactional(readOnly = true)
    public List<FileItemDTO> getStarredFiles() {
        log.info("Getting starred files");
        
        List<FileItem> starredFiles = fileItemRepository.findStarredFiles();
        
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
                .createdAt(fileItem.getCreatedAt())
                .updatedAt(fileItem.getUpdatedAt())
                .version(fileItem.getVersion())
                .starred(fileItem.getStarred() != null ? fileItem.getStarred() : false)
                .deleted(fileItem.getDeleted() != null ? fileItem.getDeleted() : false)
                .deletedAt(fileItem.getDeletedAt())
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
            List<Folder> subfolders = folderRepository.findByParentFolderIdAndDeletedFalse(folderId);
            return subfolders.size();
        } catch (Exception e) {
            log.warn("Error calculating subfolder count for folder {}: {}", folderId, e.getMessage());
            return 0;
        }
    }
    
    private Long calculateFolderSize(Long folderId) {
        try {
            // Get direct files size
            Long directFilesSize = fileItemRepository.sumSizeByFolderIdAndDeletedFalse(folderId);
            if (directFilesSize == null) {
                directFilesSize = 0L;
            }
            
            // Get subfolders and their sizes recursively
            List<Folder> subfolders = folderRepository.findByParentFolderIdAndDeletedFalse(folderId);
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
        return FileVersionDTO.builder()
                .id(version.getId())
                .fileId(version.getFileId())
                .versionNumber(version.getVersionNumber().toString())
                .fileName(version.getFileName())
                .fileSize(version.getFileSize())
                .formattedSize(version.getFormattedSize())
                .mimeType(version.getMimeType())
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
        
        List<String> pathSegments = new ArrayList<>();
        Folder currentFolder = folderRepository.findById(folderId).orElse(null);
        
        while (currentFolder != null) {
            pathSegments.add(0, currentFolder.getName());
            if (currentFolder.getParentFolderId() != null) {
                currentFolder = folderRepository.findById(currentFolder.getParentFolderId()).orElse(null);
            } else {
                currentFolder = null;
            }
        }
        
        return String.join("/", pathSegments);
    }
    
    /**
     * Check if a file with the given name already exists in the folder
     */
    private boolean fileExistsInFolder(Long folderId, String fileName) {
        List<FileItem> existingFiles = fileItemRepository.findByFolderIdAndDeletedFalse(folderId);
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
            FileAccessLog log = FileAccessLog.builder()
                    .fileId(fileId)
                    .userId(getCurrentUserId())
                    .actionType(actionType)
                    .downloadSuccess(success)
                    .errorMessage(errorMessage)
                    .accessMethod("web")
                    .build();
            
            fileAccessLogRepository.save(log);
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
}