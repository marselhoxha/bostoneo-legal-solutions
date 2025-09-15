package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "file_tags")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileTag {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "file_id", nullable = false)
    private Long fileId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id", insertable = false, updatable = false)
    private FileItem fileItem;
    
    @Column(name = "tag_name", nullable = false, length = 100)
    private String tagName;
    
    @Column(name = "tag_color", length = 20)
    @Builder.Default
    private String tagColor = "#007bff";
    
    @Column(name = "created_by", nullable = false)
    private Long createdBy;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", insertable = false, updatable = false)
    private User createdByUser;
    
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "tag_category", length = 50)
    private String tagCategory; // e.g., 'priority', 'status', 'type'
    
    @Column(name = "is_system_tag", nullable = false)
    @Builder.Default
    private Boolean isSystemTag = false;
    
    // Helper methods
    public String getDisplayName() {
        return tagName.replace("_", " ").substring(0, 1).toUpperCase() + 
               tagName.replace("_", " ").substring(1).toLowerCase();
    }
    
    public boolean isUserCreated() {
        return !isSystemTag;
    }
}