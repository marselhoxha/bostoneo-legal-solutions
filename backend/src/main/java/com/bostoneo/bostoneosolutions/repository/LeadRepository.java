package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.Lead;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;

@Repository
public interface LeadRepository extends JpaRepository<Lead, Long> {

    List<Lead> findByStatus(String status);
    
    Page<Lead> findByStatus(String status, Pageable pageable);
    
    List<Lead> findByPracticeArea(String practiceArea);
    
    Page<Lead> findByPracticeArea(String practiceArea, Pageable pageable);
    
    List<Lead> findByAssignedTo(Long assignedTo);
    
    Page<Lead> findByAssignedTo(Long assignedTo, Pageable pageable);
    
    List<Lead> findByPriority(String priority);
    
    List<Lead> findBySource(String source);
    
    @Query("SELECT l FROM Lead l WHERE l.status IN :statuses")
    List<Lead> findByStatusIn(@Param("statuses") List<String> statuses);
    
    @Query("SELECT l FROM Lead l WHERE l.status IN :statuses")
    Page<Lead> findByStatusIn(@Param("statuses") List<String> statuses, Pageable pageable);
    
    @Query("SELECT l FROM Lead l WHERE l.leadScore >= :minScore ORDER BY l.leadScore DESC")
    List<Lead> findByLeadScoreGreaterThanEqualOrderByLeadScoreDesc(@Param("minScore") Integer minScore);
    
    @Query("SELECT l FROM Lead l WHERE l.practiceArea = :practiceArea AND l.status IN :statuses")
    List<Lead> findByPracticeAreaAndStatusIn(@Param("practiceArea") String practiceArea, @Param("statuses") List<String> statuses);
    
    @Query("SELECT l FROM Lead l WHERE l.assignedTo = :assignedTo AND l.status IN :statuses ORDER BY l.priority DESC, l.createdAt ASC")
    List<Lead> findByAssignedToAndStatusInOrderByPriorityAndCreatedAt(@Param("assignedTo") Long assignedTo, @Param("statuses") List<String> statuses);
    
    @Query("SELECT l FROM Lead l WHERE l.status IN ('NEW', 'CONTACTED', 'QUALIFIED') ORDER BY l.leadScore DESC, l.createdAt ASC")
    List<Lead> findActiveLeadsOrderByScoreAndCreatedAt();
    
    @Query("SELECT l FROM Lead l WHERE l.status IN ('NEW', 'CONTACTED', 'QUALIFIED') ORDER BY l.leadScore DESC, l.createdAt ASC")
    Page<Lead> findActiveLeadsOrderByScoreAndCreatedAt(Pageable pageable);
    
    @Query("SELECT l FROM Lead l WHERE l.followUpDate <= :date AND l.status NOT IN ('CONVERTED', 'LOST', 'UNQUALIFIED')")
    List<Lead> findLeadsRequiringFollowUp(@Param("date") Timestamp date);
    
    @Query("SELECT l FROM Lead l WHERE l.createdAt BETWEEN :startDate AND :endDate")
    List<Lead> findByCreatedAtBetween(@Param("startDate") Timestamp startDate, @Param("endDate") Timestamp endDate);
    
    @Query("SELECT COUNT(l) FROM Lead l WHERE l.status = :status")
    long countByStatus(@Param("status") String status);
    
    @Query("SELECT l.status, COUNT(l) FROM Lead l GROUP BY l.status")
    List<Object[]> countByStatusGrouped();
    
    @Query("SELECT l.practiceArea, COUNT(l) FROM Lead l GROUP BY l.practiceArea")
    List<Object[]> countByPracticeAreaGrouped();
    
    @Query("SELECT l FROM Lead l WHERE l.consultationDate BETWEEN :startDate AND :endDate")
    List<Lead> findByConsultationDateBetween(@Param("startDate") Timestamp startDate, @Param("endDate") Timestamp endDate);
    
    @Query("SELECT l FROM Lead l WHERE l.status = :status AND l.updatedAt < :staleDate")
    List<Lead> findStaleLeads(@Param("status") String status, @Param("staleDate") Timestamp staleDate);
}