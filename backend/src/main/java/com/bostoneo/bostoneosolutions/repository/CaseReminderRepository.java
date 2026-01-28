package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.CaseReminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for CaseReminder with tenant isolation support
 * All methods use organization_id filtering for multi-tenant security
 */
@Repository
public interface CaseReminderRepository extends JpaRepository<CaseReminder, Long> {

    // ==================== TENANT-FILTERED METHODS ====================

    /**
     * Find reminder by ID and organization (SECURITY: tenant isolation)
     */
    Optional<CaseReminder> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Find all reminders for a case within organization (SECURITY: tenant isolation)
     */
    List<CaseReminder> findByOrganizationIdAndCaseIdOrderByDueDateAsc(Long organizationId, Long caseId);

    /**
     * Find reminders for a case with specific status (SECURITY: tenant isolation)
     */
    List<CaseReminder> findByOrganizationIdAndCaseIdAndStatusOrderByDueDateAsc(
            Long organizationId, Long caseId, String status);

    /**
     * Find upcoming reminders for a user within organization (SECURITY: tenant isolation)
     */
    @Query("SELECT r FROM CaseReminder r WHERE r.organizationId = :organizationId " +
           "AND r.userId = :userId " +
           "AND r.status = 'PENDING' " +
           "AND r.dueDate > :now " +
           "ORDER BY r.dueDate ASC")
    List<CaseReminder> findUpcomingRemindersForUser(
            @Param("organizationId") Long organizationId,
            @Param("userId") Long userId,
            @Param("now") LocalDateTime now);

    /**
     * Find all reminders due within a time range (for scheduled notifications)
     * SECURITY: Filtered by organization
     */
    @Query("SELECT r FROM CaseReminder r WHERE r.organizationId = :organizationId " +
           "AND r.status = 'PENDING' " +
           "AND r.reminderDate BETWEEN :start AND :end " +
           "ORDER BY r.reminderDate ASC")
    List<CaseReminder> findDueReminders(
            @Param("organizationId") Long organizationId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    /**
     * Count pending reminders for a case (SECURITY: tenant isolation)
     */
    long countByOrganizationIdAndCaseIdAndStatus(Long organizationId, Long caseId, String status);

    /**
     * Delete reminder by ID within organization (SECURITY: tenant isolation)
     */
    void deleteByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Delete all reminders for a case (SECURITY: tenant isolation)
     */
    void deleteByOrganizationIdAndCaseId(Long organizationId, Long caseId);
}
