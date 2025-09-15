import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { initializeApp } from 'firebase/app';
import { UserService } from '../../service/user.service';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private messaging: any;
  private tokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
  
  private notificationSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  public notification$: Observable<any> = this.notificationSubject.asObservable();
  
  private isFirebaseEnabled = false;
  private broadcastChannel: BroadcastChannel | null = null;

  /**
   * Initialize BroadcastChannel for cross-tab communication
   */
  private initializeBroadcastChannel(): void {
    if ('BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('notifications');
      
      // Listen for notifications from other tabs
      this.broadcastChannel.onmessage = (event) => {
        console.log('📻 Received notification from another tab:', event.data);
        this.notificationSubject.next(event.data);
        this.showNotification(event.data);
      };
      
      console.log('✅ Broadcast channel initialized for cross-tab notifications');
    } else {
      console.warn('⚠️ BroadcastChannel not supported - cross-tab notifications disabled');
    }
  }

  constructor(private http: HttpClient, private userService: UserService) {
    this.initializeFirebase();
    this.initializeBroadcastChannel();
  }

  /**
   * Initialize Firebase app and messaging
   */
  private initializeFirebase(): void {
    try {
      // Check if Firebase is properly configured
      if (!environment.firebase || !environment.firebase.apiKey) {
        console.warn('⚠️ Firebase not configured - Push notifications disabled');
        return;
      }
      
      const firebaseApp = initializeApp(environment.firebase);
      this.messaging = getMessaging(firebaseApp);
      this.isFirebaseEnabled = true;
      this.listenForMessages();
      console.log('✅ Firebase initialized successfully');
    } catch (error) {
      console.warn('⚠️ Firebase initialization failed - Push notifications disabled:', error);
      this.isFirebaseEnabled = false;
    }
  }

  /**
   * Request permission and get the device token
   */
  public requestPermission(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!this.isFirebaseEnabled) {
        reject('Firebase not initialized');
        return;
      }

      // Request permission for notifications
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('Notification permission granted.');
          // Get the token
          getToken(this.messaging, { vapidKey: environment.firebase.vapidKey })
            .then(token => {
              if (token) {
                this.tokenSubject.next(token);
                this.saveTokenToDatabase(token);
                resolve(token);
              } else {
                console.log('No registration token available.');
                reject('No registration token available');
              }
            })
            .catch(err => {
              console.error('Error getting token:', err);
              reject(err);
            });
        } else {
          console.log('Notification permission denied.');
          reject('Permission denied');
        }
      });
    });
  }

  /**
   * Listen for incoming messages when the app is in the foreground
   */
  private listenForMessages(): void {
    if (!this.isFirebaseEnabled) return;
    
    onMessage(this.messaging, (payload) => {
      console.log('🔔 Received foreground FCM message:', payload);
      console.log('🔔 Notification data:', payload.notification);
      console.log('🔔 Data payload:', payload.data);
      
      this.notificationSubject.next(payload);
      
      // Always display a notification for foreground messages
      this.showNotification(payload);
    });
  }

  /**
   * Display a notification when the app is in the foreground
   * MODIFIED: Only log the notification - DO NOT show browser notifications
   * The topbar component will handle in-app notifications via this.notificationSubject
   */
  private showNotification(payload: any): void {
    console.log('🔔 showNotification called with payload:', payload);
    console.log('🔔 IN-APP NOTIFICATION ONLY - Browser notifications disabled');
    
    // Simply log the notification payload for debugging
    const title = payload.notification?.title || payload.data?.title || 'BostonEO Solutions';
    const body = payload.notification?.body || payload.data?.body || '';
    
    console.log('📱 IN-APP notification:', { title, body, payload });
    console.log('✅ Notification sent to topbar component via notificationSubject');
    
    // DO NOT show browser notifications - they are handled by the topbar component
    // The notification has already been sent via this.notificationSubject.next(payload) in listenForMessages()
  }

  /**
   * Save the token to your backend database
   */
  private saveTokenToDatabase(token: string): void {
    // Try multiple ways to get user ID
    let userId: string | null = null;
    
    // Method 1: From UserService
    const currentUser = this.userService.getCurrentUser();
    if (currentUser?.id) {
      userId = currentUser.id.toString();
    }
    
    // Method 2: From localStorage
    if (!userId) {
      userId = localStorage.getItem('user_id') || localStorage.getItem('userId') || localStorage.getItem('currentUserId');
    }
    
    // Method 3: From sessionStorage
    if (!userId) {
      userId = sessionStorage.getItem('user_id') || sessionStorage.getItem('userId') || sessionStorage.getItem('currentUserId');
    }
    
    if (!userId) {
      console.warn('🔔 FCM Token generated but no user ID found for saving:', token.substring(0, 20) + '...');
      console.warn('🔔 Checked UserService, localStorage, and sessionStorage');
      return;
    }
    
    console.log('🔔 Saving FCM Token to backend for user:', userId);
    console.log('🔔 Token:', token.substring(0, 20) + '...');
    
    this.http.post(`${environment.apiUrl}/api/v1/notifications/token`, {
      token,
      userId: parseInt(userId),
      platform: 'web'
    }).subscribe({
      next: (response) => {
        console.log('✅ FCM Token saved to database:', response);
      },
      error: (error) => {
        console.error('❌ Error saving FCM token:', error);
        // Don't throw error - token generation was successful even if backend save fails
      }
    });
  }

  /**
   * Get the current FCM token
   */
  public getToken(): Observable<string | null> {
    return this.tokenSubject.asObservable();
  }

  /**
   * Manually send a test notification (for testing purposes)
   */
  public sendTestNotification(): void {
    const notificationPayload = {
      notification: {
        title: 'Test Notification',
        body: 'This is a test notification from BostonEO Solutions'
      },
      data: {
        url: '/calendar'
      }
    };
    
    this.notificationSubject.next(notificationPayload);
    this.showNotification(notificationPayload);
  }
  
  /**
   * Send a custom notification with specific payload
   */
  public sendCustomNotification(payload: any): void {
    // Send notification to current tab
    this.notificationSubject.next(payload);
    this.showNotification(payload);
    
    // Broadcast to other tabs
    if (this.broadcastChannel) {
      console.log('📻 Broadcasting notification to other tabs');
      this.broadcastChannel.postMessage(payload);
    }
  }
  
  /**
   * Check if push notifications are available
   */
  public isAvailable(): boolean {
    return this.isFirebaseEnabled && 'Notification' in window;
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
  }
} 
 