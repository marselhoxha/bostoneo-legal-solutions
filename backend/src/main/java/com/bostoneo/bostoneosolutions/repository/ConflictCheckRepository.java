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

    // ==================== TENANT-FILTERED METHODS ====================

    List<ConflictCheck> findByOrganizationId(Long organizationId);

    @Query("SELECT cc FROM ConflictCheck cc WHERE cc.organizationId = :orgId ORDER BY cc.createdAt DESC")
    List<ConflictCheck> findByOrganizationIdOrderByCreatedAtDesc(@Param("orgId") Long organizationId);

    @Query("SELECT cc FROM ConflictCheck cc WHERE cc.organizationId = :orgId AND cc.entityType = :entityType AND cc.entityId = :entityId")
    List<ConflictCheck> findByOrganizationIdAndEntityTypeAndEntityId(@Param("orgId") Long organizationId, @Param("entityType") String entityType, @Param("entityId") Long entityId);

    @Query("SELECT cc FROM ConflictCheck cc WHERE cc.organizationId = :orgId AND cc.status = :status ORDER BY cc.createdAt ASC")
    List<ConflictCheck> findByOrganizationIdAndStatus(@Param("orgId") Long organizationId, @Param("status") String status);

    @Query("SELECT cc FROM ConflictCheck cc WHERE cc.organizationId = :orgId AND cc.entityType = 'LEAD' AND cc.entityId = :leadId")
    List<ConflictCheck> findByOrganizationIdAndLeadId(@Param("orgId") Long organizationId, @Param("leadId") Long leadId);

    @Query("SELECT cc FROM ConflictCheck cc WHERE cc.organizationId = :orgId AND cc.entityType = 'LEAD' AND cc.entityId = :leadId AND cc.status IN ('PENDING', 'CONFLICT_FOUND')")
    List<ConflictCheck> findUnresolvedByOrganizationIdAndLeadId(@Param("orgId") Long organizationId, @Param("leadId") Long leadId);

    long countByOrganizationId(Long organizationId);

    @Query("SELECT COUNT(cc) FROM ConflictCheck cc WHERE cc.organizationId = :orgId AND cc.status = :status")
    long countByOrganizationIdAndStatus(@Param("orgId") Long organizationId, @Param("status") String status);

    // Additional tenant-filtered methods
    java.util.Optional<ConflictCheck> findByIdAndOrganizationId(Long id, Long organizationId);

    @Query("SELECT cc FROM ConflictCheck cc WHERE cc.organizationId = :orgId AND cc.checkType = :checkType")
    List<ConflictCheck> findByOrganizationIdAndCheckType(@Param("orgId") Long organizationId, @Param("checkType") String checkType);

    @Query("SELECT cc FROM ConflictCheck cc WHERE cc.organizationId = :orgId AND cc.status IN :statuses")
    List<ConflictCheck> findByOrganizationIdAndStatusIn(@Param("orgId") Long organizationId, @Param("statuses") List<String> statuses);

    @Query("SELECT cc FROM ConflictCheck cc WHERE cc.organizationId = :orgId AND cc.expiresAt <= :expiresAt")
    List<ConflictCheck> findByOrganizationIdAndExpiresAtBefore(@Param("orgId") Long organizationId, @Param("expiresAt") Timestamp expiresAt);

    @Query("SELECT cc.status, COUNT(cc) FROM ConflictCheck cc WHERE cc.organizationId = :orgId GROUP BY cc.status")
    List<Object[]> countByOrganizationIdGroupedByStatus(@Param("orgId") Long organizationId);

    @Query("SELECT cc.checkType, COUNT(cc) FROM ConflictCheck cc WHERE cc.organizationId = :orgId GROUP BY cc.checkType")
    List<Object[]> countByOrganizationIdGroupedByCheckType(@Param("orgId") Long organizationId);
}