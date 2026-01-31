package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PIDamageElement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Repository for PI Damage Elements
 */
@Repository
public interface PIDamageElementRepository extends JpaRepository<PIDamageElement, Long> {

    /**
     * Find all damage elements for a case ordered by display order
     */
    List<PIDamageElement> findByCaseIdAndOrganizationIdOrderByDisplayOrderAsc(Long caseId, Long organizationId);

    /**
     * Find all damage elements for a case with pagination
     */
    Page<PIDamageElement> findByCaseIdAndOrganizationIdOrderByDisplayOrderAsc(
            Long caseId, Long organizationId, Pageable pageable);

    /**
     * Find a specific damage element by ID with organization filtering
     */
    Optional<PIDamageElement> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Find damage elements by element type
     */
    List<PIDamageElement> findByCaseIdAndOrganizationIdAndElementType(
            Long caseId, Long organizationId, String elementType);

    /**
     * Sum calculated amounts by element type
     */
    @Query("SELECT e.elementType, COALESCE(SUM(e.calculatedAmount), 0) FROM PIDamageElement e " +
           "WHERE e.caseId = :caseId AND e.organizationId = :orgId " +
           "GROUP BY e.elementType ORDER BY e.elementType")
    List<Object[]> sumAmountsByElementType(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Sum total calculated amount for a case
     */
    @Query("SELECT COALESCE(SUM(e.calculatedAmount), 0) FROM PIDamageElement e " +
           "WHERE e.caseId = :caseId AND e.organizationId = :orgId")
    BigDecimal sumTotalCalculatedAmount(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Sum economic damages (medical, wages, etc.)
     */
    @Query("SELECT COALESCE(SUM(e.calculatedAmount), 0) FROM PIDamageElement e " +
           "WHERE e.caseId = :caseId AND e.organizationId = :orgId " +
           "AND e.elementType IN ('PAST_MEDICAL', 'FUTURE_MEDICAL', 'LOST_WAGES', 'EARNING_CAPACITY', " +
           "'HOUSEHOLD_SERVICES', 'MILEAGE', 'OTHER')")
    BigDecimal sumEconomicDamages(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Sum non-economic damages (pain & suffering)
     */
    @Query("SELECT COALESCE(SUM(e.calculatedAmount), 0) FROM PIDamageElement e " +
           "WHERE e.caseId = :caseId AND e.organizationId = :orgId " +
           "AND e.elementType = 'PAIN_SUFFERING'")
    BigDecimal sumNonEconomicDamages(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Count damage elements by confidence level
     */
    @Query("SELECT e.confidenceLevel, COUNT(e) FROM PIDamageElement e " +
           "WHERE e.caseId = :caseId AND e.organizationId = :orgId " +
           "GROUP BY e.confidenceLevel")
    List<Object[]> countByConfidenceLevel(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Get maximum display order for ordering new elements
     */
    @Query("SELECT COALESCE(MAX(e.displayOrder), 0) FROM PIDamageElement e " +
           "WHERE e.caseId = :caseId AND e.organizationId = :orgId")
    Integer getMaxDisplayOrder(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Delete all damage elements for a case
     */
    void deleteByCaseIdAndOrganizationId(Long caseId, Long organizationId);
}
