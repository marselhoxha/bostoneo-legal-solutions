package com.bostoneo.bostoneosolutions.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.Disposable;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Service to track and cancel ongoing AI generation requests.
 * Uses Disposable subscriptions to properly cancel HTTP requests at the reactive stream level.
 */
@Service
@Slf4j
public class GenerationCancellationService {

    // Map of conversationId -> cancelled flag
    private final ConcurrentHashMap<Long, Boolean> cancelledConversations = new ConcurrentHashMap<>();

    // Map of conversationId -> Disposable subscription (the actual reactive HTTP request)
    private final ConcurrentHashMap<Long, Disposable> ongoingSubscriptions = new ConcurrentHashMap<>();

    /**
     * Register an ongoing reactive subscription (the actual HTTP request)
     */
    public void registerSubscription(Long conversationId, Disposable subscription) {
        if (conversationId != null && subscription != null) {
            ongoingSubscriptions.put(conversationId, subscription);
            log.debug("Registered reactive subscription for conversation {}", conversationId);
        }
    }

    /**
     * Mark a conversation as cancelled and dispose the ongoing subscription
     */
    public void cancelConversation(Long conversationId) {
        if (conversationId != null) {
            cancelledConversations.put(conversationId, true);
            log.info("🛑 Conversation {} marked as cancelled", conversationId);

            // Dispose the reactive subscription to actually cancel the HTTP request
            Disposable subscription = ongoingSubscriptions.get(conversationId);
            log.info("🔍 Found subscription for conversation {}: {}", conversationId, subscription != null ? "EXISTS" : "NULL");

            if (subscription != null) {
                boolean wasDisposed = subscription.isDisposed();
                log.info("🔍 Subscription status before dispose - disposed: {}", wasDisposed);

                if (!wasDisposed) {
                    subscription.dispose();
                    boolean nowDisposed = subscription.isDisposed();
                    log.info("🛑 Disposed reactive subscription for conversation {} - HTTP request cancelled (now disposed: {})", conversationId, nowDisposed);
                } else {
                    log.warn("🛑 Subscription already disposed for conversation {}", conversationId);
                }
            } else {
                log.warn("🛑 No active subscription found for conversation {} - possible reasons:", conversationId);
                log.warn("   - Request completed before cancellation");
                log.warn("   - Subscription was never registered");
                log.warn("   - Different conversationId being used");
                log.warn("   - Current subscriptions in map: {}", ongoingSubscriptions.keySet());
            }
        }
    }

    /**
     * Check if a conversation has been cancelled
     */
    public boolean isCancelled(Long conversationId) {
        if (conversationId == null) {
            return false;
        }
        return cancelledConversations.getOrDefault(conversationId, false);
    }

    /**
     * Clear cancellation flag and subscription for a conversation
     * Call this after handling the cancellation or when conversation completes
     */
    public void clearCancellation(Long conversationId) {
        if (conversationId != null) {
            cancelledConversations.remove(conversationId);
            ongoingSubscriptions.remove(conversationId);
            log.debug("Cleared cancellation flag and subscription for conversation {}", conversationId);
        }
    }

    /**
     * Clear all cancellation flags and subscriptions (for cleanup)
     */
    public void clearAll() {
        int cancelledSize = cancelledConversations.size();
        int subscriptionsSize = ongoingSubscriptions.size();

        // Dispose all ongoing subscriptions
        ongoingSubscriptions.values().forEach(subscription -> {
            if (!subscription.isDisposed()) {
                subscription.dispose();
            }
        });

        cancelledConversations.clear();
        ongoingSubscriptions.clear();
        log.info("Cleared {} cancellation flags and disposed {} subscriptions", cancelledSize, subscriptionsSize);
    }
}
