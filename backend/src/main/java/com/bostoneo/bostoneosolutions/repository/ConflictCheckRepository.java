package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.ConflictCheck;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;

@Repository
public interface ConflictCheckRepository extends JpaRepository<ConflictCheck, Long> {

    List<ConflictCheck> findByEntityTypeAndEntityId(String entityType, Long entityId);
    
    List<ConflictCheck> findByStatus(String status);
    
    List<ConflictCheck> findByCheckType(String checkType);
    
    List<ConflictCheck> findByCheckedBy(Long checkedBy);
    
    List<ConflictCheck> findByResolvedBy(Long resolvedBy);
    
    List<ConflictCheck> findByResolution(String resolution);
    
    @Query("SELECT cc FROM ConflictCheck cc WHERE cc.entityType = 'LEAD' AND cc.entityId = :leadId")
    List<ConflictCheck> findByLeadId(@Param("leadId") Long leadId);
    
    @Query("SELECT cc FROM ConflictCheck cc WHERE cc.entityType = :entityType AND cc.entityId = :entityId AND cc.status = 'PENDING'")
    List<ConflictCheck> findPendingByEntity(@Param("entityType") String entityType, @Param("entityId") Long entityId);
    
    @Query("SELECT cc FROM ConflictCheck cc WHERE cc.entityType = 'LEAD' AND cc.entityId = :leadId AND cc.status IN ('PENDING', 'CONFLICT_FOUND')")
    List<ConflictCheck> findUnresolvedByLeadId(@Param("leadId") Long leadId);
    
    @Query("SELECT cc FROM ConflictCheck cc WHERE cc.status = 'PENDING' ORDER BY cc.createdAt ASC")
    List<ConflictCheck> findPendingOrderByCreatedAt();
    
    @Query("SELECT cc FROM ConflictCheck cc WHERE cc.checkedAt BETWEEN :startDate AND :endDate")
    List<ConflictCheck> findByCheckedAtBetween(@Param("startDate") Timestamp startDate, @Param("endDate") Timestamp endDate);
    
    @Query("SELECT cc FROM ConflictCheck cc WHERE cc.expiresAt <= :date AND cc.status = 'RESOLVED'")
    List<ConflictCheck> findExpiredResolutions(@Param("date") Timestamp date);
    
    @Query("SELECT COUNT(cc) FROM ConflictCheck cc WHERE cc.status = :status")
    long countByStatus(@Param("status") String status);
    
    @Query("SELECT cc.status, COUNT(cc) FROM ConflictCheck cc GROUP BY cc.status")
    List<Object[]> countByStatusGrouped();
    
    @Query("SELECT cc.checkType, COUNT(cc) FROM ConflictCheck cc GROUP BY cc.checkType")
    List<Object[]> countByCheckTypeGrouped();
    
    @Query("SELECT cc FROM ConflictCheck cc WHERE cc.autoChecked = :autoChecked")
    List<ConflictCheck> findByAutoChecked(@Param("autoChecked") Boolean autoChecked);
    
    List<ConflictCheck> findByStatusIn(List<String> statuses);
    
    List<ConflictCheck> findByExpiresAtBefore(Timestamp expiresAt);
}