package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.enumeration.ProvenanceSource;
import com.bostoneo.bostoneosolutions.exception.LegalCaseException;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

/**
 * Per-field provenance for the PI case-detail UI markers.
 * <p>
 * Provenance is stored as a JSONB map on {@code legal_cases.field_provenance}
 * keyed by dotted field path (e.g. {@code "parties.plaintiff_dob"} →
 * {@code "INTAKE_FORM"}).
 * <p>
 * <b>Reads</b> happen on case-detail load and surface the i/c/A/m glyph next
 * to each fact in the UI.
 * <p>
 * <b>Writes</b> are service-to-service: {@code IntakeFormService} stamps
 * INTAKE_FORM after a form submit, {@code AiExtractionService} stamps
 * AI_EXTRACTED after a medical-record extraction completes, etc. There is
 * intentionally no public PUT endpoint — markers describe how a fact got
 * there, not user input. Adding a manual override path can come later if a
 * UX need surfaces.
 */
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class ProvenanceService {

    private final LegalCaseRepository legalCaseRepository;
    private final TenantService tenantService;

    /**
     * Reads the full provenance map for a case. Returns an empty map (never
     * null) when the case has no markers yet — UI treats that as "no source
     * known" and renders a neutral dot.
     *
     * @throws LegalCaseException if the case doesn't exist or doesn't belong
     *                            to the current tenant.
     */
    @Transactional(readOnly = true)
    public Map<String, String> getProvenance(Long caseId) {
        Long orgId = requireOrganizationId();
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
                .orElseThrow(() -> new LegalCaseException(
                        "Case not found or not accessible: " + caseId));
        Map<String, String> map = legalCase.getFieldProvenance();
        return map != null ? map : new HashMap<>();
    }

    /**
     * Stamps the source for a single field path. Service-internal API
     * (callers: intake form save, AI extraction completion, manual edit
     * paths). Read-modify-write on the JSONB map; safe under typical case
     * editing concurrency since the entity is loaded, mutated, and saved
     * inside this transaction.
     *
     * @throws LegalCaseException if the case isn't accessible.
     */
    public void setProvenance(Long caseId, String fieldPath, ProvenanceSource source) {
        if (fieldPath == null || fieldPath.isBlank()) {
            throw new IllegalArgumentException("fieldPath is required");
        }
        if (source == null) {
            throw new IllegalArgumentException("source is required");
        }

        Long orgId = requireOrganizationId();
        LegalCase legalCase = legalCaseRepository.findByIdAndOrganizationId(caseId, orgId)
                .orElseThrow(() -> new LegalCaseException(
                        "Case not found or not accessible: " + caseId));

        Map<String, String> map = legalCase.getFieldProvenance();
        if (map == null) {
            map = new HashMap<>();
        } else {
            // The JSONB-deserialized map may be immutable depending on the
            // Hibernate JSON type; copy into a mutable map before mutating.
            map = new HashMap<>(map);
        }
        map.put(fieldPath, source.name());
        legalCase.setFieldProvenance(map);
        legalCaseRepository.save(legalCase);

        log.debug("Provenance stamped: caseId={} fieldPath={} source={}",
                caseId, fieldPath, source);
    }

    private Long requireOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }
}
