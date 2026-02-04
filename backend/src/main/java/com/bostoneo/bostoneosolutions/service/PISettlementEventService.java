package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.PISettlementEventDTO;

import java.util.List;

/**
 * Service interface for PI Settlement Event operations
 */
public interface PISettlementEventService {

    /**
     * Get all settlement events for a case
     */
    List<PISettlementEventDTO> getEventsByCaseId(Long caseId);

    /**
     * Get a specific settlement event by ID
     */
    PISettlementEventDTO getEventById(Long id);

    /**
     * Create a new settlement event
     */
    PISettlementEventDTO createEvent(Long caseId, PISettlementEventDTO eventDTO);

    /**
     * Delete a settlement event
     */
    void deleteEvent(Long id);

    /**
     * Delete all settlement events for a case
     */
    void deleteAllByCaseId(Long caseId);

    /**
     * Count settlement events for a case
     */
    long countByCaseId(Long caseId);
}
