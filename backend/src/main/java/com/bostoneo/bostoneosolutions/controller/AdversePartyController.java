package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.AdversePartyDTO;
import com.bostoneo.bostoneosolutions.service.AdversePartyService;
import com.bostoneo.bostoneosolutions.util.CustomHttpResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for adverse parties on a legal case.
 *
 * <p>Path scoped under <code>/api/cases/{caseId}/parties</code> to mirror the
 * frontend's case-centric UX. Tenant filtering happens in the service layer.
 */
@RestController
@RequestMapping("/api/cases/{caseId}/parties")
@RequiredArgsConstructor
@Slf4j
public class AdversePartyController {

    private final AdversePartyService partyService;

    @GetMapping
    @PreAuthorize("hasRole('ROLE_USER') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<List<AdversePartyDTO>>> getParties(
            @PathVariable Long caseId) {
        List<AdversePartyDTO> parties = partyService.getPartiesForCase(caseId);
        return ResponseEntity.ok(new CustomHttpResponse<>("Parties retrieved", parties));
    }

    @PostMapping
    @PreAuthorize("hasRole('ROLE_USER') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<AdversePartyDTO>> createParty(
            @PathVariable Long caseId,
            @Valid @RequestBody AdversePartyDTO dto) {
        AdversePartyDTO saved = partyService.createParty(caseId, dto);
        return ResponseEntity.ok(new CustomHttpResponse<>("Party created", saved));
    }

    @PutMapping("/{partyId}")
    @PreAuthorize("hasRole('ROLE_USER') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<AdversePartyDTO>> updateParty(
            @PathVariable Long caseId,
            @PathVariable Long partyId,
            @Valid @RequestBody AdversePartyDTO dto) {
        AdversePartyDTO saved = partyService.updateParty(partyId, dto);
        return ResponseEntity.ok(new CustomHttpResponse<>("Party updated", saved));
    }

    @DeleteMapping("/{partyId}")
    @PreAuthorize("hasRole('ROLE_USER') or hasRole('ROLE_ADMIN')")
    public ResponseEntity<CustomHttpResponse<Void>> deleteParty(
            @PathVariable Long caseId,
            @PathVariable Long partyId) {
        partyService.deleteParty(partyId);
        return ResponseEntity.ok(new CustomHttpResponse<>("Party deleted", null));
    }
}
