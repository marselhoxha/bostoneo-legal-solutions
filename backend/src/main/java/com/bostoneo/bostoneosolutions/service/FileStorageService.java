package com.***REMOVED***.***REMOVED***solutions.service;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;

public interface FileStorageService {
    
    /**
     * Store a file and return the storage path
     */
    String storeFile(MultipartFile file, String subdirectory) throws IOException;
    
    /**
     * Store a file with a specific name
     */
    String storeFile(MultipartFile file, String subdirectory, String fileName) throws IOException;
    
    /**
     * Load a file as a Resource
     */
    Resource loadFileAsResource(String filePath) throws IOException;
    
    /**
     * Delete a file
     */
    boolean deleteFile(String filePath);
    
    /**
     * Generate a unique filename
     */
    String generateUniqueFileName(String originalFileName);
    
    /**
     * Get file extension
     */
    String getFileExtension(String fileName);
    
    /**
     * Validate file extension
     */
    boolean isValidFileExtension(String fileName);
    
    /**
     * Get file size in bytes
     */
    long getFileSize(String filePath) throws IOException;
    
    /**
     * Create directory if it doesn't exist
     */
    void createDirectoryIfNotExists(Path directory) throws IOException;
    
    /**
     * Generate thumbnail for image files
     */
    String generateThumbnail(String originalFilePath, String fileName) throws IOException;
    
    /**
     * Clean up temporary files
     */
    void cleanupTempFiles();
    
    /**
     * Clean up deleted files
     */
    void cleanupDeletedFiles();
}