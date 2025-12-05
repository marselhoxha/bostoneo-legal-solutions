package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.OrganizationDTO;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import com.bostoneo.bostoneosolutions.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class OrganizationServiceImpl implements OrganizationService {

    private final OrganizationRepository organizationRepository;

    @Override
    public OrganizationDTO createOrganization(OrganizationDTO dto) {
        log.info("Creating new organization: {}", dto.getName());

        // Generate slug if not provided
        String slug = dto.getSlug();
        if (slug == null || slug.isEmpty()) {
            slug = generateSlug(dto.getName());
        }

        // Check if slug is available
        if (!isSlugAvailable(slug)) {
            throw new ApiException("Organization slug already exists: " + slug);
        }

        Organization org = Organization.builder()
                .name(dto.getName())
                .slug(slug)
                .logoUrl(dto.getLogoUrl())
                .website(dto.getWebsite())
                .email(dto.getEmail())
                .phone(dto.getPhone())
                .address(dto.getAddress())
                .planType(dto.getPlanType() != null ? dto.getPlanType() : Organization.PlanType.FREE)
                .smsEnabled(dto.getSmsEnabled() != null ? dto.getSmsEnabled() : true)
                .whatsappEnabled(dto.getWhatsappEnabled() != null ? dto.getWhatsappEnabled() : false)
                .emailEnabled(dto.getEmailEnabled() != null ? dto.getEmailEnabled() : true)
                .signatureReminderEmail(dto.getSignatureReminderEmail() != null ? dto.getSignatureReminderEmail() : true)
                .signatureReminderSms(dto.getSignatureReminderSms() != null ? dto.getSignatureReminderSms() : true)
                .signatureReminderWhatsapp(dto.getSignatureReminderWhatsapp() != null ? dto.getSignatureReminderWhatsapp() : false)
                .signatureReminderDays(dto.getSignatureReminderDays() != null ? dto.getSignatureReminderDays() : "7,3,1")
                .build();

        Organization saved = organizationRepository.save(org);
        log.info("Organization created successfully with ID: {}", saved.getId());

        return OrganizationDTO.fromEntity(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<OrganizationDTO> getOrganizationById(Long id) {
        return organizationRepository.findById(id)
                .map(OrganizationDTO::fromEntity);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Organization> getOrganizationEntityById(Long id) {
        return organizationRepository.findById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<OrganizationDTO> getOrganizationBySlug(String slug) {
        return organizationRepository.findBySlug(slug)
                .map(OrganizationDTO::fromEntity);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrganizationDTO> getAllOrganizations() {
        return organizationRepository.findAll().stream()
                .map(OrganizationDTO::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    public OrganizationDTO updateOrganization(Long id, OrganizationDTO dto) {
        log.info("Updating organization ID: {}", id);

        Organization org = organizationRepository.findById(id)
                .orElseThrow(() -> new ApiException("Organization not found with ID: " + id));

        // Check slug uniqueness if changing
        if (dto.getSlug() != null && !dto.getSlug().equals(org.getSlug())) {
            if (!isSlugAvailable(dto.getSlug())) {
                throw new ApiException("Organization slug already exists: " + dto.getSlug());
            }
        }

        dto.updateEntity(org);
        Organization saved = organizationRepository.save(org);

        log.info("Organization updated successfully: {}", saved.getId());
        return OrganizationDTO.fromEntity(saved);
    }

    @Override
    public void deleteOrganization(Long id) {
        log.info("Deleting organization ID: {}", id);

        if (id == 1L) {
            throw new ApiException("Cannot delete the default organization");
        }

        if (!organizationRepository.existsById(id)) {
            throw new ApiException("Organization not found with ID: " + id);
        }

        organizationRepository.deleteById(id);
        log.info("Organization deleted successfully: {}", id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrganizationDTO> searchOrganizations(String query) {
        return organizationRepository.searchOrganizations(query).stream()
                .map(OrganizationDTO::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Organization getDefaultOrganization() {
        return organizationRepository.findById(1L)
                .orElseThrow(() -> new ApiException("Default organization not found"));
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isSlugAvailable(String slug) {
        return !organizationRepository.existsBySlug(slug);
    }

    @Override
    public String generateSlug(String name) {
        if (name == null || name.isEmpty()) {
            return "org-" + System.currentTimeMillis();
        }

        // Convert to lowercase, replace spaces with hyphens, remove special chars
        String baseSlug = name.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");

        if (baseSlug.isEmpty()) {
            baseSlug = "org";
        }

        // Check if slug exists, add number suffix if needed
        String slug = baseSlug;
        int counter = 1;
        while (!isSlugAvailable(slug)) {
            slug = baseSlug + "-" + counter;
            counter++;
        }

        return slug;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Organization> getOrganizationsWithTwilioEnabled() {
        return organizationRepository.findAllWithTwilioEnabled();
    }

    @Override
    public OrganizationDTO updateTwilioSettings(Long id, String subaccountSid, String authToken,
                                                 String phoneNumber, String whatsappNumber, String friendlyName) {
        log.info("Updating Twilio settings for organization ID: {}", id);

        Organization org = organizationRepository.findById(id)
                .orElseThrow(() -> new ApiException("Organization not found with ID: " + id));

        org.setTwilioSubaccountSid(subaccountSid);
        org.setTwilioAuthTokenEncrypted(authToken); // TODO: Implement proper encryption
        org.setTwilioPhoneNumber(phoneNumber);
        org.setTwilioWhatsappNumber(whatsappNumber);
        org.setTwilioFriendlyName(friendlyName);
        org.setTwilioEnabled(true);
        org.setTwilioProvisionedAt(LocalDateTime.now());

        Organization saved = organizationRepository.save(org);
        log.info("Twilio settings updated for organization: {}", saved.getName());

        return OrganizationDTO.fromEntity(saved);
    }

    @Override
    public OrganizationDTO disableTwilio(Long id) {
        log.info("Disabling Twilio for organization ID: {}", id);

        Organization org = organizationRepository.findById(id)
                .orElseThrow(() -> new ApiException("Organization not found with ID: " + id));

        org.setTwilioEnabled(false);
        Organization saved = organizationRepository.save(org);

        log.info("Twilio disabled for organization: {}", saved.getName());
        return OrganizationDTO.fromEntity(saved);
    }

    @Override
    public OrganizationDTO updateNotificationPreferences(Long id, Boolean smsEnabled, Boolean whatsappEnabled,
                                                          Boolean emailEnabled, Boolean signatureReminderEmail,
                                                          Boolean signatureReminderSms, Boolean signatureReminderWhatsapp,
                                                          String signatureReminderDays) {
        log.info("Updating notification preferences for organization ID: {}", id);

        Organization org = organizationRepository.findById(id)
                .orElseThrow(() -> new ApiException("Organization not found with ID: " + id));

        if (smsEnabled != null) org.setSmsEnabled(smsEnabled);
        if (whatsappEnabled != null) org.setWhatsappEnabled(whatsappEnabled);
        if (emailEnabled != null) org.setEmailEnabled(emailEnabled);
        if (signatureReminderEmail != null) org.setSignatureReminderEmail(signatureReminderEmail);
        if (signatureReminderSms != null) org.setSignatureReminderSms(signatureReminderSms);
        if (signatureReminderWhatsapp != null) org.setSignatureReminderWhatsapp(signatureReminderWhatsapp);
        if (signatureReminderDays != null) org.setSignatureReminderDays(signatureReminderDays);

        Organization saved = organizationRepository.save(org);
        log.info("Notification preferences updated for organization: {}", saved.getName());

        return OrganizationDTO.fromEntity(saved);
    }
}
