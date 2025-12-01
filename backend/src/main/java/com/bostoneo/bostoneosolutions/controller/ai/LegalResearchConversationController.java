package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.model.AiConversationMessage;
import com.bostoneo.bostoneosolutions.model.AiConversationSession;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.LegalResearchConversationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

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
                    request.content(),
                    request.metadata()
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
            var conversationOpt = conversationService.getConversation(sessionId, userId);
            if (conversationOpt.isPresent()) {
                var conversation = conversationOpt.get();
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

    /**
     * Get all conversations for a user with pagination
     * GET /api/legal/research/conversations?userId={userId}&page={page}&size={size}
     */
    @GetMapping
    public ResponseEntity<HttpResponse> getAllUserConversations(
            @RequestParam Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        try {
            Page<AiConversationSession> conversations = conversationService.getAllUserConversations(userId, page, size);

            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(Map.of(
                                    "conversations", conversations.getContent(),
                                    "totalPages", conversations.getTotalPages(),
                                    "totalElements", conversations.getTotalElements(),
                                    "currentPage", conversations.getNumber()
                            ))
                            .message("Conversations loaded successfully")
                            .status(HttpStatus.OK)
                            .statusCode(HttpStatus.OK.value())
                            .build()
            );

        } catch (Exception e) {
            log.error("Error loading conversations for user: {}", userId, e);
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
     * Get conversations filtered by task type
     * GET /api/legal/research/conversations/task/{taskType}?userId={userId}&page={page}&size={size}
     */
    @GetMapping("/task/{taskType}")
    public ResponseEntity<HttpResponse> getConversationsByTaskType(
            @PathVariable String taskType,
            @RequestParam Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        try {
            Page<AiConversationSession> conversations = conversationService.getConversationsByTaskType(taskType, userId, page, size);

            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(Map.of(
                                    "conversations", conversations.getContent(),
                                    "totalPages", conversations.getTotalPages(),
                                    "totalElements", conversations.getTotalElements(),
                                    "currentPage", conversations.getNumber()
                            ))
                            .message("Conversations loaded successfully")
                            .status(HttpStatus.OK)
                            .statusCode(HttpStatus.OK.value())
                            .build()
            );

        } catch (Exception e) {
            log.error("Error loading conversations by task type {} for user: {}", taskType, userId, e);
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
     * Get ONLY general conversations (no caseId) filtered by task type
     * GET /api/legal/research/conversations/general/task/{taskType}?userId={userId}&page={page}&size={size}
     * Used by AI Workspace to exclude case-specific research conversations
     */
    @GetMapping("/general/task/{taskType}")
    public ResponseEntity<HttpResponse> getGeneralConversationsByTaskType(
            @PathVariable String taskType,
            @RequestParam Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        try {
            Page<AiConversationSession> conversations = conversationService.getGeneralConversationsByTaskType(taskType, userId, page, size);

            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(Map.of(
                                    "conversations", conversations.getContent(),
                                    "totalPages", conversations.getTotalPages(),
                                    "totalElements", conversations.getTotalElements(),
                                    "currentPage", conversations.getNumber()
                            ))
                            .message("General conversations loaded successfully")
                            .status(HttpStatus.OK)
                            .statusCode(HttpStatus.OK.value())
                            .build()
            );

        } catch (Exception e) {
            log.error("Error loading general conversations by task type {} for user: {}", taskType, userId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Failed to load general conversations: " + e.getMessage())
                            .status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .statusCode(HttpStatus.INTERNAL_SERVER_ERROR.value())
                            .build());
        }
    }

    /**
     * Create a new general conversation
     * POST /api/legal/research/conversations
     */
    @PostMapping
    public ResponseEntity<HttpResponse> createGeneralConversation(@RequestBody CreateConversationRequest request) {
        try {
            AiConversationSession session = conversationService.createGeneralConversation(
                    request.userId(),
                    request.title(),
                    request.researchMode(),
                    request.taskType(),
                    request.documentType(),
                    request.jurisdiction()
            );

            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(Map.of("session", session))
                            .message("Conversation created successfully")
                            .status(HttpStatus.OK)
                            .statusCode(HttpStatus.OK.value())
                            .build()
            );

        } catch (Exception e) {
            log.error("Error creating conversation", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Failed to create conversation: " + e.getMessage())
                            .status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .statusCode(HttpStatus.INTERNAL_SERVER_ERROR.value())
                            .build());
        }
    }

    /**
     * Send query to conversation and get AI response
     * POST /api/legal/research/conversations/{sessionId}/query
     * Note: This is a synchronous endpoint to avoid async timeout issues with long AI responses
     */
    @PostMapping("/{sessionId}/query")
    public ResponseEntity<HttpResponse> sendQuery(
            @PathVariable Long sessionId,
            @RequestBody QueryRequest request
    ) {
        try {
            // Call the service - it handles cancellation internally
            CompletableFuture<AiConversationMessage> aiRequest = conversationService.sendMessageWithAIResponse(
                    sessionId,
                    request.userId(),
                    request.query(),
                    request.researchMode()
            );

            // Wait for the AI response synchronously to avoid async timeout
            AiConversationMessage message = aiRequest.join(); // Block and wait for completion

            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(Map.of("message", message))
                            .message("Response generated successfully")
                            .status(HttpStatus.OK)
                            .statusCode(HttpStatus.OK.value())
                            .build()
            );

        } catch (IllegalStateException e) {
            // Cancellation or other state error
            log.info("Query cancelled or invalid state: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message(e.getMessage())
                            .status(HttpStatus.BAD_REQUEST)
                            .statusCode(HttpStatus.BAD_REQUEST.value())
                            .build());

        } catch (Exception e) {
            log.error("Error sending query to session: {}", sessionId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(HttpResponse.builder()
                            .timeStamp(now().toString())
                            .message("Failed to process query: " + e.getMessage())
                            .status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .statusCode(HttpStatus.INTERNAL_SERVER_ERROR.value())
                            .build());
        }
    }

    // Request DTOs
    record SessionRequest(Long sessionId, Long userId, Long caseId, String title) {}
    record MessageRequest(Long userId, String role, String content, String metadata) {}
    record UpdateTitleRequest(Long userId, String title) {}
    record CreateConversationRequest(Long userId, String title, String researchMode, String taskType, String documentType, String jurisdiction) {}
    record QueryRequest(Long userId, String query, String researchMode) {}
}
