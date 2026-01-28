package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.ResearchActionItem;
import com.bostoneo.bostoneosolutions.model.ResearchActionItem.ActionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResearchActionItemRepository extends JpaRepository<ResearchActionItem, Long> {

    // ==================== TENANT-FILTERED METHODS ====================

    java.util.Optional<ResearchActionItem> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);

    List<ResearchActionItem> findByOrganizationIdAndUserIdAndActionStatusOrderByCreatedAtDesc(Long organizationId, Long userId, ActionStatus actionStatus);

    List<ResearchActionItem> findByOrganizationIdAndUserIdOrderByCreatedAtDesc(Long organizationId, Long userId);

    List<ResearchActionItem> findByOrganizationIdAndResearchSessionIdOrderByCreatedAtDesc(Long organizationId, Long researchSessionId);

    List<ResearchActionItem> findByOrganizationIdAndCaseIdAndActionStatusOrderByCreatedAtDesc(Long organizationId, Long caseId, ActionStatus actionStatus);

    Long countByOrganizationIdAndUserIdAndActionStatus(Long organizationId, Long userId, ActionStatus actionStatus);

    // ==================== DEPRECATED METHODS ====================
    // WARNING: These methods bypass multi-tenant isolation.

    /** @deprecated Use findByOrganizationIdAndUserIdAndActionStatusOrderByCreatedAtDesc for tenant isolation */
    @Deprecated
    List<ResearchActionItem> findByUserIdAndActionStatusOrderByCreatedAtDesc(Long userId, ActionStatus actionStatus);

    /** @deprecated Use findByOrganizationIdAndUserIdOrderByCreatedAtDesc for tenant isolation */
    @Deprecated
    List<ResearchActionItem> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** @deprecated Use findByOrganizationIdAndResearchSessionIdOrderByCreatedAtDesc for tenant isolation */
    @Deprecated
    List<ResearchActionItem> findByResearchSessionIdOrderByCreatedAtDesc(Long researchSessionId);

    /** @deprecated Use findByOrganizationIdAndCaseIdAndActionStatusOrderByCreatedAtDesc for tenant isolation */
    @Deprecated
    List<ResearchActionItem> findByCaseIdAndActionStatusOrderByCreatedAtDesc(Long caseId, ActionStatus actionStatus);

    /** @deprecated Use countByOrganizationIdAndUserIdAndActionStatus for tenant isolation */
    @Deprecated
    Long countByUserIdAndActionStatus(Long userId, ActionStatus actionStatus);

    // Native queries for ai_conversation_sessions management
    /**
     * @deprecated Use countSessionsByIdAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query(value = "SELECT COUNT(*) FROM ai_conversation_sessions WHERE id = :sessionId", nativeQuery = true)
    Long countSessionsById(@Param("sessionId") Long sessionId);

    /**
     * SECURITY: Count sessions with organization filter
     */
    @Query(value = "SELECT COUNT(*) FROM ai_conversation_sessions WHERE id = :sessionId AND organization_id = :orgId", nativeQuery = true)
    Long countSessionsByIdAndOrganizationId(@Param("sessionId") Long sessionId, @Param("orgId") Long organizationId);

    /**
     * @deprecated Use createConversationSessionWithOrganization instead for tenant isolation
     */
    @Deprecated
    @Modifying
    @Query(value = "INSERT INTO ai_conversation_sessions (id, user_id, session_name, session_type, is_active, message_count, total_tokens_used, total_cost_usd) " +
                   "VALUES (:sessionId, :userId, :sessionName, :sessionType, true, 0, 0, 0.0000) " +
                   "ON CONFLICT (id) DO NOTHING", nativeQuery = true)
    void createConversationSession(@Param("sessionId") Long sessionId,
                                   @Param("userId") Long userId,
                                   @Param("sessionName") String sessionName,
                                   @Param("sessionType") String sessionType);

    /**
     * SECURITY: Create conversation session with organization ID
     */
    @Modifying
    @Query(value = "INSERT INTO ai_conversation_sessions (id, user_id, organization_id, session_name, session_type, is_active, message_count, total_tokens_used, total_cost_usd) " +
                   "VALUES (:sessionId, :userId, :orgId, :sessionName, :sessionType, true, 0, 0, 0.0000) " +
                   "ON CONFLICT (id) DO NOTHING", nativeQuery = true)
    void createConversationSessionWithOrganization(@Param("sessionId") Long sessionId,
                                                    @Param("userId") Long userId,
                                                    @Param("orgId") Long organizationId,
                                                    @Param("sessionName") String sessionName,
                                                    @Param("sessionType") String sessionType);
}
