package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AICriminalMotion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AICriminalMotionRepository extends JpaRepository<AICriminalMotion, Long> {

    // ==================== TENANT ISOLATION METHODS ====================

    /**
     * SECURITY: Get all criminal motions for an organization
     */
    List<AICriminalMotion> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Get criminal motion by ID with tenant verification
     */
    java.util.Optional<AICriminalMotion> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Get criminal motions by case with tenant filter
     */
    List<AICriminalMotion> findByCaseIdAndOrganizationIdOrderByCreatedAtDesc(Long caseId, Long organizationId);

    // ==================== EXISTING METHODS (Use with caution) ====================

    List<AICriminalMotion> findByCaseIdOrderByCreatedAtDesc(Long caseId);
}