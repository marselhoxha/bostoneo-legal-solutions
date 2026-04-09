package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.Attorney;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.repository.AttorneyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

import static java.time.LocalDateTime.now;

/**
 * Attorney professional profile — bar number, office info, fax, etc.
 * Used by the settings profile page to manage attorney-specific fields.
 */
@RestController
@RequestMapping("/api/attorney-profile")
@RequiredArgsConstructor
@Slf4j
public class AttorneyProfileController {

    private final AttorneyRepository attorneyRepository;

    /**
     * Get the current user's attorney profile (or empty if not an attorney / no profile yet)
     */
    @GetMapping
    public ResponseEntity<HttpResponse> getProfile(@AuthenticationPrincipal UserDTO user) {
        Long orgId = TenantContext.getCurrentTenant();
        if (orgId == null || user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Attorney attorney = attorneyRepository.findByUserIdAndOrganizationId(user.getId(), orgId)
                .orElse(null);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("attorney", attorney != null ? attorney : Map.of()))
                        .message(attorney != null ? "Attorney profile found" : "No attorney profile")
                        .status(HttpStatus.OK)
                        .statusCode(HttpStatus.OK.value())
                        .build()
        );
    }

    /**
     * Save/update the current user's attorney profile
     */
    @PutMapping
    public ResponseEntity<HttpResponse> saveProfile(
            @AuthenticationPrincipal UserDTO user,
            @RequestBody Map<String, Object> payload) {
        Long orgId = TenantContext.getCurrentTenant();
        if (orgId == null || user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Attorney attorney = attorneyRepository.findByUserIdAndOrganizationId(user.getId(), orgId)
                .orElse(Attorney.builder()
                        .userId(user.getId())
                        .organizationId(orgId)
                        .isActive(true)
                        .build());

        // Update fields from payload
        if (payload.containsKey("barNumber")) attorney.setBarNumber((String) payload.get("barNumber"));
        if (payload.containsKey("licenseState")) attorney.setLicenseState((String) payload.get("licenseState"));
        if (payload.containsKey("directPhone")) attorney.setDirectPhone((String) payload.get("directPhone"));
        if (payload.containsKey("fax")) attorney.setFax((String) payload.get("fax"));
        if (payload.containsKey("officeStreet")) attorney.setOfficeStreet((String) payload.get("officeStreet"));
        if (payload.containsKey("officeSuite")) attorney.setOfficeSuite((String) payload.get("officeSuite"));
        if (payload.containsKey("officeCity")) attorney.setOfficeCity((String) payload.get("officeCity"));
        if (payload.containsKey("officeState")) attorney.setOfficeState((String) payload.get("officeState"));
        if (payload.containsKey("officeZip")) attorney.setOfficeZip((String) payload.get("officeZip"));
        if (payload.containsKey("firmName")) attorney.setFirmName((String) payload.get("firmName"));
        if (payload.containsKey("practiceAreas")) attorney.setPracticeAreas((String) payload.get("practiceAreas"));
        if (payload.containsKey("education")) attorney.setEducation((String) payload.get("education"));
        if (payload.containsKey("certifications")) attorney.setCertifications((String) payload.get("certifications"));
        if (payload.containsKey("languages")) attorney.setLanguages((String) payload.get("languages"));

        Attorney saved = attorneyRepository.save(attorney);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("attorney", saved))
                        .message("Attorney profile updated successfully")
                        .status(HttpStatus.OK)
                        .statusCode(HttpStatus.OK.value())
                        .build()
        );
    }
}
