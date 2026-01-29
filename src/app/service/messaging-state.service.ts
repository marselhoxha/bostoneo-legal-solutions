import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject, timer, of, EMPTY } from 'rxjs';
import { takeUntil, switchMap, catchError, tap, take } from 'rxjs/operators';
import { MessagingService, MessageThread, Message } from './messaging.service';
import { WebSocketService, WebSocketMessage } from './websocket.service';
import { UserService } from './user.service';
import { Key } from '../enum/key.enum';

/**
 * Centralized messaging state service that persists across route navigation.
 * All components (TopbarComponent, MessagesComponent) should subscribe to this service
 * instead of maintaining their own local state.
 */
@Injectable({
  providedIn: 'root'
})
export class MessagingStateService implements OnDestroy {
  // Centralized state using BehaviorSubjects (persists values across navigation)
  private threadsSubject = new BehaviorSubject<MessageThread[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private wsConnectedSubject = new BehaviorSubject<boolean>(false);

  // Centralized message cache - stores messages per thread to persist across navigation
  private messagesCache = new Map<number, Message[]>();
  private messagesCacheSubject = new Subject<{ threadId: number; messages: Message[] }>();
  public messagesCache$ = this.messagesCacheSubject.asObservable();

  // Public observables
  public threads$ = this.threadsSubject.asObservable();
  public unreadCount$ = this.unreadCountSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public wsConnected$ = this.wsConnectedSubject.asObservable();

  // Subject for new message events (for components that need to react to new messages)
  private newMessageSubject = new Subject<{ threadId: number; message: any }>();
  public newMessage$ = this.newMessageSubject.asObservable();

  // Subject for read receipt events
  private messageReadSubject = new Subject<{ threadId: number; readAt: string }>();
  public messageRead$ = this.messageReadSubject.asObservable();

  private destroy$ = new Subject<void>();
  private initialized = false;
  private lastRefresh = 0;
  private readonly REFRESH_THRESHOLD = 2000; // Minimum 2 seconds between refreshes

  // Deduplication: Track recently processed message notifications to prevent duplicate counting
  private processedMessageKeys = new Set<string>();
  private readonly MESSAGE_DEDUP_WINDOW = 30000; // 30 seconds

  // Track currently viewed thread to prevent incrementing unread for thread being viewed
  private currentlyViewedThreadId: number | null = null;

  // Track threads recently marked as read - prevents polling from overwriting local state
  // Key: threadId, Value: timestamp when marked as read
  private recentlyMarkedAsRead = new Map<number, number>();
  private readonly MARK_AS_READ_GRACE_PERIOD = 10000; // 10 seconds

  // Track threads that received WebSocket updates - prevents polling from overwriting
  // Key: threadId, Value: { timestamp, unreadCount, lastMessage, lastMessageAt }
  private wsUpdatedThreads = new Map<number, {
    timestamp: number;
    unreadCount: number;
    lastMessage: string;
    lastMessageAt: string;
  }>();
  private readonly WS_UPDATE_GRACE_PERIOD = 15000; // 15 seconds

  constructor(
    private messagingService: MessagingService,
    private webSocketService: WebSocketService,
    private userService: UserService,
    private ngZone: NgZone
  ) {
    // Initialize immediately if token exists (no delay)
    const token = localStorage.getItem(Key.TOKEN);
    if (token && !this.initialized) {
      this.initialize();
    }

    // Also subscribe to user data changes for login/logout
    this.userService.userData$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      if (user && !this.initialized) {
        this.initialize();
      } else if (!user) {
        this.reset();
      }
    });
  }

  /**
   * Initialize the state service - connects WebSocket and loads initial data
   */
  private initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Connect WebSocket
    const token = localStorage.getItem(Key.TOKEN);
    if (token) {
      this.webSocketService.connect(token);

      // Track connection status
      this.webSocketService.isConnected()
        .pipe(takeUntil(this.destroy$))
        .subscribe(connected => {
          this.wsConnectedSubject.next(connected);
        });

      // Subscribe to WebSocket messages
      this.webSocketService.getMessages()
        .pipe(takeUntil(this.destroy$))
        .subscribe(msg => this.handleWebSocketMessage(msg));
    }

    // Load initial data
    this.refreshThreads();

    // Set up background polling as fallback
    this.startBackgroundPolling();
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(msg: WebSocketMessage): void {
    // Use NgZone.run to ensure Angular change detection runs for WebSocket messages
    this.ngZone.run(() => {
      if (msg.type === 'notification') {
        if (msg.data?.type === 'NEW_MESSAGE') {
          this.handleNewMessage(msg.data);
        } else if (msg.data?.type === 'MESSAGE_READ') {
          this.handleMessageRead(msg.data);
        }
      }
    });
  }

  /**
   * Handle new message notification from WebSocket
   */
  private handleNewMessage(notification: any): void {
    // Generate deduplication key from message properties
    const dedupKey = this.getMessageDedupKey(notification);

    // Skip if we've already processed this message (prevents duplicate counting)
    if (this.processedMessageKeys.has(dedupKey)) {
      return;
    }

    // Mark as processed and schedule cleanup
    this.processedMessageKeys.add(dedupKey);
    setTimeout(() => this.processedMessageKeys.delete(dedupKey), this.MESSAGE_DEDUP_WINDOW);

    const currentThreads = this.threadsSubject.value;
    const threadId = notification.threadId;

    // Find existing thread
    let thread = currentThreads.find(t => t.id == threadId);

    // Determine if this message is from the current user
    // IMPORTANT: Must handle multiple scenarios:
    // 1. Compare senderId with currentUserId (for multi-attorney support)
    // 2. Fall back to senderType comparison if IDs not available
    // 3. Always update UI for incoming messages - only use sound flag to control notifications
    const currentUserId = this.userService.getCurrentUserId();
    const currentUser = this.userService.getCurrentUser();
    const notificationSenderId = notification.senderId;

    let isMyMessage = false;
    // This flag ONLY controls notification sound, NOT UI updates
    // UI should always update when we receive a message that's not confirmed as ours
    let canDetermineSenderForSound = false;

    // Primary check: compare sender IDs (handles multi-attorney correctly)
    if (notificationSenderId != null && currentUserId != null) {
      canDetermineSenderForSound = true;
      // Convert both to string for reliable comparison
      isMyMessage = String(notificationSenderId) === String(currentUserId);
    }
    // Fallback: if no senderId but we have currentUser, check senderType
    else if (currentUser) {
      const isClient = currentUser.roleName === 'ROLE_CLIENT' ||
                       (currentUser as any).roles?.some((r: string) => r === 'ROLE_CLIENT');
      if (isClient && notification.senderType === 'CLIENT') {
        canDetermineSenderForSound = true;
        isMyMessage = true;
      } else if (!isClient && notification.senderType === 'ATTORNEY') {
        // For attorneys without senderId, we can't determine sender for SOUND
        // But we SHOULD still update UI - it's definitely not our message if we didn't send it
        // The backend should always provide senderId, so this case is rare
        canDetermineSenderForSound = false;
        isMyMessage = false; // Assume it's NOT our message - update UI
      } else {
        // senderType doesn't match user's role, so it's definitely not our message
        canDetermineSenderForSound = true;
        isMyMessage = false;
      }
    }
    // If we can't determine at all (no currentUser), still update UI but no sound

    // Get actual sender name (not "You" - frontend display logic handles that)
    // IMPORTANT: For multi-attorney threads, NEVER use thread?.attorneyName as fallback
    // because that's the thread OWNER, not the actual message sender!
    const senderName = notification.senderName ||
      (notification.senderType === 'CLIENT'
        ? (thread?.clientName || 'Client')
        : 'Attorney'); // Generic fallback - backend should always provide actual name

    let updatedThreads = currentThreads;

    if (thread) {
      // Update existing thread with lastSenderId for proper "You" display
      // Don't increment unread if:
      // 1. It's our own message (isMyMessage = true)
      // 2. We're currently viewing this thread (currentlyViewedThreadId matches)
      // Use == for type coercion since threadId might be string from JSON
      const isViewingThisThread = this.currentlyViewedThreadId == threadId;
      const shouldIncrementUnread = !isMyMessage && !isViewingThisThread;

      thread = {
        ...thread,
        unreadCount: shouldIncrementUnread ? (thread.unreadCount || 0) + 1 : thread.unreadCount,
        lastMessage: notification.content,
        lastMessageAt: notification.sentAt,
        lastSenderId: notification.senderId, // Critical for multi-attorney identification
        lastSenderName: senderName,
        lastSenderType: notification.senderType
      };

      // Move thread to top of list (use == for type coercion consistency)
      updatedThreads = [
        thread,
        ...currentThreads.filter(t => t.id != threadId)
      ];

      // Track this WebSocket update to prevent polling from overwriting it
      // Track even if not incrementing unread - we want to preserve lastMessage
      this.wsUpdatedThreads.set(thread.id, {
        timestamp: Date.now(),
        unreadCount: thread.unreadCount,
        lastMessage: thread.lastMessage || '',
        lastMessageAt: thread.lastMessageAt || ''
      });
      // Clean up after grace period
      setTimeout(() => {
        this.wsUpdatedThreads.delete(thread.id);
      }, this.WS_UPDATE_GRACE_PERIOD);

      this.threadsSubject.next(updatedThreads);
    } else {
      // New thread - refresh from server
      this.refreshThreads();
    }

    // Recalculate unread count from all threads
    // Always update if it's not our own message
    if (!isMyMessage) {
      const totalUnread = updatedThreads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
      this.unreadCountSubject.next(totalUnread);
    }

    // Generate a temporary negative ID if messageId is undefined
    // This helps with deduplication when polling fetches the real message
    const messageId = notification.messageId || -(Date.now());

    // Build the message object
    const newMessage: Message = {
      id: messageId,
      threadId: notification.threadId,
      senderId: notification.senderId,
      senderName: senderName,
      senderImageUrl: notification.senderImageUrl || undefined,
      senderType: notification.senderType,
      content: notification.content,
      sentAt: notification.sentAt || new Date().toISOString(),
      isRead: false,
      hasAttachment: false
    };

    // Add to centralized cache (persists across navigation)
    this.addMessageToCache(notification.threadId, newMessage);

    // Always emit new message event if it's NOT from the current user
    // The _playSoundAllowed flag controls whether notification sound plays
    // (only play sound if we can reliably determine it's from someone else)
    if (!isMyMessage) {
      this.newMessageSubject.next({
        threadId: notification.threadId,
        message: {
          ...newMessage,
          _wsReceived: Date.now(), // Track when WebSocket message was received for deduplication
          _playSoundAllowed: canDetermineSenderForSound // Only play sound if we're SURE it's from someone else
        }
      });
    }
  }

  /**
   * Generate a unique key for message deduplication
   */
  private getMessageDedupKey(notification: any): string {
    const messageId = notification.messageId || '';
    const threadId = notification.threadId || '';
    const content = (notification.content || '').substring(0, 50);
    const sentAt = notification.sentAt || '';
    return `${threadId}:${messageId}:${content}:${sentAt}`;
  }

  /**
   * Handle message read notification from WebSocket
   */
  private handleMessageRead(data: any): void {
    // Emit read event for components to update their local messages
    this.messageReadSubject.next({
      threadId: data.threadId,
      readAt: data.readAt
    });
  }

  /**
   * Refresh threads from server
   */
  public refreshThreads(force: boolean = false): void {
    // Ensure service is initialized before refreshing
    if (!this.initialized) {
      const token = localStorage.getItem(Key.TOKEN);
      if (token) {
        this.initialize();
      } else {
        return; // No token, can't refresh
      }
    }

    // Debounce rapid refresh calls
    const now = Date.now();
    if (!force && now - this.lastRefresh < this.REFRESH_THRESHOLD) {
      return;
    }
    this.lastRefresh = now;

    this.loadingSubject.next(true);

    this.messagingService.getThreads().pipe(takeUntil(this.destroy$)).subscribe({
      next: (threads) => {
        // Use NgZone.run to ensure Angular change detection runs
        this.ngZone.run(() => {
          // Preserve local state (starred, pinned, priority)
          const mergedThreads = this.mergeThreadLocalState(threads || []);
          this.threadsSubject.next(mergedThreads);

          // Calculate unread count
          const unreadCount = mergedThreads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
          this.unreadCountSubject.next(unreadCount);

          this.loadingSubject.next(false);
        });
      },
      error: (err) => {
        console.error('Failed to refresh threads:', err);
        this.ngZone.run(() => {
          this.loadingSubject.next(false);
        });
      }
    });
  }

  /**
   * Merge new thread data with existing local state (starred, pinned, priority)
   * Also preserves unread count for threads recently marked as read (prevents polling flicker)
   */
  private mergeThreadLocalState(newThreads: MessageThread[]): MessageThread[] {
    const currentThreads = this.threadsSubject.value;
    const localStateMap = new Map(
      currentThreads.map(t => [t.id, {
        starred: t.starred,
        pinned: t.pinned,
        priority: t.priority,
        unreadCount: t.unreadCount
      }])
    );

    return newThreads.map(thread => {
      const localState = localStateMap.get(thread.id);
      if (localState) {
        // Check various conditions that require preserving local state
        const markedAsReadAt = this.recentlyMarkedAsRead.get(thread.id);
        const isMarkedAsReadGrace = markedAsReadAt && (Date.now() - markedAsReadAt < this.MARK_AS_READ_GRACE_PERIOD);
        const isCurrentlyViewing = this.currentlyViewedThreadId == thread.id;

        // Check if this thread was updated via WebSocket recently
        const wsUpdate = this.wsUpdatedThreads.get(thread.id);
        const isWsUpdateGrace = wsUpdate && (Date.now() - wsUpdate.timestamp < this.WS_UPDATE_GRACE_PERIOD);

        // Determine which values to use
        let unreadCount = thread.unreadCount; // Default: use server's count
        let lastMessage = thread.lastMessage;
        let lastMessageAt = thread.lastMessageAt;

        if (isCurrentlyViewing) {
          // Currently viewing - unread is 0, but preserve lastMessage from WebSocket if available
          unreadCount = 0;
          if (isWsUpdateGrace && wsUpdate) {
            // Even when viewing, use the most recent message content
            lastMessage = wsUpdate.lastMessage || lastMessage;
            lastMessageAt = wsUpdate.lastMessageAt || lastMessageAt;
          }
        } else if (isWsUpdateGrace && wsUpdate) {
          // WebSocket recently updated this - use the WebSocket values
          unreadCount = Math.max(wsUpdate.unreadCount, thread.unreadCount);
          lastMessage = wsUpdate.lastMessage || lastMessage;
          lastMessageAt = wsUpdate.lastMessageAt || lastMessageAt;
        } else if (isMarkedAsReadGrace) {
          // Recently marked as read - preserve local unread (0)
          unreadCount = localState.unreadCount;
        }

        return {
          ...thread,
          starred: localState.starred,
          pinned: localState.pinned,
          priority: localState.priority,
          unreadCount,
          lastMessage,
          lastMessageAt
        };
      }
      return thread;
    });
  }

  /**
   * Mark a thread as read (decrements unread count)
   * CRITICAL: Also calls backend API to persist the read state.
   * This prevents polling from overwriting local state with stale data.
   */
  public markThreadAsRead(threadId: number): void {
    const currentThreads = this.threadsSubject.value;
    const thread = currentThreads.find(t => t.id === threadId);

    if (thread && thread.unreadCount > 0) {
      const unreadToRemove = thread.unreadCount;

      // Track this thread as recently marked as read
      // This prevents polling from overwriting local state for a grace period
      this.recentlyMarkedAsRead.set(threadId, Date.now());

      // Update local state immediately for responsive UI
      thread.unreadCount = 0;
      this.threadsSubject.next([...currentThreads]);
      this.unreadCountSubject.next(Math.max(0, this.unreadCountSubject.value - unreadToRemove));

      // CRITICAL: Call backend API to persist the read state
      // The getMessages() API already marks messages as read on the server
      // This ensures server state is updated before next polling cycle
      this.messagingService.getMessages(threadId).pipe(
        take(1),
        catchError(() => EMPTY)
      ).subscribe();

      // Clean up the grace period entry after it expires
      setTimeout(() => {
        this.recentlyMarkedAsRead.delete(threadId);
      }, this.MARK_AS_READ_GRACE_PERIOD);
    }
  }

  /**
   * Set the currently viewed thread ID
   * Used to prevent incrementing unread count for messages in the thread being viewed
   */
  public setCurrentlyViewedThread(threadId: number | null): void {
    this.currentlyViewedThreadId = threadId;
  }

  /**
   * Update a thread's local state (starred, pinned, priority)
   */
  public updateThreadLocalState(threadId: number, updates: Partial<Pick<MessageThread, 'starred' | 'pinned' | 'priority'>>): void {
    const currentThreads = this.threadsSubject.value;
    const threadIndex = currentThreads.findIndex(t => t.id === threadId);

    if (threadIndex !== -1) {
      currentThreads[threadIndex] = { ...currentThreads[threadIndex], ...updates };
      this.threadsSubject.next([...currentThreads]);
    }
  }

  /**
   * Get current threads (snapshot)
   */
  public getThreads(): MessageThread[] {
    return this.threadsSubject.value;
  }

  /**
   * Get current unread count (snapshot)
   */
  public getUnreadCount(): number {
    return this.unreadCountSubject.value;
  }

  /**
   * Check if current user is a client
   */
  private isClientRole(): boolean {
    return this.messagingService.isClientRole();
  }

  // ==========================================
  // MESSAGE CACHE MANAGEMENT
  // ==========================================

  /**
   * Get cached messages for a thread
   * Returns undefined if not cached (component should fetch from API)
   */
  public getCachedMessages(threadId: number): Message[] | undefined {
    return this.messagesCache.get(threadId);
  }

  /**
   * Set messages for a thread in cache (called after API fetch)
   * This replaces the entire cache for that thread
   */
  public setCachedMessages(threadId: number, messages: Message[]): void {
    this.messagesCache.set(threadId, [...messages]);
    this.messagesCacheSubject.next({ threadId, messages: [...messages] });
  }

  /**
   * Add a single message to cache (called on WebSocket message)
   * Handles deduplication by checking message ID and content signature
   */
  public addMessageToCache(threadId: number, message: Message): void {
    const cachedMessages = this.messagesCache.get(threadId) || [];

    // Check for duplicates by ID
    if (cachedMessages.find(m => m.id === message.id)) {
      return; // Already exists
    }

    // Check for duplicates by content signature (for temp ID messages)
    const signature = this.getMessageSignature(message);
    const existingBySig = cachedMessages.find(m => this.getMessageSignature(m) === signature);
    if (existingBySig && message.id < 0) {
      return; // Temp message matches existing - skip
    }

    // Add message and sort by sentAt
    const updated = [...cachedMessages, message];
    updated.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

    this.messagesCache.set(threadId, updated);
    this.messagesCacheSubject.next({ threadId, messages: updated });
  }

  /**
   * Update a message in cache (e.g., replace temp ID with real ID, update read status)
   */
  public updateMessageInCache(threadId: number, messageId: number, updates: Partial<Message>): void {
    const cachedMessages = this.messagesCache.get(threadId);
    if (!cachedMessages) return;

    const index = cachedMessages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      cachedMessages[index] = { ...cachedMessages[index], ...updates };
      this.messagesCache.set(threadId, [...cachedMessages]);
      this.messagesCacheSubject.next({ threadId, messages: [...cachedMessages] });
    }
  }

  /**
   * Replace a temp message with the real message from server
   */
  public replaceTempMessage(threadId: number, tempId: number, realMessage: Message): void {
    const cachedMessages = this.messagesCache.get(threadId);
    if (!cachedMessages) return;

    const updated = cachedMessages.map(m => m.id === tempId ? realMessage : m);
    this.messagesCache.set(threadId, updated);
    this.messagesCacheSubject.next({ threadId, messages: updated });
  }

  /**
   * Merge API messages with cached messages to preserve WebSocket messages
   * and update read statuses from server
   */
  public mergeWithCachedMessages(threadId: number, serverMessages: Message[]): Message[] {
    const cached = this.messagesCache.get(threadId) || [];

    // Build maps for deduplication
    const serverSignatures = new Set(serverMessages.map(m => this.getMessageSignature(m)));
    const serverIds = new Set(serverMessages.map(m => m.id));

    // Keep recent cached messages not yet on server (within 60 seconds)
    // This includes BOTH temp messages (negative ID) AND WebSocket messages (positive ID)
    // that might not have been saved to DB yet due to timing
    const recentThreshold = Date.now() - 60000;
    const recentCached = cached.filter(m => {
      const messageTime = new Date(m.sentAt).getTime();
      const isRecent = messageTime > recentThreshold;

      if (!isRecent) return false;

      // Skip if server already has this exact message ID
      if (serverIds.has(m.id)) return false;

      // Skip if server has a matching message by content signature
      if (serverSignatures.has(this.getMessageSignature(m))) return false;

      // Keep this cached message - it's recent and not on server yet
      return true;
    });

    // Merge: server messages + recent cached (that aren't on server yet)
    const merged = [...serverMessages, ...recentCached];
    merged.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

    // Update cache
    this.messagesCache.set(threadId, merged);
    this.messagesCacheSubject.next({ threadId, messages: merged });

    return merged;
  }

  /**
   * Clear cache for a specific thread
   */
  public clearThreadCache(threadId: number): void {
    this.messagesCache.delete(threadId);
  }

  /**
   * Generate a signature for message deduplication
   */
  private getMessageSignature(msg: Message): string {
    const timestamp = new Date(msg.sentAt).getTime();
    const roundedTime = Math.floor(timestamp / 10000); // Round to nearest 10 seconds
    const contentHash = msg.content?.substring(0, 100) || '';
    return `${contentHash}|${msg.senderType}|${roundedTime}`;
  }

  /**
   * Background polling - polls regularly to ensure messages are always up to date
   * This is the primary mechanism for real-time updates since WebSocket may not always deliver
   */
  private startBackgroundPolling(): void {
    // Use timer(0, 5000) to poll IMMEDIATELY on start, then every 5 seconds
    // This ensures messages appear quickly even if WebSocket notifications aren't working
    timer(0, 5000)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() =>
          this.messagingService.getThreads().pipe(
            // CRITICAL: catchError prevents errors from terminating the polling stream
            catchError(() => {
              // On error, return the current threads (don't clear them)
              // This prevents data from disappearing on transient errors
              return of(this.threadsSubject.value);
            })
          )
        )
      )
      .subscribe({
        next: (threads) => {
          // Skip empty results if we already have data (likely an error occurred)
          if ((!threads || threads.length === 0) && this.threadsSubject.value.length > 0) {
            return;
          }

          // Use NgZone.run to ensure Angular change detection runs
          this.ngZone.run(() => {
            const mergedThreads = this.mergeThreadLocalState(threads || []);
            const currentUnread = this.unreadCountSubject.value;
            const newUnread = mergedThreads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);

            // OPTIMIZATION: Only emit if data actually changed
            // This prevents unnecessary re-renders that cause flickering
            if (!this.areThreadsEqual(this.threadsSubject.value, mergedThreads)) {
              this.threadsSubject.next(mergedThreads);
            }

            // Update unread count if changed
            if (newUnread !== currentUnread) {
              this.unreadCountSubject.next(newUnread);
            }
          });
        }
      });
  }

  /**
   * Shallow equality check for threads to prevent unnecessary emissions
   * Compares key fields that affect the UI display
   */
  private areThreadsEqual(current: MessageThread[], incoming: MessageThread[]): boolean {
    if (current.length !== incoming.length) return false;

    for (let i = 0; i < current.length; i++) {
      const c = current[i];
      const n = incoming[i];
      // Compare key fields that affect UI
      if (c.id !== n.id ||
          c.unreadCount !== n.unreadCount ||
          c.lastMessage !== n.lastMessage ||
          c.lastMessageAt !== n.lastMessageAt ||
          c.lastSenderType !== n.lastSenderType) {
        return false;
      }
    }
    return true;
  }

  /**
   * Reset state (on logout)
   */
  private reset(): void {
    this.initialized = false;
    this.threadsSubject.next([]);
    this.unreadCountSubject.next(0);
    this.loadingSubject.next(false);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
