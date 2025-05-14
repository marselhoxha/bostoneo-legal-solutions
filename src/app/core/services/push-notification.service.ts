import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { initializeApp } from 'firebase/app';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private messaging: any;
  private tokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
  
  private notificationSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  public notification$: Observable<any> = this.notificationSubject.asObservable();

  constructor(private http: HttpClient) {
    this.initializeFirebase();
  }

  /**
   * Initialize Firebase app and messaging
   */
  private initializeFirebase(): void {
    try {
      const firebaseApp = initializeApp(environment.firebase);
      this.messaging = getMessaging(firebaseApp);
      this.listenForMessages();
    } catch (error) {
      console.error('Error initializing Firebase:', error);
    }
  }

  /**
   * Request permission and get the device token
   */
  public requestPermission(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
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
    onMessage(this.messaging, (payload) => {
      console.log('Received foreground message:', payload);
      this.notificationSubject.next(payload);
      
      // Optionally display a notification manually for foreground messages
      this.showNotification(payload);
    });
  }

  /**
   * Display a notification when the app is in the foreground
   */
  private showNotification(payload: any): void {
    // Check if the browser supports notifications
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = payload.notification?.title || 'BostonEO Solutions';
      const options = {
        body: payload.notification?.body || '',
        icon: '/assets/images/logo-sm.png',
        badge: '/assets/images/badge.png',
        data: payload.data
      };
      
      new Notification(title, options);
    }
  }

  /**
   * Save the token to your backend database
   */
  private saveTokenToDatabase(token: string): void {
    // Get the user ID from your authentication service or local storage
    const userId = localStorage.getItem('user_id') || '1'; // Default to 1 if not available
    
    // Save the token to your backend
    this.http.post(`${environment.apiUrl}/api/v1/notifications/token`, {
      token,
      userId,
      platform: 'web'
    }).subscribe({
      next: (response) => console.log('Token saved to database:', response),
      error: (error) => console.error('Error saving token:', error)
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
    this.notificationSubject.next(payload);
    this.showNotification(payload);
  }
} 
 