package com.bostoneo.bostoneosolutions.configuration;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
@ConfigurationProperties(prefix = "file.storage")
@Data
public class FileStorageConfiguration implements WebMvcConfigurer {

    /**
     * Storage type: "local" or "s3"
     */
    private String type = "local";

    /**
     * S3 bucket name (only used when type=s3)
     */
    private String s3BucketName;

    /**
     * S3 region (only used when type=s3)
     */
    private String s3Region = "us-east-1";

    /**
     * Base directory for file storage
     */
    private String baseDirectory = "./uploads";
    
    /**
     * Maximum file size allowed (in bytes)
     */
    private long maxFileSize = 100 * 1024 * 1024; // 100MB
    
    /**
     * Maximum request size (in bytes)
     */
    private long maxRequestSize = 150 * 1024 * 1024; // 150MB
    
    /**
     * Allowed file extensions
     */
    private String[] allowedExtensions = {
        "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
        "txt", "rtf", "csv", "xml", "json",
        "jpg", "jpeg", "png", "gif", "bmp", "tiff", "svg",
        "mp4", "avi", "mov", "wmv", "flv", "webm",
        "mp3", "wav", "aac", "flac", "ogg",
        "zip", "rar", "7z", "tar", "gz"
    };
    
    /**
     * Directories structure
     */
    private String documentsDirectory = "documents";
    private String imagesDirectory = "images";
    private String videosDirectory = "videos";
    private String audioDirectory = "audio";
    private String archiveDirectory = "archives";
    private String tempDirectory = "temp";
    private String thumbnailDirectory = "thumbnails";
    
    /**
     * Security settings
     */
    private boolean enableVirusScanning = false;
    private boolean enableEncryption = false;
    private String encryptionKey = "default-key-change-me";
    
    /**
     * Performance settings
     */
    private boolean enableThumbnailGeneration = true;
    private int thumbnailSize = 200;
    private String thumbnailFormat = "jpg";
    
    /**
     * File versioning settings
     */
    private int maxVersionsPerFile = 10;
    private boolean enableVersionCompression = true;
    
    /**
     * Cleanup settings
     */
    private int tempFileRetentionDays = 7;
    private int deletedFileRetentionDays = 30;
    
    public Path getBaseDirectoryPath() {
        return Paths.get(baseDirectory).toAbsolutePath().normalize();
    }
    
    public Path getDocumentsPath() {
        return getBaseDirectoryPath().resolve(documentsDirectory);
    }
    
    public Path getImagesPath() {
        return getBaseDirectoryPath().resolve(imagesDirectory);
    }
    
    public Path getVideosPath() {
        return getBaseDirectoryPath().resolve(videosDirectory);
    }
    
    public Path getAudioPath() {
        return getBaseDirectoryPath().resolve(audioDirectory);
    }
    
    public Path getArchivePath() {
        return getBaseDirectoryPath().resolve(archiveDirectory);
    }
    
    public Path getTempPath() {
        return getBaseDirectoryPath().resolve(tempDirectory);
    }
    
    public Path getThumbnailPath() {
        return getBaseDirectoryPath().resolve(thumbnailDirectory);
    }
    
    public boolean isExtensionAllowed(String extension) {
        if (extension == null) return false;
        String ext = extension.toLowerCase();
        for (String allowed : allowedExtensions) {
            if (allowed.equals(ext)) {
                return true;
            }
        }
        return false;
    }
    
    public String getDirectoryForMimeType(String mimeType) {
        if (mimeType == null) return documentsDirectory;
        
        if (mimeType.startsWith("image/")) {
            return imagesDirectory;
        } else if (mimeType.startsWith("video/")) {
            return videosDirectory;
        } else if (mimeType.startsWith("audio/")) {
            return audioDirectory;
        } else if (mimeType.equals("application/zip") || 
                   mimeType.equals("application/x-rar") ||
                   mimeType.equals("application/x-7z-compressed")) {
            return archiveDirectory;
        } else {
            return documentsDirectory;
        }
    }
    
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Serve static files from uploads directory
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + getBaseDirectoryPath().toString() + "/");
        
        // Serve thumbnails
        registry.addResourceHandler("/thumbnails/**")
                .addResourceLocations("file:" + getThumbnailPath().toString() + "/");
    }
}