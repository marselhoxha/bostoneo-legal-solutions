import { Component, OnInit } from '@angular/core';
import {
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
  Event,
  UrlSerializer,
} from '@angular/router';
import { PreloaderService } from './service/preloader.service';
import { UserService } from './service/user.service';
import { ReminderService } from './modules/legal/services/reminder.service';
import { PushNotificationService } from './core/services/push-notification.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  showPreloader = false;

  constructor(
    private router: Router,
    private preloaderService: PreloaderService,
    private urlSerializer: UrlSerializer,
    private userService: UserService,
    private reminderService: ReminderService,
    private pushNotificationService: PushNotificationService
  ) {
    this.preloaderService.showPreloader$.subscribe((show) => {
      this.showPreloader = show;
    });

    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationStart) {
        console.log('NavigationStart:', event.url);
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
    // Preload user data if authenticated
    if (this.userService.isAuthenticated()) {
      this.userService.preloadUserData();
      
      // Start deadline reminder service for authenticated users
      this.reminderService.startReminders();
    }
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

  // Add method to initialize push notifications
  private initializePushNotifications(): void {
    if ('Notification' in window) {
      // Only request permission if the browser supports notifications
      // and the permission hasn't been denied
      if (Notification.permission !== 'denied') {
        this.pushNotificationService.requestPermission()
          .then(token => {
            console.log('Notification permission granted. Token:', token);
          })
          .catch(err => {
            console.warn('Notification permission denied:', err);
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
}
