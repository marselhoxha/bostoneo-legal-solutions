package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.CaseRoleType;
import com.bostoneo.bostoneosolutions.model.CaseAssignment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CaseAssignmentRepository extends JpaRepository<CaseAssignment, Long> {
    
    // ==================== DEPRECATED METHODS (use tenant-filtered versions) ====================

    /**
     * @deprecated Use findFirstByCaseIdAndUserIdAndActiveAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.legalCase.id = :caseId " +
           "AND ca.assignedTo.id = :userId AND ca.active = :active ORDER BY ca.createdAt DESC")
    Optional<CaseAssignment> findFirstByCaseIdAndUserIdAndActive(
        @Param("caseId") Long caseId,
        @Param("userId") Long userId,
        @Param("active") boolean active
    );

    /**
     * @deprecated Use findAllByCaseIdAndUserIdAndActiveAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.legalCase.id = :caseId " +
           "AND ca.assignedTo.id = :userId AND ca.active = :active")
    List<CaseAssignment> findAllByCaseIdAndUserIdAndActive(
        @Param("caseId") Long caseId,
        @Param("userId") Long userId,
        @Param("active") boolean active
    );

    /**
     * @deprecated Use findActiveAssignmentsByUserIdAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.assignedTo.id = :userId " +
           "AND ca.active = true AND (ca.effectiveTo IS NULL OR ca.effectiveTo >= CURRENT_DATE)")
    List<CaseAssignment> findActiveAssignmentsByUserId(@Param("userId") Long userId);

    /**
     * @deprecated Use findActiveByCaseIdAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.legalCase.id = :caseId " +
           "AND ca.active = true ORDER BY ca.roleType")
    List<CaseAssignment> findActiveByCaseId(@Param("caseId") Long caseId);

    /**
     * @deprecated Use findAutoAssignmentsSinceByOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.assignmentType = 'AUTO_ASSIGNED' " +
           "AND ca.createdAt >= :startDate")
    List<CaseAssignment> findAutoAssignmentsSince(@Param("startDate") LocalDateTime startDate);

    /**
     * @deprecated Use findByCaseIdAndRoleTypeAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.legalCase.id = :caseId " +
           "AND ca.roleType = :roleType AND ca.active = true")
    Optional<CaseAssignment> findByCaseIdAndRoleType(
        @Param("caseId") Long caseId,
        @Param("roleType") CaseRoleType roleType
    );

    /**
     * @deprecated Use findByOrganizationIdAndUserId instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.assignedTo.id = :userId " +
           "AND ca.active = true ORDER BY ca.createdAt DESC")
    Page<CaseAssignment> findByUserIdWithPagination(
        @Param("userId") Long userId,
        Pageable pageable
    );

    /**
     * @deprecated Use findByOrganizationIdAndActiveTrue instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.active = true " +
           "ORDER BY ca.createdAt DESC")
    Page<CaseAssignment> findByActiveTrue(Pageable pageable);

    /**
     * @deprecated Use countActiveByUserIdAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT COUNT(ca) FROM CaseAssignment ca WHERE ca.assignedTo.id = :userId " +
           "AND ca.active = true AND (ca.effectiveTo IS NULL OR ca.effectiveTo >= CURRENT_DATE)")
    long countActiveByUserId(@Param("userId") Long userId);

    /**
     * @deprecated Use findExpiringSoonByOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.active = true " +
           "AND ca.effectiveTo IS NOT NULL AND ca.effectiveTo BETWEEN :startDate AND :endDate")
    List<CaseAssignment> findExpiringSoon(
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    /**
     * @deprecated Use findCompletedAssignmentsByUserIdAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.assignedTo.id = :userId " +
           "AND ca.active = false ORDER BY ca.updatedAt DESC")
    List<CaseAssignment> findCompletedAssignmentsByUserId(@Param("userId") Long userId);

    /**
     * @deprecated Use existsByUserIdAndClientEmailAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT CASE WHEN COUNT(ca) > 0 THEN true ELSE false END " +
           "FROM CaseAssignment ca JOIN ca.legalCase lc " +
           "WHERE ca.assignedTo.id = :userId AND lc.clientEmail = :clientEmail")
    boolean existsByUserIdAndClientEmail(
        @Param("userId") Long userId,
        @Param("clientEmail") String clientEmail
    );

    /**
     * @deprecated Use countByUserIdAndCaseIdInAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT COUNT(ca) FROM CaseAssignment ca " +
           "WHERE ca.assignedTo.id = :userId AND ca.legalCase.id IN :caseIds")
    long countByUserIdAndCaseIdIn(
        @Param("userId") Long userId,
        @Param("caseIds") List<Long> caseIds
    );
    
    /**
     * Find attorneys available for assignment (not at capacity)
     * @deprecated Use findAvailableAttorneysByOrganization instead for tenant isolation
     */
    @Deprecated
    @Query(value = "SELECT DISTINCT u.* FROM users u " +
           "JOIN user_roles ur ON u.id = ur.user_id " +
           "JOIN roles r ON ur.role_id = r.id " +
           "LEFT JOIN v_user_workload_summary vw ON u.id = vw.user_id " +
           "WHERE r.name IN ('ATTORNEY', 'SENIOR_ATTORNEY', 'PARTNER') " +
           "AND (vw.capacity_percentage IS NULL OR vw.capacity_percentage < :maxCapacity) " +
           "ORDER BY COALESCE(vw.capacity_percentage, 0)",
           nativeQuery = true)
    List<Object[]> findAvailableAttorneys(@Param("maxCapacity") double maxCapacity);

    /**
     * SECURITY: Find attorneys available for assignment filtered by organization
     */
    @Query(value = "SELECT DISTINCT u.* FROM users u " +
           "JOIN user_roles ur ON u.id = ur.user_id " +
           "JOIN roles r ON ur.role_id = r.id " +
           "LEFT JOIN v_user_workload_summary vw ON u.id = vw.user_id " +
           "WHERE u.organization_id = :orgId " +
           "AND r.name IN ('ATTORNEY', 'SENIOR_ATTORNEY', 'PARTNER') " +
           "AND (vw.capacity_percentage IS NULL OR vw.capacity_percentage < :maxCapacity) " +
           "ORDER BY COALESCE(vw.capacity_percentage, 0)",
           nativeQuery = true)
    List<Object[]> findAvailableAttorneysByOrganization(@Param("orgId") Long organizationId, @Param("maxCapacity") double maxCapacity);

    // ==================== TENANT-FILTERED METHODS ====================

    /**
     * Find all assignments for cases in a specific organization
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.legalCase.organizationId = :organizationId")
    List<CaseAssignment> findByOrganizationId(@Param("organizationId") Long organizationId);

    /**
     * Find all active assignments for cases in a specific organization with pagination
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.legalCase.organizationId = :organizationId " +
           "AND ca.active = true ORDER BY ca.createdAt DESC")
    Page<CaseAssignment> findByOrganizationIdAndActiveTrue(@Param("organizationId") Long organizationId, Pageable pageable);

    /**
     * Find assignments by organization and user with pagination
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.legalCase.organizationId = :organizationId " +
           "AND ca.assignedTo.id = :userId AND ca.active = true ORDER BY ca.createdAt DESC")
    Page<CaseAssignment> findByOrganizationIdAndUserId(
        @Param("organizationId") Long organizationId,
        @Param("userId") Long userId,
        Pageable pageable);

    /**
     * SECURITY: Find all active assignments for a case with organization verification
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.legalCase.id = :caseId " +
           "AND ca.legalCase.organizationId = :organizationId " +
           "AND ca.active = true ORDER BY ca.roleType")
    List<CaseAssignment> findActiveByCaseIdAndOrganizationId(
        @Param("caseId") Long caseId,
        @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find all active assignments for a user within an organization
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.assignedTo.id = :userId " +
           "AND ca.legalCase.organizationId = :organizationId " +
           "AND ca.active = true AND (ca.effectiveTo IS NULL OR ca.effectiveTo >= CURRENT_DATE)")
    List<CaseAssignment> findActiveAssignmentsByUserIdAndOrganizationId(
        @Param("userId") Long userId,
        @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find active assignment for case/user with org verification (returns first match)
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.legalCase.id = :caseId " +
           "AND ca.assignedTo.id = :userId AND ca.active = :active " +
           "AND ca.legalCase.organizationId = :organizationId ORDER BY ca.createdAt DESC")
    Optional<CaseAssignment> findFirstByCaseIdAndUserIdAndActiveAndOrganizationId(
        @Param("caseId") Long caseId,
        @Param("userId") Long userId,
        @Param("active") boolean active,
        @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find all assignments for case/user with org verification
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.legalCase.id = :caseId " +
           "AND ca.assignedTo.id = :userId AND ca.active = :active " +
           "AND ca.legalCase.organizationId = :organizationId")
    List<CaseAssignment> findAllByCaseIdAndUserIdAndActiveAndOrganizationId(
        @Param("caseId") Long caseId,
        @Param("userId") Long userId,
        @Param("active") boolean active,
        @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find lead attorney for case with org verification
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.legalCase.id = :caseId " +
           "AND ca.roleType = :roleType AND ca.active = true " +
           "AND ca.legalCase.organizationId = :organizationId")
    Optional<CaseAssignment> findByCaseIdAndRoleTypeAndOrganizationId(
        @Param("caseId") Long caseId,
        @Param("roleType") CaseRoleType roleType,
        @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Count active cases for user within organization
     */
    @Query("SELECT COUNT(ca) FROM CaseAssignment ca WHERE ca.assignedTo.id = :userId " +
           "AND ca.legalCase.organizationId = :organizationId " +
           "AND ca.active = true AND (ca.effectiveTo IS NULL OR ca.effectiveTo >= CURRENT_DATE)")
    long countActiveByUserIdAndOrganizationId(
        @Param("userId") Long userId,
        @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find auto-assignments since a specific date within organization
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.assignmentType = 'AUTO_ASSIGNED' " +
           "AND ca.createdAt >= :startDate AND ca.legalCase.organizationId = :organizationId")
    List<CaseAssignment> findAutoAssignmentsSinceByOrganizationId(
        @Param("startDate") LocalDateTime startDate,
        @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find assignments expiring soon within organization
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.active = true " +
           "AND ca.legalCase.organizationId = :organizationId " +
           "AND ca.effectiveTo IS NOT NULL AND ca.effectiveTo BETWEEN :startDate AND :endDate")
    List<CaseAssignment> findExpiringSoonByOrganizationId(
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate,
        @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find completed assignments for user within organization
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.assignedTo.id = :userId " +
           "AND ca.legalCase.organizationId = :organizationId " +
           "AND ca.active = false ORDER BY ca.updatedAt DESC")
    List<CaseAssignment> findCompletedAssignmentsByUserIdAndOrganizationId(
        @Param("userId") Long userId,
        @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Check if user has worked with client before within organization
     */
    @Query("SELECT CASE WHEN COUNT(ca) > 0 THEN true ELSE false END " +
           "FROM CaseAssignment ca JOIN ca.legalCase lc " +
           "WHERE ca.assignedTo.id = :userId AND lc.clientEmail = :clientEmail " +
           "AND lc.organizationId = :organizationId")
    boolean existsByUserIdAndClientEmailAndOrganizationId(
        @Param("userId") Long userId,
        @Param("clientEmail") String clientEmail,
        @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Count assignments by user and case IDs within organization
     */
    @Query("SELECT COUNT(ca) FROM CaseAssignment ca " +
           "WHERE ca.assignedTo.id = :userId AND ca.legalCase.id IN :caseIds " +
           "AND ca.legalCase.organizationId = :organizationId")
    long countByUserIdAndCaseIdInAndOrganizationId(
        @Param("userId") Long userId,
        @Param("caseIds") List<Long> caseIds,
        @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find by ID with tenant isolation (through legal case)
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.id = :id AND ca.legalCase.organizationId = :organizationId")
    Optional<CaseAssignment> findByIdAndOrganizationId(@Param("id") Long id, @Param("organizationId") Long organizationId);

    /**
     * SECURITY: Check existence with tenant isolation
     */
    @Query("SELECT CASE WHEN COUNT(ca) > 0 THEN true ELSE false END FROM CaseAssignment ca WHERE ca.id = :id AND ca.legalCase.organizationId = :organizationId")
    boolean existsByIdAndOrganizationId(@Param("id") Long id, @Param("organizationId") Long organizationId);
}