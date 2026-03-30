package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.UserNotificationPreference;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import com.bostoneo.bostoneosolutions.service.UserNotificationPreferenceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.HashMap;

@RestController
@RequestMapping("/api/notification-preferences")
@Slf4j
public class UserNotificationPreferenceController {

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleException(Exception e) {
        log.error("Exception handler triggered - type: {}, message: {}", e.getClass().getName(), e.getMessage(), e);

        Map<String, String> error = new HashMap<>();
        error.put("error", e.getMessage());
        error.put("type", e.getClass().getSimpleName());

        if (e instanceof SecurityException) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
        }
        if (e instanceof org.springframework.http.converter.HttpMessageNotReadableException) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        }

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }

    @Autowired
    private UserNotificationPreferenceService notificationPreferenceService;

    /**
     * Verify the authenticated user owns the requested userId.
     * Admins can access any user's preferences within their org.
     */
    private void verifyUserAccess(Long userId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new SecurityException("Authentication required");
        }

        Long currentUserId = null;
        Object principal = auth.getPrincipal();
        if (principal instanceof UserDTO dto) {
            currentUserId = dto.getId();
        } else if (principal instanceof UserPrincipal up) {
            currentUserId = up.getId();
        }

        if (currentUserId == null) {
            throw new SecurityException("Cannot determine current user identity");
        }

        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_SYSADMIN"));
        if (!currentUserId.equals(userId) && !isAdmin) {
            log.warn("IDOR attempt: User {} tried to access preferences of user {}", currentUserId, userId);
            throw new SecurityException("Access denied: cannot access another user's preferences");
        }
    }

    @GetMapping("/{userId}")
    public ResponseEntity<List<UserNotificationPreference>> getUserPreferences(@PathVariable Long userId) {
        try {
            verifyUserAccess(userId);
            List<UserNotificationPreference> preferences = notificationPreferenceService.getUserPreferences(userId);
            return ResponseEntity.ok(preferences);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{userId}/map")
    public ResponseEntity<Map<String, UserNotificationPreference>> getUserPreferencesMap(@PathVariable Long userId) {
        try {
            verifyUserAccess(userId);
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
            verifyUserAccess(userId);
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
            verifyUserAccess(userId);
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
            verifyUserAccess(userId);
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
            verifyUserAccess(userId);
            log.debug("Update preferences request - userId: {}, preferences count: {}", userId, preferences != null ? preferences.size() : 0);

            if (preferences == null || preferences.isEmpty()) {
                log.warn("Preferences map is null or empty for userId: {}", userId);
                Map<String, String> error = new HashMap<>();
                error.put("error", "Preferences data is required");
                return ResponseEntity.badRequest().body(error);
            }

            List<UserNotificationPreference> updatedPreferences = notificationPreferenceService.updateUserPreferences(userId, preferences);
            log.debug("Successfully updated {} preferences for userId: {}", updatedPreferences.size(), userId);
            return ResponseEntity.ok(updatedPreferences);
        } catch (Exception e) {
            log.error("Error updating preferences for userId: {}", userId, e);
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
            verifyUserAccess(userId);
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
            verifyUserAccess(userId);
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
            verifyUserAccess(userId);
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
            verifyUserAccess(userId);
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
            verifyUserAccess(userId);
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
            verifyUserAccess(userId);
            List<UserNotificationPreference> initializedPreferences = notificationPreferenceService.initializeUserPreferences(userId, roleName);
            return ResponseEntity.status(HttpStatus.CREATED).body(initializedPreferences);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> deleteUserPreferences(@PathVariable Long userId) {
        try {
            verifyUserAccess(userId);
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
            verifyUserAccess(userId);
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
            verifyUserAccess(userId);
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
            verifyUserAccess(userId);
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
            verifyUserAccess(userId);
            boolean hasPreferences = notificationPreferenceService.hasUserPreferences(userId);
            return ResponseEntity.ok(Map.of("hasPreferences", hasPreferences));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}