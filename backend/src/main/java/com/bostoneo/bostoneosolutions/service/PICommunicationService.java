package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.PICommunicationDTO;
import com.bostoneo.bostoneosolutions.dto.PICommunicationHealthDTO;

import java.util.List;

/**
 * P9e — Service interface for PI Communications Log operations.
 */
public interface PICommunicationService {

    /** Get all communications for a case (tenant-scoped, newest first). */
    List<PICommunicationDTO> getByCaseId(Long caseId);

    /** Fetch a single communication for edit/view (tenant-scoped). */
    PICommunicationDTO getById(Long id);

    /** Create a new communication entry. */
    PICommunicationDTO create(Long caseId, PICommunicationDTO dto);

    /** Update an existing entry — partial update on subject/summary/type/etc. */
    PICommunicationDTO update(Long id, PICommunicationDTO dto);

    /** Delete a single entry. */
    void delete(Long id);

    /** Cascade-delete when a case is removed. */
    void deleteAllByCaseId(Long caseId);

    /** Count of communications for a case (drives Negotiation tab badge). */
    long countByCaseId(Long caseId);

    /**
     * P5 — Compute the Activity-tab Communication Health summary for a case.
     * Derives avg response time, awaiting-reply count, volume, type/channel
     * mix from the case's tenant-filtered communication timeline. Empty
     * cases get a zero-valued DTO (never null), so the frontend can render
     * "All caught up" without null-handling.
     */
    PICommunicationHealthDTO getCommunicationHealth(Long caseId);
}
