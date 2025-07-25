package com.***REMOVED***.***REMOVED***solutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "file_access_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileAccessLog {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "file_id", nullable = false)
    private Long fileId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id", insertable = false, updatable = false)
    private FileItem fileItem;
    
    @Column(name = "user_id")
    private Long userId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false)
    private ActionType actionType;
    
    @CreationTimestamp
    @Column(name = "accessed_at", nullable = false, updatable = false)
    private LocalDateTime accessedAt;
    
    @Column(name = "ip_address", length = 45)
    private String ipAddress;
    
    @Column(name = "user_agent", length = 500)
    private String userAgent;
    
    @Column(name = "session_id", length = 100)
    private String sessionId;
    
    @Column(name = "access_method", length = 50)
    private String accessMethod; // 'web', 'api', 'mobile', 'shared_link'
    
    @Column(name = "share_token", length = 100)
    private String shareToken; // For shared link access
    
    @Column(name = "file_version")
    private Integer fileVersion;
    
    @Column(name = "download_success", nullable = false)
    @Builder.Default
    private Boolean downloadSuccess = true;
    
    @Column(name = "error_message", length = 500)
    private String errorMessage;
    
    @Column(name = "request_duration_ms")
    private Long requestDurationMs;
    
    @Column(name = "bytes_transferred")
    private Long bytesTransferred;
    
    @Column(name = "referrer_url", length = 500)
    private String referrerUrl;
    
    public enum ActionType {
        VIEW, DOWNLOAD, UPLOAD, EDIT, DELETE, SHARE, COMMENT, TAG, 
        VERSION_CREATE, VERSION_DOWNLOAD, VERSION_RESTORE, VERSION_DELETE, PERMISSION_GRANT
    }
    
    // Helper methods
    public boolean isSuccessful() {
        return downloadSuccess && errorMessage == null;
    }
    
    public String getFormattedDuration() {
        if (requestDurationMs == null) return "N/A";
        if (requestDurationMs < 1000) return requestDurationMs + "ms";
        return String.format("%.2fs", requestDurationMs / 1000.0);
    }
    
    public String getFormattedBytesTransferred() {
        if (bytesTransferred == null || bytesTransferred == 0) return "0 B";
        
        String[] units = {"B", "KB", "MB", "GB", "TB"};
        int digitGroups = (int) (Math.log10(bytesTransferred) / Math.log10(1024));
        
        return String.format("%.1f %s", 
            bytesTransferred / Math.pow(1024, digitGroups), 
            units[digitGroups]);
    }
    
    public boolean isExternalAccess() {
        return shareToken != null || "shared_link".equals(accessMethod);
    }
}