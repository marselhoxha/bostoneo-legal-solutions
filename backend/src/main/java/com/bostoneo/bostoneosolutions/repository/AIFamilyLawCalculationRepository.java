package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIFamilyLawCalculation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AIFamilyLawCalculationRepository extends JpaRepository<AIFamilyLawCalculation, Long> {

    // ==================== TENANT ISOLATION METHODS ====================

    /**
     * SECURITY: Get all family law calculations for an organization
     */
    List<AIFamilyLawCalculation> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Get calculation by ID with tenant verification
     */
    java.util.Optional<AIFamilyLawCalculation> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Get calculations by case with tenant filter
     */
    List<AIFamilyLawCalculation> findByCaseIdAndOrganizationIdOrderByCreatedAtDesc(Long caseId, Long organizationId);

    // ==================== EXISTING METHODS (Use with caution) ====================

    List<AIFamilyLawCalculation> findByCaseIdOrderByCreatedAtDesc(Long caseId);
}