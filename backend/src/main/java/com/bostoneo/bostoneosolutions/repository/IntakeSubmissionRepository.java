package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.IntakeSubmission;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;

@Repository
public interface IntakeSubmissionRepository extends JpaRepository<IntakeSubmission, Long> {

    List<IntakeSubmission> findByStatus(String status);
    
    Page<IntakeSubmission> findByStatus(String status, Pageable pageable);
    
    List<IntakeSubmission> findByFormId(Long formId);
    
    Page<IntakeSubmission> findByFormId(Long formId, Pageable pageable);
    
    List<IntakeSubmission> findByLeadId(Long leadId);
    
    List<IntakeSubmission> findByReviewedBy(Long reviewedBy);
    
    @Query("SELECT i FROM IntakeSubmission i WHERE i.status IN :statuses")
    List<IntakeSubmission> findByStatusIn(@Param("statuses") List<String> statuses);
    
    @Query("SELECT i FROM IntakeSubmission i WHERE i.status IN :statuses")
    Page<IntakeSubmission> findByStatusIn(@Param("statuses") List<String> statuses, Pageable pageable);
    
    @Query("SELECT i FROM IntakeSubmission i WHERE i.priorityScore >= :minScore ORDER BY i.priorityScore DESC")
    List<IntakeSubmission> findByPriorityScoreGreaterThanEqualOrderByPriorityScoreDesc(@Param("minScore") Integer minScore);
    
    @Query("SELECT i FROM IntakeSubmission i WHERE i.status = 'PENDING' ORDER BY i.priorityScore DESC, i.createdAt ASC")
    List<IntakeSubmission> findPendingOrderByPriorityAndCreatedAt();
    
    @Query("SELECT i FROM IntakeSubmission i WHERE i.status = 'PENDING' ORDER BY i.priorityScore DESC, i.createdAt ASC")
    Page<IntakeSubmission> findPendingOrderByPriorityAndCreatedAt(Pageable pageable);
    
    @Query("SELECT i FROM IntakeSubmission i WHERE i.createdAt BETWEEN :startDate AND :endDate")
    List<IntakeSubmission> findByCreatedAtBetween(@Param("startDate") Timestamp startDate, @Param("endDate") Timestamp endDate);
    
    @Query("SELECT COUNT(i) FROM IntakeSubmission i WHERE i.status = :status")
    long countByStatus(@Param("status") String status);
    
    @Query("SELECT i.status, COUNT(i) FROM IntakeSubmission i GROUP BY i.status")
    List<Object[]> countByStatusGrouped();
    
    @Query("SELECT i FROM IntakeSubmission i JOIN i.intakeForm f WHERE f.practiceArea = :practiceArea")
    List<IntakeSubmission> findByPracticeArea(@Param("practiceArea") String practiceArea);
    
    @Query("SELECT i FROM IntakeSubmission i WHERE i.status = :status AND i.createdAt >= :since")
    List<IntakeSubmission> findByStatusAndCreatedAtAfter(@Param("status") String status, @Param("since") Timestamp since);
    
    // Additional methods for IntakeSubmissionResource support
    @Query("SELECT i FROM IntakeSubmission i WHERE i.priorityScore >= :threshold ORDER BY i.priorityScore DESC")
    List<IntakeSubmission> findByPriorityScoreGreaterThanEqual(@Param("threshold") Integer threshold);
    
    @Query("SELECT i FROM IntakeSubmission i WHERE i.priorityScore BETWEEN :min AND :max")
    List<IntakeSubmission> findByPriorityScoreBetween(@Param("min") Integer min, @Param("max") Integer max);
    
    @Query("SELECT i FROM IntakeSubmission i WHERE i.priorityScore < :threshold")
    List<IntakeSubmission> findByPriorityScoreLessThan(@Param("threshold") Integer threshold);
    
    @Query("SELECT i.status, COUNT(i) FROM IntakeSubmission i GROUP BY i.status")
    List<Object[]> getStatusStatistics();

    // ==================== TENANT-FILTERED METHODS ====================

    List<IntakeSubmission> findByOrganizationId(Long organizationId);

    Page<IntakeSubmission> findByOrganizationId(Long organizationId, Pageable pageable);

    List<IntakeSubmission> findByOrganizationIdAndStatus(Long organizationId, String status);

    Page<IntakeSubmission> findByOrganizationIdAndStatus(Long organizationId, String status, Pageable pageable);

    @Query("SELECT i FROM IntakeSubmission i WHERE i.organizationId = :organizationId AND i.status = 'PENDING' ORDER BY i.priorityScore DESC, i.createdAt ASC")
    List<IntakeSubmission> findPendingByOrganization(@Param("organizationId") Long organizationId);

    @Query("SELECT i FROM IntakeSubmission i WHERE i.organizationId = :organizationId AND i.status = 'PENDING' ORDER BY i.priorityScore DESC, i.createdAt ASC")
    Page<IntakeSubmission> findPendingByOrganization(@Param("organizationId") Long organizationId, Pageable pageable);

    @Query("SELECT COUNT(i) FROM IntakeSubmission i WHERE i.organizationId = :organizationId AND i.status = :status")
    long countByOrganizationIdAndStatus(@Param("organizationId") Long organizationId, @Param("status") String status);

    // Additional tenant-filtered methods
    List<IntakeSubmission> findByOrganizationIdAndFormId(Long organizationId, Long formId);

    List<IntakeSubmission> findByOrganizationIdAndReviewedBy(Long organizationId, Long reviewedBy);

    @Query("SELECT i FROM IntakeSubmission i WHERE i.organizationId = :orgId AND i.priorityScore >= :minScore ORDER BY i.priorityScore DESC")
    List<IntakeSubmission> findByOrganizationIdAndPriorityScoreGreaterThanEqualOrderByPriorityScoreDesc(@Param("orgId") Long organizationId, @Param("minScore") Integer minScore);

    @Query("SELECT i FROM IntakeSubmission i WHERE i.organizationId = :orgId AND i.status = 'PENDING' ORDER BY i.priorityScore DESC, i.createdAt ASC")
    List<IntakeSubmission> findPendingByOrganizationOrderByPriorityAndCreatedAt(@Param("orgId") Long organizationId);

    @Query("SELECT i FROM IntakeSubmission i WHERE i.organizationId = :orgId AND i.status = 'PENDING' ORDER BY i.priorityScore DESC, i.createdAt ASC")
    Page<IntakeSubmission> findPendingByOrganizationOrderByPriorityAndCreatedAt(@Param("orgId") Long organizationId, Pageable pageable);

    @Query("SELECT i.status, COUNT(i) FROM IntakeSubmission i WHERE i.organizationId = :orgId GROUP BY i.status")
    List<Object[]> countByOrganizationIdGroupedByStatus(@Param("orgId") Long organizationId);

    @Query("SELECT i FROM IntakeSubmission i WHERE i.organizationId = :orgId AND i.createdAt BETWEEN :startDate AND :endDate")
    List<IntakeSubmission> findByOrganizationIdAndCreatedAtBetween(@Param("orgId") Long organizationId, @Param("startDate") Timestamp startDate, @Param("endDate") Timestamp endDate);

    // Secure findById with org verification
    java.util.Optional<IntakeSubmission> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);

    @Query("SELECT i FROM IntakeSubmission i WHERE i.id IN :ids AND i.organizationId = :orgId")
    List<IntakeSubmission> findAllByIdInAndOrganizationId(@Param("ids") List<Long> ids, @Param("orgId") Long organizationId);

    @Query("SELECT i FROM IntakeSubmission i JOIN i.intakeForm f WHERE f.practiceArea = :practiceArea AND i.organizationId = :orgId")
    List<IntakeSubmission> findByOrganizationIdAndPracticeArea(@Param("orgId") Long organizationId, @Param("practiceArea") String practiceArea);

    @Query("SELECT i FROM IntakeSubmission i WHERE i.status = :status AND i.createdAt >= :since AND i.organizationId = :orgId")
    List<IntakeSubmission> findByOrganizationIdAndStatusAndCreatedAtAfter(@Param("orgId") Long organizationId, @Param("status") String status, @Param("since") Timestamp since);

    @Query("SELECT COALESCE(f.practiceArea, 'General') as practiceArea, COUNT(i) as count " +
           "FROM IntakeSubmission i LEFT JOIN i.intakeForm f " +
           "WHERE i.organizationId = :orgId " +
           "GROUP BY COALESCE(f.practiceArea, 'General')")
    List<Object[]> countByOrganizationIdGroupedByPracticeArea(@Param("orgId") Long organizationId);
}