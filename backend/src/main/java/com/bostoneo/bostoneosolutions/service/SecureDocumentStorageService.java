package com.bostoneo.bostoneosolutions.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SecureDocumentStorageService {
    
    @Value("${app.document.storage.path:./documents}")
    private String storageBasePath;
    
    private final FileValidationService fileValidationService;
    
    /**
     * Store file securely with validation
     */
    public String storeFile(MultipartFile file, String category) throws IOException {
        // Validate file
        fileValidationService.validateFile(file);
        
        // Create secure storage path
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        Path storagePath = createSecureStoragePath(category, originalFilename);
        
        // Ensure directory exists
        Files.createDirectories(storagePath.getParent());
        
        // Store file
        Files.copy(file.getInputStream(), storagePath, StandardCopyOption.REPLACE_EXISTING);
        
        log.info("File stored successfully: {} in category: {}", storagePath.getFileName(), category);
        
        return storagePath.getFileName().toString();
    }
    
    /**
     * Retrieve file securely
     */
    public Path getFile(String category, String filename) {
        // Validate filename
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            throw new SecurityException("Invalid filename - potential path traversal detected");
        }
        
        Path categoryPath = Paths.get(storageBasePath, category).toAbsolutePath().normalize();
        Path filePath = categoryPath.resolve(filename).normalize();
        
        // Ensure the file path is within the allowed directory
        if (!filePath.startsWith(categoryPath)) {
            throw new SecurityException("Access denied - invalid file path");
        }
        
        if (!Files.exists(filePath)) {
            throw new IllegalArgumentException("File not found: " + filename);
        }
        
        return filePath;
    }
    
    /**
     * Delete file securely
     */
    public void deleteFile(String category, String filename) throws IOException {
        Path filePath = getFile(category, filename);
        Files.deleteIfExists(filePath);
        log.info("File deleted: {} from category: {}", filename, category);
    }
    
    /**
     * Create secure storage path with UUID
     */
    private Path createSecureStoragePath(String category, String originalFilename) {
        // Sanitize category
        category = category.replaceAll("[^a-zA-Z0-9_-]", "_");
        
        // Generate unique filename
        String extension = getFileExtension(originalFilename);
        String uniqueFilename = UUID.randomUUID().toString() + extension;
        
        // Create path
        Path basePath = Paths.get(storageBasePath).toAbsolutePath().normalize();
        Path categoryPath = basePath.resolve(category);
        Path filePath = categoryPath.resolve(uniqueFilename).normalize();
        
        // Ensure the path is within the base directory
        if (!filePath.startsWith(basePath)) {
            throw new SecurityException("Invalid storage path");
        }
        
        return filePath;
    }
    
    /**
     * Get file extension safely
     */
    private String getFileExtension(String filename) {
        if (filename == null) return "";
        
        int lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex > 0 && lastDotIndex < filename.length() - 1) {
            return filename.substring(lastDotIndex);
        }
        return "";
    }
    
    /**
     * Get storage statistics for quota management
     */
    public StorageStats getStorageStats(String category) throws IOException {
        Path categoryPath = Paths.get(storageBasePath, category);
        
        if (!Files.exists(categoryPath)) {
            return new StorageStats(0, 0);
        }
        
        long totalSize = Files.walk(categoryPath)
            .filter(Files::isRegularFile)
            .mapToLong(path -> {
                try {
                    return Files.size(path);
                } catch (IOException e) {
                    return 0;
                }
            })
            .sum();
        
        long fileCount = Files.walk(categoryPath)
            .filter(Files::isRegularFile)
            .count();
        
        return new StorageStats(totalSize, fileCount);
    }
    
    public record StorageStats(long totalSize, long fileCount) {}
}