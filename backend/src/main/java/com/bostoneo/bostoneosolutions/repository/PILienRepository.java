package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PILien;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * P10.c — Repository for PI liens. All finder methods include organizationId
 * for tenant isolation.
 */
@Repository
public interface PILienRepository extends JpaRepository<PILien, Long> {

    /** Per-case list ordered by status (OPEN first) then by holder name. */
    List<PILien> findByCaseIdAndOrganizationIdOrderByStatusAscHolderAsc(Long caseId, Long organizationId);

    /** Tenant-scoped fetch for update/delete authorization. */
    Optional<PILien> findByIdAndOrganizationId(Long id, Long organizationId);

    /** Cascade-delete when a case is removed. */
    void deleteByCaseIdAndOrganizationId(Long caseId, Long organizationId);

    /** Counter for KPI / dashboard widgets. */
    long countByCaseIdAndOrganizationId(Long caseId, Long organizationId);

    /**
     * Sum of asserted (original) amounts. Used as the "worst-case lien total"
     * before negotiation reductions are applied. COALESCE prevents nulls
     * from collapsing the SUM to null when no rows match.
     */
    @Query("SELECT COALESCE(SUM(l.originalAmount), 0) FROM PILien l " +
           "WHERE l.caseId = :caseId AND l.organizationId = :orgId")
    BigDecimal sumOriginalByCase(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Effective lien total: prefer negotiatedAmount when set, else originalAmount.
     * This is what flows into the closing-statement net-to-client calculation.
     */
    @Query("SELECT COALESCE(SUM(COALESCE(l.negotiatedAmount, l.originalAmount, 0)), 0) FROM PILien l " +
           "WHERE l.caseId = :caseId AND l.organizationId = :orgId")
    BigDecimal sumEffectiveByCase(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);
}
