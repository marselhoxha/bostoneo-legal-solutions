package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PIDamageCalculation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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
     * Atomically insert a row if it doesn't exist yet.
     * Uses PostgreSQL ON CONFLICT to avoid race-condition duplicate key errors
     * when concurrent requests both try to create the same record.
     */
    @Modifying
    @Query(value = "INSERT INTO pi_damage_calculations (case_id, organization_id) " +
            "VALUES (:caseId, :orgId) ON CONFLICT (case_id) DO NOTHING", nativeQuery = true)
    void ensureExists(@Param("caseId") Long caseId, @Param("orgId") Long orgId);

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
