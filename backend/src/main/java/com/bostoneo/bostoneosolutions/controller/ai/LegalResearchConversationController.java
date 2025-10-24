package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.model.AiConversationMessage;
import com.bostoneo.bostoneosolutions.model.AiConversationSession;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.LegalResearchConversationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import static java.time.LocalDateTime.now;

/**
 * REST Controller for legal research conversations
 * Manages conversation sessions and messages for the legal research feature
 */
@RestController
@RequestMapping("/api/legal/research/conversations")
@RequiredArgsConstructor
@Slf4j
public class LegalResearchConversationController {

    private final LegalResearchConversationService conversationService;

    /**
     * Get or create a conversation session
     * POST /api/legal/research/conversations/session
     */
    @PostMapping("/session")
    public ResponseEntity<HttpResponse> getOrCreateSession(@RequestBody SessionRequest request) {
        try {
            AiConversationSession session = conversationService.getOrCreateSession(
                    request.sessionId(),
                    request.userId(),
                    request.caseId(),
                    request.title()
            );

            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(Map.of("session", session))
                            .message("Session retrieved successfully")
                            .status(HttpStatus.OK)
                            .statusCode(HttpStatus.OK.value())
                            .build()
            );

        } catch (Exception e) {
            log.error("Error getting/creating session", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Failed to get/create session: " + e.getMessage())
                            .status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .statusCode(HttpStatus.INTERNAL_SERVER_ERROR.value())
                            .build());
        }
    }

    /**
     * Add a message to a conversation
     * POST /api/legal/research/conversations/{sessionId}/messages
     */
    @PostMapping("/{sessionId}/messages")
    public ResponseEntity<HttpResponse> addMessage(
            @PathVariable Long sessionId,
            @RequestBody MessageRequest request
    ) {
        try {
            AiConversationMessage message = conversationService.addMessage(
                    sessionId,
                    request.userId(),
                    request.role(),
                    request.content()
            );

            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(Map.of("message", message))
                            .message("Message added successfully")
                            .status(HttpStatus.OK)
                            .statusCode(HttpStatus.OK.value())
                            .build()
            );

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message(e.getMessage())
                            .status(HttpStatus.NOT_FOUND)
                            .statusCode(HttpStatus.NOT_FOUND.value())
                            .build());

        } catch (Exception e) {
            log.error("Error adding message to session: {}", sessionId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Failed to add message: " + e.getMessage())
                            .status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .statusCode(HttpStatus.INTERNAL_SERVER_ERROR.value())
                            .build());
        }
    }

    /**
     * Get all conversations for a case
     * GET /api/legal/research/conversations/case/{caseId}?userId={userId}
     */
    @GetMapping("/case/{caseId}")
    public ResponseEntity<HttpResponse> getConversationsForCase(
            @PathVariable Long caseId,
            @RequestParam Long userId
    ) {
        try {
            List<AiConversationSession> conversations = conversationService.getConversationsForCase(caseId, userId);

            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(Map.of("conversations", conversations))
                            .message("Conversations loaded successfully")
                            .status(HttpStatus.OK)
                            .statusCode(HttpStatus.OK.value())
                            .build()
            );

        } catch (Exception e) {
            log.error("Error loading conversations for case: {}", caseId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Failed to load conversations: " + e.getMessage())
                            .status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .statusCode(HttpStatus.INTERNAL_SERVER_ERROR.value())
                            .build());
        }
    }

    /**
     * Get a specific conversation with all messages
     * GET /api/legal/research/conversations/{sessionId}?userId={userId}
     */
    @GetMapping("/{sessionId}")
    public ResponseEntity<HttpResponse> getConversation(
            @PathVariable Long sessionId,
            @RequestParam Long userId
    ) {
        try {
            return conversationService.getConversation(sessionId, userId)
                    .map(conversation -> {
                        // Load messages separately to avoid lazy loading issues
                        List<AiConversationMessage> messages = conversationService.getMessages(sessionId, userId);

                        return ResponseEntity.ok(
                                HttpResponse.builder()
                                        .timeStamp(now().toString())
                                        .data(Map.of(
                                                "conversation", conversation,
                                                "messages", messages
                                        ))
                                        .message("Conversation found")
                                        .status(HttpStatus.OK)
                                        .statusCode(HttpStatus.OK.value())
                                        .build()
                        );
                    })
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body(HttpResponse.builder()
                                    .timeStamp(now().toString())
                                    .message("Conversation not found")
                                    .status(HttpStatus.NOT_FOUND)
                                    .statusCode(HttpStatus.NOT_FOUND.value())
                                    .build()));

        } catch (Exception e) {
            log.error("Error loading conversation: {}", sessionId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Failed to load conversation: " + e.getMessage())
                            .status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .statusCode(HttpStatus.INTERNAL_SERVER_ERROR.value())
                            .build());
        }
    }

    /**
     * Delete a conversation
     * DELETE /api/legal/research/conversations/{sessionId}?userId={userId}
     */
    @DeleteMapping("/{sessionId}")
    public ResponseEntity<HttpResponse> deleteConversation(
            @PathVariable Long sessionId,
            @RequestParam Long userId
    ) {
        try {
            boolean deleted = conversationService.deleteConversation(sessionId, userId);

            if (deleted) {
                return ResponseEntity.ok(
                        HttpResponse.builder()
                                .timeStamp(now().toString())
                                .message("Conversation deleted successfully")
                                .status(HttpStatus.OK)
                                .statusCode(HttpStatus.OK.value())
                                .build()
                );
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(HttpResponse.builder()
                                .timeStamp(now().toString())
                                .message("Conversation not found")
                                .status(HttpStatus.NOT_FOUND)
                                .statusCode(HttpStatus.NOT_FOUND.value())
                                .build());
            }

        } catch (Exception e) {
            log.error("Error deleting conversation: {}", sessionId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Failed to delete conversation: " + e.getMessage())
                            .status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .statusCode(HttpStatus.INTERNAL_SERVER_ERROR.value())
                            .build());
        }
    }

    /**
     * Update conversation title
     * PUT /api/legal/research/conversations/{sessionId}/title
     */
    @PutMapping("/{sessionId}/title")
    public ResponseEntity<HttpResponse> updateTitle(
            @PathVariable Long sessionId,
            @RequestBody UpdateTitleRequest request
    ) {
        try {
            boolean updated = conversationService.updateSessionTitle(sessionId, request.userId(), request.title());

            if (updated) {
                return ResponseEntity.ok(
                        HttpResponse.builder()
                                .timeStamp(now().toString())
                                .message("Title updated successfully")
                                .status(HttpStatus.OK)
                                .statusCode(HttpStatus.OK.value())
                                .build()
                );
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(HttpResponse.builder()
                                .timeStamp(now().toString())
                                .message("Conversation not found")
                                .status(HttpStatus.NOT_FOUND)
                                .statusCode(HttpStatus.NOT_FOUND.value())
                                .build());
            }

        } catch (Exception e) {
            log.error("Error updating title for session: {}", sessionId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Failed to update title: " + e.getMessage())
                            .status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .statusCode(HttpStatus.INTERNAL_SERVER_ERROR.value())
                            .build());
        }
    }

    // Request DTOs
    record SessionRequest(Long sessionId, Long userId, Long caseId, String title) {}
    record MessageRequest(Long userId, String role, String content) {}
    record UpdateTitleRequest(Long userId, String title) {}
}
