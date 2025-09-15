import { Injectable, OnDestroy } from '@angular/core';
import { Observable, BehaviorSubject, Subject, EMPTY, timer } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { retryWhen, delay, takeUntil, tap, catchError, switchMap, filter } from 'rxjs/operators';
import { Key } from '../../enum/key.enum';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: number;
  source?: string;
  caseId?: number;
  userId?: number;
}

export interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  lastConnected: Date | null;
  retryCount: number;
  error?: any;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private socket$: WebSocketSubject<any> | null = null;
  private destroy$ = new Subject<void>();
  private reconnectSubject$ = new Subject<void>();
  
  // Connection management
  private connectionStatus$ = new BehaviorSubject<ConnectionStatus>({
    connected: false,
    reconnecting: false,
    lastConnected: null,
    retryCount: 0
  });
  
  // Message streams
  private messages$ = new Subject<WebSocketMessage>();
  private caseMessages$ = new Subject<WebSocketMessage>();
  private taskMessages$ = new Subject<WebSocketMessage>();
  private assignmentMessages$ = new Subject<WebSocketMessage>();
  private notificationMessages$ = new Subject<WebSocketMessage>();
  
  // Configuration
  private readonly wsUrl = 'ws://localhost:8085/ws';
  private readonly reconnectInterval = 5000;
  private readonly maxReconnectAttempts = 3;
  
  // Current subscriptions
  private currentCaseId: number | null = null;
  private currentUserId: number | null = null;
  
  constructor() {
    console.log('🔌 WebSocketService - Initializing');
    this.initializeAuthenticationWatcher();
    
    // Try to connect if token already exists
    const token = localStorage.getItem(Key.TOKEN);
    if (token) {
      console.log('🔌 WebSocketService - Found existing token, attempting connection');
      // Delay connection to allow app to initialize
      setTimeout(() => this.connect(), 2000);
    }
  }
  
  /**
   * Watch for authentication changes and manage connection
   */
  private initializeAuthenticationWatcher(): void {
    // Listen for storage changes (token updates)
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === Key.TOKEN) {
          if (event.newValue) {
            console.log('🔌 WebSocketService - Token added, connecting');
            this.connect();
          } else {
            console.log('🔌 WebSocketService - Token removed, disconnecting');
            this.disconnect();
          }
        }
      });
    }
    
    // Check for token changes periodically
    timer(0, 30000) // Check every 30 seconds
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const token = localStorage.getItem(Key.TOKEN);
        const isConnected = this.connectionStatus$.value.connected;
        
        if (token && !isConnected && !this.connectionStatus$.value.reconnecting) {
          console.log('🔌 WebSocketService - Token exists but not connected, attempting connection');
          this.connect();
        } else if (!token && isConnected) {
          console.log('🔌 WebSocketService - No token but connected, disconnecting');
          this.disconnect();
        }
      });
  }
  
  ngOnDestroy(): void {
    console.log('🔌 WebSocketService - Destroying');
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnect();
  }

  // ==================== Connection Management ====================

  /**
   * Enable WebSocket connection (call when server is available)
   */
  enableWebSocket(): void {
    console.log('🔌 WebSocketService - Enabling WebSocket connection');
    this.connect();
  }

  /**
   * Establish WebSocket connection with authentication
   */
  connect(): void {
    if (this.socket$ && !this.socket$.closed) {
      console.log('🔌 WebSocketService - Already connected');
      return;
    }

    // Get authentication token
    const token = localStorage.getItem(Key.TOKEN);
    if (!token) {
      console.warn('🔌 WebSocketService - No authentication token found, cannot connect');
      this.updateConnectionStatus({
        connected: false,
        reconnecting: false,
        error: 'No authentication token'
      });
      return;
    }

    console.log('🔌 WebSocketService - Connecting to:', this.wsUrl);
    
    this.updateConnectionStatus({ 
      reconnecting: true,
      retryCount: this.connectionStatus$.value.retryCount + 1 
    });

    try {
      this.socket$ = webSocket({
        url: `${this.wsUrl}?token=${encodeURIComponent(token)}`,
        openObserver: {
          next: () => {
            console.log('✅ WebSocket - Connected successfully with authentication');
            this.updateConnectionStatus({
              connected: true,
              reconnecting: false,
              lastConnected: new Date(),
              retryCount: 0,
              error: undefined
            });
            
            // Subscribe to current user and case if available
            this.resubscribeToChannels();
          }
        },
        closeObserver: {
          next: (event) => {
            console.log('🔌 WebSocket - Connection closed:', event);
            this.updateConnectionStatus({
              connected: false,
              reconnecting: false,
              error: event
            });
            
            // Only attempt reconnection if it wasn't a deliberate close
            if (event.code !== 1000) {
              this.scheduleReconnection();
            }
          }
        },
        serializer: (msg) => JSON.stringify(msg),
        deserializer: ({ data }) => {
          try {
            return JSON.parse(data);
          } catch (e) {
            console.error('❌ WebSocket - Failed to parse message:', data);
            return { type: 'error', data: 'Invalid JSON' };
          }
        }
      });

      // Subscribe to incoming messages
      this.socket$
        .pipe(
          takeUntil(this.destroy$),
          tap(message => console.log('📨 WebSocket - Received:', message)),
          catchError(error => {
            console.error('❌ WebSocket - Message error:', error);
            this.updateConnectionStatus({ 
              connected: false, 
              error 
            });
            return EMPTY;
          })
        )
        .subscribe(message => {
          this.handleIncomingMessage(message);
        });

      // Handle reconnection
      this.socket$
        .pipe(
          retryWhen(errors =>
            errors.pipe(
              tap(error => {
                console.error('❌ WebSocket - Connection error:', error);
                this.updateConnectionStatus({ 
                  connected: false, 
                  error 
                });
              }),
              delay(this.reconnectInterval),
              takeUntil(this.destroy$)
            )
          ),
          takeUntil(this.destroy$)
        )
        .subscribe();

    } catch (error) {
      console.error('❌ WebSocket - Connection failed:', error);
      this.updateConnectionStatus({ 
        connected: false, 
        reconnecting: false, 
        error 
      });
      this.scheduleReconnection();
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    console.log('🔌 WebSocket - Disconnecting');
    
    if (this.socket$ && !this.socket$.closed) {
      this.socket$.complete();
    }
    
    this.socket$ = null;
    this.updateConnectionStatus({
      connected: false,
      reconnecting: false,
      retryCount: 0
    });
  }

  /**
   * Get connection status observable
   */
  getConnectionStatus(): Observable<ConnectionStatus> {
    return this.connectionStatus$.asObservable();
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connectionStatus$.value.connected;
  }

  // ==================== Message Handling ====================

  /**
   * Handle incoming WebSocket messages
   */
  private handleIncomingMessage(message: WebSocketMessage): void {
    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }

    // Emit to general message stream
    this.messages$.next(message);

    // Route to specific message streams based on type
    switch (message.type) {
      case 'CASE_UPDATED':
      case 'CASE_ASSIGNED':
      case 'CASE_STATUS_CHANGED':
        this.caseMessages$.next(message);
        break;
        
      case 'TASK_CREATED':
      case 'TASK_UPDATED':
      case 'TASK_ASSIGNED':
      case 'TASK_STATUS_CHANGED':
      case 'TASK_DELETED':
        this.taskMessages$.next(message);
        break;
        
      case 'ASSIGNMENT_CREATED':
      case 'ASSIGNMENT_UPDATED':
      case 'ASSIGNMENT_REMOVED':
      case 'MEMBER_ADDED':
      case 'MEMBER_REMOVED':
        this.assignmentMessages$.next(message);
        break;
        
      case 'NOTIFICATION':
      case 'ALERT':
      case 'SYSTEM_MESSAGE':
      case 'NEW_SUBMISSION':
      case 'SUBMISSION_ASSIGNED':
      case 'SUBMISSION_STATUS_CHANGE':
      case 'LEAD_CONVERSION':
      case 'LEAD_ASSIGNMENT':
      case 'LEAD_STATUS_CHANGE':
        this.notificationMessages$.next(message);
        break;
        
      default:
        console.log('🔀 WebSocket - Unhandled message type:', message.type);
    }
  }

  /**
   * Send message through WebSocket
   */
  sendMessage(message: WebSocketMessage): void {
    if (!this.socket$ || this.socket$.closed) {
      console.warn('⚠️ WebSocket - Cannot send message, not connected');
      return;
    }

    try {
      console.log('📤 WebSocket - Sending:', message);
      this.socket$.next(message);
    } catch (error) {
      console.error('❌ WebSocket - Failed to send message:', error);
    }
  }

  // ==================== Subscription Management ====================

  /**
   * Subscribe to case-specific updates
   */
  subscribeToCaseUpdates(caseId: number): void {
    this.currentCaseId = caseId;
    console.log('🔔 WebSocket - Subscribing to case updates:', caseId);
    
    this.sendMessage({
      type: 'SUBSCRIBE_CASE',
      data: { caseId },
      timestamp: Date.now()
    });
  }

  /**
   * Unsubscribe from case-specific updates
   */
  unsubscribeFromCaseUpdates(caseId?: number): void {
    const targetCaseId = caseId || this.currentCaseId;
    
    if (targetCaseId) {
      console.log('🔕 WebSocket - Unsubscribing from case updates:', targetCaseId);
      
      this.sendMessage({
        type: 'UNSUBSCRIBE_CASE',
        data: { caseId: targetCaseId },
        timestamp: Date.now()
      });
      
      if (!caseId) {
        this.currentCaseId = null;
      }
    }
  }

  /**
   * Subscribe to user-specific updates
   */
  subscribeToUserUpdates(userId: number): void {
    this.currentUserId = userId;
    console.log('🔔 WebSocket - Subscribing to user updates:', userId);
    
    this.sendMessage({
      type: 'SUBSCRIBE_USER',
      data: { userId },
      timestamp: Date.now()
    });
  }

  /**
   * Unsubscribe from user-specific updates
   */
  unsubscribeFromUserUpdates(userId?: number): void {
    const targetUserId = userId || this.currentUserId;
    
    if (targetUserId) {
      console.log('🔕 WebSocket - Unsubscribing from user updates:', targetUserId);
      
      this.sendMessage({
        type: 'UNSUBSCRIBE_USER',
        data: { userId: targetUserId },
        timestamp: Date.now()
      });
      
      if (!userId) {
        this.currentUserId = null;
      }
    }
  }

  /**
   * Re-subscribe to channels after reconnection
   */
  private resubscribeToChannels(): void {
    // Re-subscribe to case if we were previously subscribed
    if (this.currentCaseId) {
      console.log('🔔 WebSocket - Re-subscribing to case:', this.currentCaseId);
      this.subscribeToCaseUpdates(this.currentCaseId);
    }
    
    // Re-subscribe to user if we were previously subscribed
    if (this.currentUserId) {
      console.log('🔔 WebSocket - Re-subscribing to user:', this.currentUserId);
      this.subscribeToUserUpdates(this.currentUserId);
    }
  }

  // ==================== Message Streams ====================

  /**
   * Get all WebSocket messages
   */
  getMessages(): Observable<WebSocketMessage> {
    return this.messages$.asObservable();
  }

  /**
   * Get case-related messages
   */
  getCaseMessages(caseId?: number): Observable<WebSocketMessage> {
    return this.caseMessages$.asObservable().pipe(
      filter(message => !caseId || message.caseId === caseId)
    );
  }

  /**
   * Get task-related messages
   */
  getTaskMessages(caseId?: number): Observable<WebSocketMessage> {
    return this.taskMessages$.asObservable().pipe(
      filter(message => !caseId || message.caseId === caseId)
    );
  }

  /**
   * Get assignment-related messages
   */
  getAssignmentMessages(caseId?: number): Observable<WebSocketMessage> {
    return this.assignmentMessages$.asObservable().pipe(
      filter(message => !caseId || message.caseId === caseId)
    );
  }

  /**
   * Get notification messages
   */
  getNotificationMessages(userId?: number): Observable<WebSocketMessage> {
    return this.notificationMessages$.asObservable().pipe(
      filter(message => !userId || message.userId === userId)
    );
  }

  // ==================== Private Methods ====================

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnection(): void {
    const currentStatus = this.connectionStatus$.value;
    
    if (currentStatus.retryCount >= this.maxReconnectAttempts) {
      console.error('❌ WebSocket - Max reconnection attempts reached');
      this.updateConnectionStatus({
        reconnecting: false,
        error: { message: 'Max reconnection attempts reached' }
      });
      return;
    }

    if (!currentStatus.reconnecting) {
      console.log(`🔄 WebSocket - Scheduling reconnection in ${this.reconnectInterval}ms`);
      
      timer(this.reconnectInterval)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          if (!this.isConnected()) {
            this.connect();
          }
        });
    }
  }

  /**
   * Update connection status
   */
  private updateConnectionStatus(updates: Partial<ConnectionStatus>): void {
    const currentStatus = this.connectionStatus$.value;
    const newStatus: ConnectionStatus = {
      ...currentStatus,
      ...updates
    };
    
    this.connectionStatus$.next(newStatus);
  }


  // ==================== Utility Methods ====================

  /**
   * Send heartbeat/ping message
   */
  ping(): void {
    this.sendMessage({
      type: 'PING',
      data: { timestamp: Date.now() },
      timestamp: Date.now()
    });
  }

  /**
   * Get current subscription status
   */
  getSubscriptionStatus(): { caseId: number | null; userId: number | null } {
    return {
      caseId: this.currentCaseId,
      userId: this.currentUserId
    };
  }
}