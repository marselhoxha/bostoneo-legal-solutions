package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIImmigrationCase;
import com.bostoneo.bostoneosolutions.enumeration.ImmigrationStatus;
import com.bostoneo.bostoneosolutions.enumeration.ImmigrationCaseType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface AIImmigrationCaseRepository extends JpaRepository<AIImmigrationCase, Long> {
    
    List<AIImmigrationCase> findByCaseIdOrderByCreatedAtDesc(Long caseId);
    
    Page<AIImmigrationCase> findByFormType(String formType, Pageable pageable);
    
    // Note: Using formType for case type compatibility with service layer
    default Page<AIImmigrationCase> findByCaseType(String caseType, Pageable pageable) {
        return findByFormType(caseType, pageable);
    }
    
    // Overloaded method for enum types from service layer
    default Page<AIImmigrationCase> findByCaseType(ImmigrationCaseType caseType, Pageable pageable) {
        return findByFormType(caseType.toString(), pageable);
    }
    
    Page<AIImmigrationCase> findByStatus(ImmigrationStatus status, Pageable pageable);
    
    List<AIImmigrationCase> findByStatus(ImmigrationStatus status);
    
    List<AIImmigrationCase> findByFormType(String formType);
    
    List<AIImmigrationCase> findByServiceCenter(String serviceCenter);
    
    List<AIImmigrationCase> findByPetitionerNameContainingIgnoreCase(String name);
    
    List<AIImmigrationCase> findByBeneficiaryNameContainingIgnoreCase(String name);
    
    List<AIImmigrationCase> findByReceiptNumber(String receiptNumber);
    
    List<AIImmigrationCase> findByUsciseCaseNumber(String usciseCaseNumber);
    
    @Query("SELECT ic FROM AIImmigrationCase ic WHERE ic.nextActionDate BETWEEN :startDate AND :endDate ORDER BY ic.nextActionDate ASC")
    List<AIImmigrationCase> findCasesWithDeadlinesBetween(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
    
    @Query("SELECT ic FROM AIImmigrationCase ic WHERE ic.nextActionDate <= :date ORDER BY ic.nextActionDate ASC")
    List<AIImmigrationCase> findCasesWithUpcomingDeadlines(@Param("date") LocalDate date);
    
    @Query("SELECT ic FROM AIImmigrationCase ic WHERE ic.priorityDate IS NOT NULL ORDER BY ic.priorityDate ASC")
    List<AIImmigrationCase> findCasesWithPriorityDate();
}
