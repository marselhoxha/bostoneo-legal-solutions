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
import { Subject, interval } from 'rxjs';
import { PreloaderService } from './service/preloader.service';
import { UrlSerializer } from '@angular/router';
import { UserService } from './service/user.service';
import { RbacService } from './core/services/rbac.service';
import { ReminderService } from './modules/legal/services/reminder.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { WebSocketService } from './core/services/websocket.service';
import { DeadlineAlertService } from './core/services/deadline-alert.service';
import { EnhancedNotificationManagerService } from './core/services/enhanced-notification-manager.service';
import { OrganizationService } from './core/services/organization.service';

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
    private enhancedNotificationManager: EnhancedNotificationManagerService,
    private organizationService: OrganizationService
  ) {
    this.preloaderService.showPreloader$.subscribe((show) => {
      this.showPreloader = show;
    });

    // Handle navigation events
    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationStart) {
        // Redirect root URL to dashboard
        if (event.url === '/' || event.url === '') {
          this.router.navigate(['/home']);
          return;
        }

        if (!this.isExcludedRoute(event.url)) {
          this.preloaderService.show();
        } else {
          this.preloaderService.hide();
        }
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        setTimeout(() => {
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

    // Subscribe to login success events to reinitialize services after login
    // Use setTimeout to ensure the interceptor state is fully reset before making requests
    this.userService.loginSuccess$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Small delay to ensure interceptor state is fully reset
        setTimeout(() => {
          this.initializeAuthenticatedServices();
        }, 100);
      });

    // Preload user data if already authenticated (page refresh scenario)
    if (this.userService.isAuthenticated()) {
      this.initializeAuthenticatedServices();
    }
  }

  /**
   * Initialize services that require authentication
   * Called on app init if already authenticated, or after login success
   */
  private initializeAuthenticatedServices(): void {
    this.userService.preloadUserData();

    // Load organization context from JWT token
    this.organizationService.loadCurrentOrganization();

    // Start deadline reminder service for authenticated users
    this.reminderService.startReminders();

    // Start deadline alert monitoring
    this.deadlineAlertService.startDeadlineMonitoring();

    // Initialize Enhanced Notification Manager with EventBus
    this.enhancedNotificationManager.initialize();

    // Initialize WebSocket connection
    this.initializeWebSocketNotifications();

    // Start proactive token refresh check (every 2 minutes)
    this.startProactiveTokenRefresh();
  }

  private isExcludedRoute(url: string): boolean {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const urlSegments = cleanUrl.split('/').filter(segment => segment.length > 0);
    const routePath = urlSegments.join('/');
    const excludedRoutes = ['login', 'register', 'resetpassword'];

    return excludedRoutes.includes(routePath);
  }

  private initializePushNotifications(): void {
    if ('Notification' in window && this.userService.isAuthenticated()) {
      // Register the Firebase service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/firebase-messaging-sw.js')
          .catch(error => {
            console.error('Service Worker registration failed:', error);
          });
      }

      // Auto-request permission if not denied and not already granted
      if (Notification.permission === 'default') {
        this.pushNotificationService.requestPermission().catch(() => {});
      } else if (Notification.permission === 'granted') {
        // If permission already granted, just get the token
        this.pushNotificationService.requestPermission().catch(() => {});
      }

      // Subscribe to notifications to handle them when the app is open
      this.pushNotificationService.notification$.subscribe(notification => {
        // Custom handling for notifications when app is open
      });
    }
  }

  private initializeWebSocketNotifications(): void {
    // Enable WebSocket and establish connection
    this.webSocketService.enableWebSocket();

    // Subscribe to WebSocket connection status
    this.webSocketService.getConnectionStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        // Connection status tracked silently
      });

    // Subscribe to all notification messages
    this.webSocketService.getNotificationMessages()
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => {
        this.handleWebSocketNotification(message);
      });

    // Keep connection alive by subscribing to all messages
    this.webSocketService.getMessages()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {});
  }

  private handleWebSocketNotification(message: any): void {
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
      console.error('Error handling WebSocket notification:', error);
    }
  }

  /**
   * Start periodic proactive token refresh check
   * This runs every 2 minutes to check if the token is about to expire
   */
  private startProactiveTokenRefresh(): void {
    // Check every 2 minutes (120000ms)
    interval(120000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.userService.proactiveTokenRefresh();
      });

    // Also do an immediate check on startup
    this.userService.proactiveTokenRefresh();
  }

  ngOnDestroy(): void {
    // Stop deadline monitoring
    this.deadlineAlertService.stopDeadlineMonitoring();
    
    this.destroy$.next();
    this.destroy$.complete();
  }
}
