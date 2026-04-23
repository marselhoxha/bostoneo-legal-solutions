package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.model.StateCourtConfiguration;
import com.bostoneo.bostoneosolutions.repository.StateCourtConfigurationRepository;
import com.bostoneo.bostoneosolutions.service.DocumentTemplateEngine;
import com.bostoneo.bostoneosolutions.util.CustomHttpResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/admin/state-court-configs")
@PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_SUPERADMIN')")
@RequiredArgsConstructor
@Slf4j
public class StateCourtConfigController {

    private final StateCourtConfigurationRepository configRepository;
    private final DocumentTemplateEngine documentTemplateEngine;

    @GetMapping
    public ResponseEntity<CustomHttpResponse<List<StateCourtConfiguration>>> getAllConfigs(
            @RequestParam(required = false) String stateCode) {
        try {
            List<StateCourtConfiguration> configs;
            if (stateCode != null && !stateCode.isBlank()) {
                configs = configRepository.findByStateCodeAndIsActiveTrue(stateCode.toUpperCase().trim());
            } else {
                configs = configRepository.findByIsActiveTrue();
            }
            return ResponseEntity.ok(new CustomHttpResponse<>("State court configurations retrieved", configs));
        } catch (Exception e) {
            log.error("Error retrieving state court configs", e);
            return ResponseEntity.badRequest()
                    .body(new CustomHttpResponse<>(400, "Failed to retrieve configs: " + e.getMessage(), null));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<CustomHttpResponse<StateCourtConfiguration>> getConfigById(@PathVariable Long id) {
        try {
            StateCourtConfiguration config = configRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Config not found with id: " + id));
            return ResponseEntity.ok(new CustomHttpResponse<>("Config retrieved", config));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new CustomHttpResponse<>(404, e.getMessage(), null));
        } catch (Exception e) {
            log.error("Error retrieving config id={}", id, e);
            return ResponseEntity.badRequest()
                    .body(new CustomHttpResponse<>(500, "Failed to retrieve config: " + e.getMessage(), null));
        }
    }

    @PutMapping("/{id}")
    @AuditLog(action = "UPDATE", entityType = "STATE_COURT_CONFIG", description = "Updated state court configuration")
    public ResponseEntity<CustomHttpResponse<StateCourtConfiguration>> updateConfig(
            @PathVariable Long id,
            @RequestBody StateCourtConfiguration updates) {
        try {
            StateCourtConfiguration existing = configRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Config not found with id: " + id));

            // Update fields (stateCode and courtLevel are immutable on update)
            if (updates.getStateName() != null) existing.setStateName(updates.getStateName());
            if (updates.getCourtDisplayName() != null) existing.setCourtDisplayName(updates.getCourtDisplayName());
            if (updates.getCaptionTemplateHtml() != null) existing.setCaptionTemplateHtml(updates.getCaptionTemplateHtml());
            if (updates.getCaptionSeparator() != null) existing.setCaptionSeparator(updates.getCaptionSeparator());
            if (updates.getCauseNumberLabel() != null) existing.setCauseNumberLabel(updates.getCauseNumberLabel());
            if (updates.getBarNumberPrefix() != null) existing.setBarNumberPrefix(updates.getBarNumberPrefix());
            if (updates.getIsCommonwealth() != null) existing.setIsCommonwealth(updates.getIsCommonwealth());
            if (updates.getPartyLabelStyle() != null) existing.setPartyLabelStyle(updates.getPartyLabelStyle());
            if (updates.getPreambleText() != null) existing.setPreambleText(updates.getPreambleText());
            if (updates.getComesNowFormat() != null) existing.setComesNowFormat(updates.getComesNowFormat());
            if (updates.getPrayerFormat() != null) existing.setPrayerFormat(updates.getPrayerFormat());
            if (updates.getCitationReporters() != null) existing.setCitationReporters(updates.getCitationReporters());
            if (updates.getProceduralRulesRef() != null) existing.setProceduralRulesRef(updates.getProceduralRulesRef());
            if (updates.getConstitutionalRefs() != null) existing.setConstitutionalRefs(updates.getConstitutionalRefs());
            if (updates.getIsActive() != null) existing.setIsActive(updates.getIsActive());
            if (updates.getNotes() != null) existing.setNotes(updates.getNotes());
            existing.setUpdatedAt(LocalDateTime.now());

            StateCourtConfiguration saved = configRepository.save(existing);
            documentTemplateEngine.clearConfigCache();
            log.info("Updated state court config: {} {} (id={})", saved.getStateCode(), saved.getCourtLevel(), id);

            return ResponseEntity.ok(new CustomHttpResponse<>("Config updated successfully", saved));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new CustomHttpResponse<>(404, e.getMessage(), null));
        } catch (Exception e) {
            log.error("Error updating config id={}", id, e);
            return ResponseEntity.badRequest()
                    .body(new CustomHttpResponse<>(500, "Failed to update config: " + e.getMessage(), null));
        }
    }

    @PostMapping
    @AuditLog(action = "CREATE", entityType = "STATE_COURT_CONFIG", description = "Created state court configuration")
    public ResponseEntity<CustomHttpResponse<StateCourtConfiguration>> createConfig(
            @RequestBody StateCourtConfiguration config) {
        try {
            // Check for duplicate stateCode + courtLevel
            if (config.getStateCode() == null || config.getCourtLevel() == null) {
                return ResponseEntity.badRequest()
                        .body(new CustomHttpResponse<>(400, "stateCode and courtLevel are required", null));
            }
            config.setStateCode(config.getStateCode().toUpperCase().trim());
            var existing = configRepository.findByStateCodeAndCourtLevel(
                    config.getStateCode(), config.getCourtLevel());
            if (existing.isPresent()) {
                return ResponseEntity.badRequest()
                        .body(new CustomHttpResponse<>(409, "Configuration already exists for " +
                                config.getStateCode() + " / " + config.getCourtLevel(), null));
            }

            config.setCreatedAt(LocalDateTime.now());
            config.setUpdatedAt(LocalDateTime.now());
            StateCourtConfiguration saved = configRepository.save(config);
            documentTemplateEngine.clearConfigCache();
            log.info("Created state court config: {} {}", saved.getStateCode(), saved.getCourtLevel());

            return ResponseEntity.ok(new CustomHttpResponse<>("Config created successfully", saved));
        } catch (Exception e) {
            log.error("Error creating config", e);
            return ResponseEntity.badRequest()
                    .body(new CustomHttpResponse<>(500, "Failed to create config: " + e.getMessage(), null));
        }
    }

    @PutMapping("/{id}/verify")
    @AuditLog(action = "UPDATE", entityType = "STATE_COURT_CONFIG", description = "Verified state court configuration")
    public ResponseEntity<CustomHttpResponse<StateCourtConfiguration>> verifyConfig(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails user) {
        try {
            StateCourtConfiguration config = configRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Config not found with id: " + id));

            config.setIsVerified(true);
            config.setVerifiedBy(user != null ? user.getUsername() : "unknown");
            config.setVerifiedAt(LocalDateTime.now());
            config.setUpdatedAt(LocalDateTime.now());

            StateCourtConfiguration saved = configRepository.save(config);
            log.info("Verified state court config: {} {} by {}", saved.getStateCode(), saved.getCourtLevel(), saved.getVerifiedBy());

            return ResponseEntity.ok(new CustomHttpResponse<>("Config verified successfully", saved));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new CustomHttpResponse<>(404, e.getMessage(), null));
        } catch (Exception e) {
            log.error("Error verifying config id={}", id, e);
            return ResponseEntity.badRequest()
                    .body(new CustomHttpResponse<>(500, "Failed to verify config: " + e.getMessage(), null));
        }
    }
}
