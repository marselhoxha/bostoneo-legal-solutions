import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, NgZone, ViewEncapsulation, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, interval, of } from 'rxjs';
import { takeUntil, switchMap, filter, catchError } from 'rxjs/operators';
import { MessagingService, MessageThread, Message, ClientInfo, ClientCase } from '../../service/messaging.service';
import { MessagingStateService } from '../../service/messaging-state.service';
import { LegalCaseService } from '../../modules/legal/services/legal-case.service';
import { WebSocketService } from '../../service/websocket.service';
import { UserService } from '../../service/user.service';
import { Key } from '../../enum/key.enum';
import Swal from 'sweetalert2';

interface SimpleCase {
  id: number;
  caseNumber: string;
  title: string;
  clientId?: number;
}

interface QuickReply {
  text: string;
  label?: string;
}

interface QuickReplyCategory {
  name: string;
  replies: QuickReply[];
}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class MessagesComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  Math = Math;

  threads: MessageThread[] = [];
  currentMessages: Message[] = [];
  selectedThread: MessageThread | null = null;

  // Loading states
  loading = true;
  loadingMessages = false;
  sending = false;
  loadingClients = false;
  creatingThread = false;
  error: string | null = null;

  // Reply
  replyContent = '';
  searchTerm = '';
  selectedChannel: 'PORTAL' | 'SMS' = 'PORTAL';

  // Filter & Sort
  activeFilter: 'all' | 'unread' | 'starred' | 'urgent' = 'all';
  sortBy: 'recent' | 'unread' | 'waiting' | 'priority' | 'name' = 'recent';
  showSortMenu = false;

  // UI States
  showScrollButton = false;
  newMessagesCount = 0;
  isTyping = false;
  wsConnected = false;
  sidebarCollapsed = false;
  showClientPanel = false;
  showKeyboardShortcuts = false;
  showActionsDropdown = false;

  // Quick replies
  showQuickReplies = false;
  quickReplySearch = '';
  quickReplyCategories: QuickReplyCategory[] = [
    {
      name: 'General',
      replies: [
        { text: 'Thank you for your message. I will review and get back to you shortly.' },
        { text: 'I have received your inquiry and will respond within 24 hours.' },
        { text: 'Please call our office to discuss this matter further.' }
      ]
    },
    {
      name: 'Documents',
      replies: [
        { text: 'I have reviewed your documents and everything looks good.' },
        { text: 'Please provide additional documents regarding your case.' },
        { text: 'The documents have been received and filed with the court.' }
      ]
    },
    {
      name: 'Scheduling',
      replies: [
        { text: 'Your appointment has been scheduled. You will receive a confirmation email.' },
        { text: 'Please let me know your availability for a meeting this week.' },
        { text: 'I am currently in a meeting. I will respond as soon as possible.' }
      ]
    },
    {
      name: 'Case Updates',
      replies: [
        { text: 'There has been a development in your case. Please call me at your earliest convenience.' },
        { text: 'Your case is progressing as expected. I will update you with any changes.' },
        { text: 'We have received a response from the opposing party.' }
      ]
    }
  ];

  // New thread modal
  showNewThreadModal = false;
  clients: ClientInfo[] = [];
  clientCases: SimpleCase[] = [];
  newThreadClientId = 0;
  newThreadCaseId: number | null = null;
  newThreadSubject = '';
  newThreadMessage = '';

  // Searchable client dropdown
  showClientDropdown = false;
  clientSearchTerm = '';
  filteredClients: ClientInfo[] = [];

  // Analytics
  avgResponseTime = '';

  // Role detection - check dynamically every time to handle async user loading
  get isClientRole(): boolean {
    return this.messagingService.isClientRole();
  }

  // Client-specific: cases for new thread modal
  myCases: ClientCase[] = [];

  // Polling
  private readonly POLL_INTERVAL = 5000;
  private destroy$ = new Subject<void>();

  constructor(
    private messagingService: MessagingService,
    private messagingStateService: MessagingStateService,
    private legalCaseService: LegalCaseService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private webSocketService: WebSocketService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    // Role is detected via getter - no need to set here

    // Ensure loading state is true on init
    this.loading = true;

    // Subscribe to centralized state service for threads
    this.subscribeToMessagingState();

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const threadId = params['threadId'];
      if (threadId) {
        // Wait for threads to be loaded from state service
        const checkThreads = () => {
          const thread = this.threads.find(t => t.id === parseInt(threadId));
          if (thread) {
            this.selectThread(thread);
          } else if (this.threads.length === 0) {
            // Threads not loaded yet, wait and retry
            setTimeout(checkThreads, 100);
          }
        };
        checkThreads();
      }
    });

    // Load cases for client users (for new thread modal)
    if (this.isClientRole) {
      this.loadMyCases();
    }

    this.startPolling();
    this.initWebSocket();
    if (!this.isClientRole) {
      this.calculateAvgResponseTime();
    }
  }

  /**
   * Subscribe to centralized messaging state service
   * This ensures thread list syncs with topbar and persists across navigation
   */
  private subscribeToMessagingState(): void {
    // Subscribe to threads from centralized service
    // IMPORTANT: Clone the threads array and objects to prevent mutations from affecting
    // the centralized state. This was causing the "badge appears then disappears" bug.
    this.messagingStateService.threads$
      .pipe(takeUntil(this.destroy$))
      .subscribe(threads => {
        // Deep clone threads to prevent direct mutations from affecting the source
        this.threads = threads.map(t => ({ ...t }));
        // Keep selectedThread reference in sync with threads array
        if (this.selectedThread) {
          const updatedSelected = this.threads.find(t => t.id === this.selectedThread!.id);
          if (updatedSelected) {
            this.selectedThread = updatedSelected;
          }
        }
        // Only set loading=false if we have threads, otherwise wait for loading$ to indicate completion
        if (threads.length > 0) {
          this.loading = false;
        }
        this.cdr.detectChanges();
      });

    // Subscribe to loading state - handles case where there are genuinely no threads
    this.messagingStateService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isLoading => {
        // When loading completes (isLoading becomes false) and we still have no threads,
        // set loading=false to show the empty state
        if (!isLoading && this.threads.length === 0) {
          this.loading = false;
          this.cdr.detectChanges();
        }
      });

    // Subscribe to WebSocket connection status
    this.messagingStateService.wsConnected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        this.wsConnected = connected;
        this.cdr.detectChanges();
      });

    // Subscribe to new message events from the centralized service
    // Note: Messages are already added to cache by the state service
    this.messagingStateService.newMessage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ threadId, message }) => {
        this.ngZone.run(() => {
          // Handle new message for currently selected thread
          if (this.selectedThread && threadId == this.selectedThread.id) {
            // Check if message already exists in local state
            const exists = this.currentMessages.find(m =>
              m.id == message.id ||
              (m.content === message.content &&
               m.senderType === message.senderType &&
               Math.abs(new Date(m.sentAt).getTime() - new Date(message.sentAt).getTime()) < 10000)
            );

            if (!exists) {
              this.currentMessages = [...this.currentMessages, message];
              // Sort by sentAt to ensure correct order
              this.currentMessages.sort((a, b) =>
                new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
              );

              if (this.isNearBottom()) {
                setTimeout(() => this.scrollToBottom(), 50);
              } else {
                this.newMessagesCount++;
                this.showScrollButton = true;
              }
            }
          }
          this.cdr.detectChanges();
        });
      });

    // Subscribe to cache updates (for cross-component synchronization)
    this.messagingStateService.messagesCache$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ threadId, messages }) => {
        if (this.selectedThread && threadId === this.selectedThread.id) {
          this.ngZone.run(() => {
            // Only update if there are new messages we don't have
            if (messages.length > this.currentMessages.length) {
              const prevCount = this.currentMessages.length;
              this.currentMessages = [...messages];
              this.cdr.detectChanges();

              if (this.isNearBottom()) {
                setTimeout(() => this.scrollToBottom(), 50);
              }
            }
          });
        }
      });

    // Subscribe to message read events
    this.messagingStateService.messageRead$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ threadId, readAt }) => {
        this.ngZone.run(() => {
          if (this.selectedThread && threadId == this.selectedThread.id) {
            const currentUserId = this.userService.getCurrentUserId();
            this.currentMessages.forEach(msg => {
              if (!msg.isRead) {
                let shouldMarkRead = false;
                if (this.isClientRole) {
                  shouldMarkRead = msg.senderType === 'CLIENT';
                } else {
                  if (currentUserId && msg.senderId) {
                    shouldMarkRead = msg.senderId == currentUserId;
                  } else {
                    shouldMarkRead = msg.senderType === 'ATTORNEY';
                  }
                }
                if (shouldMarkRead) {
                  msg.isRead = true;
                  msg.readAt = readAt;
                }
              }
            });
            this.cdr.detectChanges();
          }
        });
      });

    // Always trigger refresh when component initializes to ensure fresh data
    // Use force=true to bypass debounce when navigating from topbar
    this.messagingStateService.refreshThreads(true);
  }

  /**
   * Load cases for client user (for new thread modal)
   * Only includes open cases - closed cases cannot be used for new conversations
   */
  private loadMyCases(): void {
    this.messagingService.getClientCases().pipe(takeUntil(this.destroy$)).subscribe({
      next: (cases) => {
        // Filter out closed cases - users can only start conversations on open cases
        this.myCases = (cases || []).filter(c =>
          !c.status || c.status.toUpperCase() !== 'CLOSED'
        );
        this.cdr.detectChanges();
      },
      error: () => {
        this.myCases = [];
      }
    });
  }

  ngOnDestroy(): void {
    // Clear the currently viewed thread when leaving the messages component
    this.messagingStateService.setCurrentlyViewedThread(null);

    this.destroy$.next();
    this.destroy$.complete();
    // Note: Do NOT disconnect WebSocket here - it's managed by MessagingStateService
    // which needs to keep the connection alive for topbar notifications
  }

  // Keyboard shortcuts
  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    // Skip if in input field
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

    if (event.key === 'Escape') {
      if (this.showNewThreadModal) this.closeNewThreadModal();
      else if (this.showKeyboardShortcuts) this.showKeyboardShortcuts = false;
      else if (this.showQuickReplies) this.showQuickReplies = false;
      else if (this.showClientPanel) this.showClientPanel = false;
      else if (this.showSortMenu) this.showSortMenu = false;
      else if (this.showActionsDropdown) this.showActionsDropdown = false;
      return;
    }

    if (isInputField) return;

    // Ctrl shortcuts
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        this.openNewThreadModal();
      } else if (event.key === 'q' || event.key === 'Q') {
        event.preventDefault();
        if (this.selectedThread) this.showQuickReplies = !this.showQuickReplies;
      }
      return;
    }

    // Single key shortcuts
    switch (event.key) {
      case '?':
        this.showKeyboardShortcuts = true;
        break;
      case 'r':
      case 'R':
        this.loadThreads();
        break;
      case 's':
      case 'S':
        if (this.selectedThread) this.toggleStar(this.selectedThread);
        break;
      case 'p':
      case 'P':
        if (this.selectedThread) this.togglePin(this.selectedThread);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.navigateThreads(-1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.navigateThreads(1);
        break;
    }
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Close dropdown when clicking outside
    if (this.showActionsDropdown && !target.closest('.dropdown')) {
      this.showActionsDropdown = false;
    }
    // Close sort menu when clicking outside
    if (this.showSortMenu && !target.closest('.sort-control')) {
      this.showSortMenu = false;
    }
    // Close client dropdown when clicking outside
    if (this.showClientDropdown && !target.closest('.searchable-select')) {
      this.showClientDropdown = false;
    }
  }

  private navigateThreads(direction: number): void {
    const threads = this.filteredThreads;
    if (threads.length === 0) return;

    if (!this.selectedThread) {
      this.selectThread(threads[0]);
      return;
    }

    const currentIndex = threads.findIndex(t => t.id === this.selectedThread!.id);
    const newIndex = Math.max(0, Math.min(threads.length - 1, currentIndex + direction));
    if (newIndex !== currentIndex) {
      this.selectThread(threads[newIndex]);
    }
  }

  // WebSocket initialization - only for typing indicators
  // NEW_MESSAGE and MESSAGE_READ are handled by MessagingStateService subscriptions
  private initWebSocket(): void {
    const token = localStorage.getItem(Key.TOKEN);
    if (token) {
      // Connection is managed by MessagingStateService
      this.webSocketService.connect(token);

      // Only subscribe to typing indicators here
      // Other events are handled via subscribeToMessagingState()
      this.webSocketService.getMessages()
        .pipe(takeUntil(this.destroy$))
        .subscribe(msg => {
          if (msg.type === 'typing') {
            this.handleTypingIndicator(msg.data);
          }
        });
    }
  }

  /**
   * Handle MESSAGE_READ WebSocket event - updates read receipts in real-time
   * This is triggered when the OTHER party reads the messages
   */
  private handleMessageRead(data: any): void {
    this.ngZone.run(() => {
      // Use == for type coercion (threadId may be string or number)
      if (this.selectedThread && data?.threadId == this.selectedThread.id) {
        // Mark MY outgoing messages in this thread as read
        // For attorneys: only mark messages I sent (compare senderId)
        // For clients: mark CLIENT messages as read
        const currentUserId = this.userService.getCurrentUserId();
        this.currentMessages.forEach(msg => {
          if (!msg.isRead) {
            let shouldMarkRead = false;
            if (this.isClientRole) {
              // Client: mark client messages as read
              shouldMarkRead = msg.senderType === 'CLIENT';
            } else {
              // Attorney: only mark MY messages as read (not other attorneys')
              // Use == for type coercion (IDs may be string or number)
              if (currentUserId && msg.senderId) {
                shouldMarkRead = msg.senderId == currentUserId;
              } else {
                // Fallback: mark all attorney messages
                shouldMarkRead = msg.senderType === 'ATTORNEY';
              }
            }
            if (shouldMarkRead) {
              msg.isRead = true;
              msg.readAt = data.readAt;
            }
          }
        });
        this.cdr.detectChanges();
      }
    });
  }

  private handleNewMessage(notification: any): void {
    this.ngZone.run(() => {
      // Use == for comparison to handle string/number type coercion
      let thread = this.threads.find(t => t.id == notification.threadId);

      // Determine sender name based on role
      // Use senderName from notification (now provided by backend), with fallbacks
      let senderName = '';
      const currentUserId = this.userService.getCurrentUserId();
      // Check if this is a message I sent (by comparing senderId or senderType)
      const isMySentMessage = notification.senderId && currentUserId
        ? notification.senderId == currentUserId
        : (this.isClientRole && notification.senderType === 'CLIENT') ||
          (!this.isClientRole && notification.senderType === 'ATTORNEY');

      if (isMySentMessage) {
        senderName = 'You';
      } else {
        // Use senderName from WebSocket notification (now includes actual name from backend)
        senderName = notification.senderName ||
                    (notification.senderType === 'CLIENT'
                      ? (thread?.clientName || this.selectedThread?.clientName || 'Client')
                      : (thread?.attorneyName || 'Your Attorney'));
      }

      // Use == for type coercion (threadId might be string or number)
      if (this.selectedThread && notification.threadId == this.selectedThread.id) {
        if (!this.currentMessages.find(m => m.id == notification.messageId)) {
          const newMessage: Message = {
            id: notification.messageId,
            threadId: notification.threadId,
            senderId: notification.senderId, // Include senderId for multi-attorney support
            senderName: senderName,
            senderType: notification.senderType,
            content: notification.content,
            sentAt: notification.sentAt,
            isRead: false,
            hasAttachment: false
          };
          this.currentMessages = [...this.currentMessages, newMessage];

          if (this.isNearBottom()) {
            setTimeout(() => this.scrollToBottom(), 50);
          } else {
            this.newMessagesCount++;
            this.showScrollButton = true;
          }
        }
      } else if (thread) {
        thread.unreadCount = (thread.unreadCount || 0) + 1;
        thread.lastMessage = notification.content;
        thread.lastMessageAt = notification.sentAt;
        thread.lastSenderName = senderName;
        thread.lastSenderType = notification.senderType;
      } else {
        // Thread not found in our list - this is a new conversation!
        // Refresh threads to get the new one
        this.loadThreads(false);
        return; // Exit early, the loaded threads will be updated
      }

      if (thread) {
        this.threads = [thread, ...this.threads.filter(t => t.id !== thread.id)];
      }

      this.cdr.detectChanges();
    });
  }

  private handleTypingIndicator(data: any): void {
    this.ngZone.run(() => {
      // Use == for type coercion (threadId may be string or number)
      if (this.selectedThread && data?.threadId == this.selectedThread.id) {
        this.isTyping = true;
        setTimeout(() => {
          this.isTyping = false;
          this.cdr.detectChanges();
        }, 3000);
        this.cdr.detectChanges();
      }
    });
  }

  private startPolling(): void {
    // NOTE: Thread polling is now handled ONLY by MessagingStateService (every 5 seconds)
    // This prevents race conditions and duplicate API calls that were causing
    // the "badge appears then disappears" bug.

    // Message polling - for read receipt updates only when viewing a thread
    // This does NOT update thread unread counts - that's handled by MessagingStateService
    let messagePollCounter = 0;
    interval(this.POLL_INTERVAL)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => {
          if (!this.selectedThread || this.loadingMessages) return false;
          // Always poll when WS not connected
          if (!this.wsConnected) return true;
          // When WS connected, poll every 3rd interval (15 seconds) for read receipts
          messagePollCounter++;
          return messagePollCounter % 3 === 0;
        }),
        switchMap(() => this.messagingService.getMessages(this.selectedThread!.id).pipe(
          catchError(() => of(null)) // On error, emit null instead of killing the polling stream
        ))
      )
      .subscribe({
        next: (serverMessages) => {
          // Skip this poll cycle if the API call failed
          if (serverMessages === null) return;

          this.ngZone.run(() => {
            const prevCount = this.currentMessages.length;
            const threadId = this.selectedThread!.id;

            // Use centralized merge to preserve WebSocket messages and update cache
            const merged = this.messagingStateService.mergeWithCachedMessages(
              threadId,
              serverMessages || []
            );

            // Defensive: never reduce message count from polling — prevents sent messages from vanishing
            if (merged.length >= prevCount) {
              this.currentMessages = merged;
            } else if (serverMessages.length > 0) {
              // Server returned fewer messages but has data — trust it
              this.currentMessages = merged;
            }
            // else: server returned empty/fewer AND merge would lose messages — keep current

            if (this.currentMessages.length > prevCount) {
              if (this.isNearBottom()) {
                setTimeout(() => this.scrollToBottom(), 50);
              } else {
                this.newMessagesCount = this.currentMessages.length - prevCount;
                this.showScrollButton = true;
              }
            }
            // NOTE: Do NOT mutate selectedThread.unreadCount here!
            // The MessagingStateService handles unread counts via markThreadAsRead()
            // Direct mutation was causing race conditions with the centralized state
            this.cdr.detectChanges();
          });
        }
      });
  }

  /**
   * Merge server messages with local messages to prevent WebSocket messages from being lost
   * - Updates existing messages with server data (for read receipts, etc.)
   * - Adds new messages from server
   * - Preserves recent local messages not yet on server (within 30 seconds)
   * - Deduplicates messages with same content and close timestamps
   */
  private mergeMessages(localMessages: Message[], serverMessages: Message[]): Message[] {
    // Build map of server messages by ID for quick lookup (use string keys for type safety)
    const serverMsgMap = new Map<string, Message>();
    for (const msg of serverMessages) {
      serverMsgMap.set(String(msg.id), msg);
    }

    // Build set of server message IDs (as strings for type-safe comparison)
    const serverIds = new Set(serverMessages.map(m => String(m.id)));

    // Build content+time signature map for deduplication
    // Key format: "content|senderType|timestamp_rounded_to_5s"
    const serverSignatures = new Map<string, Message>();
    for (const msg of serverMessages) {
      const sig = this.getMessageSignature(msg);
      serverSignatures.set(sig, msg);
    }

    // Threshold: keep local messages from last 30 seconds even if not on server
    const recentThreshold = Date.now() - 30000;

    // Start with local messages that are either on server OR are recent
    const result: Message[] = [];
    const processedIds = new Set<string>();
    const processedSignatures = new Set<string>();

    for (const localMsg of localMessages) {
      const localIdStr = String(localMsg.id);
      const localSig = this.getMessageSignature(localMsg);

      if (serverIds.has(localIdStr)) {
        // Message exists on server by ID - use server version (has updated read status)
        const serverMsg = serverMsgMap.get(localIdStr)!;
        result.push({
          ...localMsg,
          ...serverMsg,
          senderName: serverMsg.senderName || localMsg.senderName
        });
        processedIds.add(localIdStr);
        processedSignatures.add(localSig);
      } else if (serverSignatures.has(localSig) && (localMsg.id < 0 || (localMsg as any)._wsReceived)) {
        // WebSocket/optimistic message found in server by content signature
        // Replace with server version (has real ID and read status)
        const serverMsg = serverSignatures.get(localSig)!;
        if (!processedIds.has(String(serverMsg.id))) {
          result.push({
            ...serverMsg,
            senderName: serverMsg.senderName || localMsg.senderName
          });
          processedIds.add(String(serverMsg.id));
          processedSignatures.add(localSig);
        }
      } else if (localMsg.id < 0 || new Date(localMsg.sentAt).getTime() > recentThreshold) {
        // Local-only message that's recent or is an optimistic update (negative ID)
        // Keep it - it might not be on server yet
        if (!processedSignatures.has(localSig)) {
          result.push(localMsg);
          processedIds.add(localIdStr);
          processedSignatures.add(localSig);
        }
      }
      // If message is old and not on server, drop it (was likely deleted)
    }

    // Add any server messages not in local (new messages from other sources)
    for (const serverMsg of serverMessages) {
      const serverSig = this.getMessageSignature(serverMsg);
      if (!processedIds.has(String(serverMsg.id)) && !processedSignatures.has(serverSig)) {
        result.push(serverMsg);
        processedSignatures.add(serverSig);
      }
    }

    // Sort by sentAt ascending
    result.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

    return result;
  }

  /**
   * Generate a signature for deduplication based on content, sender, and approximate time
   */
  private getMessageSignature(msg: Message): string {
    const timestamp = new Date(msg.sentAt).getTime();
    // Round to nearest 10 seconds for fuzzy matching
    const roundedTime = Math.floor(timestamp / 10000);
    // Create signature from content + sender type + approximate time
    const contentHash = msg.content?.substring(0, 100) || '';
    return `${contentHash}|${msg.senderType}|${roundedTime}`;
  }


  async loadThreads(showLoading: boolean = true): Promise<void> {
    if (showLoading) {
      this.loading = true;
      this.error = null;
      this.cdr.detectChanges();
    }

    // Use centralized state service to refresh threads
    // The subscription in subscribeToMessagingState will update local threads
    this.messagingStateService.refreshThreads(true);

    // Return a promise that resolves when threads are updated
    return new Promise((resolve) => {
      const checkComplete = () => {
        if (this.threads.length > 0 || !this.loading) {
          this.calculateAvgResponseTime();
          resolve();
        } else {
          setTimeout(checkComplete, 100);
        }
      };
      setTimeout(checkComplete, 100);
    });
  }

  selectThread(thread: MessageThread): void {
    this.selectedThread = thread;
    // Clients always use PORTAL - only attorneys can use SMS
    this.selectedChannel = (!this.isClientRole && thread.channel === 'SMS') ? 'SMS' : 'PORTAL';
    this.showScrollButton = false;
    this.newMessagesCount = 0;

    // Tell state service which thread we're viewing
    // This prevents incrementing unread count for messages in this thread
    this.messagingStateService.setCurrentlyViewedThread(thread.id);

    // Notify state service that thread was selected (marks as read and calls API)
    this.messagingStateService.markThreadAsRead(thread.id);

    this.cdr.detectChanges();

    // Use clearFirst=false to preserve cached messages while loading fresh data
    // This prevents messages from "disappearing" during navigation
    this.loadMessages(thread.id, false);
  }

  loadMessages(threadId: number, clearFirst: boolean = true): void {
    this.loadingMessages = true;

    // Check centralized cache first - this preserves WebSocket messages across navigation
    const cachedMessages = this.messagingStateService.getCachedMessages(threadId);
    if (cachedMessages && cachedMessages.length > 0 && !clearFirst) {
      // Use cached messages immediately while we fetch fresh data
      this.currentMessages = [...cachedMessages];
      this.cdr.detectChanges();
    } else if (clearFirst) {
      this.currentMessages = [];
      this.cdr.detectChanges();
    }

    // Always fetch from API to get latest data and read statuses
    this.messagingService.getMessages(threadId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (messages) => {
          this.ngZone.run(() => {
            // Use centralized merge to preserve any recent WebSocket messages
            // and update the cache with server data
            this.currentMessages = this.messagingStateService.mergeWithCachedMessages(
              threadId,
              messages || []
            );
            this.loadingMessages = false;
            this.cdr.detectChanges();
            setTimeout(() => this.scrollToBottom(), 50);
            // NOTE: Do NOT directly mutate selectedThread.unreadCount here!
            // markThreadAsRead() in selectThread() handles this via the state service
          });
        },
        error: () => {
          this.ngZone.run(() => {
            // On error, still use cached messages if available
            if (!this.currentMessages.length && cachedMessages) {
              this.currentMessages = [...cachedMessages];
            }
            this.loadingMessages = false;
            this.cdr.detectChanges();
          });
        }
      });
  }

  sendMessage(): void {
    if (!this.selectedThread || !this.replyContent.trim()) return;

    // Clients can only send via PORTAL, never SMS
    const channel = this.isClientRole ? 'PORTAL' : this.selectedChannel;

    if (channel === 'SMS' && !this.selectedThread.clientPhone) {
      this.error = 'Cannot send SMS: Client phone number not available';
      return;
    }

    this.sending = true;
    const content = this.replyContent;
    const threadId = this.selectedThread.id;

    // Optimistic update - show message immediately
    const tempId = -Date.now(); // Negative ID to identify temp messages
    const currentUserId = this.userService.getCurrentUserId();
    const optimisticMessage: Message = {
      id: tempId,
      threadId: threadId,
      senderId: currentUserId || undefined,
      senderName: 'You',
      senderType: this.isClientRole ? 'CLIENT' : 'ATTORNEY',
      channel: channel,
      content: content,
      sentAt: new Date().toISOString(),
      isRead: false,
      hasAttachment: false
    };

    // Add optimistic message immediately - wrap in ngZone to ensure Angular detects the change
    this.ngZone.run(() => {
      this.currentMessages = [...this.currentMessages, optimisticMessage];
      this.replyContent = '';

      // Add to centralized cache so it persists across navigation
      this.messagingStateService.addMessageToCache(threadId, optimisticMessage);

      // Update thread preview
      if (this.selectedThread) {
        this.selectedThread.lastMessage = content;
        this.selectedThread.lastMessageAt = optimisticMessage.sentAt;
        this.selectedThread.lastSenderName = 'You';
        this.selectedThread.lastSenderType = optimisticMessage.senderType;
        this.selectedThread.lastSenderId = currentUserId || undefined;
      }

      // Force change detection to render immediately
      this.cdr.detectChanges();

      // Scroll after render cycle completes
      requestAnimationFrame(() => this.scrollToBottom());
    });

    const sendObservable = channel === 'SMS'
      ? this.messagingService.sendSmsReply(threadId, content, this.selectedThread.clientPhone!)
      : this.messagingService.sendReply(threadId, content);

    sendObservable.pipe(takeUntil(this.destroy$)).subscribe({
      next: (message) => {
        this.ngZone.run(() => {
          const realMessage = { ...message, senderName: 'You' };

          // Replace optimistic message with real one in local state
          this.currentMessages = this.currentMessages.map(m =>
            m.id === tempId ? realMessage : m
          );

          // Update centralized cache with the real message
          this.messagingStateService.replaceTempMessage(threadId, tempId, realMessage);

          this.sending = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('Error sending message:', err);
          // Remove optimistic message on error
          this.currentMessages = this.currentMessages.filter(m => m.id !== tempId);

          // Also remove from cache
          const cachedMessages = this.messagingStateService.getCachedMessages(threadId);
          if (cachedMessages) {
            const filtered = cachedMessages.filter(m => m.id !== tempId);
            this.messagingStateService.setCachedMessages(threadId, filtered);
          }

          this.error = channel === 'SMS' ? 'Failed to send SMS' : 'Failed to send message';
          this.sending = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // Thread actions - update both local state and centralized service
  toggleStar(thread: MessageThread): void {
    thread.starred = !thread.starred;
    this.messagingStateService.updateThreadLocalState(thread.id, { starred: thread.starred });
    this.cdr.detectChanges();
  }

  togglePin(thread: MessageThread): void {
    thread.pinned = !thread.pinned;
    this.messagingStateService.updateThreadLocalState(thread.id, { pinned: thread.pinned });
    this.cdr.detectChanges();
  }

  setPriority(thread: MessageThread, priority: 'URGENT' | 'HIGH' | 'NORMAL'): void {
    thread.priority = priority;
    this.messagingStateService.updateThreadLocalState(thread.id, { priority: thread.priority });
    this.cdr.detectChanges();
  }

  closeThread(): void {
    if (!this.selectedThread) return;
    this.messagingService.closeThread(this.selectedThread.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          if (this.selectedThread) {
            this.selectedThread.status = 'CLOSED';
            this.cdr.detectChanges();
          }
        }
      });
  }

  reopenThread(): void {
    if (this.selectedThread) {
      this.selectedThread.status = 'OPEN';
      this.cdr.detectChanges();
    }
  }

  confirmDeleteThread(thread: MessageThread, event: Event): void {
    event.stopPropagation();
    Swal.fire({
      title: 'Delete Conversation?',
      text: `Are you sure you want to delete the conversation with ${thread.clientName}? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#878a99',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.deleteThread(thread);
      }
    });
  }

  deleteThread(thread: MessageThread): void {
    this.messagingService.deleteThread(thread.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Refresh centralized state to remove the deleted thread
          this.messagingStateService.refreshThreads(true);
          if (this.selectedThread?.id === thread.id) {
            this.selectedThread = null;
            this.currentMessages = [];
          }
          this.cdr.detectChanges();
          Swal.fire({
            title: 'Deleted!',
            text: 'Conversation has been deleted.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
        },
        error: () => {
          Swal.fire({
            title: 'Error',
            text: 'Failed to delete conversation. Please try again.',
            icon: 'error'
          });
        }
      });
  }

  // Sorting
  setSortBy(sort: 'recent' | 'unread' | 'waiting' | 'priority' | 'name'): void {
    this.sortBy = sort;
    this.showSortMenu = false;
    this.cdr.detectChanges();
  }

  getSortLabel(): string {
    const labels: Record<string, string> = {
      recent: 'Recent',
      unread: 'Unread',
      waiting: 'Waiting',
      priority: 'Priority',
      name: 'Name'
    };
    return labels[this.sortBy] || 'Sort';
  }

  // Computed properties
  get filteredThreads(): MessageThread[] {
    let threads = this.threads.filter(t => !t.pinned);

    // Apply filter
    switch (this.activeFilter) {
      case 'unread': threads = threads.filter(t => t.unreadCount > 0); break;
      case 'starred': threads = threads.filter(t => t.starred); break;
      case 'urgent': threads = threads.filter(t => t.priority === 'URGENT' || t.priority === 'HIGH'); break;
    }

    // Apply search
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      threads = threads.filter(t =>
        t.subject?.toLowerCase().includes(term) ||
        t.clientName?.toLowerCase().includes(term) ||
        t.caseNumber?.toLowerCase().includes(term) ||
        t.lastMessage?.toLowerCase().includes(term)
      );
    }

    // Apply sort
    return this.sortThreads(threads);
  }

  private sortThreads(threads: MessageThread[]): MessageThread[] {
    return [...threads].sort((a, b) => {
      switch (this.sortBy) {
        case 'unread':
          if (a.unreadCount !== b.unreadCount) return (b.unreadCount || 0) - (a.unreadCount || 0);
          return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
        case 'waiting':
          const aWait = this.getWaitingMinutes(a);
          const bWait = this.getWaitingMinutes(b);
          return bWait - aWait;
        case 'priority':
          const priorityOrder = { URGENT: 3, HIGH: 2, NORMAL: 1, undefined: 0 };
          return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
        case 'name':
          return (a.clientName || '').localeCompare(b.clientName || '');
        default:
          return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
      }
    });
  }

  get pinnedThreads(): MessageThread[] {
    return this.threads.filter(t => t.pinned);
  }

  get unreadCount(): number {
    return this.threads.filter(t => t.unreadCount > 0).length;
  }

  get urgentCount(): number {
    return this.threads.filter(t => t.priority === 'URGENT').length;
  }

  get awaitingResponseCount(): number {
    return this.threads.filter(t => t.lastSenderName !== 'You' && t.unreadCount > 0).length;
  }

  // Waiting time calculation
  getWaitingTime(thread: MessageThread): string {
    if (!thread.lastMessageAt || thread.lastSenderName === 'You') return '';
    const minutes = this.getWaitingMinutes(thread);
    if (minutes < 1) return '';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  private getWaitingMinutes(thread: MessageThread): number {
    if (!thread.lastMessageAt || thread.lastSenderName === 'You') return 0;
    return Math.floor((Date.now() - new Date(thread.lastMessageAt).getTime()) / 60000);
  }

  /**
   * Check if last message was from current user (role-aware)
   */
  isLastMessageFromMe(): boolean {
    if (this.currentMessages.length === 0) return false;
    const lastMsg = this.currentMessages[this.currentMessages.length - 1];
    if (this.isClientRole) {
      return lastMsg.senderType === 'CLIENT';
    }
    return lastMsg.senderType === 'ATTORNEY';
  }

  private calculateAvgResponseTime(): void {
    // Placeholder - in real implementation, calculate from actual response data
    this.avgResponseTime = '< 2h';
  }

  // Quick replies
  filterQuickReplies(replies: QuickReply[]): QuickReply[] {
    if (!this.quickReplySearch) return replies;
    const term = this.quickReplySearch.toLowerCase();
    return replies.filter(r => r.text.toLowerCase().includes(term));
  }

  useQuickReply(text: string): void {
    this.replyContent = text;
    this.showQuickReplies = false;
    // Trigger change detection to ensure the value is bound before user clicks send
    this.cdr.detectChanges();
    // Focus the input so user can edit or just press Enter to send
    this.messageInput?.nativeElement?.focus();
  }

  // Input handling
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onInputChange(): void {
    // Auto-resize textarea
    if (this.messageInput?.nativeElement) {
      const el = this.messageInput.nativeElement;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 150) + 'px';
    }
  }

  // Scroll handling
  onScroll(event: any): void {
    const element = event.target;
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
    if (atBottom) {
      this.showScrollButton = false;
      this.newMessagesCount = 0;
    } else if (element.scrollHeight > element.clientHeight) {
      this.showScrollButton = true;
    }
  }

  private isNearBottom(): boolean {
    if (!this.messagesContainer?.nativeElement) return true;
    const el = this.messagesContainer.nativeElement;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  }

  scrollToBottom(): void {
    if (this.messagesContainer?.nativeElement) {
      const el = this.messagesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.showScrollButton = false;
      this.newMessagesCount = 0;
    }
  }

  // Message grouping
  isGroupedMessage(index: number): boolean {
    if (index === 0) return false;
    const current = this.currentMessages[index];
    const previous = this.currentMessages[index - 1];
    const timeDiff = new Date(current.sentAt).getTime() - new Date(previous.sentAt).getTime();
    return current.senderType === previous.senderType && timeDiff < 120000;
  }

  isLastInGroup(index: number): boolean {
    if (index === this.currentMessages.length - 1) return true;
    const current = this.currentMessages[index];
    const next = this.currentMessages[index + 1];
    const timeDiff = new Date(next.sentAt).getTime() - new Date(current.sentAt).getTime();
    return current.senderType !== next.senderType || timeDiff >= 120000;
  }

  /**
   * Get initial for the "other party" in the conversation
   * For clients: shows attorney initial
   * For attorneys: shows client initial
   */
  getOtherPartyInitial(thread?: MessageThread): string {
    const t = thread || this.selectedThread;
    if (!t) return 'U';
    if (this.isClientRole) {
      return t.attorneyName?.charAt(0)?.toUpperCase() || 'A';
    }
    return t.clientName?.charAt(0)?.toUpperCase() || 'C';
  }

  /**
   * Get image URL for the "other party" in the conversation
   * For clients: shows attorney image
   * For attorneys: shows client image
   */
  getOtherPartyImageUrl(thread?: MessageThread): string | null {
    const t = thread || this.selectedThread;
    if (!t) return null;
    if (this.isClientRole) {
      return t.attorneyImageUrl || null;
    }
    return t.clientImageUrl || null;
  }

  /**
   * Get image URL for a message sender
   * Uses message-level senderImageUrl first, falls back to thread-level images
   */
  getMessageSenderImageUrl(message: Message): string | null {
    // First try message-level image URL (supports multi-attorney threads)
    if (message.senderImageUrl) {
      return message.senderImageUrl;
    }

    // Fallback to thread-level images
    const thread = this.selectedThread;
    if (!thread) return null;

    // For CLIENT messages, return client image
    if (message.senderType === 'CLIENT') {
      return thread.clientImageUrl || null;
    }

    // For ATTORNEY messages, return attorney image
    return thread.attorneyImageUrl || null;
  }

  /**
   * Get image URL for typing indicator avatar
   * Shows the other party's image
   */
  getTypingAvatarImageUrl(): string | null {
    return this.getOtherPartyImageUrl();
  }

  /**
   * Get display name for the "other party" in the conversation
   * For clients: shows attorney name or "Your Legal Team"
   * For attorneys: shows client name
   */
  getOtherPartyName(thread?: MessageThread): string {
    const t = thread || this.selectedThread;
    if (!t) return '';
    if (this.isClientRole) {
      return t.attorneyName || 'Your Legal Team';
    }
    return t.clientName || 'Client';
  }

  /**
   * Check if "You:" prefix should be shown for thread preview
   * Based on whether current user sent the last message
   * IMPORTANT: For multi-attorney threads, MUST compare lastSenderId
   */
  isLastMessageByMe(thread: MessageThread): boolean {
    // For attorneys, MUST compare lastSenderId to handle multi-attorney scenarios
    const currentUserId = this.userService.getCurrentUserId();
    if (thread.lastSenderId && currentUserId) {
      return thread.lastSenderId == currentUserId;
    }

    // For clients, senderType check is sufficient
    if (this.isClientRole) {
      return thread.lastSenderType === 'CLIENT';
    }

    // If we can't determine for attorneys, default to false (safer - avoids showing "You" incorrectly)
    return false;
  }

  getClientInitial(): string {
    return this.selectedThread?.clientName?.charAt(0)?.toUpperCase() || 'C';
  }

  getSelectedClientInitial(): string {
    const client = this.clients.find(c => c.id === this.newThreadClientId);
    return client?.name?.charAt(0)?.toUpperCase() || 'C';
  }

  canSendSms(): boolean {
    return !!(this.selectedThread?.clientPhone);
  }

  getEmptyMessage(): string {
    switch (this.activeFilter) {
      case 'unread': return 'No unread messages';
      case 'starred': return 'No starred conversations';
      case 'urgent': return 'No urgent conversations';
      default: return 'No conversations yet';
    }
  }

  // Context menu
  openThreadContextMenu(event: MouseEvent, thread: MessageThread): void {
    event.preventDefault();
    // For now, just select the thread - context menu can be implemented later
    this.selectThread(thread);
  }

  // Client panel actions
  callClient(): void {
    if (this.selectedThread?.clientPhone) {
      window.location.href = `tel:${this.selectedThread.clientPhone}`;
    }
  }

  emailClient(): void {
    if (this.selectedThread?.clientEmail) {
      window.location.href = `mailto:${this.selectedThread.clientEmail}`;
    }
  }

  // New thread modal
  openNewThreadModal(): void {
    this.showNewThreadModal = true;
    this.newThreadClientId = 0;
    this.newThreadCaseId = null;
    this.newThreadSubject = '';
    this.newThreadMessage = '';

    // Only load clients for attorneys - clients already have myCases loaded
    if (!this.isClientRole) {
      this.loadClients();
    }
  }

  closeNewThreadModal(): void {
    this.showNewThreadModal = false;
  }

  /**
   * Load clients list (attorney only)
   */
  loadClients(): void {
    if (this.isClientRole) return; // Clients don't need this

    this.loadingClients = true;
    this.cdr.detectChanges();

    this.messagingService.getClients().pipe(takeUntil(this.destroy$)).subscribe({
      next: (clients) => {
        this.clients = clients || [];
        this.filteredClients = [...this.clients];
        this.loadingClients = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingClients = false;
        this.cdr.detectChanges();
      }
    });
  }

  onClientChange(clientId: number): void {
    this.newThreadCaseId = null;
    this.clientCases = [];
    this.cdr.detectChanges();

    if (clientId) {
      this.legalCaseService.getCasesByClient(clientId, 0, 100).pipe(takeUntil(this.destroy$)).subscribe({
        next: (response: any) => {
          // Response structure: response.data.page.content
          const cases = response?.data?.page?.content || response?.content || [];
          // Filter out closed cases - only show open cases for new conversations
          this.clientCases = cases
            .filter((c: any) => !c.status || c.status.toUpperCase() !== 'CLOSED')
            .map((c: any) => ({
              id: c.id,
              caseNumber: c.caseNumber,
              title: c.title,
              clientId: clientId
            }));
          this.cdr.detectChanges();
        },
        error: () => {
          this.clientCases = [];
          this.cdr.detectChanges();
        }
      });
    }
  }

  onCaseChange(caseId: number | null): void {
    this.cdr.detectChanges();
  }

  filterClients(): void {
    const term = this.clientSearchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredClients = [...this.clients];
    } else {
      this.filteredClients = this.clients.filter(client =>
        client.name.toLowerCase().includes(term) ||
        client.email.toLowerCase().includes(term)
      );
    }
    this.cdr.detectChanges();
  }

  selectClient(client: ClientInfo): void {
    this.newThreadClientId = client.id;
    this.showClientDropdown = false;
    this.clientSearchTerm = '';
    this.filteredClients = [...this.clients];
    this.onClientChange(client.id);
  }

  getSelectedClientName(): string {
    if (!this.newThreadClientId) return '';
    const client = this.clients.find(c => c.id === this.newThreadClientId);
    return client ? `${client.name} (${client.email})` : '';
  }

  get filteredClientCases(): SimpleCase[] {
    return this.newThreadClientId ? this.clientCases : [];
  }

  getSubjectPlaceholder(): string {
    if (this.newThreadCaseId) {
      const cases = this.isClientRole ? this.myCases : this.clientCases;
      const selectedCase = cases.find(c => c.id === this.newThreadCaseId);
      if (selectedCase) return `Re: ${selectedCase.caseNumber}`;
    }
    return 'e.g., Question about my case...';
  }

  getAutoSubject(): string {
    if (this.newThreadCaseId) {
      const cases = this.isClientRole ? this.myCases : this.clientCases;
      const selectedCase = cases.find(c => c.id === this.newThreadCaseId);
      if (selectedCase) return `Regarding: ${selectedCase.caseNumber}`;
    }
    if (!this.isClientRole && this.newThreadClientId) {
      const client = this.clients.find(c => c.id === this.newThreadClientId);
      if (client) return `Message to ${client.name}`;
    }
    return 'New Conversation';
  }

  /**
   * Get label for the other party based on role
   */
  getOtherPartyLabel(): string {
    return this.isClientRole ? 'Your Legal Team' : 'Client';
  }

  /**
   * Get sender display name based on role
   */
  getSenderDisplayName(message: Message): string {
    if (this.isSentByMe(message)) {
      return 'You';
    }
    return message.senderName || this.getOtherPartyLabel();
  }

  /**
   * Start new thread (role-aware)
   * Clients: need caseId, attorneys: need clientId
   */
  startNewThread(): void {
    // Validation based on role
    if (this.isClientRole) {
      if (!this.newThreadCaseId || !this.newThreadMessage.trim()) return;
    } else {
      if (!this.newThreadClientId || !this.newThreadMessage.trim()) return;
    }

    const subject = this.newThreadSubject.trim() || this.getAutoSubject();
    this.creatingThread = true;
    this.cdr.detectChanges();

    this.messagingService.startThread(this.newThreadClientId, this.newThreadCaseId, subject, this.newThreadMessage)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (thread) => {
          // Refresh centralized state to include the new thread
          this.messagingStateService.refreshThreads(true);
          this.selectThread(thread);
          this.closeNewThreadModal();
          this.creatingThread = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = 'Failed to create conversation';
          this.creatingThread = false;
          this.cdr.detectChanges();
        }
      });
  }

  // Track by functions
  trackByThreadId(index: number, thread: MessageThread): number { return thread.id; }
  trackByMessageId(index: number, message: Message): number { return message.id; }

  // Formatting
  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatMessageTime(dateString: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  formatMessageDate(dateString: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  formatFullDate(dateString: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  isNewDay(index: number): boolean {
    if (index === 0) return true;
    const current = new Date(this.currentMessages[index].sentAt);
    const previous = new Date(this.currentMessages[index - 1].sentAt);
    return current.toDateString() !== previous.toDateString();
  }

  /**
   * Check if message was sent by current user (role-aware)
   * For attorneys: compares senderId to determine if it's their own message
   * For clients: checks if senderType is CLIENT
   */
  isSentByMe(message: Message): boolean {
    if (this.isClientRole) {
      return message.senderType === 'CLIENT';
    }
    // For attorneys, MUST compare senderId to determine if it's their own message
    // This is critical for multi-attorney threads where multiple attorneys can send messages
    const currentUserId = this.userService.getCurrentUserId();
    if (message.senderId && currentUserId) {
      return message.senderId == currentUserId;
    }
    // If we can't determine, default to NOT sent by me (safer - avoids showing "You" incorrectly)
    return false;
  }

  /**
   * Check if the thread has multiple attorneys (for showing sender names)
   */
  isMultiAttorneyThread(thread?: MessageThread): boolean {
    const t = thread || this.selectedThread;
    return (t?.attorneyCount || 0) > 1;
  }

  /**
   * Check if we should show the sender name on a message
   * - For clients: always show sender name on attorney messages
   * - For attorneys: show sender name on messages from other attorneys in multi-attorney threads
   */
  shouldShowSenderName(message: Message): boolean {
    // For attorney messages in multi-attorney threads, always show the name
    if (message.senderType === 'ATTORNEY' && this.isMultiAttorneyThread()) {
      return true;
    }
    // For incoming messages (from the other party), show name
    if (!this.isSentByMe(message)) {
      return true;
    }
    return false;
  }

  /**
   * Get the display name for a message sender
   * Shows "You" if sent by current user, otherwise shows actual sender name
   */
  getMessageSenderName(message: Message): string {
    if (this.isSentByMe(message)) {
      return 'You';
    }
    return message.senderName || 'Unknown';
  }

  getStatusClass(status: string): string {
    return status === 'OPEN' ? 'status-open' : 'status-closed';
  }

  /**
   * Get display subject - removes redundant "Regarding: CASE-XXXX" if case badge is shown
   * This prevents showing the case number twice in the header
   */
  getDisplaySubject(thread?: MessageThread): string {
    const t = thread || this.selectedThread;
    if (!t?.subject) return '';

    const subject = t.subject;

    // If we're showing a case badge and subject starts with "Regarding: " followed by case number
    if (t.caseNumber) {
      // Pattern: "Regarding: CASE-XXXX-YYYY" or similar
      const regardingPattern = /^Regarding:\s*/i;
      if (regardingPattern.test(subject)) {
        // Remove "Regarding: " prefix
        let cleanSubject = subject.replace(regardingPattern, '').trim();

        // If what's left is just the case number, return a generic subject
        if (cleanSubject === t.caseNumber || cleanSubject.toUpperCase() === t.caseNumber.toUpperCase()) {
          return 'Case Discussion';
        }

        // If subject starts with the case number, remove it
        if (cleanSubject.startsWith(t.caseNumber)) {
          cleanSubject = cleanSubject.substring(t.caseNumber.length).trim();
          // Remove leading dash or colon if present
          cleanSubject = cleanSubject.replace(/^[-:]\s*/, '').trim();
        }

        return cleanSubject || 'Case Discussion';
      }
    }

    return subject;
  }
}
