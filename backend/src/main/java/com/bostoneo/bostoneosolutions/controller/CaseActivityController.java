package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.CaseActivityDTO;
import com.bostoneo.bostoneosolutions.dto.CreateActivityRequest;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.CaseActivityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

@RestController
@RequestMapping("/api/legal/cases/{caseId}/activities")
@RequiredArgsConstructor
@Slf4j
public class CaseActivityController {

    private final CaseActivityService activityService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getActivitiesByCaseId(@PathVariable("caseId") Long caseId) {
        log.info("Getting activities for case ID: {}", caseId);
        List<CaseActivityDTO> activities = activityService.getActivitiesByCaseId(caseId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("activities", activities))
                        .message("Case activities retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> createActivity(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable("caseId") Long caseId,
            @Valid @RequestBody CreateActivityRequest request) {
        log.info("Creating activity for case ID: {}", caseId);
        
        // Normalize activity type if needed (support legacy types)
        if (request.getActivityType() != null) {
            switch (request.getActivityType()) {
                case "N":
                    log.info("Converting legacy activity type 'N' to 'NOTE_ADDED'");
                    request.setActivityType("NOTE_ADDED");
                    break;
                case "U":
                    log.info("Converting legacy activity type 'U' to 'NOTE_UPDATED'");
                    request.setActivityType("NOTE_UPDATED");
                    break;
                case "D":
                    log.info("Converting legacy activity type 'D' to 'NOTE_DELETED'");
                    request.setActivityType("NOTE_DELETED");
                    break;
            }
        }
        
        log.info("Request details - CaseId: {}, ActivityType: {}, ReferenceId: {}, RefType: {}, Description: {}", 
                 request.getCaseId(), request.getActivityType(), request.getReferenceId(), 
                 request.getReferenceType(), request.getDescription());
        
        // If userId from auth is available but request doesn't have it, use the auth userId
        if (userId != null && request.getUserId() == null) {
            log.info("Using authenticated user ID: {} for activity", userId);
            request.setUserId(userId);
        }
        
        log.info("Final userId for activity: {}", request.getUserId());
        request.setCaseId(caseId); // Ensure caseId from path is used
        CaseActivityDTO createdActivity = activityService.createActivity(request);
        
        log.info("Created activity response - ID: {}, ActivityType: {}, UserId: {}, HasUser: {}",
                createdActivity.getId(), createdActivity.getActivityType(), 
                createdActivity.getUserId(), (createdActivity.getUser() != null));
        
        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("activity", createdActivity))
                        .message("Activity logged successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }
} 