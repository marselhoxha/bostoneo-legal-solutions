package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.AttorneyInfoDTO;
import com.bostoneo.bostoneosolutions.dto.StationeryRenderResponse;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.AIStyleGuide;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.service.StationeryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

@PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_SYSADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_ATTORNEY')")
@RestController
@RequestMapping("/api/legal/stationery")
@RequiredArgsConstructor
@Slf4j
public class StationeryController {

    private final StationeryService stationeryService;

    @GetMapping("/templates")
    public ResponseEntity<List<AIStyleGuide>> getTemplates() {
        Long orgId = TenantContext.getCurrentTenant();
        if (orgId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(stationeryService.getTemplates(orgId));
    }

    @GetMapping("/templates/{id}")
    public ResponseEntity<AIStyleGuide> getTemplate(@PathVariable Long id) {
        Long orgId = TenantContext.getCurrentTenant();
        if (orgId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(stationeryService.getTemplate(id, orgId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/templates")
    public ResponseEntity<AIStyleGuide> createTemplate(
            @RequestBody AIStyleGuide template,
            @AuthenticationPrincipal UserDTO userDto) {
        Long orgId = TenantContext.getCurrentTenant();
        if (orgId == null || userDto == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        template.setId(null); // force create
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(stationeryService.saveTemplate(template, orgId, userDto.getId()));
    }

    @PutMapping("/templates/{id}")
    public ResponseEntity<AIStyleGuide> updateTemplate(
            @PathVariable Long id,
            @RequestBody AIStyleGuide template,
            @AuthenticationPrincipal UserDTO userDto) {
        Long orgId = TenantContext.getCurrentTenant();
        if (orgId == null || userDto == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            template.setId(id);
            return ResponseEntity.ok(stationeryService.saveTemplate(template, orgId, userDto.getId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/templates/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id) {
        Long orgId = TenantContext.getCurrentTenant();
        if (orgId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            stationeryService.deleteTemplate(id, orgId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/render")
    public ResponseEntity<?> renderStationery(@RequestBody Map<String, Long> request) {
        Long orgId = TenantContext.getCurrentTenant();
        if (orgId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        Long templateId = request.get("templateId");
        Long attorneyId = request.get("attorneyId");
        if (templateId == null || attorneyId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "templateId and attorneyId are required"));
        }

        try {
            StationeryRenderResponse rendered = stationeryService.renderStationery(templateId, attorneyId, orgId);
            return ResponseEntity.ok(rendered);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/attorneys")
    public ResponseEntity<List<AttorneyInfoDTO>> getAttorneys() {
        Long orgId = TenantContext.getCurrentTenant();
        if (orgId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(stationeryService.getAttorneysForOrg(orgId));
    }

    @GetMapping("/my-attorney")
    public ResponseEntity<AttorneyInfoDTO> getMyAttorneyProfile(@AuthenticationPrincipal UserDTO userDto) {
        Long orgId = TenantContext.getCurrentTenant();
        if (orgId == null || userDto == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        AttorneyInfoDTO profile = stationeryService.getMyAttorneyProfile(userDto.getId(), orgId);
        return profile != null ? ResponseEntity.ok(profile) : ResponseEntity.noContent().build();
    }
}
