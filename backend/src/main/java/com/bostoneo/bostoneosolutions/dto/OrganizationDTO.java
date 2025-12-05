package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.model.Organization;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class OrganizationDTO {

    private Long id;

    // Basic Info
    private String name;
    private String slug;
    private String logoUrl;
    private String website;
    private String email;
    private String phone;
    private String address;

    // Subscription/Plan
    private Organization.PlanType planType;
    private LocalDateTime planExpiresAt;

    // Twilio Status (not exposing credentials)
    private Boolean twilioEnabled;
    private String twilioPhoneNumber;
    private String twilioWhatsappNumber;
    private String twilioFriendlyName;
    private LocalDateTime twilioProvisionedAt;
    private Boolean twilioConfigured;

    // BoldSign Status
    private Boolean boldsignEnabled;
    private String boldsignBrandId;
    private Boolean boldsignConfigured;

    // Notification Preferences
    private Boolean smsEnabled;
    private Boolean whatsappEnabled;
    private Boolean emailEnabled;

    // Signature Reminder Settings
    private Boolean signatureReminderEmail;
    private Boolean signatureReminderSms;
    private Boolean signatureReminderWhatsapp;
    private String signatureReminderDays;

    // SMS Templates
    private String smsTemplateSignatureRequest;
    private String smsTemplateSignatureReminder;
    private String smsTemplateSignatureCompleted;

    // Timestamps
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /**
     * Convert entity to DTO
     */
    public static OrganizationDTO fromEntity(Organization org) {
        if (org == null) return null;

        return OrganizationDTO.builder()
                .id(org.getId())
                .name(org.getName())
                .slug(org.getSlug())
                .logoUrl(org.getLogoUrl())
                .website(org.getWebsite())
                .email(org.getEmail())
                .phone(org.getPhone())
                .address(org.getAddress())
                .planType(org.getPlanType())
                .planExpiresAt(org.getPlanExpiresAt())
                .twilioEnabled(org.getTwilioEnabled())
                .twilioPhoneNumber(org.getTwilioPhoneNumber())
                .twilioWhatsappNumber(org.getTwilioWhatsappNumber())
                .twilioFriendlyName(org.getTwilioFriendlyName())
                .twilioProvisionedAt(org.getTwilioProvisionedAt())
                .twilioConfigured(org.isTwilioConfigured())
                .boldsignEnabled(org.getBoldsignEnabled())
                .boldsignBrandId(org.getBoldsignBrandId())
                .boldsignConfigured(org.isBoldsignConfigured())
                .smsEnabled(org.getSmsEnabled())
                .whatsappEnabled(org.getWhatsappEnabled())
                .emailEnabled(org.getEmailEnabled())
                .signatureReminderEmail(org.getSignatureReminderEmail())
                .signatureReminderSms(org.getSignatureReminderSms())
                .signatureReminderWhatsapp(org.getSignatureReminderWhatsapp())
                .signatureReminderDays(org.getSignatureReminderDays())
                .smsTemplateSignatureRequest(org.getSmsTemplateSignatureRequest())
                .smsTemplateSignatureReminder(org.getSmsTemplateSignatureReminder())
                .smsTemplateSignatureCompleted(org.getSmsTemplateSignatureCompleted())
                .createdAt(org.getCreatedAt())
                .updatedAt(org.getUpdatedAt())
                .build();
    }

    /**
     * Update entity from DTO (for updates - doesn't update sensitive fields)
     */
    public void updateEntity(Organization org) {
        if (name != null) org.setName(name);
        if (slug != null) org.setSlug(slug);
        if (logoUrl != null) org.setLogoUrl(logoUrl);
        if (website != null) org.setWebsite(website);
        if (email != null) org.setEmail(email);
        if (phone != null) org.setPhone(phone);
        if (address != null) org.setAddress(address);
        if (smsEnabled != null) org.setSmsEnabled(smsEnabled);
        if (whatsappEnabled != null) org.setWhatsappEnabled(whatsappEnabled);
        if (emailEnabled != null) org.setEmailEnabled(emailEnabled);
        if (signatureReminderEmail != null) org.setSignatureReminderEmail(signatureReminderEmail);
        if (signatureReminderSms != null) org.setSignatureReminderSms(signatureReminderSms);
        if (signatureReminderWhatsapp != null) org.setSignatureReminderWhatsapp(signatureReminderWhatsapp);
        if (signatureReminderDays != null) org.setSignatureReminderDays(signatureReminderDays);
        if (smsTemplateSignatureRequest != null) org.setSmsTemplateSignatureRequest(smsTemplateSignatureRequest);
        if (smsTemplateSignatureReminder != null) org.setSmsTemplateSignatureReminder(smsTemplateSignatureReminder);
        if (smsTemplateSignatureCompleted != null) org.setSmsTemplateSignatureCompleted(smsTemplateSignatureCompleted);
    }
}
