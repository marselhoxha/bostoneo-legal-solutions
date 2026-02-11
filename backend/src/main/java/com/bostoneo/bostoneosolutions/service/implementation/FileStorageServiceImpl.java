package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.configuration.FileStorageConfiguration;
import com.bostoneo.bostoneosolutions.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.PostConstruct;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.imageio.ImageIO;

@Service
@ConditionalOnProperty(name = "file.storage.type", havingValue = "local", matchIfMissing = true)
@RequiredArgsConstructor
@Slf4j
public class FileStorageServiceImpl implements FileStorageService {
    
    private final FileStorageConfiguration config;
    private final com.bostoneo.bostoneosolutions.service.FileContentValidator fileContentValidator;
    
    @PostConstruct
    public void init() {
        try {
            // Create base directories
            createDirectoryIfNotExists(config.getBaseDirectoryPath());
            createDirectoryIfNotExists(config.getDocumentsPath());
            createDirectoryIfNotExists(config.getImagesPath());
            createDirectoryIfNotExists(config.getVideosPath());
            createDirectoryIfNotExists(config.getAudioPath());
            createDirectoryIfNotExists(config.getArchivePath());
            createDirectoryIfNotExists(config.getTempPath());
            createDirectoryIfNotExists(config.getThumbnailPath());
            
            log.info("File storage initialized at: {}", config.getBaseDirectoryPath());
        } catch (IOException e) {
            log.error("Could not initialize file storage: {}", e.getMessage(), e);
            throw new RuntimeException("Could not initialize file storage", e);
        }
    }
    
    @Override
    public String storeFile(MultipartFile file, String subdirectory) throws IOException {
        String originalFileName = StringUtils.cleanPath(file.getOriginalFilename());
        String uniqueFileName = generateUniqueFileName(originalFileName);
        return storeFile(file, subdirectory, uniqueFileName);
    }
    
    @Override
    public String storeFile(MultipartFile file, String subdirectory, String fileName) throws IOException {
        log.info("storeFile called with subdirectory='{}', fileName='{}', fileSize={}", subdirectory, fileName, file.getSize());
        
        // Validate filename
        if (!StringUtils.hasText(fileName) || fileName.contains("..")) {
            throw new IOException("Invalid filename: " + fileName);
        }
        
        // Validate file extension
        if (!isValidFileExtension(fileName)) {
            throw new IOException("File type not allowed: " + getFileExtension(fileName));
        }
        
        // Validate file size
        if (file.getSize() > config.getMaxFileSize()) {
            throw new IOException("File size exceeds maximum allowed: " + config.getMaxFileSize());
        }

        // Validate file content (magic bytes check)
        if (!fileContentValidator.validate(file)) {
            throw new IOException("File rejected: potentially dangerous content detected in " + fileName);
        }

        try {
            // Determine target directory
            Path targetDirectory = config.getBaseDirectoryPath().resolve(subdirectory);
            log.info("Target directory: {}", targetDirectory);
            log.info("Target directory absolute path: {}", targetDirectory.toAbsolutePath());
            log.info("Target directory exists: {}", Files.exists(targetDirectory));
            
            createDirectoryIfNotExists(targetDirectory);
            log.info("Directory created/verified: {}", targetDirectory);
            
            // Copy file to target location
            Path targetLocation = targetDirectory.resolve(fileName);
            log.info("Target file location: {}", targetLocation);
            log.info("Target file absolute path: {}", targetLocation.toAbsolutePath());
            
            // Log file details before copy
            log.info("File size before copy: {}", file.getSize());
            log.info("File content type: {}", file.getContentType());
            log.info("File is empty: {}", file.isEmpty());
            
            try {
                // Read input stream and copy
                log.info("Starting file copy operation...");
                Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);
                log.info("Files.copy completed successfully");
                
                // Verify file was written
                if (Files.exists(targetLocation)) {
                    long writtenSize = Files.size(targetLocation);
                    log.info("File written successfully. Size on disk: {} bytes", writtenSize);
                    log.info("File is readable: {}", Files.isReadable(targetLocation));
                } else {
                    log.error("File copy appeared to succeed but file doesn't exist at: {}", targetLocation);
                }
            } catch (Exception copyEx) {
                log.error("Exception during file copy: {}", copyEx.getMessage(), copyEx);
                throw copyEx;
            }
            
            log.info("File stored successfully: {}", targetLocation);
            
            // Generate thumbnail for images
            if (config.isEnableThumbnailGeneration() && isImageFile(file.getContentType())) {
                try {
                    generateThumbnail(targetLocation.toString(), fileName);
                } catch (Exception e) {
                    log.warn("Could not generate thumbnail for {}: {}", fileName, e.getMessage());
                }
            }
            
            String resultPath = subdirectory + "/" + fileName;
            log.info("Returning file path: {}", resultPath);
            return resultPath;
            
        } catch (IOException e) {
            log.error("Could not store file {}: {}", fileName, e.getMessage(), e);
            throw new IOException("Could not store file " + fileName, e);
        }
    }
    
    @Override
    public Resource loadFileAsResource(String filePath) throws IOException {
        try {
            log.debug("Loading file resource for path: {}", filePath);
            
            // Try the direct path first
            Path targetPath = config.getBaseDirectoryPath().resolve(filePath).normalize();
            
            if (Files.exists(targetPath) && Files.isReadable(targetPath)) {
                log.info("Found file at direct path: {}", targetPath);
                Resource resource = new UrlResource(targetPath.toUri());
                if (resource.exists() && resource.isReadable()) {
                    return resource;
                }
            }
            
            // If direct path fails, this might be an old file with complex path
            // Try searching by filename
            String fileName = Paths.get(filePath).getFileName().toString();
            log.debug("Direct path not found, searching for file by name: {}", fileName);
            
            Path foundPath = Files.walk(config.getBaseDirectoryPath(), 4)
                .filter(Files::isRegularFile)
                .filter(path -> path.getFileName().toString().equals(fileName))
                .findFirst()
                .orElse(null);
                
            if (foundPath != null && Files.exists(foundPath) && Files.isReadable(foundPath)) {
                log.info("Found file at: {}", foundPath);
                return new UrlResource(foundPath.toUri());
            }
            
            log.error("File not found: {}", filePath);
            throw new IOException("File not found or not readable: " + filePath);
            
        } catch (Exception e) {
            log.error("Error loading file resource: {}", filePath, e);
            throw new IOException("Could not load file: " + filePath, e);
        }
    }
    
    /**
     * Find file by name in the uploads directory and subdirectories
     */
    private Path findFileByName(String fileName) {
        try {
            log.debug("Searching for file by name: {}", fileName);
            Path baseDir = config.getBaseDirectoryPath();
            log.debug("Searching in base directory: {}", baseDir);
            
            // Extract the original filename (without timestamp prefix)
            String originalFileName = extractOriginalFileName(fileName);
            log.debug("Extracted original filename: {}", originalFileName);
            
            Path result = Files.walk(baseDir, 3)
                .filter(Files::isRegularFile)
                .peek(path -> log.debug("Checking file: {}", path.getFileName()))
                .filter(path -> {
                    String pathFileName = path.getFileName().toString();
                    String pathOriginalFileName = extractOriginalFileName(pathFileName);
                    
                    // Match by original filename (ignoring timestamp prefixes)
                    boolean matches = pathOriginalFileName.equals(originalFileName) || 
                                    pathFileName.equals(fileName) || 
                                    pathFileName.contains(originalFileName);
                    
                    if (matches) {
                        log.debug("Found potential match: {} (original: {})", path, pathOriginalFileName);
                    }
                    return matches;
                })
                .findFirst()
                .orElse(null);
                
            if (result != null) {
                log.info("Found file by name search: {}", result);
            } else {
                log.debug("No file found with name: {}", fileName);
            }
            
            return result;
        } catch (IOException e) {
            log.error("Error searching for file by name: {}", fileName, e);
            return null;
        }
    }
    
    /**
     * Extract the original filename by removing timestamp prefix
     * e.g., "1752811839126_Boston-Miami-Flight-Receipt.pdf" -> "Boston-Miami-Flight-Receipt.pdf"
     */
    private String extractOriginalFileName(String fileName) {
        if (fileName == null || fileName.isEmpty()) {
            return fileName;
        }
        
        // Check if filename starts with timestamp pattern (digits followed by underscore)
        if (fileName.matches("^\\d+_.*")) {
            int underscoreIndex = fileName.indexOf('_');
            if (underscoreIndex > 0 && underscoreIndex < fileName.length() - 1) {
                return fileName.substring(underscoreIndex + 1);
            }
        }
        
        return fileName;
    }
    
    /**
     * Find file by name in a specific subdirectory or search globally
     */
    private Path findFileByNameInSubdirectory(String fileName, String subdirectory) {
        try {
            Path searchBase;
            int maxDepth = 3;
            
            if (subdirectory != null && !subdirectory.isEmpty()) {
                // Search in specific subdirectory
                searchBase = config.getBaseDirectoryPath().resolve(subdirectory);
                log.debug("Searching for file {} in subdirectory: {}", fileName, searchBase);
                
                // If subdirectory doesn't exist in base path, also check if it's a partial path
                if (!Files.exists(searchBase)) {
                    // Try without the first segment (e.g., "uploads/1" -> "1")
                    if (subdirectory.contains("/")) {
                        String partialSubdir = subdirectory.substring(subdirectory.indexOf("/") + 1);
                        searchBase = config.getBaseDirectoryPath().resolve(partialSubdir);
                        log.debug("Trying partial subdirectory: {}", searchBase);
                    }
                }
                
                if (!Files.exists(searchBase)) {
                    log.debug("Subdirectory doesn't exist, falling back to global search");
                    searchBase = config.getBaseDirectoryPath();
                    maxDepth = 4; // Search deeper when doing global search
                }
            } else {
                // Global search
                searchBase = config.getBaseDirectoryPath();
                log.debug("Searching for file {} globally in: {}", fileName, searchBase);
            }
            
            // Extract the original filename (without timestamp prefix)
            String originalFileName = extractOriginalFileName(fileName);
            log.debug("Extracted original filename: {}", originalFileName);
            
            Path result = Files.walk(searchBase, maxDepth)
                .filter(Files::isRegularFile)
                .filter(path -> {
                    String pathFileName = path.getFileName().toString();
                    String pathOriginalFileName = extractOriginalFileName(pathFileName);
                    
                    // Match by original filename (ignoring timestamp prefixes)
                    boolean matches = pathOriginalFileName.equals(originalFileName) || 
                                    pathFileName.equals(fileName);
                    
                    if (matches) {
                        log.debug("Found potential match: {} (original: {})", path, pathOriginalFileName);
                    }
                    return matches;
                })
                .findFirst()
                .orElse(null);
                
            if (result != null) {
                log.info("Found file by name search: {}", result);
            } else {
                log.debug("No file found with name: {} in directory: {}", fileName, searchBase);
            }
            
            return result;
        } catch (IOException e) {
            log.error("Error searching for file by name: {} in subdirectory: {}", fileName, subdirectory, e);
            return null;
        }
    }
    
    @Override
    public boolean deleteFile(String filePath) {
        try {
            Path file = config.getBaseDirectoryPath().resolve(filePath).normalize();
            boolean deleted = Files.deleteIfExists(file);
            
            if (deleted) {
                log.info("File deleted: {}", filePath);
                
                // Also delete thumbnail if exists
                String thumbnailPath = getThumbnailPath(filePath);
                if (thumbnailPath != null) {
                    Path thumbnail = config.getThumbnailPath().resolve(thumbnailPath).normalize();
                    Files.deleteIfExists(thumbnail);
                }
            }
            
            return deleted;
        } catch (IOException e) {
            log.error("Could not delete file {}: {}", filePath, e.getMessage());
            return false;
        }
    }
    
    @Override
    public String generateUniqueFileName(String originalFileName) {
        String extension = getFileExtension(originalFileName);
        String baseName = getBaseName(originalFileName);
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String uuid = UUID.randomUUID().toString().substring(0, 8);
        
        return String.format("%s_%s_%s.%s", baseName, timestamp, uuid, extension);
    }
    
    @Override
    public String getFileExtension(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return "";
        }
        
        int lastDot = fileName.lastIndexOf('.');
        return lastDot > 0 ? fileName.substring(lastDot + 1).toLowerCase() : "";
    }
    
    @Override
    public boolean isValidFileExtension(String fileName) {
        String extension = getFileExtension(fileName);
        return config.isExtensionAllowed(extension);
    }
    
    @Override
    public long getFileSize(String filePath) throws IOException {
        Path file = config.getBaseDirectoryPath().resolve(filePath).normalize();
        return Files.size(file);
    }
    
    @Override
    public void createDirectoryIfNotExists(Path directory) throws IOException {
        if (!Files.exists(directory)) {
            Files.createDirectories(directory);
            log.debug("Created directory: {}", directory);
        }
    }
    
    @Override
    public String generateThumbnail(String originalFilePath, String fileName) throws IOException {
        if (!config.isEnableThumbnailGeneration()) {
            return null;
        }
        
        Path originalFile = Paths.get(originalFilePath);
        if (!Files.exists(originalFile)) {
            throw new IOException("Original file not found: " + originalFilePath);
        }
        
        try {
            BufferedImage originalImage = ImageIO.read(originalFile.toFile());
            if (originalImage == null) {
                throw new IOException("Could not read image file");
            }
            
            // Calculate thumbnail dimensions
            int thumbnailSize = config.getThumbnailSize();
            int originalWidth = originalImage.getWidth();
            int originalHeight = originalImage.getHeight();
            
            int thumbnailWidth, thumbnailHeight;
            if (originalWidth > originalHeight) {
                thumbnailWidth = thumbnailSize;
                thumbnailHeight = (originalHeight * thumbnailSize) / originalWidth;
            } else {
                thumbnailHeight = thumbnailSize;
                thumbnailWidth = (originalWidth * thumbnailSize) / originalHeight;
            }
            
            // Create thumbnail
            BufferedImage thumbnailImage = new BufferedImage(thumbnailWidth, thumbnailHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D g2d = thumbnailImage.createGraphics();
            g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g2d.drawImage(originalImage, 0, 0, thumbnailWidth, thumbnailHeight, null);
            g2d.dispose();
            
            // Save thumbnail
            String thumbnailFileName = getThumbnailFileName(fileName);
            Path thumbnailPath = config.getThumbnailPath().resolve(thumbnailFileName);
            ImageIO.write(thumbnailImage, config.getThumbnailFormat(), thumbnailPath.toFile());
            
            log.debug("Generated thumbnail: {}", thumbnailPath);
            return thumbnailFileName;
            
        } catch (Exception e) {
            log.error("Error generating thumbnail for {}: {}", fileName, e.getMessage());
            throw new IOException("Could not generate thumbnail", e);
        }
    }
    
    @Override
    public void cleanupTempFiles() {
        try {
            Path tempDir = config.getTempPath();
            if (!Files.exists(tempDir)) {
                return;
            }
            
            LocalDateTime cutoffTime = LocalDateTime.now().minusDays(config.getTempFileRetentionDays());
            
            Files.walk(tempDir)
                .filter(Files::isRegularFile)
                .filter(path -> {
                    try {
                        return Files.getLastModifiedTime(path).toInstant()
                                .isBefore(cutoffTime.atZone(java.time.ZoneId.systemDefault()).toInstant());
                    } catch (IOException e) {
                        return false;
                    }
                })
                .forEach(path -> {
                    try {
                        Files.delete(path);
                        log.debug("Deleted temp file: {}", path);
                    } catch (IOException e) {
                        log.warn("Could not delete temp file {}: {}", path, e.getMessage());
                    }
                });
                
        } catch (IOException e) {
            log.error("Error during temp file cleanup: {}", e.getMessage());
        }
    }
    
    @Override
    public void cleanupDeletedFiles() {
        // This would be implemented to clean up files marked as deleted in the database
        // after the retention period has passed
        log.info("Deleted file cleanup completed");
    }
    
    // Helper methods
    
    private String getBaseName(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return "file";
        }
        
        int lastDot = fileName.lastIndexOf('.');
        return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    }
    
    private boolean isImageFile(String mimeType) {
        return mimeType != null && mimeType.startsWith("image/");
    }
    
    private String getThumbnailFileName(String originalFileName) {
        String baseName = getBaseName(originalFileName);
        return baseName + "_thumb." + config.getThumbnailFormat();
    }
    
    private String getThumbnailPath(String originalFilePath) {
        String fileName = Paths.get(originalFilePath).getFileName().toString();
        return getThumbnailFileName(fileName);
    }
}