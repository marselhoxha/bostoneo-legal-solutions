import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, NgZone, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, interval } from 'rxjs';
import { takeUntil, switchMap, filter } from 'rxjs/operators';
import { MessagingService, MessageThread, Message, ClientInfo } from '../../service/messaging.service';
import { LegalCaseService } from '../../modules/legal/services/legal-case.service';
import { WebSocketService } from '../../service/websocket.service';
import { Key } from '../../enum/key.enum';

interface SimpleCase {
  id: number;
  caseNumber: string;
  title: string;
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

  // New thread modal
  showNewThreadModal = false;
  clients: ClientInfo[] = [];
  clientCases: SimpleCase[] = [];
  newThreadClientId = 0;
  newThreadCaseId: number | null = null;
  newThreadSubject = '';
  newThreadMessage = '';

  // Polling
  private readonly POLL_INTERVAL = 5000; // 5 seconds
  private wsConnected = false;

  private destroy$ = new Subject<void>();

  constructor(
    private messagingService: MessagingService,
    private legalCaseService: LegalCaseService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const threadId = params['threadId'];
      if (threadId) {
        this.loadThreads().then(() => {
          const thread = this.threads.find(t => t.id === parseInt(threadId));
          if (thread) this.selectThread(thread);
        });
      } else {
        this.loadThreads();
      }
    });
    this.startPolling();
    this.initWebSocket();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.webSocketService.disconnect();
  }

  // Initialize WebSocket for real-time messages
  private initWebSocket(): void {
    const token = localStorage.getItem(Key.TOKEN);
    if (token) {
      this.webSocketService.connect(token);

      // Track connection status
      this.webSocketService.isConnected()
        .pipe(takeUntil(this.destroy$))
        .subscribe(connected => {
          this.wsConnected = connected;
        });

      this.webSocketService.getMessages()
        .pipe(takeUntil(this.destroy$))
        .subscribe(msg => {
          if (msg.type === 'notification' && msg.data?.type === 'NEW_MESSAGE') {
            const notification = msg.data;
            this.ngZone.run(() => {
              // Find the thread in the list
              const thread = this.threads.find(t => t.id === notification.threadId);

              // If message is for current thread, add it directly to UI
              if (this.selectedThread && notification.threadId === this.selectedThread.id) {
                // Only add if not already in the list
                if (!this.currentMessages.find(m => m.id === notification.messageId)) {
                  const newMessage: Message = {
                    id: notification.messageId,
                    threadId: notification.threadId,
                    senderName: notification.senderType === 'CLIENT' ? (this.selectedThread.clientName || 'Client') : 'You',
                    senderType: notification.senderType,
                    content: notification.content,
                    sentAt: notification.sentAt,
                    isRead: false,
                    hasAttachment: false
                  };
                  this.currentMessages = [...this.currentMessages, newMessage];
                  setTimeout(() => this.scrollToBottom(), 50);
                }
              } else if (thread) {
                // Message is for a different thread - increment unread count
                thread.unreadCount = (thread.unreadCount || 0) + 1;
                thread.lastMessage = notification.content;
                thread.lastMessageAt = notification.sentAt;
                thread.lastSenderName = notification.senderType === 'CLIENT' ? (thread.clientName || 'Client') : 'You';
              }

              // Move thread to top of list
              if (thread) {
                this.threads = [thread, ...this.threads.filter(t => t.id !== thread.id)];
              }

              this.cdr.detectChanges();
            });
          }
        });
    }
  }

  // Start polling for new messages (fallback when WebSocket is disconnected)
  private startPolling(): void {
    // Poll for thread updates (only when WebSocket disconnected)
    interval(this.POLL_INTERVAL)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => !this.loading && !this.wsConnected),
        switchMap(() => this.messagingService.getThreads())
      )
      .subscribe({
        next: (threads) => {
          this.ngZone.run(() => {
            const selectedId = this.selectedThread?.id;
            this.threads = threads || [];
            if (selectedId) {
              this.selectedThread = this.threads.find(t => t.id === selectedId) || null;
            }
            this.cdr.detectChanges();
          });
        }
      });

    // Poll for messages in selected thread (only when WebSocket disconnected)
    interval(this.POLL_INTERVAL)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => !!this.selectedThread && !this.loadingMessages && !this.wsConnected),
        switchMap(() => this.messagingService.getMessages(this.selectedThread!.id))
      )
      .subscribe({
        next: (messages) => {
          this.ngZone.run(() => {
            const prevCount = this.currentMessages.length;
            this.currentMessages = messages || [];
            if (this.currentMessages.length > prevCount) {
              setTimeout(() => this.scrollToBottom(), 50);
            }
            if (this.selectedThread) {
              this.selectedThread.unreadCount = 0;
            }
            this.cdr.detectChanges();
          });
        }
      });
  }

  async loadThreads(showLoading: boolean = true): Promise<void> {
    if (showLoading) {
      this.loading = true;
      this.error = null;
      this.cdr.detectChanges();
    }

    return new Promise((resolve) => {
      this.messagingService.getThreads()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (threads) => {
            this.ngZone.run(() => {
              this.threads = threads || [];
              this.loading = false;
              this.cdr.detectChanges();
              resolve();
            });
          },
          error: (err) => {
            this.ngZone.run(() => {
              console.error('Error loading threads:', err);
              this.error = 'Failed to load messages';
              this.loading = false;
              this.cdr.detectChanges();
              resolve();
            });
          }
        });
    });
  }

  selectThread(thread: MessageThread): void {
    this.selectedThread = thread;
    this.cdr.detectChanges();
    this.loadMessages(thread.id);
  }

  loadMessages(threadId: number, clearFirst: boolean = true): void {
    this.loadingMessages = true;
    if (clearFirst) {
      this.currentMessages = [];
    }
    this.cdr.detectChanges();

    this.messagingService.getMessages(threadId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (messages) => {
          this.ngZone.run(() => {
            const prevCount = this.currentMessages.length;
            this.currentMessages = messages || [];
            this.loadingMessages = false;
            this.cdr.detectChanges();
            if (this.currentMessages.length > prevCount || clearFirst) {
              setTimeout(() => this.scrollToBottom(), 50);
            }
            if (this.selectedThread) {
              this.selectedThread.unreadCount = 0;
            }
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            console.error('Error loading messages:', err);
            this.loadingMessages = false;
            this.cdr.detectChanges();
          });
        }
      });
  }

  sendReply(): void {
    if (!this.selectedThread || !this.replyContent.trim()) return;

    this.sending = true;
    this.cdr.detectChanges();

    const content = this.replyContent;
    this.messagingService.sendReply(this.selectedThread.id, content)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (message) => {
          this.ngZone.run(() => {
            this.currentMessages = [...this.currentMessages, message];
            this.replyContent = '';
            this.sending = false;
            this.cdr.detectChanges();
            setTimeout(() => this.scrollToBottom(), 50);
            if (this.selectedThread) {
              this.selectedThread.lastMessage = message.content;
              this.selectedThread.lastMessageAt = message.sentAt;
              this.selectedThread.lastSenderName = 'You';
            }
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            console.error('Error sending reply:', err);
            this.error = 'Failed to send message';
            this.sending = false;
            this.cdr.detectChanges();
          });
        }
      });
  }

  closeThread(): void {
    if (!this.selectedThread) return;

    this.messagingService.closeThread(this.selectedThread.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.ngZone.run(() => {
            if (this.selectedThread) {
              this.selectedThread.status = 'CLOSED';
              this.cdr.detectChanges();
            }
          });
        },
        error: (err) => console.error('Error closing thread:', err)
      });
  }

  refreshMessages(): void {
    if (this.selectedThread) {
      this.loadMessages(this.selectedThread.id);
    }
  }

  // New thread modal methods
  openNewThreadModal(): void {
    this.showNewThreadModal = true;
    this.newThreadClientId = 0;
    this.newThreadCaseId = null;
    this.newThreadSubject = '';
    this.newThreadMessage = '';
    this.loadClients();
    this.cdr.detectChanges();
  }

  closeNewThreadModal(): void {
    this.showNewThreadModal = false;
    this.cdr.detectChanges();
  }

  loadClients(): void {
    this.loadingClients = true;
    this.cdr.detectChanges();

    this.messagingService.getClients()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (clients) => {
          this.ngZone.run(() => {
            this.clients = clients || [];
            this.loadingClients = false;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            console.error('Error loading clients:', err);
            this.loadingClients = false;
            this.cdr.detectChanges();
          });
        }
      });

    // Load cases
    this.legalCaseService.getAllCases(0, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.ngZone.run(() => {
            this.clientCases = (response.content || []).map((c: any) => ({
              id: c.id,
              caseNumber: c.caseNumber,
              title: c.title
            }));
            this.cdr.detectChanges();
          });
        },
        error: (err) => console.error('Error loading cases:', err)
      });
  }

  startNewThread(): void {
    if (!this.newThreadClientId || !this.newThreadSubject.trim() || !this.newThreadMessage.trim()) {
      return;
    }

    this.creatingThread = true;
    this.cdr.detectChanges();

    this.messagingService.startThread(
      this.newThreadClientId,
      this.newThreadCaseId,
      this.newThreadSubject,
      this.newThreadMessage
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (thread) => {
          this.ngZone.run(() => {
            this.threads = [thread, ...this.threads];
            this.selectThread(thread);
            this.closeNewThreadModal();
            this.creatingThread = false;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            console.error('Error creating thread:', err);
            this.error = 'Failed to create conversation';
            this.creatingThread = false;
            this.cdr.detectChanges();
          });
        }
      });
  }

  get filteredThreads(): MessageThread[] {
    if (!this.searchTerm) return this.threads;
    const term = this.searchTerm.toLowerCase();
    return this.threads.filter(thread =>
      thread.subject?.toLowerCase().includes(term) ||
      thread.clientName?.toLowerCase().includes(term) ||
      thread.caseNumber?.toLowerCase().includes(term) ||
      thread.lastMessage?.toLowerCase().includes(term)
    );
  }

  // Track by functions
  trackByThreadId(index: number, thread: MessageThread): number {
    return thread.id;
  }

  trackByMessageId(index: number, message: Message): number {
    return message.id;
  }

  // Formatting
  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  formatMessageTime(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  formatMessageDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  isNewDay(index: number): boolean {
    if (index === 0) return true;
    const current = new Date(this.currentMessages[index].sentAt);
    const previous = new Date(this.currentMessages[index - 1].sentAt);
    return current.toDateString() !== previous.toDateString();
  }

  isSentByMe(message: Message): boolean {
    return message.senderType === 'ATTORNEY';
  }

  getStatusClass(status: string): string {
    return status === 'OPEN' ? 'bg-success' : 'bg-secondary';
  }

  private scrollToBottom(): void {
    if (this.messagesContainer?.nativeElement) {
      const el = this.messagesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}
