package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AppointmentRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AppointmentRequestRepository extends JpaRepository<AppointmentRequest, Long> {

    // =====================================================
    // CLIENT QUERIES
    // =====================================================

    /**
     * Find all appointments for a client
     */
    Page<AppointmentRequest> findByClientIdOrderByPreferredDatetimeDesc(Long clientId, Pageable pageable);

    /**
     * Find upcoming appointments for a client (confirmed only)
     */
    @Query("SELECT a FROM AppointmentRequest a WHERE a.clientId = :clientId " +
           "AND a.status = 'CONFIRMED' AND a.confirmedDatetime >= :now " +
           "ORDER BY a.confirmedDatetime ASC")
    List<AppointmentRequest> findUpcomingByClientId(@Param("clientId") Long clientId, @Param("now") LocalDateTime now);

    /**
     * Find pending appointments for a client
     */
    List<AppointmentRequest> findByClientIdAndStatusOrderByPreferredDatetimeAsc(Long clientId, String status);

    // =====================================================
    // ATTORNEY QUERIES
    // =====================================================

    /**
     * Find all appointments for an attorney
     */
    Page<AppointmentRequest> findByAttorneyIdOrderByPreferredDatetimeDesc(Long attorneyId, Pageable pageable);

    /**
     * Find pending appointment requests for an attorney
     */
    List<AppointmentRequest> findByAttorneyIdAndStatusOrderByCreatedAtAsc(Long attorneyId, String status);

    /**
     * Find pending reschedule requests for an attorney (by preferredDatetime for urgency)
     */
    List<AppointmentRequest> findByAttorneyIdAndStatusOrderByPreferredDatetimeAsc(Long attorneyId, String status);

    /**
     * Find upcoming confirmed appointments for an attorney
     */
    @Query("SELECT a FROM AppointmentRequest a WHERE a.attorneyId = :attorneyId " +
           "AND a.status = 'CONFIRMED' AND a.confirmedDatetime >= :now " +
           "ORDER BY a.confirmedDatetime ASC")
    List<AppointmentRequest> findUpcomingByAttorneyId(@Param("attorneyId") Long attorneyId, @Param("now") LocalDateTime now);

    /**
     * Count pending requests for an attorney
     */
    long countByAttorneyIdAndStatus(Long attorneyId, String status);

    // =====================================================
    // CASE QUERIES
    // =====================================================

    /**
     * Find appointments for a specific case
     */
    List<AppointmentRequest> findByCaseIdOrderByPreferredDatetimeDesc(Long caseId);

    // =====================================================
    // CONFLICT DETECTION
    // =====================================================

    /**
     * Find appointments for an attorney in a time range (for conflict detection)
     */
    @Query("SELECT a FROM AppointmentRequest a WHERE a.attorneyId = :attorneyId " +
           "AND a.status IN ('CONFIRMED', 'PENDING') " +
           "AND ((a.confirmedDatetime BETWEEN :start AND :end) " +
           "OR (a.preferredDatetime BETWEEN :start AND :end))")
    List<AppointmentRequest> findConflictingAppointments(
            @Param("attorneyId") Long attorneyId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    // =====================================================
    // REMINDER QUERIES
    // =====================================================

    /**
     * Find appointments needing 24-hour reminder
     */
    @Query("SELECT a FROM AppointmentRequest a WHERE a.status = 'CONFIRMED' " +
           "AND a.reminder24hSent = false " +
           "AND a.confirmedDatetime BETWEEN :start AND :end")
    List<AppointmentRequest> findNeedingReminder24h(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    /**
     * Find appointments needing 1-hour reminder
     */
    @Query("SELECT a FROM AppointmentRequest a WHERE a.status = 'CONFIRMED' " +
           "AND a.reminder1hSent = false " +
           "AND a.confirmedDatetime BETWEEN :start AND :end")
    List<AppointmentRequest> findNeedingReminder1h(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    // =====================================================
    // STATISTICS
    // =====================================================

    /**
     * Count appointments by status for an attorney
     */
    @Query("SELECT a.status, COUNT(a) FROM AppointmentRequest a WHERE a.attorneyId = :attorneyId GROUP BY a.status")
    List<Object[]> countByStatusForAttorney(@Param("attorneyId") Long attorneyId);

    /**
     * Count appointments by type for analytics
     */
    @Query("SELECT a.appointmentType, COUNT(a) FROM AppointmentRequest a WHERE a.attorneyId = :attorneyId GROUP BY a.appointmentType")
    List<Object[]> countByTypeForAttorney(@Param("attorneyId") Long attorneyId);
}
