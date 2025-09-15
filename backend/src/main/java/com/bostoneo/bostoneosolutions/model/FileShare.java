package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "file_shares")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileShare {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "file_id", nullable = false)
    private Long fileId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id", insertable = false, updatable = false)
    private FileItem fileItem;
    
    @Column(name = "shared_with_user_id")
    private Long sharedWithUserId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shared_with_user_id", insertable = false, updatable = false)
    private User sharedWithUser;
    
    @Column(name = "shared_with_email", length = 255)
    private String sharedWithEmail; // For external sharing
    
    @Column(name = "share_token", unique = true, length = 100)
    private String shareToken;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "share_type", nullable = false)
    private ShareType shareType;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "access_level", nullable = false)
    private AccessLevel accessLevel;
    
    @Column(name = "created_by", nullable = false)
    private Long createdBy;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", insertable = false, updatable = false)
    private User createdByUser;
    
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;
    
    @Column(name = "password_hash", length = 255)
    private String passwordHash; // For password-protected shares
    
    @Column(name = "download_count", nullable = false)
    @Builder.Default
    private Integer downloadCount = 0;
    
    @Column(name = "max_downloads")
    private Integer maxDownloads;
    
    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
    
    // @Column(name = "share_message", columnDefinition = "TEXT")
    // private String shareMessage; // Column doesn't exist in DB
    
    @Column(name = "last_accessed_at")
    private LocalDateTime lastAccessedAt;
    
    @Column(name = "watermark_text", length = 255)
    private String watermarkText;
    
    public enum ShareType {
        INTERNAL, EXTERNAL, PUBLIC_LINK
    }
    
    public enum AccessLevel {
        VIEW_ONLY, DOWNLOAD, COMMENT, EDIT
    }
    
    // Helper methods
    public boolean isExpired() {
        return expiresAt != null && LocalDateTime.now().isAfter(expiresAt);
    }
    
    public boolean isDownloadLimitReached() {
        return maxDownloads != null && downloadCount >= maxDownloads;
    }
    
    public boolean canAccess() {
        return isActive && !isExpired() && !isDownloadLimitReached();
    }
    
    public String getShareUrl() {
        return "/shared/" + shareToken;
    }
    
    public int getRemainingDownloads() {
        if (maxDownloads == null) return -1; // Unlimited
        return Math.max(0, maxDownloads - downloadCount);
    }
}