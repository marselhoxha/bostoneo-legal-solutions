package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "file_versions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileVersion {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "file_id", nullable = false)
    private Long fileId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id", insertable = false, updatable = false)
    private FileItem fileItem;
    
    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;
    
    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;
    
    @Column(name = "file_path", nullable = false, length = 500)
    private String filePath;
    
    @Column(name = "size", nullable = false)
    private Long fileSize;
    
    @Column(name = "mime_type", length = 100)
    private String mimeType;
    
    @Column(name = "checksum", length = 64)
    private String checksum;
    
    @Column(name = "created_by", nullable = false)
    private Long createdBy;
    
    @Column(name = "uploaded_by", nullable = false)
    private Long uploadedBy;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by", insertable = false, updatable = false)
    private User uploadedByUser;
    
    @CreationTimestamp
    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private LocalDateTime uploadedAt;
    
    @Column(name = "comment", columnDefinition = "TEXT")
    private String changeNotes;
    
    @Column(name = "is_current", nullable = false)
    @Builder.Default
    private Boolean isCurrent = false;
    
    @Column(name = "is_deleted", nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;
    
    // Encrypted storage fields - commented out as columns don't exist in DB
    // @Column(name = "encrypted", nullable = false)
    // @Builder.Default
    // private Boolean encrypted = false;
    
    // @Column(name = "encryption_metadata", columnDefinition = "TEXT")
    // private String encryptionMetadata;
    
    // Helper methods
    public String getFormattedSize() {
        if (fileSize == null || fileSize == 0) return "0 B";
        
        String[] units = {"B", "KB", "MB", "GB", "TB"};
        int digitGroups = (int) (Math.log10(fileSize) / Math.log10(1024));
        
        return String.format("%.1f %s", 
            fileSize / Math.pow(1024, digitGroups), 
            units[digitGroups]);
    }
    
    public String getDownloadUrl() {
        return "/api/file-manager/files/" + fileId + "/versions/" + id + "/download";
    }
}