package com.***REMOVED***.***REMOVED***solutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "file_items")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileItem {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "name", nullable = false, length = 255)
    private String name;
    
    @Column(name = "original_name", nullable = false, length = 255)
    private String originalName;
    
    @Column(name = "size", nullable = false)
    private Long size;
    
    @Column(name = "mime_type", length = 100)
    private String mimeType;
    
    @Column(name = "extension", length = 10)
    private String extension;
    
    @Column(name = "file_path", nullable = false, length = 500)
    private String filePath;
    
    @Column(name = "folder_id")
    private Long folderId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id", insertable = false, updatable = false)
    private Folder folder;
    
    @Column(name = "created_by", nullable = false)
    private Long createdBy;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", insertable = false, updatable = false)
    private User createdByUser;
    
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    
    @Column(name = "is_starred", nullable = false, columnDefinition = "boolean default false")
    @Builder.Default
    private Boolean starred = false;
    
    @Column(name = "is_deleted", nullable = false)
    @Builder.Default
    private Boolean deleted = false;
    
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
    
    @Column(name = "version", nullable = false)
    @Builder.Default
    private Integer version = 1;
    
    @Column(name = "checksum", length = 64)
    private String checksum;
    
    // Case integration fields from migration V55
    @Column(name = "case_id")
    private Long caseId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", insertable = false, updatable = false)
    private LegalCase legalCase;
    
    @Column(name = "department_id")
    private Long departmentId;
    
    @Column(name = "practice_area", length = 100)
    private String practiceArea;
    
    @Column(name = "document_category", length = 50)
    private String documentCategory;
    
    @Column(name = "document_status", length = 20)
    @Builder.Default
    private String documentStatus = "draft";
    
    @Column(name = "shared_with_client", nullable = false)
    @Builder.Default
    private Boolean sharedWithClient = false;
    
    @Column(name = "client_access_expires")
    private LocalDateTime clientAccessExpires;
    
    // Encrypted storage fields - commented out as columns don't exist in DB
    // @Column(name = "is_encrypted", nullable = false)
    // @Builder.Default
    // private Boolean encrypted = false;
    
    // @Column(name = "encryption_metadata", columnDefinition = "TEXT")
    // private String encryptionMetadata;
    
    // Additional metadata
    @Column(name = "metadata", columnDefinition = "JSON")
    private String metadata;
    
    // Relationships
    @OneToMany(mappedBy = "fileItem", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<FilePermission> permissions;
    
    @OneToMany(mappedBy = "fileItem", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<FileVersion> versions;
    
    @OneToMany(mappedBy = "fileItem", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<FileComment> comments;
    
    @OneToMany(mappedBy = "fileItem", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<FileTag> tags;
    
    @OneToMany(mappedBy = "fileItem", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<FileShare> shares;
    
    @OneToMany(mappedBy = "fileItem", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<FileAccessLog> accessLogs;
    
    // Helper methods
    public String getFormattedSize() {
        if (size == null || size == 0) return "0 B";
        
        String[] units = {"B", "KB", "MB", "GB", "TB"};
        int digitGroups = (int) (Math.log10(size) / Math.log10(1024));
        
        return String.format("%.1f %s", 
            size / Math.pow(1024, digitGroups), 
            units[digitGroups]);
    }
    
    public String getFileType() {
        if (mimeType == null) return "Unknown";
        
        if (mimeType.startsWith("image/")) return "Image";
        if (mimeType.startsWith("video/")) return "Video";
        if (mimeType.startsWith("audio/")) return "Audio";
        if (mimeType.equals("application/pdf")) return "PDF";
        if (mimeType.contains("document") || mimeType.contains("word")) return "Document";
        if (mimeType.contains("spreadsheet") || mimeType.contains("excel")) return "Spreadsheet";
        if (mimeType.contains("presentation") || mimeType.contains("powerpoint")) return "Presentation";
        if (mimeType.startsWith("text/")) return "Text";
        
        return "File";
    }
    
    public String getIcon() {
        String fileType = getFileType();
        switch (fileType) {
            case "PDF": return "ri-file-pdf-line";
            case "Image": return "ri-image-line";
            case "Video": return "ri-video-line";
            case "Audio": return "ri-music-line";
            case "Document": return "ri-file-word-line";
            case "Spreadsheet": return "ri-file-excel-line";
            case "Presentation": return "ri-file-ppt-line";
            case "Text": return "ri-file-text-line";
            default: return "ri-file-line";
        }
    }
    
    public String getIconColor() {
        String fileType = getFileType();
        switch (fileType) {
            case "PDF": return "#dc3545";
            case "Image": return "#28a745";
            case "Video": return "#6610f2";
            case "Audio": return "#fd7e14";
            case "Document": return "#007bff";
            case "Spreadsheet": return "#28a745";
            case "Presentation": return "#ffc107";
            case "Text": return "#6c757d";
            default: return "#6c757d";
        }
    }
    
    public String getDownloadUrl() {
        return "/api/file-manager/files/" + id + "/download";
    }
    
    public String getPreviewUrl() {
        // Only provide preview URL for supported file types
        String fileType = getFileType();
        if ("PDF".equals(fileType) || "Image".equals(fileType) || "Text".equals(fileType)) {
            return "/api/file-manager/files/" + id + "/preview";
        }
        return null;
    }
}