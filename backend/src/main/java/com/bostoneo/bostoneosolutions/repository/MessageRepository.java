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

    @Modifying
    @Query("UPDATE Message m SET m.isRead = true, m.readAt = :readAt WHERE m.threadId = :threadId AND m.senderType = :senderType AND m.isRead = false")
    int markAsRead(@Param("threadId") Long threadId, @Param("senderType") Message.SenderType senderType, @Param("readAt") LocalDateTime readAt);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.threadId = :threadId AND m.senderType = :senderType AND m.isRead = false")
    int countUnread(@Param("threadId") Long threadId, @Param("senderType") Message.SenderType senderType);
}
