package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.MessageThread;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MessageThreadRepository extends ListCrudRepository<MessageThread, Long> {

    @Query("SELECT t FROM MessageThread t WHERE t.clientId = :clientId ORDER BY t.lastMessageAt DESC NULLS LAST, t.createdAt DESC")
    List<MessageThread> findByClientIdOrderByLastMessageAtDesc(@Param("clientId") Long clientId);

    @Query("SELECT t FROM MessageThread t WHERE t.attorneyId = :attorneyId ORDER BY t.lastMessageAt DESC NULLS LAST, t.createdAt DESC")
    List<MessageThread> findByAttorneyIdOrderByLastMessageAtDesc(@Param("attorneyId") Long attorneyId);

    @Query("SELECT t FROM MessageThread t WHERE t.caseId = :caseId ORDER BY t.lastMessageAt DESC NULLS LAST, t.createdAt DESC")
    List<MessageThread> findByCaseIdOrderByLastMessageAtDesc(@Param("caseId") Long caseId);

    @Query("SELECT t FROM MessageThread t WHERE t.attorneyId = :attorneyId AND t.unreadByAttorney > 0")
    List<MessageThread> findUnreadByAttorney(@Param("attorneyId") Long attorneyId);

    @Query("SELECT SUM(t.unreadByAttorney) FROM MessageThread t WHERE t.attorneyId = :attorneyId")
    Integer countUnreadByAttorney(@Param("attorneyId") Long attorneyId);

    @Query("SELECT SUM(t.unreadByClient) FROM MessageThread t WHERE t.clientId = :clientId")
    Integer countUnreadByClient(@Param("clientId") Long clientId);

    @Query("SELECT t FROM MessageThread t WHERE t.caseId IN :caseIds ORDER BY t.lastMessageAt DESC NULLS LAST, t.createdAt DESC")
    List<MessageThread> findByCaseIdInOrderByLastMessageAtDesc(@Param("caseIds") List<Long> caseIds);
}
