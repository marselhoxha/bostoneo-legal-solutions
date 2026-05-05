package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    
    @Query("SELECT e FROM Expense e " +
           "LEFT JOIN FETCH e.vendor " +
           "LEFT JOIN FETCH e.client " + 
           "LEFT JOIN FETCH e.category " +
           "LEFT JOIN FETCH e.invoice " +
           "LEFT JOIN FETCH e.legalCase " +
           "LEFT JOIN FETCH e.receipt " +
           "WHERE e.id = :id")
    Optional<Expense> findByIdWithRelationships(@Param("id") Long id);
    
    @Query(value = "SELECT e FROM Expense e " +
           "LEFT JOIN FETCH e.vendor " +
           "LEFT JOIN FETCH e.client " +
           "LEFT JOIN FETCH e.category " +
           "LEFT JOIN FETCH e.receipt",
           countQuery = "SELECT COUNT(e) FROM Expense e")
    Page<Expense> findAllWithRelationships(Pageable pageable);

    // ========== TENANT-FILTERED METHODS (SECURE) ==========

    @Query("SELECT e FROM Expense e " +
           "LEFT JOIN FETCH e.vendor " +
           "LEFT JOIN FETCH e.client " +
           "LEFT JOIN FETCH e.category " +
           "LEFT JOIN FETCH e.invoice " +
           "LEFT JOIN FETCH e.legalCase " +
           "LEFT JOIN FETCH e.receipt " +
           "WHERE e.id = :id AND e.organizationId = :organizationId")
    Optional<Expense> findByIdAndOrganizationIdWithRelationships(@Param("id") Long id, @Param("organizationId") Long organizationId);

    @Query(value = "SELECT e FROM Expense e " +
           "LEFT JOIN FETCH e.vendor " +
           "LEFT JOIN FETCH e.client " +
           "LEFT JOIN FETCH e.category " +
           "LEFT JOIN FETCH e.receipt " +
           "WHERE e.organizationId = :organizationId",
           countQuery = "SELECT COUNT(e) FROM Expense e WHERE e.organizationId = :organizationId")
    Page<Expense> findAllWithRelationshipsByOrganization(@Param("organizationId") Long organizationId, Pageable pageable);

    @Query("SELECT e FROM Expense e WHERE e.id = :id AND e.organizationId = :organizationId")
    Optional<Expense> findByIdAndOrganizationId(@Param("id") Long id, @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find all expenses for an organization (tenant isolation)
     */
    @Query("SELECT e FROM Expense e WHERE e.organizationId = :organizationId")
    java.util.List<Expense> findByOrganizationId(@Param("organizationId") Long organizationId);

    // ========== P3 / Case Costs (Damages tab) ==========

    /**
     * Returns all expenses for one case, fully hydrated for the Damages-tab
     * Case Costs table (vendor / category / receipt all surfaced inline).
     * Tenant-isolated: a case in another org returns nothing for the caller.
     */
    @Query("SELECT e FROM Expense e " +
           "LEFT JOIN FETCH e.vendor " +
           "LEFT JOIN FETCH e.category " +
           "LEFT JOIN FETCH e.receipt " +
           "LEFT JOIN FETCH e.legalCase " +
           "WHERE e.legalCase.id = :caseId AND e.organizationId = :organizationId " +
           "ORDER BY e.date DESC")
    java.util.List<Expense> findByLegalCaseIdAndOrganizationIdWithRelationships(
            @Param("caseId") Long caseId,
            @Param("organizationId") Long organizationId);

    /**
     * Running total of case costs for the Damages-tab Net-to-Client breakdown.
     * Returns 0.0 via COALESCE if the case has no expenses logged.
     *
     * NOTE: the fallback literal must be {@code 0.0} (not {@code 0}). With
     * an integer literal Hibernate 6 infers the COALESCE type as Integer
     * and throws ClassCastException when binding the result to BigDecimal —
     * which fires on every brand-new case (zero expenses == COALESCE-fires).
     * The decimal literal forces BigDecimal type inference. Caller still
     * defensively null-checks in ExpenseService for paranoia.
     */
    @Query("SELECT COALESCE(SUM(e.amount), 0.0) FROM Expense e " +
           "WHERE e.legalCase.id = :caseId AND e.organizationId = :organizationId")
    java.math.BigDecimal sumByLegalCaseIdAndOrganizationId(
            @Param("caseId") Long caseId,
            @Param("organizationId") Long organizationId);
}