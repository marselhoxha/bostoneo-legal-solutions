package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AICriminalCase;
import com.bostoneo.bostoneosolutions.enumeration.OffenseLevel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface AICriminalCaseRepository extends JpaRepository<AICriminalCase, Long> {
    
    Page<AICriminalCase> findByOffenseLevel(OffenseLevel offenseLevel, Pageable pageable);
    
    List<AICriminalCase> findByCaseIdOrderByCreatedAtDesc(Long caseId);
    
    List<AICriminalCase> findByPrimaryOffenseContaining(String offense);
    
    List<AICriminalCase> findByCourtNameContaining(String courtName);
    
    List<AICriminalCase> findByDocketNumberContaining(String docketNumber);
    
    List<AICriminalCase> findByOffenseClass(String offenseClass);
    
    @Query("SELECT cc FROM AICriminalCase cc WHERE cc.trialDate BETWEEN :startDate AND :endDate " +
           "ORDER BY cc.trialDate ASC")
    List<AICriminalCase> findCasesWithCourtDatesBetween(@Param("startDate") LocalDate startDate,
                                                        @Param("endDate") LocalDate endDate);
                                                        
    @Query("SELECT cc FROM AICriminalCase cc WHERE cc.pleaDeadline <= :deadline ORDER BY cc.pleaDeadline ASC")
    List<AICriminalCase> findByPleaDeadlineBefore(@Param("deadline") LocalDate deadline);
    
    @Query("SELECT cc FROM AICriminalCase cc WHERE cc.discoveryDeadline <= :deadline ORDER BY cc.discoveryDeadline ASC")
    List<AICriminalCase> findByDiscoveryDeadlineBefore(@Param("deadline") LocalDate deadline);

    // ==================== TENANT-FILTERED METHODS (SECURITY CRITICAL) ====================

    /**
     * SECURITY: Find all criminal cases for an organization (tenant isolation)
     */
    List<AICriminalCase> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Find criminal case by ID within organization (tenant isolation)
     */
    java.util.Optional<AICriminalCase> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Find by case ID within organization
     */
    List<AICriminalCase> findByCaseIdAndOrganizationIdOrderByCreatedAtDesc(Long caseId, Long organizationId);

    /**
     * SECURITY: Find by offense level within organization
     */
    Page<AICriminalCase> findByOffenseLevelAndOrganizationId(OffenseLevel offenseLevel, Long organizationId, Pageable pageable);

    /**
     * SECURITY: Find court dates within organization
     */
    @Query("SELECT cc FROM AICriminalCase cc WHERE cc.organizationId = :orgId " +
           "AND cc.trialDate BETWEEN :startDate AND :endDate ORDER BY cc.trialDate ASC")
    List<AICriminalCase> findCasesWithCourtDatesBetweenAndOrganizationId(
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate,
        @Param("orgId") Long organizationId);
}