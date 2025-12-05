package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.OrganizationDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

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

    /**
     * Get all organizations (Admin only)
     */
    @GetMapping
    @PreAuthorize("hasAuthority('organization:read') or hasRole('ROLE_ADMIN') or hasRole('ROLE_SYSADMIN')")
    public ResponseEntity<HttpResponse> getAllOrganizations() {
        List<OrganizationDTO> organizations = organizationService.getAllOrganizations();
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
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('organization:read') or hasRole('ROLE_ADMIN') or hasRole('ROLE_SYSADMIN')")
    public ResponseEntity<HttpResponse> getOrganizationById(@PathVariable Long id) {
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
     * Create new organization (Admin only)
     */
    @PostMapping
    @PreAuthorize("hasAuthority('organization:create') or hasRole('ROLE_SYSADMIN')")
    public ResponseEntity<HttpResponse> createOrganization(@RequestBody OrganizationDTO dto) {
        log.info("Creating new organization: {}", dto.getName());
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
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('organization:update') or hasRole('ROLE_ADMIN') or hasRole('ROLE_SYSADMIN')")
    public ResponseEntity<HttpResponse> updateOrganization(@PathVariable Long id, @RequestBody OrganizationDTO dto) {
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
     * Delete organization (Sysadmin only)
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_SYSADMIN')")
    public ResponseEntity<HttpResponse> deleteOrganization(@PathVariable Long id) {
        log.info("Deleting organization ID: {}", id);
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
}
