package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIEditingSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AIEditingSessionRepository extends JpaRepository<AIEditingSession, Long> {

    // ==================== TENANT ISOLATION METHODS ====================

    /**
     * SECURITY: Get all editing sessions for an organization
     */
    List<AIEditingSession> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Get editing session by ID with tenant verification
     */
    Optional<AIEditingSession> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Get editing sessions by file with tenant filter
     */
    List<AIEditingSession> findByFileIdAndOrganizationId(Long fileId, Long organizationId);

    /**
     * SECURITY: Get active editing sessions for organization
     */
    List<AIEditingSession> findByOrganizationIdAndActiveStatus(Long organizationId, com.bostoneo.bostoneosolutions.enumeration.SessionStatus activeStatus);
}
