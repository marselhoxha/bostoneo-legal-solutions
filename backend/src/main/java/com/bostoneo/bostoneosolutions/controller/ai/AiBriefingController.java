package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.AiBriefingService;
import com.bostoneo.bostoneosolutions.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.OK;

/**
 * Controller for AI-powered attorney briefings.
 * Provides personalized daily briefings based on schedule, urgent items, and team activity.
 */
@RestController
@RequestMapping("/api/ai/briefing")
@RequiredArgsConstructor
@Slf4j
public class AiBriefingController {

    private final AiBriefingService aiBriefingService;
    private final UserService userService;

    /**
     * Get personalized AI briefing for the current user.
     * Accepts context data from frontend to generate relevant briefing.
     */
    @PostMapping
    public CompletableFuture<ResponseEntity<HttpResponse>> getBriefing(
            @AuthenticationPrincipal UserDTO userDetails,
            @RequestBody BriefingRequest request) {

        log.info("Generating AI briefing for user: {}", userDetails.getEmail());

        // Get full user details
        UserDTO user = userService.getUserByEmail(userDetails.getEmail());

        return aiBriefingService.generateBriefing(
                user,
                request.todayEventsCount(),
                request.urgentItemsCount(),
                request.activeCasesCount(),
                request.nextEventTitle(),
                request.nextEventTime(),
                request.hasCourtAppearance(),
                request.courtCaseName(),
                request.courtTime(),
                request.recentTeamActivity()
        ).handle((briefing, ex) -> {
            if (ex != null) {
                log.error("Error generating briefing: {}", ex.getMessage());
                return ResponseEntity.ok(
                        HttpResponse.builder()
                                .timeStamp(now().toString())
                                .data(of("briefing", "Your schedule is ready for review."))
                                .message("Fallback briefing returned")
                                .status(OK)
                                .statusCode(OK.value())
                                .build()
                );
            }
            log.info("AI briefing generated successfully for user: {}", user.getEmail());
            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(of("briefing", briefing))
                            .message("Briefing generated successfully")
                            .status(OK)
                            .statusCode(OK.value())
                            .build()
            );
        });
    }

    /**
     * Invalidate cached briefing for current user.
     * Call this when significant changes occur (new urgent items, schedule changes).
     */
    @PostMapping("/invalidate")
    public ResponseEntity<HttpResponse> invalidateCache(
            @AuthenticationPrincipal UserDTO userDetails) {

        UserDTO user = userService.getUserByEmail(userDetails.getEmail());
        aiBriefingService.invalidateCache(user.getId());

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Briefing cache invalidated")
                        .status(OK)
                        .statusCode(OK.value())
                        .build()
        );
    }

    /**
     * Request record for briefing context data.
     */
    public record BriefingRequest(
            int todayEventsCount,
            int urgentItemsCount,
            int activeCasesCount,
            String nextEventTitle,
            String nextEventTime,
            boolean hasCourtAppearance,
            String courtCaseName,
            String courtTime,
            List<String> recentTeamActivity
    ) {}
}
