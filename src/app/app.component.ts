import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  Router,
  ActivatedRoute,
  NavigationEnd,
  NavigationStart,
  NavigationCancel,
  NavigationError,
  Event,
  Params,
  PRIMARY_OUTLET,
} from '@angular/router';
import { Title } from '@angular/platform-browser';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { PreloaderService } from './service/preloader.service';
import { UrlSerializer } from '@angular/router';
import { UserService } from './service/user.service';
import { RbacService } from './core/services/rbac.service';
import { ReminderService } from './modules/legal/services/reminder.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { WebSocketService } from './core/services/websocket.service';
import { DeadlineAlertService } from './core/services/deadline-alert.service';
import { EnhancedNotificationManagerService } from './core/services/enhanced-notification-manager.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  showPreloader = false;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private titleService: Title,
    private preloaderService: PreloaderService,
    private urlSerializer: UrlSerializer,
    private userService: UserService,
    private rbacService: RbacService,
    private reminderService: ReminderService,
    private pushNotificationService: PushNotificationService,
    private webSocketService: WebSocketService,
    private deadlineAlertService: DeadlineAlertService,
    private enhancedNotificationManager: EnhancedNotificationManagerService
  ) {
    this.preloaderService.showPreloader$.subscribe((show) => {
      this.showPreloader = show;
    });

    // Handle navigation events
    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationStart) {
        console.log('NavigationStart:', event.url);
        
        // Redirect root URL to dashboard
        if (event.url === '/' || event.url === '') {
          this.router.navigate(['/home']);
          return;
        }
        
        if (!this.isExcludedRoute(event.url)) {
          console.log('Showing preloader');
          this.preloaderService.show();
        } else {
          console.log('Hiding preloader (excluded route)');
          this.preloaderService.hide();
        }
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        console.log('NavigationEnd/Cancel/Error:', event);
        setTimeout(() => {
          console.log('Hiding preloader after navigation end');
          this.preloaderService.hide();
        }, 700);
      }
    });

    // Initialize push notifications when app starts
    this.initializePushNotifications();
  }

  ngOnInit(): void {
    // Initialize title service
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        let route = this.activatedRoute;
        let routeTitle = '';
        while (route!.firstChild) {
          route = route.firstChild;
        }
        if (route!.snapshot.data['title']) {
          routeTitle = route!.snapshot.data['title'];
          this.titleService.setTitle(`${routeTitle} | Bostoneo Solutions`);
        }
      });

    // Check if we're at the root URL and redirect to dashboard
    if (window.location.pathname === '/' || window.location.pathname === '') {
      this.router.navigate(['/home']);
    }
    
    // Preload user data if authenticated
    if (this.userService.isAuthenticated()) {
      this.userService.preloadUserData();
      
      // Start deadline reminder service for authenticated users
      this.reminderService.startReminders();
      console.log('Reminder service started with improved error handling');
      
      // Start deadline alert monitoring
      this.deadlineAlertService.startDeadlineMonitoring();
      console.log('Deadline alert monitoring started');
      
      // Initialize Enhanced Notification Manager with EventBus
      this.enhancedNotificationManager.initialize();
      console.log('Enhanced Notification Manager with EventBus initialized');
      
      // Initialize WebSocket connection
      this.initializeWebSocketNotifications();
    }

    console.log('App component initialized');
  }

  private isExcludedRoute(url: string): boolean {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const urlSegments = cleanUrl.split('/').filter(segment => segment.length > 0);
    const routePath = urlSegments.join('/');
    const excludedRoutes = ['login', 'register', 'resetpassword'];
  
    const isExcluded = excludedRoutes.includes(routePath);
    console.log(`Navigating to: ${routePath}, isExcludedRoute: ${isExcluded}`);
    return isExcluded;
  }

  private initializePushNotifications(): void {
    if ('Notification' in window && this.userService.isAuthenticated()) {
      // Register the Firebase service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/firebase-messaging-sw.js')
          .then(registration => {
            console.log('🔔 Firebase Service Worker registered:', registration);
          })
          .catch(error => {
            console.error('❌ Service Worker registration failed:', error);
          });
      }
      
      // Auto-request permission if not denied and not already granted
      if (Notification.permission === 'default') {
        this.pushNotificationService.requestPermission()
          .then(token => {
            console.log('🔔 FCM Token registered automatically:', token);
          })
          .catch(err => {
            console.log('🔔 Push notification permission not granted:', err);
          });
      } else if (Notification.permission === 'granted') {
        // If permission already granted, just get the token
        this.pushNotificationService.requestPermission()
          .then(token => {
            console.log('🔔 FCM Token refreshed:', token);
          })
          .catch(err => {
            console.log('🔔 Error refreshing FCM token:', err);
          });
      }
      
      // Subscribe to notifications to handle them when the app is open
      this.pushNotificationService.notification$.subscribe(notification => {
        if (notification) {
          console.log('Received notification in app component:', notification);
          // You can add custom handling here like playing sounds or showing toasts
        }
      });
    }
  }

  private initializeWebSocketNotifications(): void {
    console.log('🔌 Initializing WebSocket notifications');
    
    // Enable WebSocket and establish connection
    this.webSocketService.enableWebSocket();
    
    // Subscribe to WebSocket connection status
    this.webSocketService.getConnectionStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        console.log('🔌 WebSocket connection status:', status);
        if (status.connected) {
          console.log('✅ WebSocket connected successfully');
        } else if (status.error) {
          console.error('❌ WebSocket connection error:', status.error);
        }
      });
    
    // Subscribe to all notification messages
    this.webSocketService.getNotificationMessages()
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => {
        console.log('📨 Received WebSocket notification:', message);
        this.handleWebSocketNotification(message);
      });
      
    // Keep connection alive by subscribing to all messages
    this.webSocketService.getMessages()
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => {
        console.log('📨 WebSocket message received:', message.type, message);
      });
  }

  private handleWebSocketNotification(message: any): void {
    console.log('🎯 Processing notification:', message);
    
    try {
      const data = message.data || message;
      const title = data.title || message.title || 'Notification';
      const messageText = data.message || message.message || 'You have a new notification';
      
      // Create push notification payload
      const notificationPayload = {
        notification: {
          title: title,
          body: messageText
        },
        data: {
          type: message.type || data.type,
          ...data
        }
      };
      
      // Send push notification using the same service as task assignments
      this.pushNotificationService.sendCustomNotification(notificationPayload);
      
    } catch (error) {
      console.error('❌ Error handling WebSocket notification:', error);
    }
  }

  ngOnDestroy(): void {
    // Stop deadline monitoring
    this.deadlineAlertService.stopDeadlineMonitoring();
    
    this.destroy$.next();
    this.destroy$.complete();
  }
}
