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

    List<ResearchActionItem> findByUserIdAndActionStatusOrderByCreatedAtDesc(Long userId, ActionStatus actionStatus);

    List<ResearchActionItem> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<ResearchActionItem> findByResearchSessionIdOrderByCreatedAtDesc(Long researchSessionId);

    List<ResearchActionItem> findByCaseIdAndActionStatusOrderByCreatedAtDesc(Long caseId, ActionStatus actionStatus);

    Long countByUserIdAndActionStatus(Long userId, ActionStatus actionStatus);

    // Native queries for ai_conversation_sessions management
    @Query(value = "SELECT COUNT(*) FROM ai_conversation_sessions WHERE id = :sessionId", nativeQuery = true)
    Long countSessionsById(@Param("sessionId") Long sessionId);

    @Modifying
    @Query(value = "INSERT INTO ai_conversation_sessions (id, user_id, session_name, session_type, is_active, message_count, total_tokens_used, total_cost_usd) " +
                   "VALUES (:sessionId, :userId, :sessionName, :sessionType, 1, 0, 0, 0.0000) " +
                   "ON DUPLICATE KEY UPDATE id=id", nativeQuery = true)
    void createConversationSession(@Param("sessionId") Long sessionId,
                                   @Param("userId") Long userId,
                                   @Param("sessionName") String sessionName,
                                   @Param("sessionType") String sessionType);
}
