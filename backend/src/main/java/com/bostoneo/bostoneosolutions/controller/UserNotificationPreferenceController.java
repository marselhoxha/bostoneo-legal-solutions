package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.model.UserNotificationPreference;
import com.***REMOVED***.***REMOVED***solutions.service.UserNotificationPreferenceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.MethodArgumentNotValidException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.HashMap;

@RestController
@RequestMapping("/api/notification-preferences")
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:8085"})
public class UserNotificationPreferenceController {
    
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleException(Exception e) {
        System.err.println("=== EXCEPTION HANDLER TRIGGERED ===");
        System.err.println("Exception type: " + e.getClass().getName());
        System.err.println("Exception message: " + e.getMessage());
        e.printStackTrace();
        
        Map<String, String> error = new HashMap<>();
        error.put("error", e.getMessage());
        error.put("type", e.getClass().getSimpleName());
        
        if (e instanceof org.springframework.http.converter.HttpMessageNotReadableException) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        }
        
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }

    @Autowired
    private UserNotificationPreferenceService notificationPreferenceService;

    @GetMapping("/{userId}")
    public ResponseEntity<List<UserNotificationPreference>> getUserPreferences(@PathVariable Long userId) {
        try {
            List<UserNotificationPreference> preferences = notificationPreferenceService.getUserPreferences(userId);
            return ResponseEntity.ok(preferences);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{userId}/map")
    public ResponseEntity<Map<String, UserNotificationPreference>> getUserPreferencesMap(@PathVariable Long userId) {
        try {
            Map<String, UserNotificationPreference> preferencesMap = notificationPreferenceService.getUserPreferencesMap(userId);
            return ResponseEntity.ok(preferencesMap);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{userId}/{eventType}")
    public ResponseEntity<UserNotificationPreference> getUserPreference(
            @PathVariable Long userId, 
            @PathVariable String eventType) {
        try {
            Optional<UserNotificationPreference> preference = notificationPreferenceService.getUserPreference(userId, eventType);
            return preference.map(ResponseEntity::ok)
                           .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/{userId}")
    public ResponseEntity<UserNotificationPreference> savePreference(
            @PathVariable Long userId,
            @RequestBody UserNotificationPreference preference) {
        try {
            preference.setUserId(userId);
            UserNotificationPreference savedPreference = notificationPreferenceService.savePreference(preference);
            return ResponseEntity.status(HttpStatus.CREATED).body(savedPreference);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/{userId}/bulk")
    public ResponseEntity<List<UserNotificationPreference>> savePreferences(
            @PathVariable Long userId,
            @RequestBody List<UserNotificationPreference> preferences) {
        try {
            preferences.forEach(preference -> preference.setUserId(userId));
            List<UserNotificationPreference> savedPreferences = notificationPreferenceService.savePreferences(preferences);
            return ResponseEntity.status(HttpStatus.CREATED).body(savedPreferences);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/{userId}")
    public ResponseEntity<?> updateUserPreferences(
            @PathVariable Long userId,
            @RequestBody Map<String, UserNotificationPreference> preferences) {
        try {
            System.out.println("=== UPDATE PREFERENCES REQUEST ===");
            System.out.println("User ID: " + userId);
            System.out.println("Preferences received: " + preferences);
            
            if (preferences == null || preferences.isEmpty()) {
                System.err.println("ERROR: Preferences map is null or empty");
                Map<String, String> error = new HashMap<>();
                error.put("error", "Preferences data is required");
                return ResponseEntity.badRequest().body(error);
            }
            
            // Log each preference
            for (Map.Entry<String, UserNotificationPreference> entry : preferences.entrySet()) {
                System.out.println("Event Type: " + entry.getKey());
                UserNotificationPreference pref = entry.getValue();
                if (pref != null) {
                    System.out.println("  - userId: " + pref.getUserId());
                    System.out.println("  - eventType: " + pref.getEventType());
                    System.out.println("  - enabled: " + pref.getEnabled());
                    System.out.println("  - emailEnabled: " + pref.getEmailEnabled());
                    System.out.println("  - pushEnabled: " + pref.getPushEnabled());
                    System.out.println("  - inAppEnabled: " + pref.getInAppEnabled());
                    System.out.println("  - priority: " + pref.getPriority());
                }
            }
            
            List<UserNotificationPreference> updatedPreferences = notificationPreferenceService.updateUserPreferences(userId, preferences);
            System.out.println("Successfully updated " + updatedPreferences.size() + " preferences");
            return ResponseEntity.ok(updatedPreferences);
        } catch (Exception e) {
            System.err.println("ERROR updating preferences: " + e.getMessage());
            e.printStackTrace();
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            error.put("type", e.getClass().getSimpleName());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PatchMapping("/{userId}/{eventType}")
    public ResponseEntity<UserNotificationPreference> updatePreference(
            @PathVariable Long userId,
            @PathVariable String eventType,
            @RequestParam(required = false) Boolean enabled,
            @RequestParam(required = false) Boolean emailEnabled,
            @RequestParam(required = false) Boolean pushEnabled,
            @RequestParam(required = false) Boolean inAppEnabled,
            @RequestParam(required = false) UserNotificationPreference.NotificationPriority priority) {
        try {
            UserNotificationPreference updatedPreference = notificationPreferenceService.updatePreference(
                userId, eventType, enabled, emailEnabled, pushEnabled, inAppEnabled, priority);
            return ResponseEntity.ok(updatedPreference);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PatchMapping("/{userId}/all/enabled")
    public ResponseEntity<List<UserNotificationPreference>> setAllNotificationsEnabled(
            @PathVariable Long userId,
            @RequestParam Boolean enabled) {
        try {
            List<UserNotificationPreference> updatedPreferences = notificationPreferenceService.setAllNotificationsEnabled(userId, enabled);
            return ResponseEntity.ok(updatedPreferences);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PatchMapping("/{userId}/all/email")
    public ResponseEntity<List<UserNotificationPreference>> setAllEmailNotificationsEnabled(
            @PathVariable Long userId,
            @RequestParam Boolean emailEnabled) {
        try {
            List<UserNotificationPreference> updatedPreferences = notificationPreferenceService.setAllEmailNotificationsEnabled(userId, emailEnabled);
            return ResponseEntity.ok(updatedPreferences);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PatchMapping("/{userId}/all/push")
    public ResponseEntity<List<UserNotificationPreference>> setAllPushNotificationsEnabled(
            @PathVariable Long userId,
            @RequestParam Boolean pushEnabled) {
        try {
            List<UserNotificationPreference> updatedPreferences = notificationPreferenceService.setAllPushNotificationsEnabled(userId, pushEnabled);
            return ResponseEntity.ok(updatedPreferences);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/{userId}/reset")
    public ResponseEntity<List<UserNotificationPreference>> resetToRoleDefaults(
            @PathVariable Long userId,
            @RequestParam String roleName) {
        try {
            List<UserNotificationPreference> resetPreferences = notificationPreferenceService.resetToRoleDefaults(userId, roleName);
            return ResponseEntity.ok(resetPreferences);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/{userId}/initialize")
    public ResponseEntity<List<UserNotificationPreference>> initializeUserPreferences(
            @PathVariable Long userId,
            @RequestParam String roleName) {
        try {
            List<UserNotificationPreference> initializedPreferences = notificationPreferenceService.initializeUserPreferences(userId, roleName);
            return ResponseEntity.status(HttpStatus.CREATED).body(initializedPreferences);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> deleteUserPreferences(@PathVariable Long userId) {
        try {
            notificationPreferenceService.deleteUserPreferences(userId);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{userId}/{eventType}")
    public ResponseEntity<Void> deletePreference(
            @PathVariable Long userId,
            @PathVariable String eventType) {
        try {
            notificationPreferenceService.deletePreference(userId, eventType);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{userId}/check/{eventType}")
    public ResponseEntity<Map<String, Boolean>> checkNotificationSettings(
            @PathVariable Long userId,
            @PathVariable String eventType) {
        try {
            Map<String, Boolean> settings = Map.of(
                "shouldReceiveNotification", notificationPreferenceService.shouldReceiveNotification(userId, eventType),
                "shouldReceiveEmailNotification", notificationPreferenceService.shouldReceiveEmailNotification(userId, eventType),
                "shouldReceivePushNotification", notificationPreferenceService.shouldReceivePushNotification(userId, eventType),
                "shouldReceiveInAppNotification", notificationPreferenceService.shouldReceiveInAppNotification(userId, eventType)
            );
            return ResponseEntity.ok(settings);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/targeting/{eventType}")
    public ResponseEntity<List<Long>> getUsersForNotification(
            @PathVariable String eventType,
            @RequestParam(required = false) String deliveryChannel) {
        try {
            List<Long> userIds = notificationPreferenceService.getUsersForNotification(eventType, deliveryChannel);
            return ResponseEntity.ok(userIds);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{userId}/stats")
    public ResponseEntity<Map<String, Object>> getUserNotificationStats(@PathVariable Long userId) {
        try {
            Map<String, Object> stats = notificationPreferenceService.getUserNotificationStats(userId);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/event-types")
    public ResponseEntity<List<String>> getAllEventTypes() {
        try {
            List<String> eventTypes = notificationPreferenceService.getAllEventTypes();
            return ResponseEntity.ok(eventTypes);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{userId}/exists")
    public ResponseEntity<Map<String, Boolean>> hasUserPreferences(@PathVariable Long userId) {
        try {
            boolean hasPreferences = notificationPreferenceService.hasUserPreferences(userId);
            return ResponseEntity.ok(Map.of("hasPreferences", hasPreferences));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}