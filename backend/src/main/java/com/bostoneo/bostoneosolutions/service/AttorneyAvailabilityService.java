package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.AttorneyAvailabilityDTO;
import com.bostoneo.bostoneosolutions.dto.AvailableSlotDTO;

import java.time.LocalDate;
import java.util.List;

public interface AttorneyAvailabilityService {

    /**
     * Get all availability slots for an attorney
     */
    List<AttorneyAvailabilityDTO> getAvailabilityByAttorneyId(Long attorneyId);

    /**
     * Get active availability slots for an attorney
     */
    List<AttorneyAvailabilityDTO> getActiveAvailabilityByAttorneyId(Long attorneyId);

    /**
     * Set weekly availability for an attorney
     */
    List<AttorneyAvailabilityDTO> setWeeklyAvailability(Long attorneyId, List<AttorneyAvailabilityDTO> availabilityList);

    /**
     * Update a single availability slot
     */
    AttorneyAvailabilityDTO updateAvailability(Long id, AttorneyAvailabilityDTO availabilityDTO);

    /**
     * Toggle active status for a day
     */
    AttorneyAvailabilityDTO toggleDayActive(Long attorneyId, Integer dayOfWeek, Boolean isActive);

    /**
     * Delete availability for an attorney
     */
    void deleteAvailability(Long attorneyId);

    /**
     * Get available time slots for booking
     */
    List<AvailableSlotDTO> getAvailableSlots(Long attorneyId, LocalDate date, Integer durationMinutes);

    /**
     * Get available slots for a date range
     */
    List<AvailableSlotDTO> getAvailableSlotsForDateRange(Long attorneyId, LocalDate startDate, LocalDate endDate, Integer durationMinutes);

    /**
     * Check if attorney has availability set up
     */
    boolean hasAvailability(Long attorneyId);

    /**
     * Initialize default availability for a new attorney
     */
    void initializeDefaultAvailability(Long attorneyId);
}
