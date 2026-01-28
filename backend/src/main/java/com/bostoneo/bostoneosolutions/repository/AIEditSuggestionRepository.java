package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIEditSuggestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AIEditSuggestionRepository extends JpaRepository<AIEditSuggestion, Long> {

    // ==================== TENANT ISOLATION METHODS ====================

    /**
     * SECURITY: Get all edit suggestions for an organization
     */
    List<AIEditSuggestion> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Get edit suggestion by ID with tenant verification
     */
    Optional<AIEditSuggestion> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Get edit suggestions by session with tenant filter
     */
    List<AIEditSuggestion> findBySessionIdAndOrganizationId(Long sessionId, Long organizationId);

    /**
     * SECURITY: Get pending suggestions for organization (not yet accepted or rejected)
     */
    List<AIEditSuggestion> findByOrganizationIdAndIsAcceptedFalseAndIsRejectedFalseOrderByCreatedAtDesc(Long organizationId);
}
