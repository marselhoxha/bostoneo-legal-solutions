package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.PILienDTO;

import java.math.BigDecimal;
import java.util.List;

/**
 * P10.c — Service interface for PI liens & subrogation claims.
 */
public interface PILienService {

    /** All liens for a case (tenant-scoped, OPEN first). */
    List<PILienDTO> getByCaseId(Long caseId);

    /** Single fetch for edit / detail view. */
    PILienDTO getById(Long id);

    /** Create a new lien entry. */
    PILienDTO create(Long caseId, PILienDTO dto);

    /** Update an existing entry — partial update on holder/type/amounts/status/notes. */
    PILienDTO update(Long id, PILienDTO dto);

    /** Delete an entry. */
    void delete(Long id);

    /** Cascade-delete when a case is removed. */
    void deleteAllByCaseId(Long caseId);

    /** Count for KPI / dashboard widgets. */
    long countByCaseId(Long caseId);

    /**
     * Sum of (negotiatedAmount when set, else originalAmount). The number
     * the closing statement reduces gross settlement by.
     */
    BigDecimal getEffectiveTotal(Long caseId);
}
