package com.***REMOVED***.***REMOVED***solutions.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Entity representing user notification preferences
 * Allows users to customize which notifications they receive and how they receive them
 */
@Entity
@Table(
    name = "user_notification_preferences",
    uniqueConstraints = @UniqueConstraint(
        name = "unique_user_event", 
        columnNames = {"user_id", "event_type"}
    ),
    indexes = {
        @Index(name = "idx_user_preferences", columnList = "user_id"),
        @Index(name = "idx_event_type", columnList = "event_type")
    }
)
public class UserNotificationPreference {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false)
    private Long id;
    
    @NotNull(message = "User ID is required")
    @Column(name = "user_id", nullable = false)
    private Long userId;
    
    @NotBlank(message = "Event type is required")
    @Column(name = "event_type", nullable = false, length = 100)
    private String eventType;
    
    @Column(name = "enabled", nullable = false)
    private Boolean enabled = true;
    
    @Column(name = "email_enabled", nullable = false)
    private Boolean emailEnabled = true;
    
    @Column(name = "push_enabled", nullable = false)
    private Boolean pushEnabled = true;
    
    @Column(name = "in_app_enabled", nullable = false)
    private Boolean inAppEnabled = true;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "priority", length = 20)
    private NotificationPriority priority = NotificationPriority.NORMAL;
    
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    
    // Default constructor
    public UserNotificationPreference() {}
    
    // Constructor with required fields
    public UserNotificationPreference(Long userId, String eventType) {
        this.userId = userId;
        this.eventType = eventType;
    }
    
    // Constructor with all fields
    public UserNotificationPreference(Long userId, String eventType, Boolean enabled, 
                                    Boolean emailEnabled, Boolean pushEnabled, 
                                    Boolean inAppEnabled, NotificationPriority priority) {
        this.userId = userId;
        this.eventType = eventType;
        this.enabled = enabled;
        this.emailEnabled = emailEnabled;
        this.pushEnabled = pushEnabled;
        this.inAppEnabled = inAppEnabled;
        this.priority = priority;
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public Long getUserId() {
        return userId;
    }
    
    public void setUserId(Long userId) {
        this.userId = userId;
    }
    
    public String getEventType() {
        return eventType;
    }
    
    public void setEventType(String eventType) {
        this.eventType = eventType;
    }
    
    public Boolean getEnabled() {
        return enabled;
    }
    
    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }
    
    public Boolean getEmailEnabled() {
        return emailEnabled;
    }
    
    public void setEmailEnabled(Boolean emailEnabled) {
        this.emailEnabled = emailEnabled;
    }
    
    public Boolean getPushEnabled() {
        return pushEnabled;
    }
    
    public void setPushEnabled(Boolean pushEnabled) {
        this.pushEnabled = pushEnabled;
    }
    
    public Boolean getInAppEnabled() {
        return inAppEnabled;
    }
    
    public void setInAppEnabled(Boolean inAppEnabled) {
        this.inAppEnabled = inAppEnabled;
    }
    
    public NotificationPriority getPriority() {
        return priority;
    }
    
    public void setPriority(NotificationPriority priority) {
        this.priority = priority;
    }
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
    
    // Utility methods
    public boolean shouldReceiveNotification() {
        return enabled != null && enabled;
    }
    
    public boolean shouldReceiveEmailNotification() {
        return shouldReceiveNotification() && emailEnabled != null && emailEnabled;
    }
    
    public boolean shouldReceivePushNotification() {
        return shouldReceiveNotification() && pushEnabled != null && pushEnabled;
    }
    
    public boolean shouldReceiveInAppNotification() {
        return shouldReceiveNotification() && inAppEnabled != null && inAppEnabled;
    }
    
    public boolean isCriticalPriority() {
        return priority == NotificationPriority.CRITICAL;
    }
    
    public boolean isHighPriority() {
        return priority == NotificationPriority.HIGH || priority == NotificationPriority.CRITICAL;
    }
    
    @Override
    public String toString() {
        return "UserNotificationPreference{" +
                "id=" + id +
                ", userId=" + userId +
                ", eventType='" + eventType + '\'' +
                ", enabled=" + enabled +
                ", emailEnabled=" + emailEnabled +
                ", pushEnabled=" + pushEnabled +
                ", inAppEnabled=" + inAppEnabled +
                ", priority=" + priority +
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                '}';
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        
        UserNotificationPreference that = (UserNotificationPreference) o;
        
        if (!userId.equals(that.userId)) return false;
        return eventType.equals(that.eventType);
    }
    
    @Override
    public int hashCode() {
        int result = userId.hashCode();
        result = 31 * result + eventType.hashCode();
        return result;
    }
    
    /**
     * Enum for notification priority levels
     */
    public enum NotificationPriority {
        LOW("Low Priority - Digest/Summary"),
        NORMAL("Normal Priority - Standard Notifications"),
        HIGH("High Priority - Important Notifications"),
        CRITICAL("Critical Priority - Immediate Attention Required");
        
        private final String description;
        
        NotificationPriority(String description) {
            this.description = description;
        }
        
        public String getDescription() {
            return description;
        }
    }
}