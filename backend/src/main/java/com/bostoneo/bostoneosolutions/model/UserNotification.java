package com.***REMOVED***.***REMOVED***solutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_notifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserNotification {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "user_id", nullable = false)
    private Long userId;
    
    @Column(name = "title", nullable = false)
    private String title;
    
    @Column(name = "message", nullable = false, columnDefinition = "TEXT")
    private String message;
    
    @Column(name = "type", nullable = false)
    private String type;
    
    @Column(name = "priority", nullable = false)
    private String priority;
    
    @Column(name = "read", nullable = false)
    private Boolean read = false;
    
    @Column(name = "triggered_by_user_id")
    private Long triggeredByUserId;
    
    @Column(name = "triggered_by_name")
    private String triggeredByName;
    
    @Column(name = "entity_id")
    private Long entityId;
    
    @Column(name = "entity_type")
    private String entityType;
    
    @Column(name = "url")
    private String url;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "read_at")
    private LocalDateTime readAt;
    
    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.read == null) {
            this.read = false;
        }
    }
}