package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.CaseNoteDTO;
import com.bostoneo.bostoneosolutions.dto.CreateCaseNoteRequest;
import com.bostoneo.bostoneosolutions.dto.UpdateCaseNoteRequest;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.CaseActivityService;
import com.bostoneo.bostoneosolutions.service.CaseNoteService;
import com.bostoneo.bostoneosolutions.service.UserService;
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
@RequestMapping("/api/legal/cases/{caseId}/notes")
@RequiredArgsConstructor
@Slf4j
public class CaseNoteController {

    private final CaseNoteService noteService;
    private final CaseActivityService activityService;
    private final UserService userService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getNotesByCaseId(@PathVariable("caseId") Long caseId) {
        log.info("Getting notes for case ID: {}", caseId);
        List<CaseNoteDTO> notes = noteService.getNotesByCaseId(caseId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("notes", notes))
                        .message("Case notes retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/{noteId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getNoteById(
            @PathVariable("caseId") Long caseId,
            @PathVariable("noteId") Long noteId) {
        log.info("Getting note ID: {} for case ID: {}", noteId, caseId);
        CaseNoteDTO note = noteService.getNoteById(caseId, noteId);
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("note", note))
                        .message("Case note retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> createNote(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable("caseId") Long caseId,
            @Valid @RequestBody CreateCaseNoteRequest request) {
        log.info("Creating note for case ID: {}", caseId);
        
        request.setCaseId(caseId); // Ensure caseId from path is used
        request.setUserId(userId); // Set the current user ID
        
        CaseNoteDTO createdNote = noteService.createNote(request);
        
        // Log activity - now in try-catch to prevent failures
        try {
            activityService.logNoteAdded(caseId, createdNote.getId(), createdNote.getTitle(), userId);
        } catch (Exception e) {
            log.error("Failed to log note activity, but note was created successfully: {}", e.getMessage());
            // Continue processing - don't let activity logging failure affect the response
        }
        
        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("note", createdNote))
                        .message("Case note created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @PutMapping("/{noteId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> updateNote(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable("caseId") Long caseId,
            @PathVariable("noteId") Long noteId,
            @Valid @RequestBody UpdateCaseNoteRequest request) {
        log.info("Updating note ID: {} for case ID: {}", noteId, caseId);
        
        request.setUserId(userId); // Set the current user ID
        
        CaseNoteDTO updatedNote = noteService.updateNote(caseId, noteId, request);
        
        // Log activity - now in try-catch to prevent failures
        try {
            activityService.logNoteUpdated(caseId, noteId, updatedNote.getTitle(), userId);
        } catch (Exception e) {
            log.error("Failed to log note update activity, but note was updated successfully: {}", e.getMessage());
            // Continue processing - don't let activity logging failure affect the response
        }
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("note", updatedNote))
                        .message("Case note updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @DeleteMapping("/{noteId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> deleteNote(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable("caseId") Long caseId,
            @PathVariable("noteId") Long noteId) {
        log.info("Deleting note ID: {} for case ID: {}", noteId, caseId);
        
        // Get note details before deletion to use in activity logging
        CaseNoteDTO note = noteService.getNoteById(caseId, noteId);
        
        // Delete the note
        noteService.deleteNote(caseId, noteId);
        
        // Log activity - now in try-catch to prevent failures
        try {
            activityService.logNoteDeleted(caseId, noteId, note.getTitle(), userId);
        } catch (Exception e) {
            log.error("Failed to log note deletion activity, but note was deleted successfully: {}", e.getMessage());
            // Continue processing - don't let activity logging failure affect the response
        }
        
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Case note deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
} 