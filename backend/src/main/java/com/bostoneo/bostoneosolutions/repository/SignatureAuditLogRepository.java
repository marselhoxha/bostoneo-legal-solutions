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

    // ==================== DEPRECATED METHODS (use tenant-filtered versions) ====================

    /**
     * @deprecated Use findBySignatureRequestIdAndOrganizationIdOrderByCreatedAtDesc instead for tenant isolation
     */
    @Deprecated
    List<SignatureAuditLog> findBySignatureRequestIdOrderByCreatedAtDesc(Long signatureRequestId);

    /**
     * @deprecated Use findBySignatureRequestIdAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    Page<SignatureAuditLog> findBySignatureRequestId(Long signatureRequestId, Pageable pageable);

    /**
     * @deprecated Use findBySignatureRequestIdAndEventTypeAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    List<SignatureAuditLog> findBySignatureRequestIdAndEventType(Long signatureRequestId, String eventType);

    /**
     * @deprecated Use findLatestBySignatureRequestAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT sal FROM SignatureAuditLog sal WHERE sal.signatureRequestId = :requestId " +
            "ORDER BY sal.createdAt DESC LIMIT 1")
    SignatureAuditLog findLatestBySignatureRequest(@Param("requestId") Long signatureRequestId);

    /**
     * @deprecated Use existsBySignatureRequestIdAndEventTypeAndActorEmailAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    boolean existsBySignatureRequestIdAndEventTypeAndActorEmail(Long signatureRequestId,
                                                                  String eventType,
                                                                  String actorEmail);

    // ==================== TENANT-FILTERED METHODS ====================

    // Find by organization (SAFE - already includes organization filtering)
    Page<SignatureAuditLog> findByOrganizationId(Long organizationId, Pageable pageable);

    // Find by organization and event type (SAFE)
    Page<SignatureAuditLog> findByOrganizationIdAndEventType(Long organizationId, String eventType, Pageable pageable);

    // Find by date range for organization (SAFE)
    @Query("SELECT sal FROM SignatureAuditLog sal WHERE sal.organizationId = :orgId " +
            "AND sal.createdAt BETWEEN :start AND :end ORDER BY sal.createdAt DESC")
    Page<SignatureAuditLog> findByOrganizationAndDateRange(@Param("orgId") Long organizationId,
                                                            @Param("start") LocalDateTime start,
                                                            @Param("end") LocalDateTime end,
                                                            Pageable pageable);

    // Count events by type for organization (SAFE)
    @Query("SELECT sal.eventType, COUNT(sal) FROM SignatureAuditLog sal " +
            "WHERE sal.organizationId = :orgId AND sal.createdAt BETWEEN :start AND :end " +
            "GROUP BY sal.eventType")
    List<Object[]> countEventsByType(@Param("orgId") Long organizationId,
                                     @Param("start") LocalDateTime start,
                                     @Param("end") LocalDateTime end);

    /**
     * SECURITY: Find by signature request with organization verification
     */
    List<SignatureAuditLog> findBySignatureRequestIdAndOrganizationIdOrderByCreatedAtDesc(
        Long signatureRequestId, Long organizationId);

    /**
     * SECURITY: Find by signature request with organization verification (paginated)
     */
    Page<SignatureAuditLog> findBySignatureRequestIdAndOrganizationId(
        Long signatureRequestId, Long organizationId, Pageable pageable);

    /**
     * SECURITY: Find by signature request and event type with organization verification
     */
    List<SignatureAuditLog> findBySignatureRequestIdAndEventTypeAndOrganizationId(
        Long signatureRequestId, String eventType, Long organizationId);

    /**
     * SECURITY: Find latest event for a signature request with organization verification
     */
    @Query("SELECT sal FROM SignatureAuditLog sal WHERE sal.signatureRequestId = :requestId " +
            "AND sal.organizationId = :orgId ORDER BY sal.createdAt DESC LIMIT 1")
    SignatureAuditLog findLatestBySignatureRequestAndOrganizationId(
        @Param("requestId") Long signatureRequestId,
        @Param("orgId") Long organizationId);

    /**
     * SECURITY: Check if event already logged with organization verification
     */
    boolean existsBySignatureRequestIdAndEventTypeAndActorEmailAndOrganizationId(
        Long signatureRequestId, String eventType, String actorEmail, Long organizationId);

    /**
     * SECURITY: Find by ID with tenant isolation
     */
    java.util.Optional<SignatureAuditLog> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Check existence with tenant isolation
     */
    boolean existsByIdAndOrganizationId(Long id, Long organizationId);
}
