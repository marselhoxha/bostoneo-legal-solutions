package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.dto.OrganizationDTO;
import com.bostoneo.bostoneosolutions.dto.OrganizationStatsDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.service.OrganizationService;
import com.bostoneo.bostoneosolutions.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static java.time.LocalDateTime.now;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
@Slf4j
public class OrganizationController {

    private final OrganizationService organizationService;
    private final TenantService tenantService;
    private final FileStorageService fileStorageService;

    /**
     * Common PreAuthorize expression for org-level read access.
     * Includes all admin-tier law firm hierarchy roles that the frontend treats as admin.
     * Inner method checks still enforce own-org-only access for non-SUPERADMIN users.
     */
    private static final String ORG_READ_ACCESS =
        "hasRole('ROLE_SUPERADMIN') or hasRole('ROLE_ADMIN') or hasRole('ROLE_SYSADMIN') " +
        "or hasRole('ROLE_ATTORNEY') or hasRole('ROLE_MANAGING_PARTNER') " +
        "or hasRole('ROLE_SENIOR_PARTNER') or hasRole('ROLE_EQUITY_PARTNER') " +
        "or hasRole('ROLE_COO') or hasRole('ROLE_CFO') " +
        "or hasAuthority('organization:read') or hasAuthority('ORGANIZATION:VIEW')";

    private boolean isSuperAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_SUPERADMIN"));
    }

    /**
     * Get current user's organization ID
     */
    private Long getCurrentOrganizationId() {
        return tenantService.getCurrentOrganizationId().orElse(null);
    }

    /**
     * Get organizations based on user role:
     * - SUPERADMIN: sees ALL organizations
     * - ADMIN/other: sees only their own organization
     */
    @GetMapping
    @PreAuthorize(ORG_READ_ACCESS)
    public ResponseEntity<HttpResponse> getAllOrganizations() {
        List<OrganizationDTO> organizations;

        if (isSuperAdmin()) {
            // SUPERADMIN sees all organizations
            organizations = organizationService.getAllOrganizations();
            log.info("SUPERADMIN accessing all organizations, found: {}", organizations.size());
        } else {
            // Regular admin sees only their own organization
            Long orgId = getCurrentOrganizationId();
            if (orgId != null) {
                organizations = organizationService.getOrganizationById(orgId)
                        .map(Collections::singletonList)
                        .orElse(Collections.emptyList());
                log.info("Admin accessing own organization: {}", orgId);
            } else {
                organizations = Collections.emptyList();
            }
        }

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("organizations", organizations))
                        .message("Organizations retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get organization by ID
     * - SUPERADMIN: can access any organization
     * - ADMIN/other: can only access their own organization
     */
    @GetMapping("/{id}")
    @PreAuthorize(ORG_READ_ACCESS)
    public ResponseEntity<HttpResponse> getOrganizationById(@PathVariable Long id) {
        // Check access: SUPERADMIN can access any, others only their own
        if (!isSuperAdmin()) {
            Long currentOrgId = getCurrentOrganizationId();
            if (currentOrgId == null || !currentOrgId.equals(id)) {
                log.warn("User attempted to access organization {} but belongs to org {}", id, currentOrgId);
                return ResponseEntity.status(FORBIDDEN).body(
                        HttpResponse.builder()
                                .timeStamp(now().toString())
                                .message("Access denied: You can only view your own organization")
                                .status(FORBIDDEN)
                                .statusCode(FORBIDDEN.value())
                                .build()
                );
            }
        }

        var orgOpt = organizationService.getOrganizationById(id);
        if (orgOpt.isPresent()) {
            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(Map.of("organization", orgOpt.get()))
                            .message("Organization retrieved successfully")
                            .status(OK)
                            .statusCode(OK.value())
                            .build()
            );
        }
        return ResponseEntity.status(NOT_FOUND).body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Organization not found")
                        .status(NOT_FOUND)
                        .statusCode(NOT_FOUND.value())
                        .build()
        );
    }

    /**
     * Get organization by slug
     */
    @GetMapping("/slug/{slug}")
    @PreAuthorize("hasAuthority('organization:read') or hasRole('ROLE_ADMIN') or hasRole('ROLE_SYSADMIN')")
    public ResponseEntity<HttpResponse> getOrganizationBySlug(@PathVariable String slug) {
        var orgOpt = organizationService.getOrganizationBySlug(slug);
        if (orgOpt.isPresent()) {
            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(Map.of("organization", orgOpt.get()))
                            .message("Organization retrieved successfully")
                            .status(OK)
                            .statusCode(OK.value())
                            .build()
            );
        }
        return ResponseEntity.status(NOT_FOUND).body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Organization not found")
                        .status(NOT_FOUND)
                        .statusCode(NOT_FOUND.value())
                        .build()
        );
    }

    /**
     * Create new organization (SUPERADMIN only)
     */
    @PostMapping
    @PreAuthorize("hasRole('ROLE_SUPERADMIN')")
    @AuditLog(action = "CREATE", entityType = "ORGANIZATION", description = "Created new organization")
    public ResponseEntity<HttpResponse> createOrganization(@RequestBody OrganizationDTO dto) {
        log.info("SUPERADMIN creating new organization: {}", dto.getName());
        OrganizationDTO created = organizationService.createOrganization(dto);
        return ResponseEntity.status(CREATED).body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("organization", created))
                        .message("Organization created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build()
        );
    }

    /**
     * Update organization
     * - SUPERADMIN: can update any organization
     * - ADMIN: can only update their own organization
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_ADMIN') or hasRole('ROLE_SUPERADMIN')")
    @AuditLog(action = "UPDATE", entityType = "ORGANIZATION", description = "Updated organization")
    public ResponseEntity<HttpResponse> updateOrganization(@PathVariable Long id, @RequestBody OrganizationDTO dto) {
        // Check access: SUPERADMIN can update any, others only their own
        if (!isSuperAdmin()) {
            Long currentOrgId = getCurrentOrganizationId();
            if (currentOrgId == null || !currentOrgId.equals(id)) {
                return ResponseEntity.status(FORBIDDEN).body(
                        HttpResponse.builder()
                                .timeStamp(now().toString())
                                .message("Access denied: You can only update your own organization")
                                .status(FORBIDDEN)
                                .statusCode(FORBIDDEN.value())
                                .build()
                );
            }
            // Non-SUPERADMIN cannot change plan or firm type — strip these fields
            dto.setPlanType(null);
            dto.setPlanExpiresAt(null);
            dto.setFirmType(null);
        }

        log.info("Updating organization ID: {}", id);
        OrganizationDTO updated = organizationService.updateOrganization(id, dto);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("organization", updated))
                        .message("Organization updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Delete organization (SUPERADMIN only)
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_SUPERADMIN')")
    @AuditLog(action = "DELETE", entityType = "ORGANIZATION", description = "Deleted organization")
    public ResponseEntity<HttpResponse> deleteOrganization(@PathVariable Long id) {
        log.info("SUPERADMIN deleting organization ID: {}", id);
        organizationService.deleteOrganization(id);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Organization deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Upload organization logo
     */
    @PostMapping("/{id}/logo")
    @PreAuthorize("hasRole('ROLE_ADMIN') or hasRole('ROLE_SUPERADMIN')")
    public ResponseEntity<HttpResponse> uploadLogo(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        if (!isSuperAdmin()) {
            Long currentOrgId = getCurrentOrganizationId();
            if (currentOrgId == null || !currentOrgId.equals(id)) {
                return ResponseEntity.status(FORBIDDEN).body(
                        HttpResponse.builder().timeStamp(now().toString())
                                .message("Access denied").status(FORBIDDEN).statusCode(FORBIDDEN.value()).build());
            }
        }

        try {
            String extension = file.getOriginalFilename() != null
                    ? file.getOriginalFilename().substring(file.getOriginalFilename().lastIndexOf('.'))
                    : ".png";
            String fileName = "org-" + id + extension;
            fileStorageService.storeFile(file, "org-logos", fileName);

            String logoUrl = "/api/organizations/" + id + "/logo-image";
            OrganizationDTO dto = new OrganizationDTO();
            dto.setLogoUrl(logoUrl);
            organizationService.updateOrganization(id, dto);

            return ResponseEntity.ok(HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(Map.of("logoUrl", logoUrl))
                    .message("Logo uploaded successfully")
                    .status(OK).statusCode(OK.value()).build());
        } catch (IOException e) {
            return ResponseEntity.status(INTERNAL_SERVER_ERROR).body(
                    HttpResponse.builder().timeStamp(now().toString())
                            .message("Failed to upload logo").status(INTERNAL_SERVER_ERROR)
                            .statusCode(INTERNAL_SERVER_ERROR.value()).build());
        }
    }

    /**
     * Serve organization logo image (public — no auth required for img src)
     */
    @GetMapping(value = "/{id}/logo-image", produces = "image/*")
    public ResponseEntity<byte[]> getLogoImage(@PathVariable Long id) {
        try {
            // Try common extensions
            for (String ext : new String[]{".png", ".jpg", ".jpeg", ".svg", ".webp"}) {
                try {
                    Resource resource = fileStorageService.loadFileAsResource("org-logos/org-" + id + ext);
                    if (resource.exists()) {
                        try (java.io.InputStream is = resource.getInputStream()) {
                            return ResponseEntity.ok(is.readAllBytes());
                        }
                    }
                } catch (IOException ignored) {}
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Search organizations
     */
    @GetMapping("/search")
    @PreAuthorize("hasAuthority('organization:read') or hasRole('ROLE_ADMIN') or hasRole('ROLE_SYSADMIN')")
    public ResponseEntity<HttpResponse> searchOrganizations(@RequestParam String query) {
        List<OrganizationDTO> organizations = organizationService.searchOrganizations(query);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("organizations", organizations))
                        .message("Search results retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Check if slug is available
     */
    @GetMapping("/check-slug/{slug}")
    public ResponseEntity<HttpResponse> checkSlugAvailability(@PathVariable String slug) {
        boolean available = organizationService.isSlugAvailable(slug);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("available", available, "slug", slug))
                        .message(available ? "Slug is available" : "Slug is already taken")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Update notification preferences
     */
    @PutMapping("/{id}/notifications")
    @PreAuthorize("hasAuthority('organization:update') or hasRole('ROLE_ADMIN') or hasRole('ROLE_SYSADMIN')")
    public ResponseEntity<HttpResponse> updateNotificationPreferences(
            @PathVariable Long id,
            @RequestParam(required = false) Boolean smsEnabled,
            @RequestParam(required = false) Boolean whatsappEnabled,
            @RequestParam(required = false) Boolean emailEnabled,
            @RequestParam(required = false) Boolean signatureReminderEmail,
            @RequestParam(required = false) Boolean signatureReminderSms,
            @RequestParam(required = false) Boolean signatureReminderWhatsapp,
            @RequestParam(required = false) String signatureReminderDays) {
        if (!isSuperAdmin()) {
            Long currentOrgId = getCurrentOrganizationId();
            if (currentOrgId == null || !currentOrgId.equals(id)) {
                return ResponseEntity.status(FORBIDDEN).body(HttpResponse.builder().timeStamp(now().toString())
                        .reason("Access denied").status(FORBIDDEN).statusCode(FORBIDDEN.value()).build());
            }
        }
        OrganizationDTO updated = organizationService.updateNotificationPreferences(
                id, smsEnabled, whatsappEnabled, emailEnabled,
                signatureReminderEmail, signatureReminderSms, signatureReminderWhatsapp,
                signatureReminderDays
        );

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("organization", updated))
                        .message("Notification preferences updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    // ==================== BoldSign Integration ====================

    @PutMapping("/{id}/boldsign")
    @PreAuthorize(ORG_READ_ACCESS)
    public ResponseEntity<HttpResponse> updateBoldSignSettings(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> body) {
        if (!isSuperAdmin()) {
            Long currentOrgId = getCurrentOrganizationId();
            if (currentOrgId == null || !currentOrgId.equals(id)) {
                return ResponseEntity.status(FORBIDDEN).body(HttpResponse.builder().timeStamp(now().toString())
                        .reason("Access denied").status(FORBIDDEN).statusCode(FORBIDDEN.value()).build());
            }
        }
        String apiKey = body.get("apiKey");
        organizationService.updateBoldSignApiKey(id, apiKey);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message(apiKey != null && !apiKey.isBlank() ? "BoldSign connected successfully" : "BoldSign disconnected")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    @GetMapping("/{id}/boldsign/status")
    @PreAuthorize(ORG_READ_ACCESS)
    public ResponseEntity<HttpResponse> getBoldSignStatus(@PathVariable Long id) {
        boolean configured = organizationService.isBoldSignConfigured(id);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(java.util.Map.of("configured", configured))
                        .message(configured ? "BoldSign is connected" : "BoldSign is not connected")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    @PostMapping("/{id}/boldsign/validate")
    @PreAuthorize(ORG_READ_ACCESS)
    public ResponseEntity<HttpResponse> validateBoldSignKey(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> body) {
        String apiKey = body.get("apiKey");
        if (apiKey == null || apiKey.isBlank()) {
            throw new com.bostoneo.bostoneosolutions.exception.ApiException("API key is required");
        }
        // Test the key by calling BoldSign API
        try {
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.set("X-API-KEY", apiKey);
            org.springframework.http.HttpEntity<String> entity = new org.springframework.http.HttpEntity<>(headers);
            new RestTemplate(new org.springframework.http.client.SimpleClientHttpRequestFactory() {{ setConnectTimeout(java.time.Duration.ofSeconds(10)); setReadTimeout(java.time.Duration.ofSeconds(15)); }}).exchange("https://api.boldsign.com/v1/document/list?Page=1&PageSize=1",
                    org.springframework.http.HttpMethod.GET, entity, String.class);
            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(java.util.Map.of("valid", true))
                            .message("API key is valid")
                            .status(OK)
                            .statusCode(OK.value())
                            .build()
            );
        } catch (Exception e) {
            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(java.util.Map.of("valid", false))
                            .message("Invalid API key")
                            .status(OK)
                            .statusCode(OK.value())
                            .build()
            );
        }
    }

    /**
     * Get paginated list of organizations
     * - SUPERADMIN: sees all organizations
     * - ADMIN/other: sees only their own organization
     */
    @GetMapping("/paginated")
    @PreAuthorize(ORG_READ_ACCESS)
    public ResponseEntity<HttpResponse> getAllOrganizationsPaginated(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {

        String validatedSort = com.bostoneo.bostoneosolutions.util.SortValidator.forOrganizations(sortBy);
        Sort sort = sortDir.equalsIgnoreCase("desc")
                ? Sort.by(validatedSort).descending()
                : Sort.by(validatedSort).ascending();

        Pageable pageable = PageRequest.of(page, size, sort);
        Page<OrganizationDTO> organizations;

        if (isSuperAdmin()) {
            // SUPERADMIN sees all organizations
            organizations = organizationService.getAllOrganizationsPaginated(pageable);
        } else {
            // Regular admin sees only their own organization
            Long orgId = getCurrentOrganizationId();
            if (orgId != null) {
                List<OrganizationDTO> orgList = organizationService.getOrganizationById(orgId)
                        .map(Collections::singletonList)
                        .orElse(Collections.emptyList());
                organizations = new PageImpl<>(orgList, pageable, orgList.size());
            } else {
                organizations = new PageImpl<>(Collections.emptyList(), pageable, 0);
            }
        }

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of(
                                "organizations", organizations.getContent(),
                                "page", Map.of(
                                        "number", organizations.getNumber(),
                                        "size", organizations.getSize(),
                                        "totalElements", organizations.getTotalElements(),
                                        "totalPages", organizations.getTotalPages()
                                )
                        ))
                        .message("Organizations retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get organization statistics
     * - SUPERADMIN: can access any organization's stats
     * - ADMIN/other: can only access their own organization's stats
     */
    @GetMapping("/{id}/stats")
    @PreAuthorize(ORG_READ_ACCESS)
    public ResponseEntity<HttpResponse> getOrganizationStats(@PathVariable Long id) {
        // Check access: SUPERADMIN can access any, others only their own
        if (!isSuperAdmin()) {
            Long currentOrgId = getCurrentOrganizationId();
            if (currentOrgId == null || !currentOrgId.equals(id)) {
                return ResponseEntity.status(FORBIDDEN).body(
                        HttpResponse.builder()
                                .timeStamp(now().toString())
                                .message("Access denied: You can only view your own organization's statistics")
                                .status(FORBIDDEN)
                                .statusCode(FORBIDDEN.value())
                                .build()
                );
            }
        }

        OrganizationStatsDTO stats = organizationService.getOrganizationStats(id);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("stats", stats))
                        .message("Organization statistics retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Get users belonging to an organization
     * - SUPERADMIN: can access any organization's users
     * - ADMIN/other: can only access their own organization's users
     */
    @GetMapping("/{id}/users")
    @PreAuthorize(ORG_READ_ACCESS)
    public ResponseEntity<HttpResponse> getOrganizationUsers(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        // Check access: SUPERADMIN can access any, others only their own
        if (!isSuperAdmin()) {
            Long currentOrgId = getCurrentOrganizationId();
            if (currentOrgId == null || !currentOrgId.equals(id)) {
                return ResponseEntity.status(FORBIDDEN).body(
                        HttpResponse.builder()
                                .timeStamp(now().toString())
                                .message("Access denied: You can only view your own organization's users")
                                .status(FORBIDDEN)
                                .statusCode(FORBIDDEN.value())
                                .build()
                );
            }
        }

        Pageable pageable = PageRequest.of(page, size);
        var usersPage = organizationService.getUsersByOrganization(id, pageable);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of(
                                "users", usersPage.getContent(),
                                "page", Map.of(
                                        "number", usersPage.getNumber(),
                                        "size", usersPage.getSize(),
                                        "totalElements", usersPage.getTotalElements(),
                                        "totalPages", usersPage.getTotalPages()
                                )
                        ))
                        .message("Organization users retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }
}
