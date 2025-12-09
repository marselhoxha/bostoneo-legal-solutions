import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, NgZone, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, interval } from 'rxjs';
import { takeUntil, switchMap, filter } from 'rxjs/operators';
import { ClientPortalService, ClientMessageThread, ClientMessage, ClientCase } from '../../services/client-portal.service';
import { WebSocketService } from '../../../../service/websocket.service';
import { Key } from '../../../../enum/key.enum';

@Component({
  selector: 'app-client-messages',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './client-messages.component.html',
  styleUrls: ['./client-messages.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ClientMessagesComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  threads: ClientMessageThread[] = [];
  currentMessages: ClientMessage[] = [];
  cases: ClientCase[] = [];

  selectedThread: ClientMessageThread | null = null;
  loading = true;
  loadingMessages = false;
  sending = false;
  error: string | null = null;

  // New message
  newMessageContent = '';

  // Search
  searchTerm = '';

  // New thread modal
  showNewThreadModal = false;
  newThreadCaseId: number = 0;
  newThreadSubject = '';
  newThreadMessage = '';

  // Polling
  private readonly POLL_INTERVAL = 5000; // 5 seconds
  private wsConnected = false;

  private destroy$ = new Subject<void>();

  constructor(
    private clientPortalService: ClientPortalService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['caseId']) {
        this.newThreadCaseId = parseInt(params['caseId']);
      }
      if (params['threadId']) {
        this.loadThreads().then(() => {
          const thread = this.threads.find(t => t.id === parseInt(params['threadId']));
          if (thread) this.selectThread(thread);
        });
      } else {
        this.loadThreads();
      }
    });

    this.loadCases();
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
                  const newMessage: ClientMessage = {
                    id: notification.messageId,
                    threadId: notification.threadId,
                    senderName: notification.senderType === 'ATTORNEY' ? 'Attorney' : 'You',
                    senderType: notification.senderType,
                    content: notification.content,
                    sentAt: notification.sentAt,
                    isRead: false,
                    hasAttachment: false,
                    attachmentName: ''
                  };
                  this.currentMessages = [...this.currentMessages, newMessage];
                  setTimeout(() => this.scrollToBottom(), 50);
                }
              } else if (thread) {
                // Message is for a different thread - increment unread count
                thread.unreadCount = (thread.unreadCount || 0) + 1;
                thread.lastMessage = notification.content;
                thread.lastMessageAt = notification.sentAt;
                thread.lastSenderName = notification.senderType === 'ATTORNEY' ? 'Attorney' : 'You';
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

  // Load threads without showing loading spinner
  private loadThreadsSilent(): void {
    this.clientPortalService.getMessageThreads()
      .pipe(takeUntil(this.destroy$))
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
  }

  // Start polling for new messages (fallback when WebSocket is disconnected)
  private startPolling(): void {
    // Poll for thread updates (only when WebSocket disconnected)
    interval(this.POLL_INTERVAL)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => !this.loading && !this.wsConnected),
        switchMap(() => this.clientPortalService.getMessageThreads())
      )
      .subscribe({
        next: (threads) => {
          this.ngZone.run(() => {
            // Update threads while preserving selection
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
        switchMap(() => this.clientPortalService.getThreadMessages(this.selectedThread!.id))
      )
      .subscribe({
        next: (messages) => {
          this.ngZone.run(() => {
            const prevCount = this.currentMessages.length;
            this.currentMessages = messages || [];
            // Auto-scroll if new messages arrived
            if (this.currentMessages.length > prevCount) {
              setTimeout(() => this.scrollToBottom(), 50);
            }
            // Update unread count
            if (this.selectedThread) {
              this.selectedThread.unreadCount = 0;
            }
            this.cdr.detectChanges();
          });
        }
      });
  }

  async loadThreads(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();

    return new Promise((resolve) => {
      this.clientPortalService.getMessageThreads()
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
              this.error = 'Failed to load messages. Please try again.';
              this.loading = false;
              this.cdr.detectChanges();
              resolve();
            });
          }
        });
    });
  }

  loadCases(): void {
    this.clientPortalService.getCases(0, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.cases = response.content || [];
        },
        error: (err) => {
          console.error('Error loading cases:', err);
        }
      });
  }

  selectThread(thread: ClientMessageThread): void {
    this.selectedThread = thread;
    this.cdr.detectChanges();
    this.loadMessages(thread.id);
  }

  loadMessages(threadId: number): void {
    this.loadingMessages = true;
    this.currentMessages = [];
    this.cdr.detectChanges();

    this.clientPortalService.getThreadMessages(threadId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (messages) => {
          this.ngZone.run(() => {
            this.currentMessages = messages || [];
            this.loadingMessages = false;
            // Clear unread
            if (this.selectedThread) {
              this.selectedThread.unreadCount = 0;
            }
            this.cdr.detectChanges();
            setTimeout(() => this.scrollToBottom(), 50);
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

  sendMessage(): void {
    if (!this.selectedThread || !this.newMessageContent.trim()) {
      return;
    }

    this.sending = true;
    this.cdr.detectChanges();

    const content = this.newMessageContent;
    this.clientPortalService.sendMessage(this.selectedThread.id, content)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (message) => {
          this.ngZone.run(() => {
            this.currentMessages = [...this.currentMessages, message];
            this.newMessageContent = '';
            this.sending = false;
            this.cdr.detectChanges();
            setTimeout(() => this.scrollToBottom(), 50);
            // Update thread's last message
            if (this.selectedThread) {
              this.selectedThread.lastMessage = message.content;
              this.selectedThread.lastMessageAt = message.sentAt;
              this.selectedThread.lastSenderName = 'You';
            }
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            console.error('Error sending message:', err);
            this.error = 'Failed to send message. Please try again.';
            this.sending = false;
            this.cdr.detectChanges();
          });
        }
      });
  }

  // New thread modal methods
  openNewThreadModal(): void {
    this.showNewThreadModal = true;
    this.newThreadSubject = '';
    this.newThreadMessage = '';
    this.cdr.detectChanges();
  }

  closeNewThreadModal(): void {
    this.showNewThreadModal = false;
    this.newThreadCaseId = 0;
    this.newThreadSubject = '';
    this.newThreadMessage = '';
    this.cdr.detectChanges();
  }

  startNewThread(): void {
    if (!this.newThreadCaseId || !this.newThreadSubject.trim() || !this.newThreadMessage.trim()) {
      return;
    }

    this.sending = true;
    this.cdr.detectChanges();

    this.clientPortalService.startNewThread(this.newThreadCaseId, this.newThreadSubject, this.newThreadMessage)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (thread) => {
          this.ngZone.run(() => {
            this.threads = [thread, ...this.threads];
            this.selectThread(thread);
            this.closeNewThreadModal();
            this.sending = false;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            console.error('Error starting thread:', err);
            this.error = 'Failed to start new conversation. Please try again.';
            this.sending = false;
            this.cdr.detectChanges();
          });
        }
      });
  }

  // Formatting methods
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
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  formatMessageDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  isNewDay(index: number): boolean {
    if (index === 0) return true;
    const current = new Date(this.currentMessages[index].sentAt);
    const previous = new Date(this.currentMessages[index - 1].sentAt);
    return current.toDateString() !== previous.toDateString();
  }

  isSentByClient(message: ClientMessage): boolean {
    return message.senderType === 'CLIENT';
  }

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'OPEN': 'bg-success',
      'ACTIVE': 'bg-success',
      'CLOSED': 'bg-secondary',
      'PENDING': 'bg-warning'
    };
    return statusMap[status] || 'bg-secondary';
  }

  truncateText(text: string, maxLength: number = 50): string {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  get filteredThreads(): ClientMessageThread[] {
    if (!this.searchTerm) return this.threads;
    const term = this.searchTerm.toLowerCase();
    return this.threads.filter(thread =>
      thread.subject?.toLowerCase().includes(term) ||
      thread.caseNumber?.toLowerCase().includes(term) ||
      thread.lastMessage?.toLowerCase().includes(term)
    );
  }

  trackByThreadId(index: number, thread: ClientMessageThread): number {
    return thread.id;
  }

  trackByMessageId(index: number, message: ClientMessage): number {
    return message.id;
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }
}
