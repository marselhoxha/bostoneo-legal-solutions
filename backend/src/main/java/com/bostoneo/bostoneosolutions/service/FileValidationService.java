package com.***REMOVED***.***REMOVED***solutions.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileValidationService {
    
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    private static final List<String> ALLOWED_EXTENSIONS = Arrays.asList(
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", ".txt"
    );
    private static final List<String> BLOCKED_EXTENSIONS = Arrays.asList(
        ".exe", ".bat", ".cmd", ".sh", ".ps1", ".vbs", ".js", ".jar", ".com"
    );
    private static final List<String> ALLOWED_MIME_TYPES = Arrays.asList(
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/png",
        "image/jpeg",
        "text/plain"
    );
    
    private final Tika tika = new Tika();
    
    /**
     * Validate uploaded file
     */
    public void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        
        // Check file size
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds maximum allowed size of " + 
                (MAX_FILE_SIZE / (1024 * 1024)) + "MB");
        }
        
        String filename = file.getOriginalFilename();
        if (filename == null || filename.isEmpty()) {
            throw new IllegalArgumentException("Invalid filename");
        }
        
        // Check file extension
        String extension = getFileExtension(filename).toLowerCase();
        if (BLOCKED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("File type not allowed: " + extension);
        }
        
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("File type not supported: " + extension);
        }
        
        // Validate MIME type
        try {
            String mimeType = tika.detect(file.getInputStream());
            if (!ALLOWED_MIME_TYPES.contains(mimeType)) {
                throw new IllegalArgumentException("File content type not allowed: " + mimeType);
            }
        } catch (IOException e) {
            throw new RuntimeException("Error validating file content", e);
        }
        
        // Check for path traversal
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            throw new IllegalArgumentException("Invalid filename - potential path traversal detected");
        }
    }
    
    /**
     * Sanitize filename to prevent path traversal
     */
    public String sanitizeFilename(String filename) {
        // Remove any path components
        filename = Paths.get(filename).getFileName().toString();
        
        // Replace dangerous characters
        filename = filename.replaceAll("[^a-zA-Z0-9._-]", "_");
        
        // Add UUID to ensure uniqueness
        String extension = getFileExtension(filename);
        String baseName = filename.substring(0, filename.length() - extension.length());
        
        return baseName + "_" + UUID.randomUUID().toString() + extension;
    }
    
    /**
     * Create secure storage path
     */
    public Path createSecureStoragePath(String baseDir, String filename) {
        String sanitizedFilename = sanitizeFilename(filename);
        Path basePath = Paths.get(baseDir).toAbsolutePath().normalize();
        Path targetPath = basePath.resolve(sanitizedFilename).normalize();
        
        // Ensure the target path is within the base directory
        if (!targetPath.startsWith(basePath)) {
            throw new SecurityException("Invalid file path - potential path traversal detected");
        }
        
        return targetPath;
    }
    
    /**
     * Get file extension
     */
    private String getFileExtension(String filename) {
        int lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex > 0 && lastDotIndex < filename.length() - 1) {
            return filename.substring(lastDotIndex);
        }
        return "";
    }
    
    /**
     * Check if file needs virus scanning (for future implementation)
     */
    public boolean requiresVirusScan(String mimeType) {
        // All executable and script files should be scanned
        return !mimeType.startsWith("image/") && !mimeType.equals("text/plain");
    }
}