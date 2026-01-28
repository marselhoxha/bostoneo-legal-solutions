package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.OrganizationDTO;
import com.bostoneo.bostoneosolutions.dto.OrganizationStatsDTO;
import com.bostoneo.bostoneosolutions.dto.PlanQuotaDTO;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import com.bostoneo.bostoneosolutions.service.OrganizationService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
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
    private final EntityManager entityManager;
    private final com.bostoneo.bostoneosolutions.multitenancy.TenantService tenantService;

    /**
     * SECURITY: Verify the requested organization matches the current tenant context.
     * Users can only access their own organization.
     */
    private void verifyOrganizationAccess(Long organizationId) {
        Long currentOrgId = tenantService.getCurrentOrganizationId().orElse(null);
        if (currentOrgId != null && !currentOrgId.equals(organizationId)) {
            throw new ApiException("Access denied: Cannot access another organization");
        }
    }

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new ApiException("Organization context required"));
    }

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
        // SECURITY: Verify user has access to this organization
        verifyOrganizationAccess(id);
        return organizationRepository.findById(id)
                .map(OrganizationDTO::fromEntity);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Organization> getOrganizationEntityById(Long id) {
        // SECURITY: Verify user has access to this organization
        verifyOrganizationAccess(id);
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
        // NOTE: Access control is handled in the controller (SUPERADMIN check)
        // This method returns all organizations - controller filters based on role
        return organizationRepository.findAll().stream()
                .map(OrganizationDTO::fromEntity)
                .toList();
    }

    @Override
    public OrganizationDTO updateOrganization(Long id, OrganizationDTO dto) {
        log.info("Updating organization ID: {}", id);
        // SECURITY: Verify user has access to update this organization
        verifyOrganizationAccess(id);

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
        // SECURITY: Verify user has access to delete this organization
        verifyOrganizationAccess(id);

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
        // SECURITY: Users can only search within their own organization
        Long currentOrgId = tenantService.getCurrentOrganizationId().orElse(null);
        if (currentOrgId != null) {
            return organizationRepository.findById(currentOrgId)
                    .filter(org -> org.getName().toLowerCase().contains(query.toLowerCase()) ||
                                   org.getSlug().toLowerCase().contains(query.toLowerCase()))
                    .map(org -> List.of(OrganizationDTO.fromEntity(org)))
                    .orElse(List.of());
        }
        // Only system-level operations can search all
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
        // SECURITY: Verify user has access to this organization
        verifyOrganizationAccess(id);

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
        // SECURITY: Verify user has access to this organization
        verifyOrganizationAccess(id);

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
        // SECURITY: Verify user has access to this organization
        verifyOrganizationAccess(id);

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

    @Override
    @Transactional(readOnly = true)
    public Page<OrganizationDTO> getAllOrganizationsPaginated(Pageable pageable) {
        // NOTE: Access control is handled in the controller (SUPERADMIN check)
        // This method returns all organizations - controller filters based on role
        return organizationRepository.findAll(pageable)
                .map(OrganizationDTO::fromEntity);
    }

    @Override
    @Transactional(readOnly = true)
    public OrganizationStatsDTO getOrganizationStats(Long organizationId) {
        // SECURITY: Verify user has access to this organization
        verifyOrganizationAccess(organizationId);

        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ApiException("Organization not found with ID: " + organizationId));

        Integer userCount = getUserCountByOrganization(organizationId);
        Integer caseCount = getCaseCountByOrganization(organizationId);
        Integer documentCount = getDocumentCountByOrganization(organizationId);
        Integer clientCount = getClientCountByOrganization(organizationId);

        PlanQuotaDTO quota = PlanQuotaDTO.forPlanType(org.getPlanType());

        // Calculate usage percentages
        Double userUsagePercent = quota.getMaxUsers() > 0 && quota.getMaxUsers() != Integer.MAX_VALUE
                ? (userCount.doubleValue() / quota.getMaxUsers()) * 100 : 0.0;
        Double caseUsagePercent = quota.getMaxCases() > 0 && quota.getMaxCases() != Integer.MAX_VALUE
                ? (caseCount.doubleValue() / quota.getMaxCases()) * 100 : 0.0;

        return OrganizationStatsDTO.builder()
                .organizationId(organizationId)
                .organizationName(org.getName())
                .userCount(userCount)
                .activeUserCount(userCount) // For now, same as total
                .caseCount(caseCount)
                .activeCaseCount(caseCount) // For now, same as total
                .documentCount(documentCount)
                .storageUsedBytes(0L) // TODO: Calculate actual storage usage
                .clientCount(clientCount)
                .planQuota(quota)
                .userUsagePercent(userUsagePercent)
                .caseUsagePercent(caseUsagePercent)
                .storageUsagePercent(0.0) // TODO: Calculate actual storage percentage
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public Integer getUserCountByOrganization(Long organizationId) {
        // Count users belonging to this organization
        return organizationRepository.countUsersByOrganizationId(organizationId);
    }

    @Override
    @Transactional(readOnly = true)
    public Integer getCaseCountByOrganization(Long organizationId) {
        // Count cases belonging to this organization
        return organizationRepository.countCasesByOrganizationId(organizationId);
    }

    @Override
    @Transactional(readOnly = true)
    public Integer getDocumentCountByOrganization(Long organizationId) {
        // Count documents belonging to this organization
        return organizationRepository.countDocumentsByOrganizationId(organizationId);
    }

    @Override
    @Transactional(readOnly = true)
    public Integer getClientCountByOrganization(Long organizationId) {
        // Count clients belonging to this organization
        return organizationRepository.countClientsByOrganizationId(organizationId);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserDTO> getUsersByOrganization(Long organizationId, Pageable pageable) {
        // Verify organization exists
        if (!organizationRepository.existsById(organizationId)) {
            throw new ApiException("Organization not found with ID: " + organizationId);
        }

        // Get total count
        TypedQuery<Long> countQuery = entityManager.createQuery(
                "SELECT COUNT(u) FROM User u WHERE u.organizationId = :orgId", Long.class);
        countQuery.setParameter("orgId", organizationId);
        long totalCount = countQuery.getSingleResult();

        // Get users with pagination
        TypedQuery<User> query = entityManager.createQuery(
                "SELECT u FROM User u WHERE u.organizationId = :orgId ORDER BY u.lastName, u.firstName", User.class);
        query.setParameter("orgId", organizationId);
        query.setFirstResult((int) pageable.getOffset());
        query.setMaxResults(pageable.getPageSize());

        List<User> users = query.getResultList();

        // Convert to DTOs
        List<UserDTO> userDTOs = users.stream()
                .map(this::convertToUserDTO)
                .collect(Collectors.toList());

        return new PageImpl<>(userDTOs, pageable, totalCount);
    }

    private UserDTO convertToUserDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setEmail(user.getEmail());
        dto.setPhone(user.getPhone());
        dto.setTitle(user.getTitle());
        dto.setEnabled(user.isEnabled());
        dto.setNotLocked(user.isNotLocked());
        dto.setUsingMFA(user.isUsingMFA());
        dto.setImageUrl(user.getImageUrl());
        dto.setCreatedAt(user.getCreatedAt());
        return dto;
    }
}
