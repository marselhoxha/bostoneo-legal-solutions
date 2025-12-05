package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.SignatureAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SignatureAuditLogRepository extends JpaRepository<SignatureAuditLog, Long> {

    // Find by signature request
    List<SignatureAuditLog> findBySignatureRequestIdOrderByCreatedAtDesc(Long signatureRequestId);

    Page<SignatureAuditLog> findBySignatureRequestId(Long signatureRequestId, Pageable pageable);

    // Find by organization
    Page<SignatureAuditLog> findByOrganizationId(Long organizationId, Pageable pageable);

    // Find by event type
    List<SignatureAuditLog> findBySignatureRequestIdAndEventType(Long signatureRequestId, String eventType);

    // Find by organization and event type
    Page<SignatureAuditLog> findByOrganizationIdAndEventType(Long organizationId, String eventType, Pageable pageable);

    // Find by date range for organization
    @Query("SELECT sal FROM SignatureAuditLog sal WHERE sal.organizationId = :orgId " +
            "AND sal.createdAt BETWEEN :start AND :end ORDER BY sal.createdAt DESC")
    Page<SignatureAuditLog> findByOrganizationAndDateRange(@Param("orgId") Long organizationId,
                                                            @Param("start") LocalDateTime start,
                                                            @Param("end") LocalDateTime end,
                                                            Pageable pageable);

    // Count events by type for organization
    @Query("SELECT sal.eventType, COUNT(sal) FROM SignatureAuditLog sal " +
            "WHERE sal.organizationId = :orgId AND sal.createdAt BETWEEN :start AND :end " +
            "GROUP BY sal.eventType")
    List<Object[]> countEventsByType(@Param("orgId") Long organizationId,
                                     @Param("start") LocalDateTime start,
                                     @Param("end") LocalDateTime end);

    // Find latest event for a signature request
    @Query("SELECT sal FROM SignatureAuditLog sal WHERE sal.signatureRequestId = :requestId " +
            "ORDER BY sal.createdAt DESC LIMIT 1")
    SignatureAuditLog findLatestBySignatureRequest(@Param("requestId") Long signatureRequestId);

    // Check if event already logged (for idempotency)
    boolean existsBySignatureRequestIdAndEventTypeAndActorEmail(Long signatureRequestId,
                                                                  String eventType,
                                                                  String actorEmail);
}
