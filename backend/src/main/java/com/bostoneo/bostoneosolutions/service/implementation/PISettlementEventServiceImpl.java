package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.PISettlementEventDTO;
import com.bostoneo.bostoneosolutions.exception.ResourceNotFoundException;
import com.bostoneo.bostoneosolutions.model.PISettlementEvent;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.PISettlementEventRepository;
import com.bostoneo.bostoneosolutions.service.PISettlementEventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Implementation of PI Settlement Event Service
 */
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class PISettlementEventServiceImpl implements PISettlementEventService {

    private final PISettlementEventRepository eventRepository;
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public List<PISettlementEventDTO> getEventsByCaseId(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting settlement events for case: {} in org: {}", caseId, orgId);

        return eventRepository.findByCaseIdAndOrganizationIdOrderByEventDateAsc(caseId, orgId)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public PISettlementEventDTO getEventById(Long id) {
        Long orgId = getRequiredOrganizationId();
        PISettlementEvent event = eventRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Settlement event not found with ID: " + id));
        return mapToDTO(event);
    }

    @Override
    public PISettlementEventDTO createEvent(Long caseId, PISettlementEventDTO eventDTO) {
        Long orgId = getRequiredOrganizationId();
        log.info("Creating settlement event for case: {} in org: {}", caseId, orgId);

        PISettlementEvent event = mapToEntity(eventDTO);
        event.setCaseId(caseId);
        event.setOrganizationId(orgId);

        // Set event date if not provided
        if (event.getEventDate() == null) {
            event.setEventDate(LocalDateTime.now());
        }

        PISettlementEvent saved = eventRepository.save(event);
        log.info("Settlement event created with ID: {}", saved.getId());
        return mapToDTO(saved);
    }

    @Override
    public void deleteEvent(Long id) {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting settlement event: {} in org: {}", id, orgId);

        PISettlementEvent event = eventRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Settlement event not found with ID: " + id));

        eventRepository.delete(event);
        log.info("Settlement event deleted: {}", id);
    }

    @Override
    public void deleteAllByCaseId(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting all settlement events for case: {} in org: {}", caseId, orgId);

        eventRepository.deleteByCaseIdAndOrganizationId(caseId, orgId);
        log.info("All settlement events deleted for case: {}", caseId);
    }

    @Override
    public long countByCaseId(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return eventRepository.countByCaseIdAndOrganizationId(caseId, orgId);
    }

    // ===== Mapping Methods =====

    private PISettlementEventDTO mapToDTO(PISettlementEvent event) {
        return PISettlementEventDTO.builder()
                .id(event.getId())
                .caseId(event.getCaseId())
                .organizationId(event.getOrganizationId())
                .eventDate(event.getEventDate())
                .demandAmount(event.getDemandAmount())
                .offerAmount(event.getOfferAmount())
                .offerDate(event.getOfferDate())
                .counterAmount(event.getCounterAmount())
                .notes(event.getNotes())
                .createdAt(event.getCreatedAt())
                .createdBy(event.getCreatedBy())
                .build();
    }

    private PISettlementEvent mapToEntity(PISettlementEventDTO dto) {
        return PISettlementEvent.builder()
                .demandAmount(dto.getDemandAmount())
                .offerAmount(dto.getOfferAmount())
                .offerDate(dto.getOfferDate())
                .counterAmount(dto.getCounterAmount())
                .notes(dto.getNotes())
                .eventDate(dto.getEventDate())
                .createdBy(dto.getCreatedBy())
                .build();
    }
}
