package com.***REMOVED***.***REMOVED***solutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "file_permissions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FilePermission {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "file_id", nullable = false)
    private Long fileId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id", insertable = false, updatable = false)
    private FileItem fileItem;
    
    @Column(name = "user_id", nullable = false)
    private Long userId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "permission_type", nullable = false)
    private PermissionType permissionType;
    
    @Column(name = "granted_by")
    private Long grantedBy;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "granted_by", insertable = false, updatable = false)
    private User grantedByUser;
    
    @CreationTimestamp
    @Column(name = "granted_at", nullable = false, updatable = false)
    private LocalDateTime grantedAt;
    
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;
    
    @Column(name = "is_revoked", nullable = false)
    @Builder.Default
    private Boolean isRevoked = false;
    
    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;
    
    @Column(name = "revoked_by")
    private Long revokedBy;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "revoked_by", insertable = false, updatable = false)
    private User revokedByUser;
    
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    
    public enum PermissionType {
        VIEW, DOWNLOAD, EDIT, DELETE, SHARE, ADMIN
    }
    
    // Helper methods
    public boolean isActive() {
        if (isRevoked) {
            return false;
        }
        if (expiresAt != null && LocalDateTime.now().isAfter(expiresAt)) {
            return false;
        }
        return true;
    }
    
    public boolean isExpired() {
        return expiresAt != null && LocalDateTime.now().isAfter(expiresAt);
    }
}