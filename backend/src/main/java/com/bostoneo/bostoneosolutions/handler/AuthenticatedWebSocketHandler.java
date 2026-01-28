package com.bostoneo.bostoneosolutions.handler;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.bostoneo.bostoneosolutions.provider.TokenProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuthenticatedWebSocketHandler extends TextWebSocketHandler {

    private final TokenProvider tokenProvider;
    private final ObjectMapper objectMapper;

    @Value("${jwt.secret}")
    private String secret;

    // Store authenticated sessions with user ID as key
    private final Map<String, WebSocketSession> userSessions = new ConcurrentHashMap<>();
    private final Map<String, String> sessionUsers = new ConcurrentHashMap<>();
    // SECURITY: Track organization ID per session for tenant-isolated broadcasts
    private final Map<String, Long> sessionOrganizations = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        log.info("WebSocket connection established: {}", session.getId());
        
        // Extract JWT token from query parameters
        String token = extractTokenFromSession(session);
        
        if (token != null) {
            try {
                // Extract user ID from token first
                Long userId = extractUserIdFromToken(token);
                
                if (userId != null && tokenProvider.isTokenValid(userId, token)) {
                    String userIdStr = userId.toString();

                    // Store the session
                    userSessions.put(userIdStr, session);
                    sessionUsers.put(session.getId(), userIdStr);

                    // SECURITY: Extract and store organization ID for tenant-isolated broadcasts
                    Long organizationId = extractOrganizationIdFromToken(token);
                    if (organizationId != null) {
                        sessionOrganizations.put(session.getId(), organizationId);
                    }

                    log.info("WebSocket authenticated for user: {} (org: {})", userId, organizationId);
                    
                    // Send welcome message
                    sendMessage(session, createMessage("connected", "WebSocket connection authenticated successfully"));
                } else {
                    log.warn("WebSocket connection rejected - invalid token or user");
                    session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Invalid authentication token"));
                }
            } catch (Exception e) {
                log.error("WebSocket authentication error: {}", e.getMessage());
                session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Authentication error"));
            }
        } else {
            log.warn("WebSocket connection rejected - missing token");
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Missing authentication token"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String userId = sessionUsers.remove(session.getId());
        sessionOrganizations.remove(session.getId());  // SECURITY: Clean up org tracking
        if (userId != null) {
            userSessions.remove(userId);
            log.info("WebSocket connection closed for user: {} - Status: {}", userId, status);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String userId = sessionUsers.get(session.getId());
        if (userId != null) {
            log.debug("Received message from user {}: {}", userId, message.getPayload());
            
            // Echo the message back (can be extended for specific message handling)
            sendMessage(session, createMessage("echo", "Message received: " + message.getPayload()));
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        String userId = sessionUsers.get(session.getId());
        log.error("WebSocket transport error for user {}: {}", userId, exception.getMessage());
        
        if (session.isOpen()) {
            session.close(CloseStatus.SERVER_ERROR.withReason("Transport error"));
        }
    }

    /**
     * Send notification to a specific user
     */
    public void sendNotificationToUser(String userId, Object notification) {
        WebSocketSession session = userSessions.get(userId);
        if (session != null && session.isOpen()) {
            try {
                String message = createMessage("notification", notification);
                sendMessage(session, message);
                log.debug("Notification sent to user: {}", userId);
            } catch (Exception e) {
                log.error("Failed to send notification to user {}: {}", userId, e.getMessage());
            }
        } else {
            log.debug("No active WebSocket session for user: {}", userId);
        }
    }

    /**
     * Broadcast message to all connected users
     * @deprecated Use broadcastToOrganization for tenant-isolated broadcasts
     * @throws UnsupportedOperationException Always - this method is disabled for security
     */
    @Deprecated
    public void broadcastMessage(Object message) {
        // SECURITY: This method is disabled to prevent cross-tenant data leakage
        log.error("SECURITY: broadcastMessage called - this method is disabled. Use broadcastToOrganization instead.");
        throw new UnsupportedOperationException(
            "SECURITY: broadcastMessage is disabled. Use broadcastToOrganization(organizationId, message) for tenant-isolated broadcasts."
        );
    }

    /**
     * SECURITY: Broadcast message only to users in the specified organization
     */
    public void broadcastToOrganization(Long organizationId, Object message) {
        if (organizationId == null) {
            log.warn("SECURITY: broadcastToOrganization called with null organizationId - message not sent");
            return;
        }
        String messageStr = createMessage("broadcast", message);
        userSessions.entrySet().parallelStream()
                .filter(entry -> {
                    WebSocketSession session = entry.getValue();
                    Long sessionOrgId = sessionOrganizations.get(session.getId());
                    return session.isOpen() && organizationId.equals(sessionOrgId);
                })
                .forEach(entry -> {
                    try {
                        sendMessage(entry.getValue(), messageStr);
                    } catch (Exception e) {
                        log.error("Failed to broadcast message to session {}: {}", entry.getValue().getId(), e.getMessage());
                    }
                });
    }

    private String extractTokenFromSession(WebSocketSession session) {
        // Check query parameters for token
        String query = session.getUri().getQuery();
        if (query != null) {
            String[] params = query.split("&");
            for (String param : params) {
                String[] keyValue = param.split("=", 2);
                if (keyValue.length == 2 && "token".equals(keyValue[0])) {
                    return keyValue[1];
                }
            }
        }
        
        // Check headers as fallback
        return session.getHandshakeHeaders().getFirst("Authorization");
    }

    private void sendMessage(WebSocketSession session, String message) throws IOException {
        if (session.isOpen()) {
            synchronized (session) {
                session.sendMessage(new TextMessage(message));
            }
        }
    }

    private String createMessage(String type, Object data) {
        try {
            Map<String, Object> message = Map.of(
                "type", type,
                "data", data,
                "timestamp", System.currentTimeMillis()
            );
            return objectMapper.writeValueAsString(message);
        } catch (Exception e) {
            log.error("Failed to create WebSocket message: {}", e.getMessage());
            return "{\"type\":\"error\",\"data\":\"Failed to create message\"}";
        }
    }

    /**
     * Get count of active connections
     */
    public int getActiveConnectionCount() {
        return (int) userSessions.values().stream()
                .filter(WebSocketSession::isOpen)
                .count();
    }

    /**
     * Check if user has active WebSocket connection
     */
    public boolean isUserConnected(String userId) {
        WebSocketSession session = userSessions.get(userId);
        return session != null && session.isOpen();
    }

    /**
     * Extract user ID from JWT token
     */
    private Long extractUserIdFromToken(String token) {
        try {
            return Long.valueOf(JWT.require(Algorithm.HMAC512(secret.getBytes()))
                    .build()
                    .verify(token)
                    .getSubject());
        } catch (Exception e) {
            log.error("Failed to extract user ID from token: {}", e.getMessage());
            return null;
        }
    }

    private Long extractOrganizationIdFromToken(String token) {
        try {
            var decodedJWT = JWT.require(Algorithm.HMAC512(secret.getBytes()))
                    .build()
                    .verify(token);
            var orgClaim = decodedJWT.getClaim("organizationId");
            if (!orgClaim.isNull()) {
                return orgClaim.asLong();
            }
            return null;
        } catch (Exception e) {
            log.error("Failed to extract organization ID from token: {}", e.getMessage());
            return null;
        }
    }
}