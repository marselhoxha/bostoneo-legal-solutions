package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AiConversationMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiConversationMessageRepository extends JpaRepository<AiConversationMessage, Long> {

    /**
     * Find all messages for a specific session
     */
    @Query("SELECT m FROM AiConversationMessage m WHERE m.session.id = :sessionId ORDER BY m.createdAt ASC")
    List<AiConversationMessage> findBySessionIdOrderByCreatedAtAsc(@Param("sessionId") Long sessionId);

    /**
     * Count messages in a session
     */
    @Query("SELECT COUNT(m) FROM AiConversationMessage m WHERE m.session.id = :sessionId")
    Long countBySessionId(@Param("sessionId") Long sessionId);

    /**
     * Delete all messages for a session
     */
    void deleteBySessionId(Long sessionId);
}
