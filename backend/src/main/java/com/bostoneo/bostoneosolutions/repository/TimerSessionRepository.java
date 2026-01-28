package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.TimerSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Date;
import java.util.List;

public interface TimerSessionRepository extends PagingAndSortingRepository<TimerSession, Long>, ListCrudRepository<TimerSession, Long> {

    // ==================== DEPRECATED METHODS (use tenant-filtered versions) ====================

    /** @deprecated Use findByUserIdAndOrganizationId instead for tenant isolation */
    @Deprecated
    List<TimerSession> findByUserId(Long userId);

    /** @deprecated Use findByUserIdAndOrganizationId(pageable) instead for tenant isolation */
    @Deprecated
    Page<TimerSession> findByUserId(Long userId, Pageable pageable);

    /** @deprecated Use findByLegalCaseIdAndOrganizationId instead for tenant isolation */
    @Deprecated
    List<TimerSession> findByLegalCaseId(Long legalCaseId);

    /** @deprecated Use findByLegalCaseIdAndOrganizationId(pageable) instead for tenant isolation */
    @Deprecated
    Page<TimerSession> findByLegalCaseId(Long legalCaseId, Pageable pageable);

    /** @deprecated Use findByUserIdAndLegalCaseIdAndOrganizationId instead for tenant isolation */
    @Deprecated
    List<TimerSession> findByUserIdAndLegalCaseId(Long userId, Long legalCaseId);

    /** @deprecated Use findByUserIdAndDateRangeAndOrganizationId instead for tenant isolation */
    @Deprecated
    @Query("SELECT ts FROM TimerSession ts WHERE ts.userId = :userId AND ts.startTime BETWEEN :startDate AND :endDate ORDER BY ts.startTime DESC")
    List<TimerSession> findByUserIdAndDateRange(@Param("userId") Long userId, @Param("startDate") Date startDate, @Param("endDate") Date endDate);

    /** @deprecated Use findByUserIdAndConvertedToTimeEntryAndOrganizationId instead for tenant isolation */
    @Deprecated
    List<TimerSession> findByUserIdAndConvertedToTimeEntry(Long userId, Boolean converted);

    /** @deprecated Use findByConvertedToTimeEntryAndOrganizationId instead for tenant isolation */
    @Deprecated
    List<TimerSession> findByConvertedToTimeEntry(Boolean converted);

    /** @deprecated Use findUnconvertedSessionsByOrganizationId instead for tenant isolation */
    @Deprecated
    @Query("SELECT ts FROM TimerSession ts WHERE ts.convertedToTimeEntry = false AND ts.endTime IS NOT NULL ORDER BY ts.endTime DESC")
    List<TimerSession> findUnconvertedSessions();

    /** @deprecated Use getTotalDurationByUserAndDateRangeAndOrganizationId instead for tenant isolation */
    @Deprecated
    @Query("SELECT COALESCE(SUM(ts.duration), 0) FROM TimerSession ts WHERE ts.userId = :userId AND ts.startTime BETWEEN :startDate AND :endDate")
    Long getTotalDurationByUserAndDateRange(@Param("userId") Long userId, @Param("startDate") Date startDate, @Param("endDate") Date endDate);

    /** @deprecated Use getTotalDurationByCaseAndOrganizationId instead for tenant isolation */
    @Deprecated
    @Query("SELECT COALESCE(SUM(ts.duration), 0) FROM TimerSession ts WHERE ts.legalCaseId = :legalCaseId")
    Long getTotalDurationByCase(@Param("legalCaseId") Long legalCaseId);

    /** @deprecated Use getSessionCountByUserSinceAndOrganizationId instead for tenant isolation */
    @Deprecated
    @Query("SELECT COUNT(ts) FROM TimerSession ts WHERE ts.userId = :userId AND ts.startTime >= :startDate")
    Long getSessionCountByUserSince(@Param("userId") Long userId, @Param("startDate") Date startDate);

    /** @deprecated Use getAverageSessionDurationByUserAndOrganizationId instead for tenant isolation */
    @Deprecated
    @Query("SELECT AVG(ts.duration) FROM TimerSession ts WHERE ts.userId = :userId")
    Double getAverageSessionDurationByUser(@Param("userId") Long userId);

    /** @deprecated Use findByTimeEntryIdAndOrganizationId instead for tenant isolation */
    @Deprecated
    List<TimerSession> findByTimeEntryId(Long timeEntryId);

    /** @deprecated Use findConvertedSessionsByOrganizationId instead for tenant isolation */
    @Deprecated
    @Query("SELECT ts FROM TimerSession ts WHERE ts.convertedToTimeEntry = true AND ts.timeEntryId IS NOT NULL")
    List<TimerSession> findConvertedSessions();

    /** @deprecated Use deleteOldConvertedSessionsByOrganizationId instead for tenant isolation */
    @Deprecated
    @Query("DELETE FROM TimerSession ts WHERE ts.startTime < :cutoffDate AND ts.convertedToTimeEntry = true")
    void deleteOldConvertedSessions(@Param("cutoffDate") Date cutoffDate);

    // ==================== TENANT-FILTERED METHODS ====================

    /** SECURITY: Find timer sessions by user within organization */
    List<TimerSession> findByUserIdAndOrganizationId(Long userId, Long organizationId);

    /** SECURITY: Find timer sessions by user within organization (paginated) */
    Page<TimerSession> findByUserIdAndOrganizationId(Long userId, Long organizationId, Pageable pageable);

    /** SECURITY: Find timer sessions by legal case within organization */
    List<TimerSession> findByLegalCaseIdAndOrganizationId(Long legalCaseId, Long organizationId);

    /** SECURITY: Find timer sessions by legal case within organization (paginated) */
    Page<TimerSession> findByLegalCaseIdAndOrganizationId(Long legalCaseId, Long organizationId, Pageable pageable);

    /** SECURITY: Find timer sessions by user and case within organization */
    List<TimerSession> findByUserIdAndLegalCaseIdAndOrganizationId(Long userId, Long legalCaseId, Long organizationId);

    /** SECURITY: Find timer sessions by date range within organization */
    @Query("SELECT ts FROM TimerSession ts WHERE ts.userId = :userId AND ts.organizationId = :orgId " +
           "AND ts.startTime BETWEEN :startDate AND :endDate ORDER BY ts.startTime DESC")
    List<TimerSession> findByUserIdAndDateRangeAndOrganizationId(
        @Param("userId") Long userId,
        @Param("startDate") Date startDate,
        @Param("endDate") Date endDate,
        @Param("orgId") Long organizationId);

    /** SECURITY: Find unconverted timer sessions by user within organization */
    List<TimerSession> findByUserIdAndConvertedToTimeEntryAndOrganizationId(Long userId, Boolean converted, Long organizationId);

    /** SECURITY: Find by conversion status within organization */
    List<TimerSession> findByConvertedToTimeEntryAndOrganizationId(Boolean converted, Long organizationId);

    /** SECURITY: Find unconverted sessions within organization */
    @Query("SELECT ts FROM TimerSession ts WHERE ts.convertedToTimeEntry = false AND ts.endTime IS NOT NULL " +
           "AND ts.organizationId = :orgId ORDER BY ts.endTime DESC")
    List<TimerSession> findUnconvertedSessionsByOrganizationId(@Param("orgId") Long organizationId);

    /** SECURITY: Get total duration for user in date range within organization */
    @Query("SELECT COALESCE(SUM(ts.duration), 0) FROM TimerSession ts WHERE ts.userId = :userId " +
           "AND ts.organizationId = :orgId AND ts.startTime BETWEEN :startDate AND :endDate")
    Long getTotalDurationByUserAndDateRangeAndOrganizationId(
        @Param("userId") Long userId,
        @Param("startDate") Date startDate,
        @Param("endDate") Date endDate,
        @Param("orgId") Long organizationId);

    /** SECURITY: Get total duration for case within organization */
    @Query("SELECT COALESCE(SUM(ts.duration), 0) FROM TimerSession ts WHERE ts.legalCaseId = :legalCaseId " +
           "AND ts.organizationId = :orgId")
    Long getTotalDurationByCaseAndOrganizationId(
        @Param("legalCaseId") Long legalCaseId,
        @Param("orgId") Long organizationId);

    /** SECURITY: Get session count by user since date within organization */
    @Query("SELECT COUNT(ts) FROM TimerSession ts WHERE ts.userId = :userId AND ts.organizationId = :orgId " +
           "AND ts.startTime >= :startDate")
    Long getSessionCountByUserSinceAndOrganizationId(
        @Param("userId") Long userId,
        @Param("startDate") Date startDate,
        @Param("orgId") Long organizationId);

    /** SECURITY: Get average session duration by user within organization */
    @Query("SELECT AVG(ts.duration) FROM TimerSession ts WHERE ts.userId = :userId AND ts.organizationId = :orgId")
    Double getAverageSessionDurationByUserAndOrganizationId(
        @Param("userId") Long userId,
        @Param("orgId") Long organizationId);

    /** SECURITY: Find sessions by time entry ID within organization */
    List<TimerSession> findByTimeEntryIdAndOrganizationId(Long timeEntryId, Long organizationId);

    /** SECURITY: Find converted sessions within organization */
    @Query("SELECT ts FROM TimerSession ts WHERE ts.convertedToTimeEntry = true AND ts.timeEntryId IS NOT NULL " +
           "AND ts.organizationId = :orgId")
    List<TimerSession> findConvertedSessionsByOrganizationId(@Param("orgId") Long organizationId);

    /** SECURITY: Delete old converted sessions within organization */
    @Query("DELETE FROM TimerSession ts WHERE ts.startTime < :cutoffDate AND ts.convertedToTimeEntry = true " +
           "AND ts.organizationId = :orgId")
    void deleteOldConvertedSessionsByOrganizationId(
        @Param("cutoffDate") Date cutoffDate,
        @Param("orgId") Long organizationId);

    /**
     * SECURITY: Find all timer sessions for an organization (tenant isolation)
     */
    List<TimerSession> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Find timer session by ID and organization (tenant isolation)
     */
    java.util.Optional<TimerSession> findByIdAndOrganizationId(Long id, Long organizationId);
} 