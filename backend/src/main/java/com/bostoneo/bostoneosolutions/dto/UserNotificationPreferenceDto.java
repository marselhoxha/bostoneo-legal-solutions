package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.model.UserNotificationPreference;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL;

@JsonInclude(NON_NULL)
public class UserNotificationPreferenceDto {
    
    private Long id;
    
    @NotNull(message = "User ID is required")
    private Long userId;
    
    @NotBlank(message = "Event type is required")
    private String eventType;
    
    private Boolean enabled;
    private Boolean emailEnabled;
    private Boolean pushEnabled;
    private Boolean inAppEnabled;
    private UserNotificationPreference.NotificationPriority priority;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public UserNotificationPreferenceDto() {}

    public UserNotificationPreferenceDto(UserNotificationPreference preference) {
        this.id = preference.getId();
        this.userId = preference.getUserId();
        this.eventType = preference.getEventType();
        this.enabled = preference.getEnabled();
        this.emailEnabled = preference.getEmailEnabled();
        this.pushEnabled = preference.getPushEnabled();
        this.inAppEnabled = preference.getInAppEnabled();
        this.priority = preference.getPriority();
        this.createdAt = preference.getCreatedAt();
        this.updatedAt = preference.getUpdatedAt();
    }

    public UserNotificationPreference toEntity() {
        UserNotificationPreference preference = new UserNotificationPreference();
        preference.setId(this.id);
        preference.setUserId(this.userId);
        preference.setEventType(this.eventType);
        preference.setEnabled(this.enabled != null ? this.enabled : true);
        preference.setEmailEnabled(this.emailEnabled != null ? this.emailEnabled : true);
        preference.setPushEnabled(this.pushEnabled != null ? this.pushEnabled : true);
        preference.setInAppEnabled(this.inAppEnabled != null ? this.inAppEnabled : true);
        preference.setPriority(this.priority != null ? this.priority : UserNotificationPreference.NotificationPriority.NORMAL);
        return preference;
    }

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

    public UserNotificationPreference.NotificationPriority getPriority() {
        return priority;
    }

    public void setPriority(UserNotificationPreference.NotificationPriority priority) {
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
}