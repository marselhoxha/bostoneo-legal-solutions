package com.***REMOVED***.***REMOVED***solutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL;

@JsonInclude(NON_NULL)
public class NotificationPreferencesResponse {
    
    private Long userId;
    private List<UserNotificationPreferenceDto> preferences;
    private Map<String, Object> statistics;
    private List<String> availableEventTypes;
    private String message;
    private boolean success;

    public NotificationPreferencesResponse() {}

    public NotificationPreferencesResponse(Long userId, List<UserNotificationPreferenceDto> preferences) {
        this.userId = userId;
        this.preferences = preferences;
        this.success = true;
    }

    public static NotificationPreferencesResponse success(Long userId, List<UserNotificationPreferenceDto> preferences) {
        return new NotificationPreferencesResponse(userId, preferences);
    }

    public static NotificationPreferencesResponse success(String message) {
        NotificationPreferencesResponse response = new NotificationPreferencesResponse();
        response.setMessage(message);
        response.setSuccess(true);
        return response;
    }

    public static NotificationPreferencesResponse error(String message) {
        NotificationPreferencesResponse response = new NotificationPreferencesResponse();
        response.setMessage(message);
        response.setSuccess(false);
        return response;
    }

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

    public Map<String, Object> getStatistics() {
        return statistics;
    }

    public void setStatistics(Map<String, Object> statistics) {
        this.statistics = statistics;
    }

    public List<String> getAvailableEventTypes() {
        return availableEventTypes;
    }

    public void setAvailableEventTypes(List<String> availableEventTypes) {
        this.availableEventTypes = availableEventTypes;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }
}