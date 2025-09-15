package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.CaseActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CaseActivityRepository extends JpaRepository<CaseActivity, Long> {
    
    /**
     * Find all activities for a specific case ordered by created date descending (newest first)
     * 
     * @param caseId The ID of the case to get activities for
     * @return List of activities for the case
     */
    @Query("SELECT a FROM CaseActivity a WHERE a.caseId = ?1 ORDER BY a.createdAt DESC")
    List<CaseActivity> findByCaseIdOrderByCreatedAtDesc(Long caseId);
    
    /**
     * Find activities by type for a specific case
     * 
     * @param caseId The ID of the case
     * @param activityType The type of activity to filter by
     * @return List of matching activities
     */
    List<CaseActivity> findByCaseIdAndActivityTypeOrderByCreatedAtDesc(Long caseId, String activityType);
} 