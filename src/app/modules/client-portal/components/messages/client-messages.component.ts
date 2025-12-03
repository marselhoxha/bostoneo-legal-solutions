import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ClientPortalService, ClientMessageThread, ClientMessage, ClientCase } from '../../services/client-portal.service';

@Component({
  selector: 'app-client-messages',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './client-messages.component.html',
  styleUrls: ['./client-messages.component.scss']
})
export class ClientMessagesComponent implements OnInit, OnDestroy, AfterViewChecked {
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

  // New thread modal
  showNewThreadModal = false;
  newThreadCaseId: number = 0;
  newThreadSubject = '';
  newThreadMessage = '';

  private destroy$ = new Subject<void>();
  private shouldScrollToBottom = false;

  constructor(
    private clientPortalService: ClientPortalService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['caseId']) {
        this.newThreadCaseId = parseInt(params['caseId']);
        // Optionally open new thread modal if coming from case page
      }
    });

    this.loadThreads();
    this.loadCases();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  loadThreads(): void {
    this.loading = true;
    this.error = null;

    this.clientPortalService.getMessageThreads()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (threads) => {
          this.threads = threads || [];
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading threads:', err);
          this.error = 'Failed to load messages. Please try again.';
          this.loading = false;
        }
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
    this.loadMessages(thread.id);
  }

  loadMessages(threadId: number): void {
    this.loadingMessages = true;
    this.currentMessages = [];

    this.clientPortalService.getThreadMessages(threadId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (messages) => {
          this.currentMessages = messages || [];
          this.loadingMessages = false;
          this.shouldScrollToBottom = true;
        },
        error: (err) => {
          console.error('Error loading messages:', err);
          this.loadingMessages = false;
        }
      });
  }

  sendMessage(): void {
    if (!this.selectedThread || !this.newMessageContent.trim()) {
      return;
    }

    this.sending = true;

    this.clientPortalService.sendMessage(this.selectedThread.id, this.newMessageContent)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (message) => {
          this.currentMessages.push(message);
          this.newMessageContent = '';
          this.sending = false;
          this.shouldScrollToBottom = true;
          // Update thread's last message
          if (this.selectedThread) {
            this.selectedThread.lastMessage = message.content;
            this.selectedThread.lastMessageAt = message.sentAt;
          }
        },
        error: (err) => {
          console.error('Error sending message:', err);
          this.error = 'Failed to send message. Please try again.';
          this.sending = false;
        }
      });
  }

  // New thread modal methods
  openNewThreadModal(): void {
    this.showNewThreadModal = true;
    this.newThreadSubject = '';
    this.newThreadMessage = '';
  }

  closeNewThreadModal(): void {
    this.showNewThreadModal = false;
    this.newThreadCaseId = 0;
    this.newThreadSubject = '';
    this.newThreadMessage = '';
  }

  startNewThread(): void {
    if (!this.newThreadCaseId || !this.newThreadSubject.trim() || !this.newThreadMessage.trim()) {
      return;
    }

    this.sending = true;

    this.clientPortalService.startNewThread(this.newThreadCaseId, this.newThreadSubject, this.newThreadMessage)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (thread) => {
          this.threads.unshift(thread);
          this.selectThread(thread);
          this.closeNewThreadModal();
          this.sending = false;
        },
        error: (err) => {
          console.error('Error starting thread:', err);
          this.error = 'Failed to start new conversation. Please try again.';
          this.sending = false;
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

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }
}
