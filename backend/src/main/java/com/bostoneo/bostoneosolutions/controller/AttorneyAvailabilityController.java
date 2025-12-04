package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.AttorneyAvailabilityDTO;
import com.bostoneo.bostoneosolutions.dto.AvailableSlotDTO;
import com.bostoneo.bostoneosolutions.model.Attorney;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.repository.AttorneyRepository;
import com.bostoneo.bostoneosolutions.service.AttorneyAvailabilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.OK;

@RestController
@RequestMapping("/api/availability")
@RequiredArgsConstructor
@Slf4j
public class AttorneyAvailabilityController {

    private final AttorneyAvailabilityService availabilityService;
    private final AttorneyRepository attorneyRepository;

    /**
     * Convert user ID to attorney ID (creates attorney record if needed)
     */
    private Long getOrCreateAttorneyId(Long userId) {
        return attorneyRepository.findByUserId(userId)
                .map(Attorney::getId)
                .orElseGet(() -> {
                    log.info("Creating attorney record for user: {}", userId);
                    Attorney newAttorney = Attorney.builder()
                            .userId(userId)
                            .practiceAreas("[]")
                            .isActive(true)
                            .currentCaseLoad(0)
                            .maxCaseLoad(50)
                            .build();
                    Attorney saved = attorneyRepository.save(newAttorney);
                    return saved.getId();
                });
    }

    /**
     * Get current user's availability (for attorneys)
     */
    @GetMapping("/me")
    @PreAuthorize("hasAnyRole('ATTORNEY', 'ADMIN')")
    public ResponseEntity<HttpResponse> getMyAvailability(
            @AuthenticationPrincipal(expression = "id") Long userId) {
        Long attorneyId = getOrCreateAttorneyId(userId);
        log.info("Getting availability for attorney: {} (user: {})", attorneyId, userId);

        List<AttorneyAvailabilityDTO> availability = availabilityService.getAvailabilityByAttorneyId(attorneyId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("availability", availability))
                        .message("Availability retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get attorney's availability by ID (for clients booking)
     */
    @GetMapping("/attorney/{attorneyId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getAttorneyAvailability(@PathVariable Long attorneyId) {
        log.info("Getting availability for attorney: {}", attorneyId);

        List<AttorneyAvailabilityDTO> availability = availabilityService.getActiveAvailabilityByAttorneyId(attorneyId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("availability", availability))
                        .message("Attorney availability retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Set weekly availability for the current attorney
     */
    @PostMapping("/me")
    @PreAuthorize("hasAnyRole('ATTORNEY', 'ADMIN')")
    public ResponseEntity<HttpResponse> setMyAvailability(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @RequestBody List<AttorneyAvailabilityDTO> availabilityList) {
        Long attorneyId = getOrCreateAttorneyId(userId);
        log.info("Setting availability for attorney: {} (user: {})", attorneyId, userId);

        List<AttorneyAvailabilityDTO> savedAvailability = availabilityService.setWeeklyAvailability(attorneyId, availabilityList);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("availability", savedAvailability))
                        .message("Availability set successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Update a single availability slot
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ATTORNEY', 'ADMIN')")
    public ResponseEntity<HttpResponse> updateAvailability(
            @PathVariable Long id,
            @RequestBody AttorneyAvailabilityDTO dto) {
        log.info("Updating availability with ID: {}", id);

        AttorneyAvailabilityDTO updated = availabilityService.updateAvailability(id, dto);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("availability", updated))
                        .message("Availability updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Toggle a day's active status
     */
    @PatchMapping("/me/day/{dayOfWeek}")
    @PreAuthorize("hasAnyRole('ATTORNEY', 'ADMIN')")
    public ResponseEntity<HttpResponse> toggleDayActive(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Integer dayOfWeek,
            @RequestParam Boolean active) {
        Long attorneyId = getOrCreateAttorneyId(userId);
        log.info("Toggling day {} active status to {} for attorney: {} (user: {})", dayOfWeek, active, attorneyId, userId);

        AttorneyAvailabilityDTO updated = availabilityService.toggleDayActive(attorneyId, dayOfWeek, active);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("availability", updated))
                        .message("Day availability toggled successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get available time slots for a specific date
     */
    @GetMapping("/slots/{attorneyId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getAvailableSlots(
            @PathVariable Long attorneyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false, defaultValue = "30") Integer durationMinutes) {
        log.info("Getting available slots for attorney {} on date {} with duration {}", attorneyId, date, durationMinutes);

        List<AvailableSlotDTO> slots = availabilityService.getAvailableSlots(attorneyId, date, durationMinutes);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("slots", slots, "date", date.toString()))
                        .message("Available slots retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get available time slots for a date range
     */
    @GetMapping("/slots/{attorneyId}/range")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getAvailableSlotsForRange(
            @PathVariable Long attorneyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false, defaultValue = "30") Integer durationMinutes) {
        log.info("Getting available slots for attorney {} from {} to {}", attorneyId, startDate, endDate);

        List<AvailableSlotDTO> slots = availabilityService.getAvailableSlotsForDateRange(attorneyId, startDate, endDate, durationMinutes);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("slots", slots, "startDate", startDate.toString(), "endDate", endDate.toString()))
                        .message("Available slots retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Initialize default availability for attorney
     */
    @PostMapping("/me/initialize")
    @PreAuthorize("hasAnyRole('ATTORNEY', 'ADMIN')")
    public ResponseEntity<HttpResponse> initializeDefaultAvailability(
            @AuthenticationPrincipal(expression = "id") Long userId) {
        Long attorneyId = getOrCreateAttorneyId(userId);
        log.info("Initializing default availability for attorney: {} (user: {})", attorneyId, userId);

        availabilityService.initializeDefaultAvailability(attorneyId);
        List<AttorneyAvailabilityDTO> availability = availabilityService.getAvailabilityByAttorneyId(attorneyId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("availability", availability))
                        .message("Default availability initialized successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}
