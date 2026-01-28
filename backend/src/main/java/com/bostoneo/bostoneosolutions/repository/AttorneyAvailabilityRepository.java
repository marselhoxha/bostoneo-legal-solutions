package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AttorneyAvailability;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttorneyAvailabilityRepository extends JpaRepository<AttorneyAvailability, Long> {

    /**
     * Find all availability slots for an attorney
     */
    List<AttorneyAvailability> findByAttorneyIdOrderByDayOfWeekAscStartTimeAsc(Long attorneyId);

    /**
     * Find active availability slots for an attorney
     */
    List<AttorneyAvailability> findByAttorneyIdAndIsActiveTrueOrderByDayOfWeekAscStartTimeAsc(Long attorneyId);

    /**
     * Find availability for a specific day
     */
    List<AttorneyAvailability> findByAttorneyIdAndDayOfWeekAndIsActiveTrue(Long attorneyId, Integer dayOfWeek);

    /**
     * Find availability by attorney and day
     */
    Optional<AttorneyAvailability> findByAttorneyIdAndDayOfWeek(Long attorneyId, Integer dayOfWeek);

    /**
     * Check if attorney has any availability set up
     */
    boolean existsByAttorneyIdAndIsActiveTrue(Long attorneyId);

    /**
     * @deprecated Use deleteByAttorneyIdAndOrganizationId for tenant isolation
     */
    @Deprecated
    @Modifying
    @Query("DELETE FROM AttorneyAvailability a WHERE a.attorneyId = :attorneyId")
    void deleteByAttorneyId(@Param("attorneyId") Long attorneyId);

    /**
     * TENANT-FILTERED: Delete all availability for an attorney within organization
     */
    @Modifying
    @Query("DELETE FROM AttorneyAvailability a WHERE a.attorneyId = :attorneyId AND a.organizationId = :organizationId")
    void deleteByAttorneyIdAndOrganizationId(@Param("attorneyId") Long attorneyId, @Param("organizationId") Long organizationId);

    /**
     * Get all attorneys who have availability set up
     */
    @Query("SELECT DISTINCT a.attorneyId FROM AttorneyAvailability a WHERE a.isActive = true")
    List<Long> findAttorneysWithAvailability();

    /**
     * Count active availability days for an attorney
     */
    @Query("SELECT COUNT(DISTINCT a.dayOfWeek) FROM AttorneyAvailability a WHERE a.attorneyId = :attorneyId AND a.isActive = true")
    int countActiveDays(@Param("attorneyId") Long attorneyId);

    // ==================== TENANT-FILTERED METHODS ====================

    java.util.Optional<AttorneyAvailability> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);

    List<AttorneyAvailability> findByOrganizationIdAndAttorneyIdOrderByDayOfWeekAscStartTimeAsc(Long organizationId, Long attorneyId);

    List<AttorneyAvailability> findByOrganizationIdAndAttorneyIdAndIsActiveTrueOrderByDayOfWeekAscStartTimeAsc(Long organizationId, Long attorneyId);

    List<AttorneyAvailability> findByOrganizationIdAndAttorneyIdAndDayOfWeekAndIsActiveTrue(Long organizationId, Long attorneyId, Integer dayOfWeek);

    boolean existsByOrganizationIdAndAttorneyIdAndIsActiveTrue(Long organizationId, Long attorneyId);

    @Query("SELECT DISTINCT a.attorneyId FROM AttorneyAvailability a WHERE a.organizationId = :orgId AND a.isActive = true")
    List<Long> findAttorneysWithAvailabilityByOrganization(@Param("orgId") Long organizationId);

    /**
     * SECURITY: Tenant-filtered find by attorney and day
     */
    Optional<AttorneyAvailability> findByOrganizationIdAndAttorneyIdAndDayOfWeek(Long organizationId, Long attorneyId, Integer dayOfWeek);
}
