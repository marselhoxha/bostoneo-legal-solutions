package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AiConversationSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiConversationSessionRepository extends JpaRepository<AiConversationSession, Long> {

    /**
     * Find all sessions for a specific case and user
     */
    @Query("SELECT s FROM AiConversationSession s WHERE s.caseId = :caseId AND s.userId = :userId AND s.sessionType = 'legal_research' ORDER BY s.lastInteractionAt DESC")
    List<AiConversationSession> findByCaseIdAndUserIdAndSessionType(
            @Param("caseId") Long caseId,
            @Param("userId") Long userId
    );

    /**
     * Find all active sessions for a user
     */
    List<AiConversationSession> findByUserIdAndIsActiveTrue(Long userId);

    /**
     * Find all pinned sessions for a user
     */
    List<AiConversationSession> findByUserIdAndIsPinnedTrue(Long userId);

    /**
     * Find session by ID and user (for security)
     */
    Optional<AiConversationSession> findByIdAndUserId(Long id, Long userId);

    /**
     * Check if session exists for user (for security)
     */
    boolean existsByIdAndUserId(Long id, Long userId);

    /**
     * Find all sessions for a user with pagination, ordered by last interaction
     */
    @Query("SELECT s FROM AiConversationSession s WHERE s.userId = :userId ORDER BY s.lastInteractionAt DESC")
    Page<AiConversationSession> findAllByUserId(@Param("userId") Long userId, Pageable pageable);

    /**
     * Find sessions by task type for a user with pagination
     */
    @Query("SELECT s FROM AiConversationSession s WHERE s.userId = :userId AND s.taskType = :taskType ORDER BY s.lastInteractionAt DESC")
    Page<AiConversationSession> findByUserIdAndTaskType(
            @Param("userId") Long userId,
            @Param("taskType") String taskType,
            Pageable pageable
    );

    /**
     * Find ONLY general conversations (no caseId) by task type for a user with pagination
     * Used by AI Workspace to exclude case-specific research
     */
    @Query("SELECT s FROM AiConversationSession s WHERE s.userId = :userId AND s.taskType = :taskType AND s.caseId IS NULL ORDER BY s.lastInteractionAt DESC")
    Page<AiConversationSession> findGeneralConversationsByUserIdAndTaskType(
            @Param("userId") Long userId,
            @Param("taskType") String taskType,
            Pageable pageable
    );

    // ==================== TENANT-FILTERED METHODS ====================

    /**
     * Find session by ID, user, and organization (for security)
     */
    Optional<AiConversationSession> findByIdAndUserIdAndOrganizationId(Long id, Long userId, Long organizationId);

    /**
     * Find all sessions for a case, user, and organization
     */
    @Query("SELECT s FROM AiConversationSession s WHERE s.caseId = :caseId AND s.userId = :userId AND s.organizationId = :orgId AND s.sessionType = 'legal_research' ORDER BY s.lastInteractionAt DESC")
    List<AiConversationSession> findByCaseIdAndUserIdAndOrganizationId(
            @Param("caseId") Long caseId,
            @Param("userId") Long userId,
            @Param("orgId") Long organizationId
    );

    /**
     * Check if session exists for user and organization
     */
    boolean existsByIdAndUserIdAndOrganizationId(Long id, Long userId, Long organizationId);

    /**
     * Find all sessions for a user and organization with pagination
     */
    @Query("SELECT s FROM AiConversationSession s WHERE s.userId = :userId AND s.organizationId = :orgId ORDER BY s.lastInteractionAt DESC")
    Page<AiConversationSession> findAllByUserIdAndOrganizationId(@Param("userId") Long userId, @Param("orgId") Long organizationId, Pageable pageable);

    /**
     * Find sessions by task type for a user and organization with pagination
     */
    @Query("SELECT s FROM AiConversationSession s WHERE s.userId = :userId AND s.organizationId = :orgId AND s.taskType = :taskType ORDER BY s.lastInteractionAt DESC")
    Page<AiConversationSession> findByUserIdAndOrganizationIdAndTaskType(
            @Param("userId") Long userId,
            @Param("orgId") Long organizationId,
            @Param("taskType") String taskType,
            Pageable pageable
    );

    /**
     * Find session by ID and organization (for security - tenant isolation)
     */
    Optional<AiConversationSession> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Find ONLY general conversations (no caseId) by task type for a user and org with pagination
     * SECURITY: Tenant-isolated version of findGeneralConversationsByUserIdAndTaskType
     */
    @Query("SELECT s FROM AiConversationSession s WHERE s.userId = :userId AND s.organizationId = :orgId AND s.taskType = :taskType AND s.caseId IS NULL ORDER BY s.lastInteractionAt DESC")
    Page<AiConversationSession> findGeneralConversationsByUserIdAndOrganizationIdAndTaskType(
            @Param("userId") Long userId,
            @Param("orgId") Long organizationId,
            @Param("taskType") String taskType,
            Pageable pageable
    );
}
