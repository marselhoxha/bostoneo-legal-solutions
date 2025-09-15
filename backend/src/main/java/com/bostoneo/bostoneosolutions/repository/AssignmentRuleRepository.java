package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.RuleType;
import com.bostoneo.bostoneosolutions.model.AssignmentRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssignmentRuleRepository extends JpaRepository<AssignmentRule, Long> {
    
    /**
     * Find all active rules ordered by priority
     */
    @Query("SELECT ar FROM AssignmentRule ar WHERE ar.active = true " +
           "ORDER BY ar.priorityOrder ASC")
    List<AssignmentRule> findActiveRulesOrderByPriority();
    
    /**
     * Find active rules by type
     */
    List<AssignmentRule> findByRuleTypeAndActiveTrue(RuleType ruleType);
    
    /**
     * Find rules applicable to a case type
     */
    @Query("SELECT ar FROM AssignmentRule ar WHERE ar.active = true " +
           "AND (ar.caseType IS NULL OR ar.caseType = :caseType) " +
           "ORDER BY ar.priorityOrder ASC")
    List<AssignmentRule> findApplicableRules(@Param("caseType") String caseType);
    
    /**
     * Find rules by active status
     */
    List<AssignmentRule> findByActive(boolean active);
    
    /**
     * Count active rules
     */
    long countByActiveTrue();
    
    /**
     * Check if rule name exists
     */
    boolean existsByRuleNameAndIdNot(String ruleName, Long id);
    
    /**
     * Find rules with specific workload threshold
     */
    @Query("SELECT ar FROM AssignmentRule ar WHERE ar.active = true " +
           "AND ar.maxWorkloadPercentage <= :threshold")
    List<AssignmentRule> findByMaxWorkloadThreshold(@Param("threshold") Double threshold);
}