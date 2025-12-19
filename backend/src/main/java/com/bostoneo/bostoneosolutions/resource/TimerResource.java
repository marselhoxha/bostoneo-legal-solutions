package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.dto.ActiveTimerDTO;
import com.bostoneo.bostoneosolutions.dto.StartTimerRequest;
import com.bostoneo.bostoneosolutions.dto.TimeEntryDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.TimerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static java.time.LocalDateTime.now;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/timers")
@RequiredArgsConstructor
@Slf4j
public class TimerResource {

    private final TimerService timerService;

    // Start a new timer with enhanced rate configuration
    @PostMapping("/start")
    @PreAuthorize("hasAuthority('TIME_TRACKING:CREATE')")
    public ResponseEntity<HttpResponse> startTimer(@Valid @RequestBody Map<String, Object> request) {
        try {
            Long userId = Long.valueOf(request.get("userId").toString());
            
            // Build StartTimerRequest with enhanced rate parameters
            StartTimerRequest.StartTimerRequestBuilder requestBuilder = StartTimerRequest.builder()
                    .legalCaseId(Long.valueOf(request.get("legalCaseId").toString()))
                    .description(request.get("description") != null ? request.get("description").toString() : null);
            
            // Handle rate configuration parameters
            if (request.get("rate") != null) {
                requestBuilder.rate(new BigDecimal(request.get("rate").toString()));
            }
            
            if (request.get("applyMultipliers") != null) {
                requestBuilder.applyMultipliers(Boolean.valueOf(request.get("applyMultipliers").toString()));
            }
            
            if (request.get("isEmergency") != null) {
                requestBuilder.isEmergency(Boolean.valueOf(request.get("isEmergency").toString()));
            }
            
            if (request.get("workType") != null) {
                requestBuilder.workType(request.get("workType").toString());
            }
            
            if (request.get("tags") != null) {
                requestBuilder.tags(request.get("tags").toString());
            }
            
            StartTimerRequest startRequest = requestBuilder.build();
            
            ActiveTimerDTO timer = timerService.startTimer(userId, startRequest);
            
            log.info("Timer started successfully for user {} on case {} with rate ${}/hr", 
                    userId, startRequest.getLegalCaseId(), timer.getHourlyRate());
            
            return ResponseEntity.status(CREATED).body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(Map.of("timer", timer))
                    .message("Timer started successfully with rate configuration")
                    .status(CREATED)
                    .statusCode(CREATED.value())
                    .build()
            );
            
        } catch (Exception e) {
            log.error("Error starting timer: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .statusCode(BAD_REQUEST.value())
                    .status(BAD_REQUEST)
                    .message("Failed to start timer: " + e.getMessage())
                    .build()
            );
        }
    }

    // Pause a timer
    @PostMapping("/{timerId}/pause")
    @PreAuthorize("hasAuthority('TIME_TRACKING:EDIT')")
    public ResponseEntity<HttpResponse> pauseTimer(@PathVariable Long timerId, @RequestBody Map<String, Object> request) {
        try {
            Long userId = Long.valueOf(request.get("userId").toString());
            ActiveTimerDTO timer = timerService.pauseTimer(userId, timerId);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(Map.of("timer", timer))
                    .message("Timer paused successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .statusCode(BAD_REQUEST.value())
                    .status(BAD_REQUEST)
                    .message("Failed to pause timer: " + e.getMessage())
                    .build());
        }
    }

    // Resume a timer
    @PostMapping("/{timerId}/resume")
    @PreAuthorize("hasAuthority('TIME_TRACKING:EDIT')")
    public ResponseEntity<HttpResponse> resumeTimer(@PathVariable Long timerId, @RequestBody Map<String, Object> request) {
        try {
            Long userId = Long.valueOf(request.get("userId").toString());
            ActiveTimerDTO timer = timerService.resumeTimer(userId, timerId);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(Map.of("timer", timer))
                    .message("Timer resumed successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .statusCode(BAD_REQUEST.value())
                    .status(BAD_REQUEST)
                    .message("Failed to resume timer: " + e.getMessage())
                    .build());
        }
    }

    // Stop a timer with enhanced rate information in response
    @PostMapping("/{timerId}/stop")
    @PreAuthorize("hasAuthority('TIME_TRACKING:EDIT')")
    public ResponseEntity<HttpResponse> stopTimer(@PathVariable Long timerId, @RequestBody Map<String, Object> request) {
        try {
            Long userId = Long.valueOf(request.get("userId").toString());
            
            // Get timer info before stopping for response
            ActiveTimerDTO timerInfo = timerService.getActiveTimer(timerId);
            
            timerService.stopTimer(userId, timerId);
            
            return ResponseEntity.ok().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .statusCode(OK.value())
                    .status(OK)
                    .message("Timer stopped successfully")
                    .data(Map.of(
                        "timerId", timerId, 
                        "stopped", true,
                        "finalRate", timerInfo.getHourlyRate(),
                        "totalHours", timerInfo.getDurationHours(),
                        "estimatedAmount", timerInfo.getEstimatedAmount()
                    ))
                    .build());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .statusCode(BAD_REQUEST.value())
                    .status(BAD_REQUEST)
                    .message("Failed to stop timer: " + e.getMessage())
                    .build());
        }
    }

    // Get active timers for a user
    @GetMapping("/user/{userId}/active")
    @PreAuthorize("hasAnyAuthority('TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING:VIEW_TEAM')")
    public ResponseEntity<HttpResponse> getActiveTimers(@PathVariable Long userId) {
        List<ActiveTimerDTO> timers = timerService.getActiveTimers(userId);
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("timers", timers))
                .message("Active timers retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // Get all active timers
    @GetMapping("/active")
    @PreAuthorize("hasAnyAuthority('TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING:VIEW_TEAM')")
    public ResponseEntity<HttpResponse> getAllActiveTimers() {
        List<ActiveTimerDTO> timers = timerService.getAllActiveTimers();
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("timers", timers))
                .message("All active timers retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // Get active timer for a specific case
    @GetMapping("/user/{userId}/case/{legalCaseId}/active")
    @PreAuthorize("hasAnyAuthority('TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING:VIEW_TEAM')")
    public ResponseEntity<HttpResponse> getActiveTimerForCase(@PathVariable Long userId, @PathVariable Long legalCaseId) {
        ActiveTimerDTO timer = timerService.getActiveTimerForCase(userId, legalCaseId);
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("timer", timer))
                .message("Active timer for case retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // Convert timer to time entry
    @PostMapping("/{timerId}/convert")
    @PreAuthorize("hasAuthority('TIME_TRACKING:CREATE')")
    public ResponseEntity<HttpResponse> convertTimerToTimeEntry(@PathVariable Long timerId, @RequestBody Map<String, Object> request) {
        Long userId = Long.valueOf(request.get("userId").toString());
        String description = request.get("description") != null ? request.get("description").toString() : null;
        
        TimeEntryDTO timeEntry = timerService.convertTimerToTimeEntry(userId, timerId, description);
        return ResponseEntity.status(CREATED).body(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("timeEntry", timeEntry))
                .message("Timer converted to time entry successfully")
                .status(CREATED)
                .statusCode(CREATED.value())
                .build()
        );
    }

    // Stop all timers for a user
    @PostMapping("/user/{userId}/stop-all")
    @PreAuthorize("hasAuthority('TIME_TRACKING:EDIT')")
    public ResponseEntity<HttpResponse> stopAllTimers(@PathVariable Long userId) {
        timerService.stopAllTimers(userId);
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .message("All timers stopped successfully")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // Check if user has active timer
    @GetMapping("/user/{userId}/has-active")
    @PreAuthorize("hasAnyAuthority('TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING:VIEW_TEAM')")
    public ResponseEntity<HttpResponse> hasActiveTimer(@PathVariable Long userId) {
        boolean hasActive = timerService.hasActiveTimer(userId);
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("hasActiveTimer", hasActive))
                .message("Active timer status retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // Check if user has active timer for specific case
    @GetMapping("/user/{userId}/case/{legalCaseId}/has-active")
    @PreAuthorize("hasAnyAuthority('TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING:VIEW_TEAM')")
    public ResponseEntity<HttpResponse> hasActiveTimerForCase(@PathVariable Long userId, @PathVariable Long legalCaseId) {
        boolean hasActive = timerService.hasActiveTimerForCase(userId, legalCaseId);
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("hasActiveTimer", hasActive))
                .message("Active timer status for case retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    // Update timer description
    @PatchMapping("/{timerId}/description")
    @PreAuthorize("hasAuthority('TIME_TRACKING:EDIT')")
    public ResponseEntity<HttpResponse> updateTimerDescription(@PathVariable Long timerId, @RequestBody Map<String, Object> request) {
        try {
            Long userId = Long.valueOf(request.get("userId").toString());
            String description = request.get("description").toString();
            
            timerService.updateTimerDescription(userId, timerId, description);
            
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .message("Timer description updated successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .statusCode(BAD_REQUEST.value())
                    .status(BAD_REQUEST)
                    .message("Failed to update timer description: " + e.getMessage())
                    .build());
        }
    }

    // Delete/Discard a timer without saving
    @DeleteMapping("/{timerId}")
    @PreAuthorize("hasAuthority('TIME_TRACKING:EDIT')")
    public ResponseEntity<HttpResponse> deleteTimer(@PathVariable Long timerId, @RequestParam Long userId) {
        try {
            timerService.deleteTimer(timerId);
            return ResponseEntity.ok(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .data(Map.of("timerId", timerId, "deleted", true))
                    .message("Timer discarded successfully")
                    .status(OK)
                    .statusCode(OK.value())
                    .build()
            );
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(
                HttpResponse.builder()
                    .timeStamp(now().toString())
                    .statusCode(BAD_REQUEST.value())
                    .status(BAD_REQUEST)
                    .message("Failed to delete timer: " + e.getMessage())
                    .build());
        }
    }

    // Analytics endpoints
    @GetMapping("/analytics/total-active")
    @PreAuthorize("hasAnyAuthority('TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING:VIEW_TEAM')")
    public ResponseEntity<HttpResponse> getTotalActiveTimersCount() {
        Long count = timerService.getTotalActiveTimersCount();
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("totalActiveTimers", count))
                .message("Total active timers count retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }

    @GetMapping("/analytics/long-running")
    @PreAuthorize("hasAnyAuthority('TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING:VIEW_TEAM')")
    public ResponseEntity<HttpResponse> getLongRunningTimers(@RequestParam(defaultValue = "8") Integer hours) {
        List<ActiveTimerDTO> timers = timerService.getLongRunningTimers(hours);
        return ResponseEntity.ok(
            HttpResponse.builder()
                .timeStamp(now().toString())
                .data(Map.of("longRunningTimers", timers))
                .message("Long running timers retrieved")
                .status(OK)
                .statusCode(OK.value())
                .build()
        );
    }
} 