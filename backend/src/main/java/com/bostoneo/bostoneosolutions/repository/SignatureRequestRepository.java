package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.SignatureStatus;
import com.bostoneo.bostoneosolutions.model.SignatureRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SignatureRequestRepository extends JpaRepository<SignatureRequest, Long> {

    // Find by organization
    Page<SignatureRequest> findByOrganizationId(Long organizationId, Pageable pageable);

    List<SignatureRequest> findByOrganizationIdAndStatus(Long organizationId, SignatureStatus status);

    // Find by BoldSign document ID
    Optional<SignatureRequest> findByBoldsignDocumentId(String boldsignDocumentId);

    // SECURITY: Tenant-filtered find by BoldSign document ID
    Optional<SignatureRequest> findByBoldsignDocumentIdAndOrganizationId(String boldsignDocumentId, Long organizationId);

    // Find by case
    List<SignatureRequest> findByCaseId(Long caseId);

    Page<SignatureRequest> findByCaseIdAndOrganizationId(Long caseId, Long organizationId, Pageable pageable);

    // Find by client
    List<SignatureRequest> findByClientId(Long clientId);

    Page<SignatureRequest> findByClientIdAndOrganizationId(Long clientId, Long organizationId, Pageable pageable);

    // Find pending requests (for reminders)
    @Query("SELECT sr FROM SignatureRequest sr WHERE sr.organizationId = :orgId " +
            "AND sr.status IN ('SENT', 'VIEWED', 'PARTIALLY_SIGNED') " +
            "AND sr.expiresAt > :now")
    List<SignatureRequest> findPendingByOrganization(@Param("orgId") Long organizationId,
                                                      @Param("now") LocalDateTime now);

    // Find expiring soon (for urgent reminders)
    @Query("SELECT sr FROM SignatureRequest sr WHERE sr.status IN ('SENT', 'VIEWED', 'PARTIALLY_SIGNED') " +
            "AND sr.expiresAt BETWEEN :now AND :expiryThreshold")
    List<SignatureRequest> findExpiringSoon(@Param("now") LocalDateTime now,
                                             @Param("expiryThreshold") LocalDateTime expiryThreshold);

    // Find expired requests to update status
    @Query("SELECT sr FROM SignatureRequest sr WHERE sr.status IN ('SENT', 'VIEWED', 'PARTIALLY_SIGNED') " +
            "AND sr.expiresAt < :now")
    List<SignatureRequest> findExpired(@Param("now") LocalDateTime now);

    // Count by status for organization
    long countByOrganizationIdAndStatus(Long organizationId, SignatureStatus status);

    // Statistics queries
    @Query("SELECT COUNT(sr) FROM SignatureRequest sr WHERE sr.organizationId = :orgId " +
            "AND sr.status = 'COMPLETED' AND sr.completedAt BETWEEN :start AND :end")
    long countCompletedInPeriod(@Param("orgId") Long organizationId,
                                @Param("start") LocalDateTime start,
                                @Param("end") LocalDateTime end);

    @Query("SELECT COUNT(sr) FROM SignatureRequest sr WHERE sr.organizationId = :orgId " +
            "AND sr.createdAt BETWEEN :start AND :end")
    long countCreatedInPeriod(@Param("orgId") Long organizationId,
                              @Param("start") LocalDateTime start,
                              @Param("end") LocalDateTime end);

    // Search
    @Query("SELECT sr FROM SignatureRequest sr WHERE sr.organizationId = :orgId " +
            "AND (LOWER(sr.title) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(sr.signerName) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(sr.signerEmail) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<SignatureRequest> searchByOrganization(@Param("orgId") Long organizationId,
                                                 @Param("search") String search,
                                                 Pageable pageable);

    // Find requests needing reminders
    @Query("SELECT sr FROM SignatureRequest sr WHERE sr.status IN ('SENT', 'VIEWED', 'PARTIALLY_SIGNED') " +
            "AND sr.expiresAt > :now " +
            "AND (sr.reminderEmail = true OR sr.reminderSms = true OR sr.reminderWhatsapp = true) " +
            "AND (sr.lastReminderSentAt IS NULL OR sr.lastReminderSentAt < :reminderThreshold)")
    List<SignatureRequest> findNeedingReminders(@Param("now") LocalDateTime now,
                                                 @Param("reminderThreshold") LocalDateTime reminderThreshold);

    // ==================== TENANT-FILTERED METHODS ====================

    Optional<SignatureRequest> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);

    // Find expired requests by organization (for scheduled tasks)
    @Query("SELECT sr FROM SignatureRequest sr WHERE sr.organizationId = :organizationId " +
            "AND sr.status IN ('SENT', 'VIEWED', 'PARTIALLY_SIGNED') " +
            "AND sr.expiresAt < :now")
    List<SignatureRequest> findExpiredByOrganizationId(@Param("organizationId") Long organizationId,
                                                        @Param("now") LocalDateTime now);

    // Find expiring soon by organization (for scheduled tasks)
    @Query("SELECT sr FROM SignatureRequest sr WHERE sr.organizationId = :organizationId " +
            "AND sr.status IN ('SENT', 'VIEWED', 'PARTIALLY_SIGNED') " +
            "AND sr.expiresAt BETWEEN :now AND :expiryThreshold")
    List<SignatureRequest> findExpiringSoonByOrganizationId(@Param("organizationId") Long organizationId,
                                                             @Param("now") LocalDateTime now,
                                                             @Param("expiryThreshold") LocalDateTime expiryThreshold);

    // Find requests needing reminders by organization (for scheduled tasks)
    @Query("SELECT sr FROM SignatureRequest sr WHERE sr.organizationId = :organizationId " +
            "AND sr.status IN ('SENT', 'VIEWED', 'PARTIALLY_SIGNED') " +
            "AND sr.expiresAt > :now " +
            "AND (sr.reminderEmail = true OR sr.reminderSms = true OR sr.reminderWhatsapp = true) " +
            "AND (sr.lastReminderSentAt IS NULL OR sr.lastReminderSentAt < :reminderThreshold)")
    List<SignatureRequest> findNeedingRemindersByOrganizationId(@Param("organizationId") Long organizationId,
                                                                 @Param("now") LocalDateTime now,
                                                                 @Param("reminderThreshold") LocalDateTime reminderThreshold);
}
