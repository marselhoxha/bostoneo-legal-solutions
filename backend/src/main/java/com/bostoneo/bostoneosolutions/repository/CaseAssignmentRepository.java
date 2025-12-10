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
    
    /**
     * Find active assignment for a specific case and user (returns first match)
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.legalCase.id = :caseId " +
           "AND ca.assignedTo.id = :userId AND ca.active = :active ORDER BY ca.createdAt DESC")
    Optional<CaseAssignment> findFirstByCaseIdAndUserIdAndActive(
        @Param("caseId") Long caseId,
        @Param("userId") Long userId,
        @Param("active") boolean active
    );

    /**
     * Find all assignments for a specific case and user (handles duplicates)
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.legalCase.id = :caseId " +
           "AND ca.assignedTo.id = :userId AND ca.active = :active")
    List<CaseAssignment> findAllByCaseIdAndUserIdAndActive(
        @Param("caseId") Long caseId,
        @Param("userId") Long userId,
        @Param("active") boolean active
    );
    
    /**
     * Find all active assignments for a user
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.assignedTo.id = :userId " +
           "AND ca.active = true AND (ca.effectiveTo IS NULL OR ca.effectiveTo >= CURRENT_DATE)")
    List<CaseAssignment> findActiveAssignmentsByUserId(@Param("userId") Long userId);
    
    /**
     * Find all active assignments for a case
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.legalCase.id = :caseId " +
           "AND ca.active = true ORDER BY ca.roleType")
    List<CaseAssignment> findActiveByCaseId(@Param("caseId") Long caseId);
    
    /**
     * Find auto-assignments since a specific date
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.assignmentType = 'AUTO_ASSIGNED' " +
           "AND ca.createdAt >= :startDate")
    List<CaseAssignment> findAutoAssignmentsSince(@Param("startDate") LocalDateTime startDate);
    
    /**
     * Find lead attorney for a case
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.legalCase.id = :caseId " +
           "AND ca.roleType = :roleType AND ca.active = true")
    Optional<CaseAssignment> findByCaseIdAndRoleType(
        @Param("caseId") Long caseId, 
        @Param("roleType") CaseRoleType roleType
    );
    
    /**
     * Find user assignments with pagination
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.assignedTo.id = :userId " +
           "AND ca.active = true ORDER BY ca.createdAt DESC")
    Page<CaseAssignment> findByUserIdWithPagination(
        @Param("userId") Long userId,
        Pageable pageable
    );

    /**
     * Find all active assignments with pagination
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.active = true " +
           "ORDER BY ca.createdAt DESC")
    Page<CaseAssignment> findByActiveTrue(Pageable pageable);
    
    /**
     * Count active cases for a user
     */
    @Query("SELECT COUNT(ca) FROM CaseAssignment ca WHERE ca.assignedTo.id = :userId " +
           "AND ca.active = true AND (ca.effectiveTo IS NULL OR ca.effectiveTo >= CURRENT_DATE)")
    long countActiveByUserId(@Param("userId") Long userId);
    
    /**
     * Find assignments expiring soon
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.active = true " +
           "AND ca.effectiveTo IS NOT NULL AND ca.effectiveTo BETWEEN :startDate AND :endDate")
    List<CaseAssignment> findExpiringSoon(
        @Param("startDate") LocalDate startDate, 
        @Param("endDate") LocalDate endDate
    );
    
    /**
     * Find completed assignments for performance analysis
     */
    @Query("SELECT ca FROM CaseAssignment ca WHERE ca.assignedTo.id = :userId " +
           "AND ca.active = false ORDER BY ca.updatedAt DESC")
    List<CaseAssignment> findCompletedAssignmentsByUserId(@Param("userId") Long userId);
    
    /**
     * Check if user has worked with client before (by client email)
     */
    @Query("SELECT CASE WHEN COUNT(ca) > 0 THEN true ELSE false END " +
           "FROM CaseAssignment ca JOIN ca.legalCase lc " +
           "WHERE ca.assignedTo.id = :userId AND lc.clientEmail = :clientEmail")
    boolean existsByUserIdAndClientEmail(
        @Param("userId") Long userId, 
        @Param("clientEmail") String clientEmail
    );
    
    /**
     * Count assignments by user and case IDs
     */
    @Query("SELECT COUNT(ca) FROM CaseAssignment ca " +
           "WHERE ca.assignedTo.id = :userId AND ca.legalCase.id IN :caseIds")
    long countByUserIdAndCaseIdIn(
        @Param("userId") Long userId, 
        @Param("caseIds") List<Long> caseIds
    );
    
    /**
     * Find attorneys available for assignment (not at capacity)
     */
    @Query(value = "SELECT DISTINCT u.* FROM users u " +
           "JOIN user_roles ur ON u.id = ur.user_id " +
           "JOIN roles r ON ur.role_id = r.id " +
           "LEFT JOIN v_user_workload_summary vw ON u.id = vw.user_id " +
           "WHERE r.name IN ('ATTORNEY', 'SENIOR_ATTORNEY', 'PARTNER') " +
           "AND (vw.capacity_percentage IS NULL OR vw.capacity_percentage < :maxCapacity) " +
           "ORDER BY COALESCE(vw.capacity_percentage, 0)", 
           nativeQuery = true)
    List<Object[]> findAvailableAttorneys(@Param("maxCapacity") double maxCapacity);
}