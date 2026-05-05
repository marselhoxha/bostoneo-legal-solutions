package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.PICommunicationDTO;
import com.bostoneo.bostoneosolutions.dto.PICommunicationHealthDTO;
import com.bostoneo.bostoneosolutions.exception.ResourceNotFoundException;
import com.bostoneo.bostoneosolutions.model.PICommunication;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.PICommunicationRepository;
import com.bostoneo.bostoneosolutions.service.PICommunicationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * P9e — Implementation of PI Communication service.
 *
 * Mirrors PISettlementEventServiceImpl: every read/write enforces the org
 * tenant filter via TenantService. Communications do NOT trigger
 * caseStageService recompute (unlike settlement events) — they're
 * informational and don't drive stage transitions.
 */
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class PICommunicationServiceImpl implements PICommunicationService {

    private final PICommunicationRepository repository;
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public List<PICommunicationDTO> getByCaseId(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return repository.findByCaseIdAndOrganizationIdOrderByEventDateDesc(caseId, orgId)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public PICommunicationDTO getById(Long id) {
        Long orgId = getRequiredOrganizationId();
        PICommunication entity = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Communication not found: " + id));
        return mapToDTO(entity);
    }

    @Override
    public PICommunicationDTO create(Long caseId, PICommunicationDTO dto) {
        Long orgId = getRequiredOrganizationId();
        Long userId = tenantService.getCurrentUserId().orElse(null);
        log.info("Creating communication for case {} in org {}", caseId, orgId);

        PICommunication entity = mapToEntity(dto);
        entity.setCaseId(caseId);
        entity.setOrganizationId(orgId);
        if (entity.getEventDate() == null) {
            entity.setEventDate(LocalDateTime.now());
        }
        if (entity.getCreatedBy() == null && userId != null) {
            entity.setCreatedBy(userId);
        }

        PICommunication saved = repository.save(entity);
        return mapToDTO(saved);
    }

    @Override
    public PICommunicationDTO update(Long id, PICommunicationDTO dto) {
        Long orgId = getRequiredOrganizationId();
        PICommunication entity = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Communication not found: " + id));

        // Partial update — only overwrite fields the client sent.
        if (dto.getType() != null) entity.setType(dto.getType());
        if (dto.getDirection() != null) entity.setDirection(dto.getDirection());
        if (dto.getCounterparty() != null) entity.setCounterparty(dto.getCounterparty());
        if (dto.getSubject() != null) entity.setSubject(dto.getSubject());
        if (dto.getSummary() != null) entity.setSummary(dto.getSummary());
        if (dto.getEventDate() != null) entity.setEventDate(dto.getEventDate());

        PICommunication saved = repository.save(entity);
        return mapToDTO(saved);
    }

    @Override
    public void delete(Long id) {
        Long orgId = getRequiredOrganizationId();
        PICommunication entity = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Communication not found: " + id));
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

    // ===== Mapping =====

    // createdByName is intentionally left null here, mirroring
    // PISettlementEventServiceImpl. If/when the timeline shows author labels
    // at the row level, replace this with a batched UserRepository fetch in
    // getByCaseId rather than a per-row lookup.
    private PICommunicationDTO mapToDTO(PICommunication entity) {
        return PICommunicationDTO.builder()
                .id(entity.getId())
                .caseId(entity.getCaseId())
                .organizationId(entity.getOrganizationId())
                .type(entity.getType())
                .direction(entity.getDirection())
                .counterparty(entity.getCounterparty())
                .subject(entity.getSubject())
                .summary(entity.getSummary())
                .eventDate(entity.getEventDate())
                .createdAt(entity.getCreatedAt())
                .createdBy(entity.getCreatedBy())
                .build();
    }

    private PICommunication mapToEntity(PICommunicationDTO dto) {
        return PICommunication.builder()
                .type(dto.getType())
                .direction(dto.getDirection())
                .counterparty(dto.getCounterparty())
                .subject(dto.getSubject())
                .summary(dto.getSummary())
                .eventDate(dto.getEventDate())
                .createdBy(dto.getCreatedBy())
                .build();
    }

    // ============================================================
    // P5 — Communication Health derivation
    // ============================================================

    private static final int VOLUME_WINDOW_DAYS = 14;
    private static final int RESPONSE_WINDOW_DAYS = 30;
    private static final int AWAITING_ITEM_LIMIT = 5;

    @Override
    public PICommunicationHealthDTO getCommunicationHealth(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        // Repository is already tenant-isolated and orders newest-first; the
        // derivation below assumes that order to compute "latest inbound vs
        // any later outbound" without re-sorting.
        List<PICommunication> all = repository
                .findByCaseIdAndOrganizationIdOrderByEventDateDesc(caseId, orgId);

        if (all.isEmpty()) {
            // Cold-start safe default — every numeric is 0 and every map
            // is empty so the frontend's "All caught up" / zero-state is
            // straightforward.
            return PICommunicationHealthDTO.builder()
                    .avgResponseHours(null)
                    .lastInboundAt(null)
                    .awaitingReplyCount(0)
                    .oldestAwaitingAgeHours(null)
                    .awaitingItems(new ArrayList<>())
                    .volume14d(0)
                    .typeBreakdown(new HashMap<>())
                    .channelBreakdown(new HashMap<>())
                    .build();
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime volumeCutoff = now.minusDays(VOLUME_WINDOW_DAYS);
        LocalDateTime responseCutoff = now.minusDays(RESPONSE_WINDOW_DAYS);

        // Latest inbound across all parties.
        LocalDateTime lastInbound = all.stream()
                .filter(c -> "IN".equalsIgnoreCase(c.getDirection()))
                .map(PICommunication::getEventDate)
                .max(Comparator.naturalOrder())
                .orElse(null);

        // Avg response time: pair each inbound with the *next* outbound to
        // the same counterparty (chronologically after it). Restrict to the
        // last 30 days so old stale pairs don't drag the average. Returns
        // null if no pair exists in the window — frontend renders "—" then.
        Double avgResponseHours = computeAvgResponseHours(all, responseCutoff);

        // Awaiting reply: per-counterparty, take the latest inbound; if no
        // outbound to that counterparty is more recent, it's awaiting.
        AwaitingResult awaiting = computeAwaitingReply(all, now);

        // 14-day volume + breakdowns by type.
        List<PICommunication> recent = all.stream()
                .filter(c -> c.getEventDate() != null
                        && c.getEventDate().isAfter(volumeCutoff))
                .collect(Collectors.toList());

        Map<String, Integer> typeBreakdown = new TreeMap<>();
        for (PICommunication c : recent) {
            String type = c.getType() != null ? c.getType() : "OTHER";
            typeBreakdown.merge(type, 1, Integer::sum);
        }

        return PICommunicationHealthDTO.builder()
                .avgResponseHours(avgResponseHours)
                .lastInboundAt(lastInbound)
                .awaitingReplyCount(awaiting.count)
                .oldestAwaitingAgeHours(awaiting.oldestAgeHours)
                .awaitingItems(awaiting.items)
                .volume14d(recent.size())
                .typeBreakdown(typeBreakdown)
                // channelBreakdown intentionally aliases typeBreakdown until
                // the comm entity grows a dedicated channel column.
                .channelBreakdown(new TreeMap<>(typeBreakdown))
                .build();
    }

    private Double computeAvgResponseHours(List<PICommunication> all, LocalDateTime cutoff) {
        // 'all' is newest-first per the repository's ORDER BY clause — we
        // walk backwards (oldest to newest within the window) so each
        // inbound is checked against subsequent outbounds.
        List<PICommunication> windowed = all.stream()
                .filter(c -> c.getEventDate() != null
                        && c.getEventDate().isAfter(cutoff))
                .sorted(Comparator.comparing(PICommunication::getEventDate))
                .collect(Collectors.toList());

        long pairCount = 0;
        long totalHours = 0;

        // Each outbound can be claimed by AT MOST one inbound (the
        // chronologically earliest one to it). Without this, two consecutive
        // inbounds from the same party that share a single reply would both
        // pair to that reply — counting one human reply as two pairs and
        // inflating the average. Adjuster sends two emails Mon 9am and Mon
        // 3pm, you reply Tue 9am: one human response, not two.
        Set<Integer> claimedOutbounds = new HashSet<>();

        for (int i = 0; i < windowed.size(); i++) {
            PICommunication candidate = windowed.get(i);
            if (!"IN".equalsIgnoreCase(candidate.getDirection())) continue;

            String party = normalizeParty(candidate.getCounterparty());
            if (party.isEmpty()) continue;

            // Next unclaimed outbound to same counterparty after this inbound.
            for (int j = i + 1; j < windowed.size(); j++) {
                if (claimedOutbounds.contains(j)) continue;
                PICommunication next = windowed.get(j);
                if (!"OUT".equalsIgnoreCase(next.getDirection())) continue;
                if (!normalizeParty(next.getCounterparty()).equals(party)) continue;

                long hrs = Duration.between(candidate.getEventDate(), next.getEventDate())
                        .toHours();
                if (hrs >= 0) {
                    pairCount++;
                    totalHours += hrs;
                    claimedOutbounds.add(j);
                }
                break; // only count the FIRST reply, not every subsequent outbound
            }
        }

        return pairCount == 0 ? null : ((double) totalHours) / pairCount;
    }

    private AwaitingResult computeAwaitingReply(List<PICommunication> all, LocalDateTime now) {
        AwaitingResult result = new AwaitingResult();

        // Per-counterparty: latest inbound + latest outbound. If latest
        // outbound is missing or older than latest inbound, party is
        // awaiting reply. 'all' is newest-first so the first match per
        // direction-per-party wins.
        Map<String, PICommunication> latestInbound = new HashMap<>();
        Map<String, PICommunication> latestOutbound = new HashMap<>();
        Map<String, String> displayNames = new HashMap<>();

        for (PICommunication c : all) {
            String key = normalizeParty(c.getCounterparty());
            if (key.isEmpty()) continue;
            displayNames.putIfAbsent(key, c.getCounterparty());

            if ("IN".equalsIgnoreCase(c.getDirection())) {
                latestInbound.putIfAbsent(key, c);
            } else if ("OUT".equalsIgnoreCase(c.getDirection())) {
                latestOutbound.putIfAbsent(key, c);
            }
        }

        for (Map.Entry<String, PICommunication> e : latestInbound.entrySet()) {
            PICommunication inbound = e.getValue();
            PICommunication outbound = latestOutbound.get(e.getKey());

            boolean awaiting = outbound == null
                    || (inbound.getEventDate() != null
                        && outbound.getEventDate() != null
                        && inbound.getEventDate().isAfter(outbound.getEventDate()));

            if (!awaiting) continue;
            if (inbound.getEventDate() == null) continue;

            double ageHours = Duration.between(inbound.getEventDate(), now).toHours();
            result.count++;
            result.items.add(PICommunicationHealthDTO.AwaitingItem.builder()
                    .name(displayNames.get(e.getKey()))
                    .ageHours(ageHours)
                    .build());

            if (result.oldestAgeHours == null || ageHours > result.oldestAgeHours) {
                result.oldestAgeHours = ageHours;
            }
        }

        // Sort items oldest-first and trim to the card-display cap.
        result.items.sort(Comparator
                .comparing((PICommunicationHealthDTO.AwaitingItem ai) -> ai.getAgeHours())
                .reversed());
        if (result.items.size() > AWAITING_ITEM_LIMIT) {
            result.items = new ArrayList<>(result.items.subList(0, AWAITING_ITEM_LIMIT));
        }
        return result;
    }

    /** Lowercase + trim for "is this the same party?" comparisons. Empty if blank. */
    private String normalizeParty(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }

    private static class AwaitingResult {
        int count = 0;
        Double oldestAgeHours = null;
        List<PICommunicationHealthDTO.AwaitingItem> items = new ArrayList<>();
    }
}
