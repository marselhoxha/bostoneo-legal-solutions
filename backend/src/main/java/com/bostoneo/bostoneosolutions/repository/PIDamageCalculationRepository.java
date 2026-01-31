package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PIDamageCalculation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for PI Damage Calculations
 */
@Repository
public interface PIDamageCalculationRepository extends JpaRepository<PIDamageCalculation, Long> {

    /**
     * Find the damage calculation for a case (there should only be one per case)
     */
    Optional<PIDamageCalculation> findByCaseIdAndOrganizationId(Long caseId, Long organizationId);

    /**
     * Find a specific calculation by ID with organization filtering
     */
    Optional<PIDamageCalculation> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Check if a calculation exists for a case
     */
    boolean existsByCaseIdAndOrganizationId(Long caseId, Long organizationId);

    /**
     * Delete calculation for a case
     */
    void deleteByCaseIdAndOrganizationId(Long caseId, Long organizationId);
}
