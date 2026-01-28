package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "file_comments")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileComment {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "file_id", nullable = false)
    private Long fileId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id", insertable = false, updatable = false)
    private FileItem fileItem;
    
    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String commentText;
    
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
    
    @Column(name = "parent_comment_id")
    private Long parentCommentId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_comment_id", insertable = false, updatable = false)
    private FileComment parentComment;
    
    @Column(name = "is_internal", nullable = false)
    @Builder.Default
    private Boolean isInternal = true;
    
    @Column(name = "is_deleted", nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;
    
    // @Column(name = "mention_users", columnDefinition = "TEXT")
    // private String mentionUsers; // JSON array of user IDs - Column doesn't exist in DB
    
    // Helper methods
    public boolean isReply() {
        return parentCommentId != null;
    }
    
    public String getShortText(int maxLength) {
        if (commentText == null) return "";
        if (commentText.length() <= maxLength) return commentText;
        return commentText.substring(0, maxLength) + "...";
    }
}