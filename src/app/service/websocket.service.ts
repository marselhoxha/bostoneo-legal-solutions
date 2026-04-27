import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Key } from '../enum/key.enum';
import { environment } from '../../environments/environment';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export interface NewMessageNotification {
  type: string;
  threadId: number;
  messageId: number;
  content: string;
  senderType: string;
  sentAt: string;
}

// Spring CloseStatus codes from backend AuthenticatedWebSocketHandler
const WS_CLOSE_AUTH_FAILED = 1003;     // NOT_ACCEPTABLE — bad/revoked token
const WS_CLOSE_SERVER_OVERLOAD = 1013; // SERVICE_OVERLOAD — too many sessions

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private socket: WebSocket | null = null;
  private messageSubject = new Subject<WebSocketMessage>();
  private connectionStatus = new BehaviorSubject<boolean>(false);
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  // Gate: if backend rejected us (auth/overload), don't reconnect until
  // either the user explicitly calls ensureConnected() or this timestamp passes
  private nextAllowedConnectAt = 0;

  constructor() {}

  connect(token: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    if (Date.now() < this.nextAllowedConnectAt) {
      return;
    }

    const wsUrl = `${environment.wsUrl}?token=${token}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.connectionStatus.next(true);
        this.reconnectAttempts = 0;
      };

      this.socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.messageSubject.next(message);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.socket.onclose = (event) => {
        this.connectionStatus.next(false);

        // Auth failure — token won't fix itself, stop trying
        if (event.code === WS_CLOSE_AUTH_FAILED) {
          this.nextAllowedConnectAt = Number.MAX_SAFE_INTEGER;
          return;
        }

        // Server overload — long backoff, don't hammer
        if (event.code === WS_CLOSE_SERVER_OVERLOAD) {
          this.nextAllowedConnectAt = Date.now() + 60_000;
          return;
        }

        this.attemptReconnect(token);
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
    }
  }

  private attemptReconnect(token: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      // Exponential backoff: 3s, 6s, 12s, 24s, 48s
      const delayMs = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      setTimeout(() => this.connect(token), delayMs);
    } else {
      // Hit the cap. Don't reset — that creates an infinite cycle. Set a
      // 60s cooldown so any future ensureConnected() call has to wait.
      this.nextAllowedConnectAt = Date.now() + 60_000;
    }
  }

  /**
   * Ensure WebSocket is connected, reconnecting if necessary.
   * Explicit user action — clear the cooldown gate.
   */
  ensureConnected(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      const token = localStorage.getItem('access-token') || localStorage.getItem(Key.TOKEN);
      if (token) {
        this.reconnectAttempts = 0;
        this.nextAllowedConnectAt = 0;
        this.connect(token);
      }
    }
  }

  /**
   * Check if currently connected
   */
  isCurrentlyConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  getMessages(): Observable<WebSocketMessage> {
    return this.messageSubject.asObservable();
  }

  getNewMessageNotifications(): Observable<NewMessageNotification> {
    return this.messageSubject.pipe(
      filter(msg => msg.type === 'notification' && msg.data?.type === 'NEW_MESSAGE')
    ) as Observable<any>;
  }

  isConnected(): Observable<boolean> {
    return this.connectionStatus.asObservable();
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.messageSubject.complete();
    this.connectionStatus.complete();
  }
}
