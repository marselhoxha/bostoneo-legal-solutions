package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL;

@JsonInclude(NON_NULL)
public class NotificationPreferencesUpdateRequest {
    
    @NotNull(message = "User ID is required")
    private Long userId;
    
    @Valid
    private List<UserNotificationPreferenceDto> preferences;
    
    private Map<String, UserNotificationPreferenceDto> preferencesMap;
    
    private Boolean enableAll;
    private Boolean enableAllEmail;
    private Boolean enableAllPush;
    private Boolean enableAllInApp;
    
    private String resetToRole;

    public NotificationPreferencesUpdateRequest() {}

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public List<UserNotificationPreferenceDto> getPreferences() {
        return preferences;
    }

    public void setPreferences(List<UserNotificationPreferenceDto> preferences) {
        this.preferences = preferences;
    }

    public Map<String, UserNotificationPreferenceDto> getPreferencesMap() {
        return preferencesMap;
    }

    public void setPreferencesMap(Map<String, UserNotificationPreferenceDto> preferencesMap) {
        this.preferencesMap = preferencesMap;
    }

    public Boolean getEnableAll() {
        return enableAll;
    }

    public void setEnableAll(Boolean enableAll) {
        this.enableAll = enableAll;
    }

    public Boolean getEnableAllEmail() {
        return enableAllEmail;
    }

    public void setEnableAllEmail(Boolean enableAllEmail) {
        this.enableAllEmail = enableAllEmail;
    }

    public Boolean getEnableAllPush() {
        return enableAllPush;
    }

    public void setEnableAllPush(Boolean enableAllPush) {
        this.enableAllPush = enableAllPush;
    }

    public Boolean getEnableAllInApp() {
        return enableAllInApp;
    }

    public void setEnableAllInApp(Boolean enableAllInApp) {
        this.enableAllInApp = enableAllInApp;
    }

    public String getResetToRole() {
        return resetToRole;
    }

    public void setResetToRole(String resetToRole) {
        this.resetToRole = resetToRole;
    }
}