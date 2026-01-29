package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
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
    private final TenantService tenantService;

    /**
     * Get the current organization ID from tenant context.
     * Throws RuntimeException if no organization context is available.
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required for document storage"));
    }
    
    /**
     * Store file securely with validation
     * SECURITY: Files are stored in organization-specific directories for tenant isolation
     */
    public String storeFile(MultipartFile file, String category) throws IOException {
        Long orgId = getRequiredOrganizationId();

        // Validate file
        fileValidationService.validateFile(file);

        // Create secure storage path with org isolation
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        Path storagePath = createSecureStoragePath(orgId, category, originalFilename);

        // Ensure directory exists
        Files.createDirectories(storagePath.getParent());

        // Store file
        Files.copy(file.getInputStream(), storagePath, StandardCopyOption.REPLACE_EXISTING);

        log.info("File stored successfully: {} in category: {} for org: {}", storagePath.getFileName(), category, orgId);

        return storagePath.getFileName().toString();
    }
    
    /**
     * Retrieve file securely
     * SECURITY: Files are retrieved only from the current organization's directory
     */
    public Path getFile(String category, String filename) {
        Long orgId = getRequiredOrganizationId();

        // Validate filename
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            throw new SecurityException("Invalid filename - potential path traversal detected");
        }

        // SECURITY: Include organization ID in path for tenant isolation
        Path orgPath = Paths.get(storageBasePath, "org", orgId.toString(), category).toAbsolutePath().normalize();
        Path filePath = orgPath.resolve(filename).normalize();

        // Ensure the file path is within the organization's allowed directory
        if (!filePath.startsWith(orgPath)) {
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
     * SECURITY: Includes organization ID for tenant isolation
     */
    private Path createSecureStoragePath(Long orgId, String category, String originalFilename) {
        // Sanitize category
        category = category.replaceAll("[^a-zA-Z0-9_-]", "_");

        // Generate unique filename
        String extension = getFileExtension(originalFilename);
        String uniqueFilename = UUID.randomUUID().toString() + extension;

        // Create path with organization isolation
        // Format: {basePath}/org/{orgId}/{category}/{filename}
        Path basePath = Paths.get(storageBasePath).toAbsolutePath().normalize();
        Path orgPath = basePath.resolve("org").resolve(orgId.toString());
        Path categoryPath = orgPath.resolve(category);
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
     * SECURITY: Returns stats only for current organization's files
     */
    public StorageStats getStorageStats(String category) throws IOException {
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Include organization ID in path for tenant isolation
        Path categoryPath = Paths.get(storageBasePath, "org", orgId.toString(), category);

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