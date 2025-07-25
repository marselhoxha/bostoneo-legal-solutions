package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.filemanager.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface FileManagerService {
    
    // File operations
    Page<FileItemDTO> getFiles(Pageable pageable, Long folderId, Long caseId, String search, String fileType);
    Page<FileItemDTO> getDeletedFiles(Pageable pageable);
    FileItemDTO getFile(Long fileId);
    String getFilePath(Long fileId);
    FileUploadResponseDTO uploadFile(MultipartFile file, Long folderId, Long caseId, String description, String tags);
    FileItemDTO updateFile(Long fileId, UpdateFileRequestDTO request);
    FileVersionDTO replaceFileContent(Long fileId, MultipartFile file, String comment);
    void deleteFile(Long fileId);
    FileItemDTO restoreFile(Long fileId);
    void permanentlyDeleteFile(Long fileId);
    void moveFile(Long fileId, Long targetFolderId);
    void copyFile(Long fileId, Long targetFolderId);
    FileItemDTO toggleFileStar(Long fileId);
    
    // Folder operations
    FolderDTO getRootFolder();
    List<FolderDTO> getRootFolders();
    FolderDTO getFolder(Long folderId);
    List<FolderDTO> getSubfolders(Long parentFolderId);
    List<FolderDTO> getPersonalSubfolders(Long parentFolderId);
    FolderDTO createFolder(CreateFolderRequestDTO request);
    FolderDTO updateFolder(Long folderId, UpdateFolderRequestDTO request);
    void deleteFolder(Long folderId);
    void moveFolder(Long folderId, Long targetFolderId);
    
    // Case operations
    Page<CaseDTO> getActiveCases(Pageable pageable);
    List<FileItemDTO> getCaseFiles(Long caseId);
    List<FolderDTO> getCaseFolders(Long caseId);
    
    // Version operations
    List<FileVersionDTO> getFileVersions(Long fileId);
    FileVersionDTO getFileVersion(Long fileId, Long versionId);
    FileVersionDTO uploadFileVersion(Long fileId, MultipartFile file, String comment);
    byte[] downloadFileVersion(Long versionId);
    void restoreFileVersion(Long fileId, Long versionId);
    void deleteFileVersion(Long fileId, Long versionId);
    
    // Permission operations
    List<FilePermissionDTO> getFilePermissions(Long fileId);
    void shareFile(Long fileId, ShareFileRequestDTO request);
    
    // Search and analytics
    Page<FileItemDTO> searchFiles(String query, Pageable pageable, String fileType, Long caseId);
    FileManagerStatsDTO getStats();
    List<FileItemDTO> getRecentFiles(int limit);
    List<FileItemDTO> getStarredFiles();
}