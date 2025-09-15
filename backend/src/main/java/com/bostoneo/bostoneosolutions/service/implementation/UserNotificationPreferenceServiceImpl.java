package com.***REMOVED***.***REMOVED***solutions.service.implementation;

import com.***REMOVED***.***REMOVED***solutions.model.UserNotificationPreference;
import com.***REMOVED***.***REMOVED***solutions.repository.UserNotificationPreferenceRepository;
import com.***REMOVED***.***REMOVED***solutions.service.UserNotificationPreferenceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class UserNotificationPreferenceServiceImpl implements UserNotificationPreferenceService {

    @Autowired
    private UserNotificationPreferenceRepository repository;

    private static final List<String> DEFAULT_EVENT_TYPES = Arrays.asList(
        "CASE_STATUS_CHANGED", "CASE_PRIORITY_CHANGED", "CASE_ASSIGNMENT_ADDED",
        "TASK_CREATED", "TASK_STATUS_CHANGED", "TASK_DEADLINE_APPROACHING",
        "DOCUMENT_UPLOADED", "DOCUMENT_VERSION_UPDATED", "INVOICE_CREATED",
        "PAYMENT_RECEIVED", "EXPENSE_SUBMITTED", "LEAD_STATUS_CHANGED",
        "INTAKE_FORM_SUBMITTED", "CALENDAR_EVENT_CREATED", "SYSTEM_ISSUE"
    );

    @Override
    @Transactional(readOnly = true)
    public List<UserNotificationPreference> getUserPreferences(Long userId) {
        return repository.findByUserIdOrderByEventType(userId);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, UserNotificationPreference> getUserPreferencesMap(Long userId) {
        List<UserNotificationPreference> preferences = repository.findByUserId(userId);
        return preferences.stream()
                .collect(Collectors.toMap(
                    UserNotificationPreference::getEventType,
                    preference -> preference,
                    (existing, replacement) -> existing
                ));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UserNotificationPreference> getUserPreference(Long userId, String eventType) {
        return repository.findByUserIdAndEventType(userId, eventType);
    }

    @Override
    public UserNotificationPreference savePreference(UserNotificationPreference preference) {
        return repository.save(preference);
    }

    @Override
    public List<UserNotificationPreference> savePreferences(List<UserNotificationPreference> preferences) {
        return repository.saveAll(preferences);
    }

    @Override
    public List<UserNotificationPreference> updateUserPreferences(Long userId, Map<String, UserNotificationPreference> preferences) {
        List<UserNotificationPreference> updatedPreferences = new ArrayList<>();
        
        for (Map.Entry<String, UserNotificationPreference> entry : preferences.entrySet()) {
            String eventType = entry.getKey();
            UserNotificationPreference newPreference = entry.getValue();
            
            Optional<UserNotificationPreference> existingOpt = repository.findByUserIdAndEventType(userId, eventType);
            
            if (existingOpt.isPresent()) {
                UserNotificationPreference existing = existingOpt.get();
                // Only update non-null values
                if (newPreference.getEnabled() != null) {
                    existing.setEnabled(newPreference.getEnabled());
                }
                if (newPreference.getEmailEnabled() != null) {
                    existing.setEmailEnabled(newPreference.getEmailEnabled());
                }
                if (newPreference.getPushEnabled() != null) {
                    existing.setPushEnabled(newPreference.getPushEnabled());
                }
                if (newPreference.getInAppEnabled() != null) {
                    existing.setInAppEnabled(newPreference.getInAppEnabled());
                }
                if (newPreference.getPriority() != null) {
                    existing.setPriority(newPreference.getPriority());
                }
                updatedPreferences.add(repository.save(existing));
            } else {
                newPreference.setUserId(userId);
                newPreference.setEventType(eventType);
                updatedPreferences.add(repository.save(newPreference));
            }
        }
        
        return updatedPreferences;
    }

    @Override
    public UserNotificationPreference updatePreference(Long userId, String eventType, Boolean enabled, 
                                                     Boolean emailEnabled, Boolean pushEnabled, 
                                                     Boolean inAppEnabled, UserNotificationPreference.NotificationPriority priority) {
        Optional<UserNotificationPreference> existingOpt = repository.findByUserIdAndEventType(userId, eventType);
        
        UserNotificationPreference preference;
        if (existingOpt.isPresent()) {
            preference = existingOpt.get();
        } else {
            preference = new UserNotificationPreference(userId, eventType);
        }
        
        if (enabled != null) preference.setEnabled(enabled);
        if (emailEnabled != null) preference.setEmailEnabled(emailEnabled);
        if (pushEnabled != null) preference.setPushEnabled(pushEnabled);
        if (inAppEnabled != null) preference.setInAppEnabled(inAppEnabled);
        if (priority != null) preference.setPriority(priority);
        
        return repository.save(preference);
    }

    @Override
    public List<UserNotificationPreference> setAllNotificationsEnabled(Long userId, Boolean enabled) {
        List<UserNotificationPreference> preferences = repository.findByUserId(userId);
        
        for (UserNotificationPreference preference : preferences) {
            preference.setEnabled(enabled);
        }
        
        return repository.saveAll(preferences);
    }

    @Override
    public List<UserNotificationPreference> setAllEmailNotificationsEnabled(Long userId, Boolean emailEnabled) {
        List<UserNotificationPreference> preferences = repository.findByUserId(userId);
        
        for (UserNotificationPreference preference : preferences) {
            preference.setEmailEnabled(emailEnabled);
        }
        
        return repository.saveAll(preferences);
    }

    @Override
    public List<UserNotificationPreference> setAllPushNotificationsEnabled(Long userId, Boolean pushEnabled) {
        List<UserNotificationPreference> preferences = repository.findByUserId(userId);
        
        for (UserNotificationPreference preference : preferences) {
            preference.setPushEnabled(pushEnabled);
        }
        
        return repository.saveAll(preferences);
    }

    @Override
    public List<UserNotificationPreference> resetToRoleDefaults(Long userId, String roleName) {
        repository.deleteByUserId(userId);
        return initializeUserPreferences(userId, roleName);
    }

    @Override
    public List<UserNotificationPreference> initializeUserPreferences(Long userId, String roleName) {
        List<UserNotificationPreference> preferences = new ArrayList<>();
        
        for (String eventType : DEFAULT_EVENT_TYPES) {
            UserNotificationPreference preference = createRoleBasedPreference(userId, eventType, roleName);
            preferences.add(preference);
        }
        
        return repository.saveAll(preferences);
    }

    @Override
    public void deleteUserPreferences(Long userId) {
        repository.deleteByUserId(userId);
    }

    @Override
    public void deletePreference(Long userId, String eventType) {
        repository.deleteByUserIdAndEventType(userId, eventType);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean shouldReceiveNotification(Long userId, String eventType) {
        Optional<UserNotificationPreference> preference = repository.findByUserIdAndEventType(userId, eventType);
        return preference.map(UserNotificationPreference::shouldReceiveNotification).orElse(true);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean shouldReceiveEmailNotification(Long userId, String eventType) {
        Optional<UserNotificationPreference> preference = repository.findByUserIdAndEventType(userId, eventType);
        return preference.map(UserNotificationPreference::shouldReceiveEmailNotification).orElse(false);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean shouldReceivePushNotification(Long userId, String eventType) {
        Optional<UserNotificationPreference> preference = repository.findByUserIdAndEventType(userId, eventType);
        return preference.map(UserNotificationPreference::shouldReceivePushNotification).orElse(false);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean shouldReceiveInAppNotification(Long userId, String eventType) {
        Optional<UserNotificationPreference> preference = repository.findByUserIdAndEventType(userId, eventType);
        return preference.map(UserNotificationPreference::shouldReceiveInAppNotification).orElse(true);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> getUsersForNotification(String eventType, String deliveryChannel) {
        return repository.findUserIdsByEventTypeAndDeliveryChannel(eventType, deliveryChannel);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getUserNotificationStats(Long userId) {
        Map<String, Object> stats = new HashMap<>();
        
        Long total = repository.countByUserId(userId);
        Long enabled = repository.countEnabledByUserId(userId);
        Long disabled = total - enabled;
        
        List<UserNotificationPreference> preferences = repository.findByUserId(userId);
        long emailEnabled = preferences.stream().mapToLong(p -> p.shouldReceiveEmailNotification() ? 1 : 0).sum();
        long pushEnabled = preferences.stream().mapToLong(p -> p.shouldReceivePushNotification() ? 1 : 0).sum();
        long inAppEnabled = preferences.stream().mapToLong(p -> p.shouldReceiveInAppNotification() ? 1 : 0).sum();
        
        stats.put("total", total);
        stats.put("enabled", enabled);
        stats.put("disabled", disabled);
        stats.put("emailEnabled", emailEnabled);
        stats.put("pushEnabled", pushEnabled);
        stats.put("inAppEnabled", inAppEnabled);
        
        return stats;
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getAllEventTypes() {
        List<String> dbEventTypes = repository.findDistinctEventTypes();
        return dbEventTypes.isEmpty() ? DEFAULT_EVENT_TYPES : dbEventTypes;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasUserPreferences(Long userId) {
        return repository.existsByUserId(userId);
    }

    private UserNotificationPreference createRoleBasedPreference(Long userId, String eventType, String roleName) {
        UserNotificationPreference preference = new UserNotificationPreference(userId, eventType);
        
        if (roleName == null) {
            roleName = "DEFAULT";
        }
        
        switch (roleName.toUpperCase()) {
            case "MANAGING_PARTNER":
            case "SENIOR_PARTNER":
            case "EQUITY_PARTNER":
                setPartnerPreferences(preference, eventType);
                break;
                
            case "SENIOR_ASSOCIATE":
            case "ASSOCIATE":
            case "JUNIOR_ASSOCIATE":
            case "ROLE_ATTORNEY":
            case "OF_COUNSEL":
                setAssociatePreferences(preference, eventType);
                break;
                
            case "PARALEGAL":
            case "SENIOR_PARALEGAL":
            case "LEGAL_ASSISTANT":
            case "LAW_CLERK":
                setParalegalPreferences(preference, eventType);
                break;
                
            case "LEGAL_SECRETARY":
            case "PRACTICE_MANAGER":
                setAdministrativePreferences(preference, eventType);
                break;
                
            case "CFO":
            case "FINANCE_MANAGER":
                setFinancialPreferences(preference, eventType);
                break;
                
            case "IT_MANAGER":
            case "ROLE_ADMIN":
                setITPreferences(preference, eventType);
                break;
                
            default:
                setDefaultPreferences(preference, eventType);
                break;
        }
        
        return preference;
    }

    private void setPartnerPreferences(UserNotificationPreference preference, String eventType) {
        switch (eventType) {
            case "CASE_STATUS_CHANGED":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "CASE_PRIORITY_CHANGED":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.CRITICAL);
                break;
            case "CASE_ASSIGNMENT_ADDED":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "TASK_CREATED":
            case "TASK_STATUS_CHANGED":
                preference.setEnabled(false);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.LOW);
                break;
            case "TASK_DEADLINE_APPROACHING":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.CRITICAL);
                break;
            case "DOCUMENT_UPLOADED":
            case "DOCUMENT_VERSION_UPDATED":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "INVOICE_CREATED":
            case "PAYMENT_RECEIVED":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "EXPENSE_SUBMITTED":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.NORMAL);
                break;
            case "LEAD_STATUS_CHANGED":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "INTAKE_FORM_SUBMITTED":
            case "CALENDAR_EVENT_CREATED":
            case "SYSTEM_ISSUE":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(eventType.equals("SYSTEM_ISSUE") ? 
                    UserNotificationPreference.NotificationPriority.CRITICAL : 
                    UserNotificationPreference.NotificationPriority.HIGH);
                break;
            default:
                setDefaultPreferences(preference, eventType);
        }
    }

    private void setAssociatePreferences(UserNotificationPreference preference, String eventType) {
        switch (eventType) {
            case "CASE_STATUS_CHANGED":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "CASE_PRIORITY_CHANGED":
            case "CASE_ASSIGNMENT_ADDED":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "TASK_CREATED":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "TASK_STATUS_CHANGED":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.NORMAL);
                break;
            case "TASK_DEADLINE_APPROACHING":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.CRITICAL);
                break;
            case "DOCUMENT_UPLOADED":
            case "DOCUMENT_VERSION_UPDATED":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.NORMAL);
                break;
            case "INVOICE_CREATED":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.NORMAL);
                break;
            case "PAYMENT_RECEIVED":
            case "EXPENSE_SUBMITTED":
                preference.setEnabled(false);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(false);
                preference.setPriority(UserNotificationPreference.NotificationPriority.LOW);
                break;
            case "LEAD_STATUS_CHANGED":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.NORMAL);
                break;
            case "INTAKE_FORM_SUBMITTED":
            case "CALENDAR_EVENT_CREATED":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "SYSTEM_ISSUE":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            default:
                setDefaultPreferences(preference, eventType);
        }
    }

    private void setParalegalPreferences(UserNotificationPreference preference, String eventType) {
        switch (eventType) {
            case "CASE_STATUS_CHANGED":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.NORMAL);
                break;
            case "CASE_PRIORITY_CHANGED":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "CASE_ASSIGNMENT_ADDED":
            case "TASK_CREATED":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "TASK_STATUS_CHANGED":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.NORMAL);
                break;
            case "TASK_DEADLINE_APPROACHING":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.CRITICAL);
                break;
            case "DOCUMENT_UPLOADED":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "DOCUMENT_VERSION_UPDATED":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.NORMAL);
                break;
            case "INVOICE_CREATED":
            case "PAYMENT_RECEIVED":
            case "EXPENSE_SUBMITTED":
            case "LEAD_STATUS_CHANGED":
                preference.setEnabled(false);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(false);
                preference.setPriority(UserNotificationPreference.NotificationPriority.LOW);
                break;
            case "INTAKE_FORM_SUBMITTED":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "CALENDAR_EVENT_CREATED":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.NORMAL);
                break;
            case "SYSTEM_ISSUE":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.NORMAL);
                break;
            default:
                setDefaultPreferences(preference, eventType);
        }
    }

    private void setAdministrativePreferences(UserNotificationPreference preference, String eventType) {
        switch (eventType) {
            case "CASE_STATUS_CHANGED":
            case "CASE_PRIORITY_CHANGED":
            case "CASE_ASSIGNMENT_ADDED":
            case "TASK_CREATED":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.NORMAL);
                break;
            case "TASK_STATUS_CHANGED":
                preference.setEnabled(false);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(false);
                preference.setPriority(UserNotificationPreference.NotificationPriority.LOW);
                break;
            case "TASK_DEADLINE_APPROACHING":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "DOCUMENT_UPLOADED":
            case "DOCUMENT_VERSION_UPDATED":
                preference.setEnabled(false);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(false);
                preference.setPriority(UserNotificationPreference.NotificationPriority.LOW);
                break;
            case "INVOICE_CREATED":
            case "PAYMENT_RECEIVED":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "EXPENSE_SUBMITTED":
            case "LEAD_STATUS_CHANGED":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.NORMAL);
                break;
            case "INTAKE_FORM_SUBMITTED":
            case "CALENDAR_EVENT_CREATED":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(eventType.equals("CALENDAR_EVENT_CREATED") ? 
                    UserNotificationPreference.NotificationPriority.CRITICAL : 
                    UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "SYSTEM_ISSUE":
                preference.setEnabled(true);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            default:
                setDefaultPreferences(preference, eventType);
        }
    }

    private void setFinancialPreferences(UserNotificationPreference preference, String eventType) {
        switch (eventType) {
            case "INVOICE_CREATED":
            case "PAYMENT_RECEIVED":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.CRITICAL);
                break;
            case "EXPENSE_SUBMITTED":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            case "SYSTEM_ISSUE":
                preference.setEnabled(true);
                preference.setEmailEnabled(true);
                preference.setPushEnabled(true);
                preference.setInAppEnabled(true);
                preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
                break;
            default:
                preference.setEnabled(false);
                preference.setEmailEnabled(false);
                preference.setPushEnabled(false);
                preference.setInAppEnabled(false);
                preference.setPriority(UserNotificationPreference.NotificationPriority.LOW);
        }
    }

    private void setITPreferences(UserNotificationPreference preference, String eventType) {
        if ("SYSTEM_ISSUE".equals(eventType)) {
            preference.setEnabled(true);
            preference.setEmailEnabled(true);
            preference.setPushEnabled(true);
            preference.setInAppEnabled(true);
            preference.setPriority(UserNotificationPreference.NotificationPriority.CRITICAL);
        } else {
            preference.setEnabled(false);
            preference.setEmailEnabled(false);
            preference.setPushEnabled(false);
            preference.setInAppEnabled(false);
            preference.setPriority(UserNotificationPreference.NotificationPriority.LOW);
        }
    }

    private void setDefaultPreferences(UserNotificationPreference preference, String eventType) {
        preference.setEnabled(true);
        preference.setEmailEnabled(false);
        preference.setPushEnabled(false);
        preference.setInAppEnabled(true);
        
        if ("TASK_DEADLINE_APPROACHING".equals(eventType) || "SYSTEM_ISSUE".equals(eventType)) {
            preference.setEmailEnabled(true);
            preference.setPushEnabled(true);
            preference.setPriority(UserNotificationPreference.NotificationPriority.HIGH);
        } else {
            preference.setPriority(UserNotificationPreference.NotificationPriority.NORMAL);
        }
    }
}