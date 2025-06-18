package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.dto.AuditActivityResponseDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.AuditLogDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.CreateAuditLogRequest;
import com.***REMOVED***.***REMOVED***solutions.model.AuditLog;
import com.***REMOVED***.***REMOVED***solutions.model.HttpResponse;
import com.***REMOVED***.***REMOVED***solutions.util.CustomHttpResponse;
import com.***REMOVED***.***REMOVED***solutions.service.SystemAuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
@Slf4j
public class AuditController {

    private final SystemAuditService auditService;

    /**
     * Get recent activities for dashboard
     */
    @GetMapping("/activities/recent")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getRecentActivities(
            @RequestParam(defaultValue = "10") int limit) {
        log.info("Getting recent activities with limit: {}", limit);
        
        AuditActivityResponseDTO activities = auditService.getRecentActivities(limit);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("activities", activities.getActivities(),
                                "totalCount", activities.getTotalCount(),
                                "todayCount", activities.getTodayCount(),
                                "weekCount", activities.getWeekCount(),
                                "statistics", activities.getStatistics(),
                                "lastUpdateTime", activities.getLastUpdateTime()))
                        .message("Recent activities retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get activities for a specific user
     */
    @GetMapping("/activities/user/{userId}")
    @PreAuthorize("hasAuthority('ADMINISTRATIVE:VIEW') or #userId == authentication.principal.id")
    public ResponseEntity<HttpResponse> getUserActivities(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        log.info("Getting activities for user: {} (page: {}, size: {})", userId, page, size);
        
        Page<AuditLogDTO> activities = auditService.getUserActivities(userId, page, size);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("activities", activities.getContent(),
                                "totalElements", activities.getTotalElements(),
                                "totalPages", activities.getTotalPages(),
                                "currentPage", activities.getNumber(),
                                "pageSize", activities.getSize()))
                        .message("User activities retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get activities by date range
     */
    @GetMapping("/activities/range")
    @PreAuthorize("hasAuthority('ADMINISTRATIVE:VIEW')")
    public ResponseEntity<HttpResponse> getActivitiesByDateRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        log.info("Getting activities from {} to {} (page: {}, size: {})", startDate, endDate, page, size);
        
        Page<AuditLogDTO> activities = auditService.getActivitiesByDateRange(startDate, endDate, page, size);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("activities", activities.getContent(),
                                "totalElements", activities.getTotalElements(),
                                "totalPages", activities.getTotalPages(),
                                "currentPage", activities.getNumber(),
                                "pageSize", activities.getSize(),
                                "startDate", startDate.toString(),
                                "endDate", endDate.toString()))
                        .message("Activities by date range retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get activities for a specific entity
     */
    @GetMapping("/activities/entity/{entityType}/{entityId}")
    @PreAuthorize("hasAuthority('ADMINISTRATIVE:VIEW')")
    public ResponseEntity<HttpResponse> getEntityActivities(
            @PathVariable String entityType,
            @PathVariable Long entityId) {
        log.info("Getting activities for entity: {} (ID: {})", entityType, entityId);
        
        try {
            AuditLog.EntityType type = AuditLog.EntityType.valueOf(entityType.toUpperCase());
            List<AuditLogDTO> activities = auditService.getEntityActivities(type, entityId);
            
            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(of("activities", activities,
                                    "entityType", entityType,
                                    "entityId", entityId,
                                    "count", activities.size()))
                            .message("Entity activities retrieved successfully")
                            .status(OK)
                            .statusCode(OK.value())
                            .build());
        } catch (IllegalArgumentException e) {
            log.error("Invalid entity type: {}", entityType);
            return ResponseEntity.badRequest()
                    .body(HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Invalid entity type: " + entityType)
                            .status(org.springframework.http.HttpStatus.BAD_REQUEST)
                            .statusCode(400)
                            .build());
        }
    }

    /**
     * Create new audit log entry
     */
    @PostMapping("/activities")
    @PreAuthorize("hasAuthority('ADMINISTRATIVE:ADMIN')")
    public ResponseEntity<HttpResponse> createAuditLog(
            @AuthenticationPrincipal(expression = "id") Long currentUserId,
            @Valid @RequestBody CreateAuditLogRequest request) {
        log.info("Creating audit log entry: {} {} {}", request.getAction(), request.getEntityType(), request.getEntityId());
        
        // Use authenticated user if userId not provided in request
        if (request.getUserId() == null && currentUserId != null) {
            request.setUserId(currentUserId);
        }
        
        AuditLogDTO createdActivity = auditService.logActivity(request);
        
        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("activity", createdActivity))
                        .message("Audit log created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    /**
     * Get activity statistics
     */
    @GetMapping("/statistics")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getActivityStatistics() {
        log.info("Getting activity statistics");
        
        AuditActivityResponseDTO.ActivityStatistics statistics = auditService.getActivityStatistics();
        SystemAuditService.ActivityCounts counts = auditService.getActivityCounts();
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("statistics", statistics,
                                "counts", of(
                                        "total", counts.total,
                                        "today", counts.today,
                                        "week", counts.week
                                )))
                        .message("Activity statistics retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get activity counts for dashboard widgets
     */
    @GetMapping("/counts")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getActivityCounts() {
        log.info("Getting activity counts for dashboard");
        
        SystemAuditService.ActivityCounts counts = auditService.getActivityCounts();
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("total", counts.total,
                                "today", counts.today,
                                "week", counts.week))
                        .message("Activity counts retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Test audit functionality - creates a test audit log entry
     */
    @PostMapping("/test")
    @com.***REMOVED***.***REMOVED***solutions.annotation.AuditLog(action = "CREATE", entityType = "SYSTEM", description = "Test audit log entry created")
    public ResponseEntity<HttpResponse> testAuditLog(Authentication authentication) {
        try {
            String username = authentication != null ? authentication.getName() : "system";
            
            // Create a test audit entry directly
            auditService.logActivity(
                username,
                AuditLog.AuditAction.CREATE,
                AuditLog.EntityType.DOCUMENT,
                null,
                "Manual test audit log entry - Testing activity tracking system functionality",
                null,
                null,
                null
            );
            
            // Also create an additional test document activity
            auditService.logActivity(
                username,
                AuditLog.AuditAction.DELETE,
                AuditLog.EntityType.DOCUMENT,
                12345L,
                "Test document deletion - Simulating document removal activity",
                null,
                "192.168.1.100",
                "Test-User-Agent/1.0"
            );
            
            log.info("Test audit logs created successfully for user: {}", username);
            
            return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("message", "Test audit logs created successfully",
                               "entries", "Two test audit entries have been created: DOCUMENT CREATE and DOCUMENT DELETE"))
                        .message("Test audit logs created successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
            );
        } catch (Exception e) {
            log.error("Error creating test audit log", e);
            return ResponseEntity.status(500)
                    .body(HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Failed to create test audit log: " + e.getMessage())
                            .status(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR)
                            .statusCode(500)
                            .build());
        }
    }

    /**
     * Create test audit entries for debugging timestamp issues
     */
    @PostMapping("/activities/test")
    @PreAuthorize("hasAuthority('ADMINISTRATIVE:CREATE')")
    public ResponseEntity<HttpResponse> createTestAuditEntries() {
        log.info("Creating test audit entries for debugging");
        
        try {
            auditService.createTestAuditEntries();
            
            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(of("message", "Test audit entries created successfully"))
                            .message("Test audit entries created for timestamp debugging")
                            .status(OK)
                            .statusCode(OK.value())
                            .build());
        } catch (Exception e) {
            log.error("Failed to create test audit entries", e);
            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(of("error", e.getMessage()))
                            .message("Failed to create test audit entries")
                            .status(OK)
                            .statusCode(500)
                            .build());
        }
    }

    /**
     * Debug endpoint to check timestamp synchronization between backend and frontend
     */
    @GetMapping("/debug/time")
    @PreAuthorize("hasAuthority('ADMINISTRATIVE:VIEW')")
    public ResponseEntity<HttpResponse> debugTime() {
        log.info("Debug time endpoint called");
        
        LocalDateTime now = LocalDateTime.now();
        ZonedDateTime zonedNow = ZonedDateTime.now();
        ZonedDateTime estNow = ZonedDateTime.now(ZoneId.of("America/New_York"));
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now.toString())
                        .data(of(
                                "serverLocalDateTime", now.toString(),
                                "serverZonedDateTime", zonedNow.toString(),
                                "serverEST", estNow.toString(),
                                "serverTimezone", ZoneId.systemDefault().toString(),
                                "serverTimestamp", System.currentTimeMillis(),
                                "year", now.getYear(),
                                "instructions", "Compare these timestamps with your frontend current time"
                        ))
                        .message("Backend timestamp debug information")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
} 
 
 
 
 
 
 