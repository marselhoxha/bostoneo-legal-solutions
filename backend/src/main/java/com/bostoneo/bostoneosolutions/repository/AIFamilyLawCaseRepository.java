package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIFamilyLawCase;
import com.bostoneo.bostoneosolutions.enumeration.FamilyLawCaseType;
import com.bostoneo.bostoneosolutions.enumeration.FamilyLawStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface AIFamilyLawCaseRepository extends JpaRepository<AIFamilyLawCase, Long> {
    
    List<AIFamilyLawCase> findByClientIdOrderByCreatedAtDesc(Long clientId);
    
    Page<AIFamilyLawCase> findByCaseType(FamilyLawCaseType caseType, Pageable pageable);
    
    Page<AIFamilyLawCase> findByStatus(FamilyLawStatus status, Pageable pageable);
    
    List<AIFamilyLawCase> findByCaseType(FamilyLawCaseType caseType);
    
    List<AIFamilyLawCase> findByStatus(FamilyLawStatus status);
    
    List<AIFamilyLawCase> findByClientId(Long clientId);
    
    List<AIFamilyLawCase> findByIsContestedTrue();
    
    List<AIFamilyLawCase> findByHasMinorChildrenTrue();
    
    List<AIFamilyLawCase> findByCourtName(String courtName);
    
    List<AIFamilyLawCase> findByJudgeName(String judgeName);
    
    @Query("SELECT flc FROM AIFamilyLawCase flc WHERE flc.nextHearingDate BETWEEN :startDate AND :endDate ORDER BY flc.nextHearingDate ASC")
    List<AIFamilyLawCase> findCasesWithHearingsBetween(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
    
    @Query("SELECT flc FROM AIFamilyLawCase flc WHERE flc.nextHearingDate <= :date ORDER BY flc.nextHearingDate ASC")
    List<AIFamilyLawCase> findCasesWithUpcomingHearings(@Param("date") LocalDate date);
}
