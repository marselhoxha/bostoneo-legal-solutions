package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.LeadActivity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;

@Repository
public interface LeadActivityRepository extends JpaRepository<LeadActivity, Long> {

    List<LeadActivity> findByLeadId(Long leadId);
    
    Page<LeadActivity> findByLeadId(Long leadId, Pageable pageable);
    
    List<LeadActivity> findByActivityType(String activityType);
    
    List<LeadActivity> findByCreatedBy(Long createdBy);
    
    @Query("SELECT la FROM LeadActivity la WHERE la.leadId = :leadId ORDER BY la.activityDate DESC")
    List<LeadActivity> findByLeadIdOrderByActivityDateDesc(@Param("leadId") Long leadId);
    
    @Query("SELECT la FROM LeadActivity la WHERE la.leadId = :leadId ORDER BY la.activityDate DESC")
    Page<LeadActivity> findByLeadIdOrderByActivityDateDesc(@Param("leadId") Long leadId, Pageable pageable);
    
    @Query("SELECT la FROM LeadActivity la WHERE la.activityDate BETWEEN :startDate AND :endDate")
    List<LeadActivity> findByActivityDateBetween(@Param("startDate") Timestamp startDate, @Param("endDate") Timestamp endDate);
    
    @Query("SELECT la FROM LeadActivity la WHERE la.leadId = :leadId AND la.activityType = :activityType ORDER BY la.activityDate DESC")
    List<LeadActivity> findByLeadIdAndActivityType(@Param("leadId") Long leadId, @Param("activityType") String activityType);
    
    @Query("SELECT la FROM LeadActivity la WHERE la.followUpDate <= :date AND la.followUpDate IS NOT NULL")
    List<LeadActivity> findActivitiesRequiringFollowUp(@Param("date") Timestamp date);
    
    @Query("SELECT la FROM LeadActivity la WHERE la.leadId IN :leadIds ORDER BY la.activityDate DESC")
    List<LeadActivity> findByLeadIdInOrderByActivityDateDesc(@Param("leadIds") List<Long> leadIds);
    
    @Query("SELECT COUNT(la) FROM LeadActivity la WHERE la.leadId = :leadId")
    long countByLeadId(@Param("leadId") Long leadId);
    
    @Query("SELECT la.activityType, COUNT(la) FROM LeadActivity la GROUP BY la.activityType")
    List<Object[]> countByActivityTypeGrouped();
    
    @Query("SELECT la FROM LeadActivity la WHERE la.createdBy = :userId ORDER BY la.createdAt DESC")
    List<LeadActivity> findRecentActivitiesByUser(@Param("userId") Long userId, Pageable pageable);
}