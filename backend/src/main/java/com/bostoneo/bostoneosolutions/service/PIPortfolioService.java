package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.PIPortfolioStatsDTO;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Service for PI Portfolio statistics and case list operations
 */
public interface PIPortfolioService {

    /**
     * Get aggregate portfolio statistics for all PI cases in an organization
     */
    PIPortfolioStatsDTO getPortfolioStats(Long organizationId);

    /**
     * Get paginated list of PI cases for an organization
     */
    Page<LegalCase> getPICases(Long organizationId, Pageable pageable);

    /**
     * Search PI cases by keyword within an organization
     */
    Page<LegalCase> searchPICases(Long organizationId, String searchTerm, Pageable pageable);

    /**
     * Get PI cases filtered by status
     */
    Page<LegalCase> getPICasesByStatus(Long organizationId, String status, Pageable pageable);
}
