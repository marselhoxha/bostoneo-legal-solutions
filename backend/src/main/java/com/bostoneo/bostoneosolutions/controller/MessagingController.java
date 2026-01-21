package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.ClientPortalMessageDTO;
import com.bostoneo.bostoneosolutions.dto.ClientPortalMessageThreadDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.MessagingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import static java.time.LocalDateTime.now;
import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

/**
 * Controller for Attorney/Staff messaging endpoints.
 * Allows attorneys to view and respond to client messages.
 */
@RestController
@RequestMapping("/api/messaging")
@RequiredArgsConstructor
@Slf4j
public class MessagingController {

    private final MessagingService messagingService;

    /**
     * Get all message threads for the authenticated attorney
     */
    @GetMapping("/threads")
    public ResponseEntity<HttpResponse> getThreads(@AuthenticationPrincipal(expression = "id") Long userId) {
        log.info("User {} fetching message threads", userId);
        List<ClientPortalMessageThreadDTO> threads = messagingService.getThreadsForAttorney(userId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("threads", threads))
                        .message("Message threads retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get threads by case
     */
    @GetMapping("/threads/case/{caseId}")
    public ResponseEntity<HttpResponse> getThreadsByCase(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long caseId) {
        log.info("User {} fetching threads for case {}", userId, caseId);
        List<ClientPortalMessageThreadDTO> threads = messagingService.getThreadsByCase(caseId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("threads", threads))
                        .message("Case threads retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Get messages in a thread
     */
    @GetMapping("/threads/{threadId}/messages")
    public ResponseEntity<HttpResponse> getMessages(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long threadId) {
        log.info("User {} fetching messages for thread {}", userId, threadId);
        List<ClientPortalMessageDTO> messages = messagingService.getMessagesForAttorney(userId, threadId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("messages", messages))
                        .message("Messages retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Send a reply to a thread
     */
    @PostMapping("/threads/{threadId}/reply")
    public ResponseEntity<HttpResponse> sendReply(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long threadId,
            @RequestBody Map<String, String> request) {
        String content = request.get("content");
        log.info("User {} sending reply to thread {}", userId, threadId);
        ClientPortalMessageDTO message = messagingService.sendReply(userId, threadId, content);

        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("message", message))
                        .message("Reply sent")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    /**
     * Send a reply via SMS to the client's phone.
     * This will send an actual SMS and also store the message in the thread.
     */
    @PostMapping("/threads/{threadId}/reply-sms")
    public ResponseEntity<HttpResponse> sendSmsReply(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long threadId,
            @RequestBody Map<String, String> request) {
        String content = request.get("content");
        String toPhone = request.get("toPhone");

        if (content == null || content.isEmpty()) {
            throw new IllegalArgumentException("Message content is required");
        }
        if (toPhone == null || toPhone.isEmpty()) {
            throw new IllegalArgumentException("Phone number is required");
        }

        log.info("User {} sending SMS reply to thread {}", userId, threadId);
        ClientPortalMessageDTO message = messagingService.sendSmsReply(userId, threadId, content, toPhone);

        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("message", message))
                        .message("SMS reply sent successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    /**
     * Get unread message count for attorney
     */
    @GetMapping("/unread-count")
    public ResponseEntity<HttpResponse> getUnreadCount(@AuthenticationPrincipal(expression = "id") Long userId) {
        int count = messagingService.getUnreadCount(userId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("unreadCount", count))
                        .message("Unread count retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Close a thread
     */
    @PutMapping("/threads/{threadId}/close")
    public ResponseEntity<HttpResponse> closeThread(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long threadId) {
        log.info("User {} closing thread {}", userId, threadId);
        messagingService.closeThread(threadId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Thread closed")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Delete a thread and all its messages
     */
    @DeleteMapping("/threads/{threadId}")
    public ResponseEntity<HttpResponse> deleteThread(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @PathVariable Long threadId) {
        log.info("User {} deleting thread {}", userId, threadId);
        messagingService.deleteThread(threadId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Thread deleted")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    /**
     * Start a new thread with a client
     */
    @PostMapping("/threads/new")
    public ResponseEntity<HttpResponse> startThread(
            @AuthenticationPrincipal(expression = "id") Long userId,
            @RequestBody Map<String, Object> request) {
        Long clientId = Long.valueOf(request.get("clientId").toString());
        Long caseId = request.get("caseId") != null ? Long.valueOf(request.get("caseId").toString()) : null;
        String subject = (String) request.get("subject");
        String message = (String) request.get("message");

        log.info("User {} starting new thread with client {}", userId, clientId);
        ClientPortalMessageThreadDTO thread = messagingService.startThreadWithClient(userId, clientId, caseId, subject, message);

        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("thread", thread))
                        .message("Thread created")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    /**
     * Get list of clients for starting a new conversation
     */
    @GetMapping("/clients")
    public ResponseEntity<HttpResponse> getClients(@AuthenticationPrincipal(expression = "id") Long userId) {
        log.info("User {} fetching clients list", userId);
        List<MessagingService.ClientDTO> clients = messagingService.getClientsForAttorney(userId);

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(Map.of("clients", clients))
                        .message("Clients retrieved")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}
