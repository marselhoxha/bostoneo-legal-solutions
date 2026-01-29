package com.bostoneo.bostoneosolutions.service.impl;

import com.bostoneo.bostoneosolutions.dto.ActiveTimerDTO;
import com.bostoneo.bostoneosolutions.dto.StartTimerRequest;
import com.bostoneo.bostoneosolutions.dto.TimeEntryDTO;
import com.bostoneo.bostoneosolutions.enumeration.TimeEntryStatus;
import com.bostoneo.bostoneosolutions.model.ActiveTimer;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.TimerSession;
import com.bostoneo.bostoneosolutions.repository.ActiveTimerRepository;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.repository.TimerSessionRepository;
import com.bostoneo.bostoneosolutions.service.TimerService;
import com.bostoneo.bostoneosolutions.service.TimeTrackingService;
import com.bostoneo.bostoneosolutions.service.BillingRateService;
import com.bostoneo.bostoneosolutions.service.CaseRateConfigurationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class TimerServiceImpl implements TimerService {

    private final ActiveTimerRepository activeTimerRepository;
    private final TimerSessionRepository timerSessionRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final TimeTrackingService timeTrackingService;
    private final BillingRateService billingRateService;
    private final CaseRateConfigurationService caseRateConfigurationService;
    private final com.bostoneo.bostoneosolutions.multitenancy.TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public ActiveTimerDTO startTimer(Long userId, StartTimerRequest request) {
        log.info("Starting timer for user {} on case {} with rate configuration", userId, request.getLegalCaseId());

        // Check if user already has an active timer for this case
        if (hasActiveTimerForCase(userId, request.getLegalCaseId())) {
            throw new RuntimeException("User already has an active timer for this case");
        }

        // Determine the effective rate to use
        BigDecimal effectiveRate = determineEffectiveRate(request);
        Long orgId = getRequiredOrganizationId();

        // Create new active timer with rate configuration
        ActiveTimer timer = ActiveTimer.builder()
                .organizationId(orgId)  // SECURITY: Set organization ID for tenant isolation
                .userId(userId)
                .legalCaseId(request.getLegalCaseId())
                .description(request.getDescription())
                .startTime(new Date())
                .isActive(true)
                .pausedDuration(0)
                .hourlyRate(effectiveRate)
                .applyMultipliers(request.getApplyMultipliers())
                .isEmergency(request.getIsEmergency())
                .workType(request.getWorkType())
                .tags(request.getTags())
                .build();

        ActiveTimer savedTimer = activeTimerRepository.save(timer);
        log.info("Timer started with rate: ${}/hr, multipliers: {}, emergency: {}", 
                effectiveRate, request.getApplyMultipliers(), request.getIsEmergency());
        
        return mapToDTO(savedTimer);
    }

    private BigDecimal determineEffectiveRate(StartTimerRequest request) {
        log.debug("Determining effective rate for case: {}", request.getLegalCaseId());
        
        // If rate is explicitly provided in request, use it as base
        BigDecimal baseRate = request.getRate();
        
        // If no rate provided, get default rate for the case
        if (baseRate == null) {
            baseRate = caseRateConfigurationService.getDefaultRateForCase(request.getLegalCaseId());
            log.debug("Using case default rate: ${}", baseRate);
        }
        
        // Apply multipliers if requested
        if (Boolean.TRUE.equals(request.getApplyMultipliers())) {
            LocalDate now = LocalDate.now();
            LocalTime currentTime = LocalTime.now();
            
            boolean isWeekend = now.getDayOfWeek().getValue() >= 6; // Saturday = 6, Sunday = 7
            boolean isAfterHours = currentTime.isAfter(LocalTime.of(18, 0)) || currentTime.isBefore(LocalTime.of(8, 0));
            boolean isEmergency = Boolean.TRUE.equals(request.getIsEmergency());
            
            BigDecimal effectiveRate = caseRateConfigurationService.calculateEffectiveRate(
                    request.getLegalCaseId(), baseRate, isWeekend, isAfterHours, isEmergency);
            
            log.debug("Applied multipliers - Base: ${}, Effective: ${}, Weekend: {}, AfterHours: {}, Emergency: {}", 
                     baseRate, effectiveRate, isWeekend, isAfterHours, isEmergency);
            
            return effectiveRate;
        } else {
            log.debug("No multipliers applied, using base rate: ${}", baseRate);
            return baseRate;
        }
    }

    @Override
    public ActiveTimerDTO pauseTimer(Long userId, Long timerId) {
        log.info("Pausing timer {} for user {}", timerId, userId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        ActiveTimer timer = activeTimerRepository.findByIdAndOrganizationId(timerId, orgId)
            .orElseThrow(() -> new RuntimeException("Timer not found or access denied: " + timerId));

        if (!timer.getUserId().equals(userId)) {
            throw new RuntimeException("Timer does not belong to user");
        }
        
        if (!timer.getIsActive()) {
            log.warn("Timer {} is already paused", timerId);
            return mapToDTO(timer);
        }
        
        // Calculate current session duration and add to total working time
        long currentTime = System.currentTimeMillis();
        long currentSessionMs = currentTime - timer.getStartTime().getTime();
        int currentSessionSeconds = (int)(currentSessionMs / 1000);
        
        // Add current session to total working time (pausedDuration = total working time)
        timer.setPausedDuration(timer.getPausedDuration() + currentSessionSeconds);
        
        // Mark as paused and update start time for next session
        timer.setIsActive(false);
        timer.setStartTime(new Date(currentTime)); // Reset for next resume
        
        ActiveTimer updated = activeTimerRepository.save(timer);
        log.debug("Timer {} paused. Total working time: {}s", timerId, updated.getPausedDuration());
        
        return mapToDTO(updated);
    }

    @Override
    public ActiveTimerDTO resumeTimer(Long userId, Long timerId) {
        log.info("Resuming timer {} for user {}", timerId, userId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        ActiveTimer timer = activeTimerRepository.findByIdAndOrganizationId(timerId, orgId)
            .orElseThrow(() -> new RuntimeException("Timer not found or access denied: " + timerId));

        if (!timer.getUserId().equals(userId)) {
            throw new RuntimeException("Timer does not belong to user");
        }
        
        if (timer.getIsActive()) {
            log.warn("Timer {} is already active", timerId);
            return mapToDTO(timer);
        }
        
        // Resume: just mark as active and reset start time
        timer.setIsActive(true);
        timer.setStartTime(new Date()); // New session starts now
        
        // Optionally recalculate rate if multipliers are enabled and time context changed
        if (Boolean.TRUE.equals(timer.getApplyMultipliers())) {
            BigDecimal newRate = recalculateRateForCurrentTime(timer);
            if (newRate != null && !newRate.equals(timer.getHourlyRate())) {
                log.info("Rate recalculated on resume: ${} -> ${}", timer.getHourlyRate(), newRate);
                timer.setHourlyRate(newRate);
            }
        }
        
        ActiveTimer updated = activeTimerRepository.save(timer);
        log.debug("Timer {} resumed. Total working time so far: {}s", timerId, updated.getPausedDuration());
        
        return mapToDTO(updated);
    }

    private BigDecimal recalculateRateForCurrentTime(ActiveTimer timer) {
        if (!Boolean.TRUE.equals(timer.getApplyMultipliers())) {
            return timer.getHourlyRate();
        }
        
        // Get base rate (remove any existing multipliers)
        BigDecimal baseRate = caseRateConfigurationService.getDefaultRateForCase(timer.getLegalCaseId());
        
        LocalDate now = LocalDate.now();
        LocalTime currentTime = LocalTime.now();
        
        boolean isWeekend = now.getDayOfWeek().getValue() >= 6;
        boolean isAfterHours = currentTime.isAfter(LocalTime.of(18, 0)) || currentTime.isBefore(LocalTime.of(8, 0));
        boolean isEmergency = Boolean.TRUE.equals(timer.getIsEmergency());
        
        return caseRateConfigurationService.calculateEffectiveRate(
                timer.getLegalCaseId(), baseRate, isWeekend, isAfterHours, isEmergency);
    }

    @Override
    public void stopTimer(Long userId, Long timerId) {
        log.info("Stopping timer {} for user {}", timerId, userId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        ActiveTimer timer = activeTimerRepository.findByIdAndOrganizationId(timerId, orgId).orElse(null);

        if (timer == null) {
            log.warn("Timer {} not found - may have already been stopped", timerId);
            return; // Timer already stopped/deleted, this is OK
        }

        // Check if timer belongs to user
        if (!timer.getUserId().equals(userId)) {
            throw new RuntimeException("Timer does not belong to user");
        }
        
        // Calculate total duration
        int totalDurationSeconds;
        
        if (timer.getIsActive()) {
            // Timer is currently running, add current session to total elapsed time
            long currentTime = System.currentTimeMillis();
            long currentSessionMs = currentTime - timer.getStartTime().getTime();
            int currentSessionSeconds = (int)(currentSessionMs / 1000);
            totalDurationSeconds = timer.getPausedDuration() + currentSessionSeconds;
        } else {
            // Timer is paused, total duration is already in pausedDuration
            totalDurationSeconds = timer.getPausedDuration();
        }
        
        log.debug("Timer {} stopped. Total duration: {}s, Rate: ${}/hr", 
                 timerId, totalDurationSeconds, timer.getHourlyRate());
        
        // Create timer session record with rate information
        TimerSession session = TimerSession.builder()
            .organizationId(timer.getOrganizationId())  // SECURITY: Set organization ID for tenant isolation
            .userId(timer.getUserId())
            .legalCaseId(timer.getLegalCaseId())
            .description(timer.getDescription())
            .startTime(timer.getCreatedAt()) // Original timer creation time
            .endTime(new Date())
            .duration(totalDurationSeconds) // Total working duration
            .pausedDuration(0) // Not using this field in TimerSession for now
            .convertedToTimeEntry(false)
            .build();
        
        timerSessionRepository.save(session);
        
        // Delete the active timer
        activeTimerRepository.delete(timer);
    }

    @Override
    public void stopAllTimers(Long userId) {
        log.info("Stopping all timers for user {}", userId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        List<ActiveTimer> activeTimers = activeTimerRepository.findByOrganizationIdAndUserIdAndIsActive(orgId, userId, true);
        for (ActiveTimer timer : activeTimers) {
            stopTimer(userId, timer.getId());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<ActiveTimerDTO> getActiveTimers(Long userId) {
        log.info("Getting all timers (running and paused) for user {}", userId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        List<ActiveTimer> timers = activeTimerRepository.findByOrganizationIdAndUserId(orgId, userId);
        return timers.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ActiveTimerDTO> getAllActiveTimers() {
        log.info("Getting all active timers");
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        List<ActiveTimer> timers = activeTimerRepository.findByOrganizationIdAndIsActive(orgId, true);
        return timers.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ActiveTimerDTO getActiveTimer(Long timerId) {
        log.info("Getting timer {}", timerId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        ActiveTimer timer = activeTimerRepository.findByIdAndOrganizationId(timerId, orgId)
                .orElseThrow(() -> new RuntimeException("Timer not found or access denied: " + timerId));

        return mapToDTO(timer);
    }

    @Override
    @Transactional(readOnly = true)
    public ActiveTimerDTO getActiveTimerForCase(Long userId, Long legalCaseId) {
        log.info("Getting active timer for user {} and case {}", userId, legalCaseId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        return activeTimerRepository.findByOrganizationIdAndUserIdAndLegalCaseIdAndIsActive(orgId, userId, legalCaseId, true)
                .map(this::mapToDTO)
                .orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasActiveTimer(Long userId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return activeTimerRepository.hasActiveTimerByOrganization(orgId, userId);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasActiveTimerForCase(Long userId, Long legalCaseId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return activeTimerRepository.findByOrganizationIdAndUserIdAndLegalCaseIdAndIsActive(orgId, userId, legalCaseId, true).isPresent();
    }

    @Override
    public TimeEntryDTO convertTimerToTimeEntry(Long userId, Long timerId, String description) {
        log.info("Converting timer {} to time entry for user {}", timerId, userId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        ActiveTimer timer = activeTimerRepository.findByIdAndOrganizationId(timerId, orgId)
                .orElseThrow(() -> new RuntimeException("Timer not found or access denied: " + timerId));

        if (!timer.getUserId().equals(userId)) {
            throw new RuntimeException("Timer does not belong to user");
        }

        // Calculate total working time before stopping the timer
        int totalWorkingSeconds = timer.getPausedDuration(); // Already accumulated working time
        
        if (timer.getIsActive()) {
            // Timer is currently running, add current session working time
            long currentTime = System.currentTimeMillis();
            long currentSessionMs = currentTime - timer.getStartTime().getTime();
            int currentSessionSeconds = (int)(currentSessionMs / 1000);
            totalWorkingSeconds += currentSessionSeconds;
        }

        // Stop the timer first
        stopTimer(userId, timerId);

        // Convert working seconds to hours with 6-minute (0.1 hour) rounding
        double workingHours = totalWorkingSeconds / 3600.0;
        double roundedHours = Math.ceil(workingHours * 10.0) / 10.0; // Round up to nearest 0.1 hour

        log.debug("Converting timer {} - Working time: {}s, Hours: {}, Rounded: {}, Rate: ${}", 
                  timerId, totalWorkingSeconds, workingHours, roundedHours, timer.getHourlyRate());

        // Create time entry with the timer's rate information
        TimeEntryDTO timeEntry = TimeEntryDTO.builder()
                .legalCaseId(timer.getLegalCaseId())
                .userId(userId)
                .date(LocalDate.now())
                .hours(BigDecimal.valueOf(roundedHours))
                .rate(timer.getHourlyRate() != null ? timer.getHourlyRate() : 
                      billingRateService.getEffectiveRateForTimeEntry(userId, timer.getLegalCaseId(), LocalDate.now()))
                .description(description != null ? description : timer.getDescription())
                .status(TimeEntryStatus.DRAFT)
                .billable(true)
                .build();

        log.info("Time entry created with rate: ${}/hr, hours: {}, amount: ${}", 
                timeEntry.getRate(), timeEntry.getHours(), 
                timeEntry.getHours().multiply(timeEntry.getRate()));

        return timeTrackingService.createTimeEntry(timeEntry);
    }
    
    /**
     * Get effective billing rate for user and case (fallback method)
     */
    private BigDecimal getEffectiveRateForUser(Long userId, Long legalCaseId) {
        try {
            return billingRateService.getEffectiveRateForTimeEntry(userId, legalCaseId, LocalDate.now());
        } catch (Exception e) {
            log.warn("Error getting rate from billing service, using default: {}", e.getMessage());
            return new BigDecimal("250.00"); // Fallback rate
        }
    }

    @Override
    public List<TimeEntryDTO> convertMultipleTimersToTimeEntries(Long userId, List<Long> timerIds) {
        log.info("Converting {} timers to time entries for user {}", timerIds.size(), userId);

        return timerIds.stream()
                .map(timerId -> convertTimerToTimeEntry(userId, timerId, null))
                .collect(Collectors.toList());
    }

    @Override
    public void updateTimerDescription(Long userId, Long timerId, String description) {
        log.info("Updating description for timer {} for user {}", timerId, userId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        ActiveTimer timer = activeTimerRepository.findByIdAndOrganizationId(timerId, orgId)
                .orElseThrow(() -> new RuntimeException("Timer not found or access denied: " + timerId));

        if (!timer.getUserId().equals(userId)) {
            throw new RuntimeException("Timer does not belong to user");
        }

        timer.setDescription(description);
        activeTimerRepository.save(timer);
    }

    @Override
    public void deleteTimer(Long timerId) {
        log.info("Deleting timer {}", timerId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify ownership before deletion
        ActiveTimer timer = activeTimerRepository.findByIdAndOrganizationId(timerId, orgId)
                .orElseThrow(() -> new RuntimeException("Timer not found or access denied: " + timerId));

        activeTimerRepository.delete(timer);
    }

    @Override
    @Transactional(readOnly = true)
    public Long getTotalActiveTimersCount() {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return activeTimerRepository.countActiveByOrganizationId(orgId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ActiveTimerDTO> getLongRunningTimers(Integer hoursThreshold) {
        log.info("Getting timers running longer than {} hours", hoursThreshold);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        List<ActiveTimer> allActiveTimers = activeTimerRepository.findByOrganizationIdAndIsActive(orgId, true);
        long thresholdMillis = hoursThreshold * 3600L * 1000L;
        Date now = new Date();

        return allActiveTimers.stream()
                .filter(timer -> (now.getTime() - timer.getStartTime().getTime()) > thresholdMillis)
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    private ActiveTimerDTO mapToDTO(ActiveTimer timer) {
        // Fetch case name and case number from LegalCase
        String caseName = null;
        String caseNumber = null;

        try {
            // SECURITY: Use tenant-filtered query - timer org matches case org
            Long orgId = tenantService.getCurrentOrganizationId().orElse(null);
            LegalCase legalCase = orgId != null
                ? legalCaseRepository.findByIdAndOrganizationId(timer.getLegalCaseId(), orgId).orElse(null)
                : null;
            if (legalCase != null) {
                caseName = legalCase.getTitle();
                caseNumber = legalCase.getCaseNumber();
            }
        } catch (Exception e) {
            log.warn("Could not fetch case details for timer {}: {}", timer.getId(), e.getMessage());
        }

        // Calculate current duration seconds
        long currentDurationSeconds;
        if (Boolean.TRUE.equals(timer.getIsActive())) {
            // Timer is running: pausedDuration + current session time
            long currentSessionMs = System.currentTimeMillis() - timer.getStartTime().getTime();
            int currentSessionSeconds = (int)(currentSessionMs / 1000);
            currentDurationSeconds = (timer.getPausedDuration() != null ? timer.getPausedDuration() : 0) + currentSessionSeconds;
        } else {
            // Timer is paused: just the accumulated pausedDuration
            currentDurationSeconds = timer.getPausedDuration() != null ? timer.getPausedDuration() : 0;
        }

        return ActiveTimerDTO.builder()
                .id(timer.getId())
                .userId(timer.getUserId())
                .legalCaseId(timer.getLegalCaseId())
                .startTime(timer.getStartTime())
                .description(timer.getDescription())
                .isActive(timer.getIsActive())
                .pausedDuration(timer.getPausedDuration())
                .hourlyRate(timer.getHourlyRate())
                .applyMultipliers(timer.getApplyMultipliers())
                .isEmergency(timer.getIsEmergency())
                .workType(timer.getWorkType())
                .tags(timer.getTags())
                .currentDurationSeconds(currentDurationSeconds)
                .caseName(caseName)
                .caseNumber(caseNumber)
                .createdAt(timer.getCreatedAt())
                .updatedAt(timer.getUpdatedAt())
                .build();
    }
} 