package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

/**
 * Organization entity representing a law firm or tenant in the multi-tenant system.
 * Each organization has its own Twilio subaccount, BoldSign settings, and data isolation.
 */
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "organizations")
public class Organization {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    // Basic Info
    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "slug", nullable = false, unique = true, length = 100)
    private String slug;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @Column(name = "website")
    private String website;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "phone", length = 30)
    private String phone;

    @Column(name = "address", columnDefinition = "TEXT")
    private String address;

    // Subscription/Plan
    @Enumerated(EnumType.STRING)
    @Column(name = "plan_type")
    @Builder.Default
    private PlanType planType = PlanType.FREE;

    @Column(name = "plan_expires_at")
    private LocalDateTime planExpiresAt;

    // Twilio Subaccount Settings
    @Column(name = "twilio_subaccount_sid", length = 50)
    private String twilioSubaccountSid;

    @Column(name = "twilio_auth_token_encrypted")
    private String twilioAuthTokenEncrypted;

    @Column(name = "twilio_phone_number", length = 20)
    private String twilioPhoneNumber;

    @Column(name = "twilio_whatsapp_number", length = 20)
    private String twilioWhatsappNumber;

    @Column(name = "twilio_friendly_name", length = 100)
    private String twilioFriendlyName;

    @Column(name = "twilio_enabled")
    @Builder.Default
    private Boolean twilioEnabled = false;

    @Column(name = "twilio_provisioned_at")
    private LocalDateTime twilioProvisionedAt;

    // BoldSign Settings
    @Column(name = "boldsign_api_key_encrypted")
    private String boldsignApiKeyEncrypted;

    @Column(name = "boldsign_enabled")
    @Builder.Default
    private Boolean boldsignEnabled = true;

    @Column(name = "boldsign_brand_id", length = 100)
    private String boldsignBrandId;

    // Notification Preferences
    @Column(name = "sms_enabled")
    @Builder.Default
    private Boolean smsEnabled = true;

    @Column(name = "whatsapp_enabled")
    @Builder.Default
    private Boolean whatsappEnabled = false;

    @Column(name = "email_enabled")
    @Builder.Default
    private Boolean emailEnabled = true;

    // Signature Reminder Settings
    @Column(name = "signature_reminder_email")
    @Builder.Default
    private Boolean signatureReminderEmail = true;

    @Column(name = "signature_reminder_sms")
    @Builder.Default
    private Boolean signatureReminderSms = true;

    @Column(name = "signature_reminder_whatsapp")
    @Builder.Default
    private Boolean signatureReminderWhatsapp = false;

    @Column(name = "signature_reminder_days", length = 50)
    @Builder.Default
    private String signatureReminderDays = "7,3,1";

    // SMS Templates
    @Column(name = "sms_template_signature_request", columnDefinition = "TEXT")
    private String smsTemplateSignatureRequest;

    @Column(name = "sms_template_signature_reminder", columnDefinition = "TEXT")
    private String smsTemplateSignatureReminder;

    @Column(name = "sms_template_signature_completed", columnDefinition = "TEXT")
    private String smsTemplateSignatureCompleted;

    // Timestamps
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.planType == null) {
            this.planType = PlanType.FREE;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // Helper methods
    public boolean isTwilioConfigured() {
        return twilioEnabled != null && twilioEnabled
                && twilioSubaccountSid != null && !twilioSubaccountSid.isEmpty()
                && twilioPhoneNumber != null && !twilioPhoneNumber.isEmpty();
    }

    public boolean isBoldsignConfigured() {
        return boldsignEnabled != null && boldsignEnabled;
    }

    public boolean canSendSms() {
        return smsEnabled != null && smsEnabled && isTwilioConfigured();
    }

    public boolean canSendWhatsapp() {
        return whatsappEnabled != null && whatsappEnabled
                && isTwilioConfigured()
                && twilioWhatsappNumber != null && !twilioWhatsappNumber.isEmpty();
    }

    /**
     * Get reminder days as an array of integers
     */
    public int[] getReminderDaysArray() {
        if (signatureReminderDays == null || signatureReminderDays.isEmpty()) {
            return new int[]{7, 3, 1};
        }
        String[] parts = signatureReminderDays.split(",");
        int[] days = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            try {
                days[i] = Integer.parseInt(parts[i].trim());
            } catch (NumberFormatException e) {
                days[i] = 0;
            }
        }
        return days;
    }

    // Plan type enum
    public enum PlanType {
        FREE,
        STARTER,
        PROFESSIONAL,
        ENTERPRISE
    }
}
