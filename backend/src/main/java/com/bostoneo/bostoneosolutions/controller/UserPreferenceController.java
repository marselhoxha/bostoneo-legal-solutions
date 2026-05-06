package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.dto.UserPreferenceDTO;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.service.UserPreferenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user-preferences")
@RequiredArgsConstructor
public class UserPreferenceController {

    private final UserPreferenceService service;

    @GetMapping("/me")
    public ResponseEntity<UserPreferenceDTO> getMine(@AuthenticationPrincipal UserDTO user) {
        Long orgId = TenantContext.getCurrentTenant();
        if (user == null || orgId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(service.getMyPreferences(user.getId(), orgId));
    }

    @PutMapping("/me")
    public ResponseEntity<UserPreferenceDTO> updateMine(
            @AuthenticationPrincipal UserDTO user,
            @RequestBody UserPreferenceDTO request) {
        Long orgId = TenantContext.getCurrentTenant();
        if (user == null || orgId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(service.updateMyPreferences(user.getId(), orgId, request));
    }
}
