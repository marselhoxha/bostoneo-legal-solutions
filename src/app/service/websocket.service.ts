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

  constructor() {}

  connect(token: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
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

      this.socket.onclose = () => {
        this.connectionStatus.next(false);
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
      setTimeout(() => this.connect(token), this.reconnectDelay);
    } else {
      // Reset attempts after max reached, allowing future reconnection
      this.reconnectAttempts = 0;
    }
  }

  /**
   * Ensure WebSocket is connected, reconnecting if necessary
   */
  ensureConnected(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      const token = localStorage.getItem('access-token') || localStorage.getItem(Key.TOKEN);
      if (token) {
        this.reconnectAttempts = 0; // Reset to allow fresh connection
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
