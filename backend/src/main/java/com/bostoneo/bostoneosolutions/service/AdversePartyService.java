package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.AdversePartyDTO;
import com.bostoneo.bostoneosolutions.dtomapper.AdversePartyDTOMapper;
import com.bostoneo.bostoneosolutions.model.AdverseParty;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.AdversePartyRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * CRUD for {@link AdverseParty} records scoped to a legal case.
 *
 * <p>Multi-tenant rules are enforced here: every read filters by current
 * organization, every write stamps the current organization, and every update/
 * delete verifies the entity belongs to the current organization before
 * touching it. Calls bypassing these guards are bugs.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class AdversePartyService {

    private final AdversePartyRepository repository;
    private final TenantService tenantService;

    /** Tenant-filtered list for a case. */
    @Transactional(readOnly = true)
    public List<AdversePartyDTO> getPartiesForCase(Long caseId) {
        Long orgId = tenantService.requireCurrentOrganizationId();
        return repository.findByOrganizationIdAndCaseId(orgId, caseId).stream()
                .map(AdversePartyDTOMapper::toDTO)
                .toList();
    }

    /** Create a party against the given case. orgId/caseId come from server context. */
    public AdversePartyDTO createParty(Long caseId, AdversePartyDTO dto) {
        Long orgId = tenantService.requireCurrentOrganizationId();
        if (dto.getName() == null || dto.getName().isBlank()) {
            throw new IllegalArgumentException("Party name is required");
        }
        if (dto.getPartyType() == null || dto.getPartyType().isBlank()) {
            throw new IllegalArgumentException("Party type is required");
        }
        AdverseParty entity = AdversePartyDTOMapper.toEntity(dto);
        entity.setId(null);                      // never trust client id
        entity.setOrganizationId(orgId);
        entity.setCaseId(caseId);
        AdverseParty saved = repository.save(entity);
        return AdversePartyDTOMapper.toDTO(saved);
    }

    /** Update an existing party. Cross-tenant access throws. */
    public AdversePartyDTO updateParty(Long partyId, AdversePartyDTO dto) {
        AdverseParty existing = loadAndVerify(partyId);
        AdversePartyDTOMapper.applyEditableFields(dto, existing);
        AdverseParty saved = repository.save(existing);
        return AdversePartyDTOMapper.toDTO(saved);
    }

    /** Delete a party. Cross-tenant access throws. */
    public void deleteParty(Long partyId) {
        AdverseParty existing = loadAndVerify(partyId);
        repository.delete(existing);
    }

    /** Load a party and verify it belongs to the current tenant. */
    private AdverseParty loadAndVerify(Long partyId) {
        AdverseParty party = repository.findById(partyId)
                .orElseThrow(() -> new EntityNotFoundException("Party not found: " + partyId));
        tenantService.verifyTenantAccess(party.getOrganizationId());
        return party;
    }
}
