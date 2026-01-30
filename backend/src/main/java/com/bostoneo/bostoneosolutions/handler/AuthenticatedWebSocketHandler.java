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

    // Store authenticated sessions - sessionId -> session (supports multiple tabs per user)
    private final Map<String, WebSocketSession> allSessions = new ConcurrentHashMap<>();
    // Legacy map for single session per user (for backward compatibility with sendNotificationToUser)
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

                    // Store the session in ALL maps
                    allSessions.put(session.getId(), session);
                    userSessions.put(userIdStr, session);
                    sessionUsers.put(session.getId(), userIdStr);

                    // SECURITY: Extract and store organization ID for tenant-isolated broadcasts
                    Long organizationId = extractOrganizationIdFromToken(token);
                    if (organizationId != null) {
                        sessionOrganizations.put(session.getId(), organizationId);
                    }

                    log.info("WebSocket connected: user={}, org={}, session={}, totalSessions={}",
                        userId, organizationId, session.getId(), allSessions.size());

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
        String sessionId = session.getId();
        String userId = sessionUsers.remove(sessionId);
        sessionOrganizations.remove(sessionId);
        allSessions.remove(sessionId);

        // Only remove from userSessions if this was the active session for that user
        if (userId != null && userSessions.get(userId) != null &&
            userSessions.get(userId).getId().equals(sessionId)) {
            userSessions.remove(userId);
        }

        log.info("WebSocket closed: user={}, session={}, remainingSessions={}", userId, sessionId, allSessions.size());
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
        log.info("Sending WebSocket notification to user: {} (active sessions: {})", userId, userSessions.keySet());
        WebSocketSession session = userSessions.get(userId);
        if (session != null && session.isOpen()) {
            try {
                String message = createMessage("notification", notification);
                sendMessage(session, message);
                log.info("WebSocket notification delivered to user: {}", userId);
            } catch (Exception e) {
                log.error("Failed to send notification to user {}: {}", userId, e.getMessage());
            }
        } else {
            log.warn("No active WebSocket session for user: {} - notification will be available on page refresh", userId);
        }
    }

    /**
     * Check if a user has an active WebSocket connection
     */
    public boolean isUserConnected(Long userId) {
        if (userId == null) return false;
        WebSocketSession session = userSessions.get(userId.toString());
        return session != null && session.isOpen();
    }

    /**
     * Get count of connected users
     */
    public int getConnectedUserCount() {
        return (int) userSessions.values().stream().filter(WebSocketSession::isOpen).count();
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
     * Broadcasts to ALL sessions (supports multiple tabs/windows per user)
     */
    public void broadcastToOrganization(Long organizationId, Object message) {
        if (organizationId == null) {
            log.warn("broadcastToOrganization called with null organizationId");
            return;
        }

        String messageStr = createMessage("broadcast", message);
        int sentCount = 0;

        // Iterate over ALL sessions and send to those with matching org
        for (Map.Entry<String, WebSocketSession> entry : allSessions.entrySet()) {
            String sessionId = entry.getKey();
            WebSocketSession session = entry.getValue();
            Long sessionOrgId = sessionOrganizations.get(sessionId);

            if (session.isOpen() && organizationId.equals(sessionOrgId)) {
                try {
                    sendMessage(session, messageStr);
                    sentCount++;
                } catch (Exception e) {
                    log.error("Failed to send to session {}: {}", sessionId, e.getMessage());
                }
            }
        }

        log.info("Broadcast sent to {} sessions in org {}", sentCount, organizationId);
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