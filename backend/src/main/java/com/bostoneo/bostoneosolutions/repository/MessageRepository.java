package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.Message;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface MessageRepository extends ListCrudRepository<Message, Long> {

    @Query("SELECT m FROM Message m WHERE m.threadId = :threadId ORDER BY m.createdAt ASC")
    List<Message> findByThreadIdOrderByCreatedAtAsc(@Param("threadId") Long threadId);

    @Query("SELECT m FROM Message m WHERE m.threadId = :threadId ORDER BY m.createdAt DESC")
    List<Message> findByThreadIdOrderByCreatedAtDesc(@Param("threadId") Long threadId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Message m SET m.isRead = true, m.readAt = :readAt WHERE m.threadId = :threadId AND m.senderType = :senderType AND m.isRead = false")
    int markAsRead(@Param("threadId") Long threadId, @Param("senderType") Message.SenderType senderType, @Param("readAt") LocalDateTime readAt);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.threadId = :threadId AND m.senderType = :senderType AND m.isRead = false")
    int countUnread(@Param("threadId") Long threadId, @Param("senderType") Message.SenderType senderType);

    @Modifying
    @Query("DELETE FROM Message m WHERE m.threadId = :threadId")
    void deleteByThreadId(@Param("threadId") Long threadId);

    // ========== TENANT-FILTERED METHODS (SECURE) ==========

    @Query("SELECT m FROM Message m WHERE m.threadId = :threadId AND m.organizationId = :organizationId ORDER BY m.createdAt ASC")
    List<Message> findByThreadIdAndOrganizationIdOrderByCreatedAtAsc(@Param("threadId") Long threadId, @Param("organizationId") Long organizationId);

    @Query("SELECT m FROM Message m WHERE m.threadId = :threadId AND m.organizationId = :organizationId ORDER BY m.createdAt DESC")
    List<Message> findByThreadIdAndOrganizationIdOrderByCreatedAtDesc(@Param("threadId") Long threadId, @Param("organizationId") Long organizationId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Message m SET m.isRead = true, m.readAt = :readAt WHERE m.threadId = :threadId AND m.organizationId = :organizationId AND m.senderType = :senderType AND m.isRead = false")
    int markAsReadByOrganization(@Param("threadId") Long threadId, @Param("organizationId") Long organizationId, @Param("senderType") Message.SenderType senderType, @Param("readAt") LocalDateTime readAt);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.threadId = :threadId AND m.organizationId = :organizationId AND m.senderType = :senderType AND m.isRead = false")
    int countUnreadByOrganization(@Param("threadId") Long threadId, @Param("organizationId") Long organizationId, @Param("senderType") Message.SenderType senderType);

    @Modifying
    @Query("DELETE FROM Message m WHERE m.threadId = :threadId AND m.organizationId = :organizationId")
    void deleteByThreadIdAndOrganizationId(@Param("threadId") Long threadId, @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find message by ID and organization (tenant isolation)
     */
    @Query("SELECT m FROM Message m WHERE m.id = :id AND m.organizationId = :organizationId")
    java.util.Optional<Message> findByIdAndOrganizationId(@Param("id") Long id, @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find all messages for an organization (tenant isolation)
     */
    @Query("SELECT m FROM Message m WHERE m.organizationId = :organizationId")
    List<Message> findByOrganizationId(@Param("organizationId") Long organizationId);
}
