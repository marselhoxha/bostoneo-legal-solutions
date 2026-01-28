package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.CommunicationLog;
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
public interface CommunicationLogRepository extends JpaRepository<CommunicationLog, Long> {

    // Find by Twilio SID
    Optional<CommunicationLog> findByTwilioSid(String twilioSid);

    // Find by client
    Page<CommunicationLog> findByClientIdOrderByCreatedAtDesc(Long clientId, Pageable pageable);

    List<CommunicationLog> findByClientIdOrderByCreatedAtDesc(Long clientId);

    // Find by case
    Page<CommunicationLog> findByCaseIdOrderByCreatedAtDesc(Long caseId, Pageable pageable);

    List<CommunicationLog> findByCaseIdOrderByCreatedAtDesc(Long caseId);

    // Find by user
    Page<CommunicationLog> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    // Find by channel
    Page<CommunicationLog> findByChannelOrderByCreatedAtDesc(String channel, Pageable pageable);

    // Find by status
    List<CommunicationLog> findByStatus(String status);

    // Find by client and channel
    Page<CommunicationLog> findByClientIdAndChannelOrderByCreatedAtDesc(
            Long clientId, String channel, Pageable pageable);

    // Find by case and channel
    Page<CommunicationLog> findByCaseIdAndChannelOrderByCreatedAtDesc(
            Long caseId, String channel, Pageable pageable);

    // Find communications in date range
    @Query("SELECT c FROM CommunicationLog c WHERE c.createdAt BETWEEN :startDate AND :endDate ORDER BY c.createdAt DESC")
    Page<CommunicationLog> findByDateRange(
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            Pageable pageable);

    // Find by client and date range
    @Query("SELECT c FROM CommunicationLog c WHERE c.clientId = :clientId AND c.createdAt BETWEEN :startDate AND :endDate ORDER BY c.createdAt DESC")
    List<CommunicationLog> findByClientIdAndDateRange(
            @Param("clientId") Long clientId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    // Count by channel
    long countByChannel(String channel);

    // Count by status
    long countByStatus(String status);

    // Count by client
    long countByClientId(Long clientId);

    // Count failed communications
    @Query("SELECT COUNT(c) FROM CommunicationLog c WHERE c.status IN ('FAILED', 'UNDELIVERED')")
    long countFailedCommunications();

    // Get recent communications for a client (last 30 days)
    @Query("SELECT c FROM CommunicationLog c WHERE c.clientId = :clientId AND c.createdAt >= :since ORDER BY c.createdAt DESC")
    List<CommunicationLog> findRecentByClientId(@Param("clientId") Long clientId, @Param("since") LocalDateTime since);

    // Get communication statistics by channel
    @Query("SELECT c.channel, COUNT(c) FROM CommunicationLog c WHERE c.createdAt >= :since GROUP BY c.channel")
    List<Object[]> getChannelStatistics(@Param("since") LocalDateTime since);

    // Search communications
    @Query("SELECT c FROM CommunicationLog c WHERE " +
           "(c.toAddress LIKE %:query% OR c.content LIKE %:query% OR c.subject LIKE %:query%) " +
           "ORDER BY c.createdAt DESC")
    Page<CommunicationLog> searchCommunications(@Param("query") String query, Pageable pageable);

    // ==================== TENANT-FILTERED METHODS ====================

    java.util.Optional<CommunicationLog> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);

    Page<CommunicationLog> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId, Pageable pageable);

    Page<CommunicationLog> findByOrganizationIdAndClientIdOrderByCreatedAtDesc(Long organizationId, Long clientId, Pageable pageable);

    List<CommunicationLog> findByOrganizationIdAndClientIdOrderByCreatedAtDesc(Long organizationId, Long clientId);

    Page<CommunicationLog> findByOrganizationIdAndCaseIdOrderByCreatedAtDesc(Long organizationId, Long caseId, Pageable pageable);

    Page<CommunicationLog> findByOrganizationIdAndChannelOrderByCreatedAtDesc(Long organizationId, String channel, Pageable pageable);

    Page<CommunicationLog> findByOrganizationIdAndUserIdOrderByCreatedAtDesc(Long organizationId, Long userId, Pageable pageable);

    @Query("SELECT c FROM CommunicationLog c WHERE c.organizationId = :orgId AND c.createdAt BETWEEN :startDate AND :endDate ORDER BY c.createdAt DESC")
    Page<CommunicationLog> findByOrganizationIdAndDateRange(@Param("orgId") Long organizationId,
                                                            @Param("startDate") LocalDateTime startDate,
                                                            @Param("endDate") LocalDateTime endDate,
                                                            Pageable pageable);

    long countByOrganizationId(Long organizationId);

    long countByOrganizationIdAndChannel(Long organizationId, String channel);

    @Query("SELECT c FROM CommunicationLog c WHERE c.organizationId = :orgId AND " +
           "(c.toAddress LIKE %:query% OR c.content LIKE %:query% OR c.subject LIKE %:query%) " +
           "ORDER BY c.createdAt DESC")
    Page<CommunicationLog> searchByOrganization(@Param("orgId") Long organizationId, @Param("query") String query, Pageable pageable);

    // SECURITY: Tenant-filtered recent by client
    @Query("SELECT c FROM CommunicationLog c WHERE c.organizationId = :orgId AND c.clientId = :clientId AND c.createdAt >= :since ORDER BY c.createdAt DESC")
    List<CommunicationLog> findRecentByOrganizationIdAndClientId(@Param("orgId") Long organizationId, @Param("clientId") Long clientId, @Param("since") LocalDateTime since);

    // SECURITY: Tenant-filtered channel statistics
    @Query("SELECT c.channel, COUNT(c) FROM CommunicationLog c WHERE c.organizationId = :orgId AND c.createdAt >= :since GROUP BY c.channel")
    List<Object[]> getChannelStatisticsByOrganizationId(@Param("orgId") Long organizationId, @Param("since") LocalDateTime since);

    // SECURITY: Tenant-filtered failed count
    @Query("SELECT COUNT(c) FROM CommunicationLog c WHERE c.organizationId = :orgId AND c.status IN ('FAILED', 'UNDELIVERED')")
    long countFailedByOrganizationId(@Param("orgId") Long organizationId);
}
