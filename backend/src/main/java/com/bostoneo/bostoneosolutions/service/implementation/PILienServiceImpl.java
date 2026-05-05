package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.PILienDTO;
import com.bostoneo.bostoneosolutions.exception.ResourceNotFoundException;
import com.bostoneo.bostoneosolutions.model.PILien;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.PILienRepository;
import com.bostoneo.bostoneosolutions.service.PILienService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * P10.c — Implementation of PILienService.
 *
 * Mirrors PICommunicationServiceImpl: every read/write enforces the org
 * tenant filter via TenantService. Status transitions auto-set the
 * `resolvedDate` when status flips to RESOLVED so the closing-statement
 * generator doesn't have to derive it.
 */
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class PILienServiceImpl implements PILienService {

    private final PILienRepository repository;
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public List<PILienDTO> getByCaseId(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return repository.findByCaseIdAndOrganizationIdOrderByStatusAscHolderAsc(caseId, orgId)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public PILienDTO getById(Long id) {
        Long orgId = getRequiredOrganizationId();
        PILien entity = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Lien not found: " + id));
        return mapToDTO(entity);
    }

    @Override
    public PILienDTO create(Long caseId, PILienDTO dto) {
        Long orgId = getRequiredOrganizationId();
        Long userId = tenantService.getCurrentUserId().orElse(null);
        log.info("Creating lien for case {} in org {}", caseId, orgId);

        PILien entity = mapToEntity(dto);
        entity.setCaseId(caseId);
        entity.setOrganizationId(orgId);
        if (entity.getStatus() == null || entity.getStatus().isBlank()) {
            entity.setStatus("OPEN");
        }
        if (entity.getCreatedBy() == null && userId != null) {
            entity.setCreatedBy(userId);
        }

        PILien saved = repository.save(entity);
        return mapToDTO(saved);
    }

    @Override
    public PILienDTO update(Long id, PILienDTO dto) {
        Long orgId = getRequiredOrganizationId();
        PILien entity = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Lien not found: " + id));

        if (dto.getHolder() != null)            entity.setHolder(dto.getHolder());
        if (dto.getType() != null)              entity.setType(dto.getType());
        if (dto.getOriginalAmount() != null)    entity.setOriginalAmount(dto.getOriginalAmount());
        if (dto.getNegotiatedAmount() != null)  entity.setNegotiatedAmount(dto.getNegotiatedAmount());
        if (dto.getNotes() != null)             entity.setNotes(dto.getNotes());
        if (dto.getAssertedDate() != null)      entity.setAssertedDate(dto.getAssertedDate());

        // Status transitions auto-stamp / clear resolvedDate so the closing
        // statement always has a reliable signal of when liens were finalized.
        if (dto.getStatus() != null) {
            String prev = entity.getStatus();
            entity.setStatus(dto.getStatus());
            if ("RESOLVED".equals(dto.getStatus()) && !"RESOLVED".equals(prev) && entity.getResolvedDate() == null) {
                entity.setResolvedDate(LocalDate.now());
            }
            if (!"RESOLVED".equals(dto.getStatus()) && "RESOLVED".equals(prev)) {
                entity.setResolvedDate(null);
            }
        }
        // Allow explicit overrides of resolvedDate too (e.g. backdating an entry).
        if (dto.getResolvedDate() != null) entity.setResolvedDate(dto.getResolvedDate());

        PILien saved = repository.save(entity);
        return mapToDTO(saved);
    }

    @Override
    public void delete(Long id) {
        Long orgId = getRequiredOrganizationId();
        PILien entity = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Lien not found: " + id));
        repository.delete(entity);
    }

    @Override
    public void deleteAllByCaseId(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        repository.deleteByCaseIdAndOrganizationId(caseId, orgId);
    }

    @Override
    public long countByCaseId(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return repository.countByCaseIdAndOrganizationId(caseId, orgId);
    }

    @Override
    public BigDecimal getEffectiveTotal(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        BigDecimal total = repository.sumEffectiveByCase(caseId, orgId);
        return total != null ? total : BigDecimal.ZERO;
    }

    // ===== Mapping =====

    private PILienDTO mapToDTO(PILien entity) {
        return PILienDTO.builder()
                .id(entity.getId())
                .caseId(entity.getCaseId())
                .organizationId(entity.getOrganizationId())
                .holder(entity.getHolder())
                .type(entity.getType())
                .originalAmount(entity.getOriginalAmount())
                .negotiatedAmount(entity.getNegotiatedAmount())
                .status(entity.getStatus())
                .notes(entity.getNotes())
                .assertedDate(entity.getAssertedDate())
                .resolvedDate(entity.getResolvedDate())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .createdBy(entity.getCreatedBy())
                .build();
    }

    private PILien mapToEntity(PILienDTO dto) {
        return PILien.builder()
                .holder(dto.getHolder())
                .type(dto.getType())
                .originalAmount(dto.getOriginalAmount())
                .negotiatedAmount(dto.getNegotiatedAmount())
                .status(dto.getStatus() != null ? dto.getStatus() : "OPEN")
                .notes(dto.getNotes())
                .assertedDate(dto.getAssertedDate())
                .resolvedDate(dto.getResolvedDate())
                .createdBy(dto.getCreatedBy())
                .build();
    }
}
