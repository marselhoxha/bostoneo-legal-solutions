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
}