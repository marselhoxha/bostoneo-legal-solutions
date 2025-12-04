package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.AttorneyAvailabilityDTO;
import com.bostoneo.bostoneosolutions.dto.AvailableSlotDTO;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.AppointmentRequest;
import com.bostoneo.bostoneosolutions.model.Attorney;
import com.bostoneo.bostoneosolutions.model.AttorneyAvailability;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.repository.AppointmentRequestRepository;
import com.bostoneo.bostoneosolutions.repository.AttorneyAvailabilityRepository;
import com.bostoneo.bostoneosolutions.repository.AttorneyRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.service.AttorneyAvailabilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AttorneyAvailabilityServiceImpl implements AttorneyAvailabilityService {

    private final AttorneyAvailabilityRepository availabilityRepository;
    private final AppointmentRequestRepository appointmentRequestRepository;
    private final UserRepository userRepository;
    private final AttorneyRepository attorneyRepository;

    private static final String[] DAY_NAMES = {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};

    /**
     * Get the attorney record ID from the user ID
     * Creates an attorney record if one doesn't exist
     */
    private Long getAttorneyIdFromUserId(Long userId) {
        return attorneyRepository.findByUserId(userId)
                .map(Attorney::getId)
                .orElseGet(() -> {
                    // Auto-create attorney record if it doesn't exist
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
     * Get user ID from attorney ID (for name lookup)
     */
    private Long getUserIdFromAttorneyId(Long attorneyId) {
        return attorneyRepository.findById(attorneyId)
                .map(Attorney::getUserId)
                .orElse(attorneyId); // Fallback to using attorneyId as userId for backwards compatibility
    }

    @Override
    public List<AttorneyAvailabilityDTO> getAvailabilityByAttorneyId(Long attorneyId) {
        log.info("Getting all availability for attorney: {}", attorneyId);
        return availabilityRepository.findByAttorneyIdOrderByDayOfWeekAscStartTimeAsc(attorneyId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<AttorneyAvailabilityDTO> getActiveAvailabilityByAttorneyId(Long attorneyId) {
        log.info("Getting active availability for attorney: {}", attorneyId);
        return availabilityRepository.findByAttorneyIdAndIsActiveTrueOrderByDayOfWeekAscStartTimeAsc(attorneyId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<AttorneyAvailabilityDTO> setWeeklyAvailability(Long attorneyId, List<AttorneyAvailabilityDTO> availabilityList) {
        log.info("Setting weekly availability for attorney: {}", attorneyId);

        // Delete existing availability
        availabilityRepository.deleteByAttorneyId(attorneyId);

        // Create new availability records
        List<AttorneyAvailability> savedAvailability = new ArrayList<>();
        for (AttorneyAvailabilityDTO dto : availabilityList) {
            AttorneyAvailability availability = AttorneyAvailability.builder()
                    .attorneyId(attorneyId)
                    .dayOfWeek(dto.getDayOfWeek())
                    .startTime(dto.getStartTime())
                    .endTime(dto.getEndTime())
                    .slotDurationMinutes(dto.getSlotDurationMinutes() != null ? dto.getSlotDurationMinutes() : 30)
                    .bufferMinutes(dto.getBufferMinutes() != null ? dto.getBufferMinutes() : 15)
                    .isActive(dto.getIsActive() != null ? dto.getIsActive() : true)
                    .build();
            savedAvailability.add(availabilityRepository.save(availability));
        }

        return savedAvailability.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public AttorneyAvailabilityDTO updateAvailability(Long id, AttorneyAvailabilityDTO dto) {
        log.info("Updating availability with ID: {}", id);

        AttorneyAvailability availability = availabilityRepository.findById(id)
                .orElseThrow(() -> new ApiException("Availability not found with ID: " + id));

        if (dto.getStartTime() != null) {
            availability.setStartTime(dto.getStartTime());
        }
        if (dto.getEndTime() != null) {
            availability.setEndTime(dto.getEndTime());
        }
        if (dto.getSlotDurationMinutes() != null) {
            availability.setSlotDurationMinutes(dto.getSlotDurationMinutes());
        }
        if (dto.getBufferMinutes() != null) {
            availability.setBufferMinutes(dto.getBufferMinutes());
        }
        if (dto.getIsActive() != null) {
            availability.setIsActive(dto.getIsActive());
        }

        return toDTO(availabilityRepository.save(availability));
    }

    @Override
    public AttorneyAvailabilityDTO toggleDayActive(Long attorneyId, Integer dayOfWeek, Boolean isActive) {
        log.info("Toggling day {} active status to {} for attorney: {}", dayOfWeek, isActive, attorneyId);

        Optional<AttorneyAvailability> availabilityOpt = availabilityRepository.findByAttorneyIdAndDayOfWeek(attorneyId, dayOfWeek);

        if (availabilityOpt.isPresent()) {
            AttorneyAvailability availability = availabilityOpt.get();
            availability.setIsActive(isActive);
            return toDTO(availabilityRepository.save(availability));
        } else {
            // Create new availability for the day with default times
            AttorneyAvailability newAvailability = AttorneyAvailability.builder()
                    .attorneyId(attorneyId)
                    .dayOfWeek(dayOfWeek)
                    .startTime(LocalTime.of(9, 0))
                    .endTime(LocalTime.of(17, 0))
                    .slotDurationMinutes(30)
                    .bufferMinutes(15)
                    .isActive(isActive)
                    .build();
            return toDTO(availabilityRepository.save(newAvailability));
        }
    }

    @Override
    public void deleteAvailability(Long attorneyId) {
        log.info("Deleting all availability for attorney: {}", attorneyId);
        availabilityRepository.deleteByAttorneyId(attorneyId);
    }

    @Override
    public List<AvailableSlotDTO> getAvailableSlots(Long attorneyId, LocalDate date, Integer durationMinutes) {
        log.info("Getting available slots for attorney {} on date {} with duration {}", attorneyId, date, durationMinutes);

        int dayOfWeek = getDayOfWeekValue(date);
        List<AttorneyAvailability> availabilityList = availabilityRepository
                .findByAttorneyIdAndDayOfWeekAndIsActiveTrue(attorneyId, dayOfWeek);

        if (availabilityList.isEmpty()) {
            return new ArrayList<>();
        }

        List<AvailableSlotDTO> slots = new ArrayList<>();
        String attorneyName = getAttorneyName(attorneyId);

        for (AttorneyAvailability availability : availabilityList) {
            int effectiveDuration = durationMinutes != null ? durationMinutes : availability.getSlotDurationMinutes();
            int bufferMinutes = availability.getBufferMinutes();

            LocalTime currentTime = availability.getStartTime();
            LocalTime endTime = availability.getEndTime();

            while (currentTime.plusMinutes(effectiveDuration).compareTo(endTime) <= 0) {
                LocalDateTime slotStart = LocalDateTime.of(date, currentTime);
                LocalDateTime slotEnd = slotStart.plusMinutes(effectiveDuration);

                // Check if slot is available (not conflicting with existing appointments)
                boolean isAvailable = isSlotAvailable(attorneyId, slotStart, slotEnd);

                // Only add future slots
                if (slotStart.isAfter(LocalDateTime.now())) {
                    slots.add(AvailableSlotDTO.builder()
                            .startTime(slotStart)
                            .endTime(slotEnd)
                            .durationMinutes(effectiveDuration)
                            .attorneyId(attorneyId)
                            .attorneyName(attorneyName)
                            .available(isAvailable)
                            .build());
                }

                currentTime = currentTime.plusMinutes(effectiveDuration + bufferMinutes);
            }
        }

        return slots;
    }

    @Override
    public List<AvailableSlotDTO> getAvailableSlotsForDateRange(Long attorneyId, LocalDate startDate, LocalDate endDate, Integer durationMinutes) {
        log.info("Getting available slots for attorney {} from {} to {}", attorneyId, startDate, endDate);

        List<AvailableSlotDTO> allSlots = new ArrayList<>();
        LocalDate currentDate = startDate;

        while (!currentDate.isAfter(endDate)) {
            allSlots.addAll(getAvailableSlots(attorneyId, currentDate, durationMinutes));
            currentDate = currentDate.plusDays(1);
        }

        return allSlots;
    }

    @Override
    public boolean hasAvailability(Long attorneyId) {
        return availabilityRepository.existsByAttorneyIdAndIsActiveTrue(attorneyId);
    }

    @Override
    public void initializeDefaultAvailability(Long attorneyId) {
        log.info("Initializing default availability for attorney: {}", attorneyId);

        if (hasAvailability(attorneyId)) {
            log.info("Attorney {} already has availability set up", attorneyId);
            return;
        }

        // Create default availability for Monday-Friday 9 AM - 5 PM
        for (int dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
            AttorneyAvailability availability = AttorneyAvailability.builder()
                    .attorneyId(attorneyId)
                    .dayOfWeek(dayOfWeek)
                    .startTime(LocalTime.of(9, 0))
                    .endTime(LocalTime.of(17, 0))
                    .slotDurationMinutes(30)
                    .bufferMinutes(15)
                    .isActive(true)
                    .build();
            availabilityRepository.save(availability);
        }
    }

    /**
     * Check if a time slot is available (no conflicting appointments)
     */
    private boolean isSlotAvailable(Long attorneyId, LocalDateTime start, LocalDateTime end) {
        List<AppointmentRequest> conflicts = appointmentRequestRepository
                .findConflictingAppointments(attorneyId, start, end);
        return conflicts.isEmpty();
    }

    /**
     * Convert Java DayOfWeek to our day numbering (0=Sunday, 1=Monday, etc.)
     */
    private int getDayOfWeekValue(LocalDate date) {
        DayOfWeek dayOfWeek = date.getDayOfWeek();
        // DayOfWeek.MONDAY = 1, ..., SUNDAY = 7
        // We want SUNDAY = 0, MONDAY = 1, ..., SATURDAY = 6
        return dayOfWeek == DayOfWeek.SUNDAY ? 0 : dayOfWeek.getValue();
    }

    private String getAttorneyName(Long attorneyId) {
        Long userId = getUserIdFromAttorneyId(attorneyId);
        User user = userRepository.get(userId);
        if (user != null) {
            return user.getFirstName() + " " + user.getLastName();
        }
        return "Unknown Attorney";
    }

    private AttorneyAvailabilityDTO toDTO(AttorneyAvailability entity) {
        return AttorneyAvailabilityDTO.builder()
                .id(entity.getId())
                .attorneyId(entity.getAttorneyId())
                .dayOfWeek(entity.getDayOfWeek())
                .dayName(DAY_NAMES[entity.getDayOfWeek()])
                .startTime(entity.getStartTime())
                .endTime(entity.getEndTime())
                .slotDurationMinutes(entity.getSlotDurationMinutes())
                .bufferMinutes(entity.getBufferMinutes())
                .isActive(entity.getIsActive())
                .build();
    }
}
