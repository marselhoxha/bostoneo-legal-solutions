package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PIDocumentRequestLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

/**
 * Repository for PI Document Request Log entities.
 */
@Repository
public interface PIDocumentRequestLogRepository extends JpaRepository<PIDocumentRequestLog, Long> {

    /**
     * Find all request logs for a checklist item
     */
    List<PIDocumentRequestLog> findByChecklistItemIdAndOrganizationIdOrderBySentAtDesc(
            Long checklistItemId, Long organizationId);

    /**
     * Find all request logs for a case
     */
    List<PIDocumentRequestLog> findByCaseIdAndOrganizationIdOrderBySentAtDesc(
            Long caseId, Long organizationId);

    /**
     * Count requests for a checklist item
     */
    long countByChecklistItemIdAndOrganizationId(Long checklistItemId, Long organizationId);

    /**
     * Find recent requests for a case (last N)
     */
    @Query("SELECT r FROM PIDocumentRequestLog r WHERE r.caseId = :caseId AND r.organizationId = :orgId " +
           "ORDER BY r.sentAt DESC LIMIT :limit")
    List<PIDocumentRequestLog> findRecentRequestsByCaseId(
            @Param("caseId") Long caseId,
            @Param("orgId") Long organizationId,
            @Param("limit") int limit);

    /**
     * Find requests by channel status
     */
    List<PIDocumentRequestLog> findByCaseIdAndOrganizationIdAndChannelStatusOrderBySentAtDesc(
            Long caseId, Long organizationId, String channelStatus);

    /**
     * Calculate total document fees for a case
     */
    @Query("SELECT COALESCE(SUM(r.documentFee), 0) FROM PIDocumentRequestLog r " +
           "WHERE r.caseId = :caseId AND r.organizationId = :orgId AND r.feeStatus = 'PAID'")
    BigDecimal calculateTotalPaidFees(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);

    /**
     * Calculate total pending fees for a case
     */
    @Query("SELECT COALESCE(SUM(r.documentFee), 0) FROM PIDocumentRequestLog r " +
           "WHERE r.caseId = :caseId AND r.organizationId = :orgId AND r.feeStatus = 'PENDING'")
    BigDecimal calculateTotalPendingFees(@Param("caseId") Long caseId, @Param("orgId") Long organizationId);
}
