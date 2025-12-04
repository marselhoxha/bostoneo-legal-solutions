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
     * Delete all availability for an attorney
     */
    @Modifying
    @Query("DELETE FROM AttorneyAvailability a WHERE a.attorneyId = :attorneyId")
    void deleteByAttorneyId(@Param("attorneyId") Long attorneyId);

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
}
