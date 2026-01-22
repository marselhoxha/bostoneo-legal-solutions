import { Component, OnInit, EventEmitter, Output, Inject, ViewChild, TemplateRef, Input, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { DOCUMENT } from '@angular/common';

//Logout

import { Router } from '@angular/router';

// Language
import { CookieService } from 'ngx-cookie-service';
import { allNotification, messages } from './data'
import { CartModel } from './topbar.model';
import { cartData } from './data';
import { NgbModal, NgbDropdown } from '@ng-bootstrap/ng-bootstrap';
import { NotificationService } from 'src/app/service/notification.service';
import { UserService } from 'src/app/service/user.service';
import { User } from 'src/app/interface/user';
import { State } from '@ngrx/store';
import { Observable, BehaviorSubject, map, Subject, takeUntil } from 'rxjs';
import { CustomHttpResponse, Profile } from 'src/app/interface/appstates';
import { NavigationEnd } from '@angular/router';
import { PushNotificationService } from 'src/app/core/services/push-notification.service';
import { NotificationManagerService } from 'src/app/core/services/notification-manager.service';
import { CaseAssignmentService } from 'src/app/service/case-assignment.service';
import { CaseTaskService } from 'src/app/service/case-task.service';
import { CaseAssignment } from 'src/app/interface/case-assignment';
import { MessagingService, MessageThread } from 'src/app/service/messaging.service';
import { MessagingStateService } from 'src/app/service/messaging-state.service';
import { WebSocketService } from 'src/app/service/websocket.service';
import { Key } from 'src/app/enum/key.enum';
import { ClientPortalService, ClientMessageThread } from 'src/app/modules/client-portal/services/client-portal.service';
import { TimerService, ActiveTimer } from 'src/app/modules/time-tracking/services/timer.service';
import { LegalCaseService } from 'src/app/modules/legal/services/legal-case.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-topbar',
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopbarComponent implements OnInit, OnDestroy {
  @Input() user: User;
  messages: any
  element: any;
  mode: string | undefined;
  @Output() mobileMenuButtonClicked = new EventEmitter();
  allnotifications: any
  flagvalue: any;
  valueset: any;
  countryName: any;
  cookieValue: any;
  userData: any;
  cartData!: CartModel[];
  total = 0;
  cart_length: any = 0;
  totalNotify: number = 0;
  newNotify: number = 0;
  readNotify: number = 0;
  isDropdownOpen = false;
  @ViewChild('removenotification') removenotification !: TemplateRef<any>;
  notifyId: any;
  user$: Observable<User>;
  private destroy$ = new Subject<void>();
  
  // Push notifications
  pushNotifications: any[] = [];
  hasNewNotifications = false;
  firebaseToken: string | null = null;
  unreadNotificationCount = 0;
  activeNotification: any = null;
  private notificationsLoaded = false;
  notificationPermissionStatus: NotificationPermission = 'default';
  @ViewChild('notificationDropdown') notificationDropdown!: NgbDropdown;
  
  // Case Management Properties
  pendingAssignments = 0;
  myCasesCount = 0;
  myTasksCount = 0;
  teamWorkloadPercentage = 0;
  recentAssignments: any[] = [];

  // Messages
  unreadMessageCount = 0;
  messageThreads: MessageThread[] = [];
  clientMessageThreads: ClientMessageThread[] = [];
  loadingMessages = false;
  isClientUser = false;
  private messagingStateSubscribed = false; // Guard to prevent duplicate subscriptions
  @ViewChild('messageDropdown') messageDropdown!: NgbDropdown;

  // Time Tracking
  activeTimers: ActiveTimer[] = [];
  loadingTimers = false;
  @ViewChild('timerDropdown') timerDropdown!: NgbDropdown;

  // Quick Start Timer
  showQuickStartForm = false;
  quickStartCaseId: number | null = null;
  quickStartDescription = '';
  startingTimer = false;
  availableCases: any[] = [];

  // Case Search & Recent Cases
  caseSearchQuery = '';
  filteredCases: any[] = [];
  recentCases: any[] = [];

  constructor(@Inject(DOCUMENT) private document: any,   private modalService: NgbModal,
    public _cookiesService: CookieService, private userService: UserService, private notificationService: NotificationService,
    private router: Router, private cdr: ChangeDetectorRef, private pushNotificationService: PushNotificationService,
    private notificationManagerService: NotificationManagerService,
    private caseAssignmentService: CaseAssignmentService, private caseTaskService: CaseTaskService,
    private messagingService: MessagingService, private messagingStateService: MessagingStateService,
    private webSocketService: WebSocketService,
    private clientPortalService: ClientPortalService, private timerService: TimerService,
    private legalCaseService: LegalCaseService) {

     }

  ngOnInit(): void {
    // Initialize user data
    this.user$ = this.userService.userData$;

    // Load user data if authenticated
    if (this.userService.isAuthenticated()) {
      this.loadUserData();
    }

    // Check notification permission status
    this.checkNotificationPermission();

    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.changeMode(savedTheme);
    } else {
      this.changeMode('light');
    }

    this.element = document.documentElement;

    // Subscribe to user data changes
    this.userService.userData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (user) => {
        if (user) {
          // Update client role when user data changes
          this.isClientUser = user.roleName === 'ROLE_CLIENT' ||
                              user.roles?.some((role: string) => role === 'ROLE_CLIENT') || false;
          // Force change detection when user data changes
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        }
      }
    });

    // Subscribe to router events to refresh user data (but avoid reloading notifications on every route change)
    this.router.events.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        // Only refresh user data but don't trigger notification reload on every route change
        // The notification loading should only happen on initial login or when explicitly needed
        this.userService.refreshUserData();
      }
    });

    // Initialize push notifications
    this.initializePushNotifications();

    // Initialize backend notifications
    this.initializeBackendNotifications();

    // Initialize unread notification count
    this.updateUnreadCount();

    // Initialize dropdown component with a small delay to ensure proper rendering
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 100);

    // Load case management data with a delay to ensure user data is ready
    setTimeout(() => {
      this.loadCaseManagementData();
    }, 1000);

    // IMPORTANT: Subscribe to messaging state IMMEDIATELY (don't wait for user data)
    // This ensures we receive WebSocket notifications from the start
    this.subscribeToMessagingState();

    // Detect user role (for UI display purposes only - messaging subscription already done above)
    this.detectUserRole();

    // Initialize time tracking - subscribe to active timers
    this.initializeTimeTracking();
  }
  
  /**
   * Load case management data for dropdown
   */
  private loadCaseManagementData(): void {
    // Skip if user not authenticated
    if (!this.userService.isAuthenticated()) {
      return;
    }
    
    this.userService.userData$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      if (!user || !user.id) {
        // Retry after a delay if user data not available
        setTimeout(() => {
          this.loadCaseManagementDataDirect();
        }, 500);
        return;
      }

      this.loadCaseDataForUser(user.id);
    });
  }
  
  /**
   * Direct load without subscription
   */
  private loadCaseManagementDataDirect(): void {
    const userData = this.userService.getCurrentUser();
    if (userData && userData.id) {
      this.loadCaseDataForUser(userData.id);
    }
  }
  
  /**
   * Load case data for a specific user
   */
  private loadCaseDataForUser(userId: number): void {
      // Load user's case assignments
      this.caseAssignmentService.getUserAssignments(userId, 0, 10)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response && response.data) {
              // Service now handles the mapping
              const assignments = response.data;
              if (assignments.length > 0) {
                this.recentAssignments = assignments.slice(0, 3).map((assignment: CaseAssignment) => ({
                  id: assignment.id,
                  caseId: assignment.caseId,
                  caseTitle: assignment.caseTitle || 'Case #' + assignment.caseId,
                  assignmentDate: assignment.assignedAt,
                  roleType: assignment.roleType
                }));
                this.myCasesCount = assignments.length;
                // Count active assignments as pending (no workloadStatus property exists)
                this.pendingAssignments = assignments.filter((a: CaseAssignment) => 
                  a.active === true
                ).length;
              } else {
                // Set default values when no assignments
                this.recentAssignments = [];
                this.myCasesCount = 0;
                this.pendingAssignments = 0;
              }
            } else {
              // Set default values when no data
              this.recentAssignments = [];
              this.myCasesCount = 0;
              this.pendingAssignments = 0;
            }
            this.cdr.detectChanges();
          },
          error: () => {
            // Set default values on error
            this.recentAssignments = [];
            this.myCasesCount = 0;
            this.pendingAssignments = 0;
            this.cdr.detectChanges();
          }
        });

      // Load user's workload
      this.caseAssignmentService.calculateUserWorkload(userId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response && response.data) {
              // Service now handles the mapping
              const workload = response.data;
              this.teamWorkloadPercentage = Math.round(workload.capacityPercentage || 0);
            }
            this.cdr.detectChanges();
          },
          error: () => {
            // Set default value on error
            this.teamWorkloadPercentage = 0;
            this.cdr.detectChanges();
          }
        });
      
      // Load active tasks count
      this.caseTaskService.getUserTasks(userId, { page: 0, size: 100 })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response && response.data) {
              // Service now handles the mapping
              const tasks = response.data;
              if (tasks.length > 0) {
                this.myTasksCount = tasks.filter((task: any) =>
                  task.status !== 'COMPLETED' && task.status !== 'CANCELLED'
                ).length;
              } else {
                this.myTasksCount = 0;
              }
            }
            this.cdr.detectChanges();
          },
          error: () => {
            // Set default value on error
            this.myTasksCount = 0;
            this.cdr.detectChanges();
          }
        });
  }
  
  /**
   * Initialize push notification features
   */
  private initializePushNotifications(): void {
    // Request permission for notifications if the user is logged in
    if (this.userService.isAuthenticated()) {
      this.requestNotificationPermission();
    }
    
    // Listen for new notifications
    this.pushNotificationService.notification$
      .pipe(takeUntil(this.destroy$))
      .subscribe(notification => {
        if (notification) {
          // Add notification to the list
          this.addNotification(notification);
          // Mark that we have new notifications
          this.hasNewNotifications = true;
          // Force change detection
          this.cdr.detectChanges();
        }
      });
      
    // Get the current token
    this.pushNotificationService.getToken()
      .pipe(takeUntil(this.destroy$))
      .subscribe(token => {
        this.firebaseToken = token;
      });
  }
  
  /**
   * Initialize backend notifications - load missed notifications from database
   */
  private initializeBackendNotifications(): void {
    // Skip if user not authenticated
    if (!this.userService.isAuthenticated()) {
      return;
    }
    
    // Subscribe to user data changes to fetch notifications when user logs in
    let previousUserId: number | null = null;
    this.userService.userData$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      if (user && user.id) {
        // If user changed, reset notifications loaded flag
        if (previousUserId && previousUserId !== user.id) {
          this.notificationsLoaded = false;
          this.pushNotifications = [];
          this.unreadNotificationCount = 0;
        }

        // Load notifications only if not already loaded for this user
        if (!this.notificationsLoaded) {
          this.loadBackendNotifications(user.id);
          this.notificationsLoaded = true;
        }

        previousUserId = user.id;
      } else {
        // User logged out, reset everything
        this.notificationsLoaded = false;
        this.pushNotifications = [];
        this.unreadNotificationCount = 0;
        previousUserId = null;
      }
    });
  }
  
  /**
   * Load notifications from backend database
   */
  private async loadBackendNotifications(userId: number): Promise<void> {
    try {
      // Use the NotificationManagerService to check for missed notifications
      // This will use the proper authentication and API setup
      await this.notificationManagerService.checkMissedNotifications(userId);

    } catch (error) {
      // Fallback: Try direct API call as a backup
      try {
        const response = await fetch(`http://localhost:8085/api/v1/notifications/user/${userId}?page=0&size=10`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem(Key.TOKEN)}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();

          if (data?.data?.notifications && data.data.notifications.length > 0) {
            // Process each individual notification and add it to the UI
            data.data.notifications.forEach((backendNotification: any) => {
              // Convert backend notification to frontend format
              const frontendNotification = {
                notification: {
                  title: backendNotification.title,
                  body: backendNotification.message
                },
                data: {
                  type: backendNotification.type?.toLowerCase() || 'default',
                  url: backendNotification.url || '/dashboard',
                  priority: backendNotification.priority?.toLowerCase() || 'normal',
                  backendId: backendNotification.id,
                  isFromBackend: true,
                  createdAt: backendNotification.createdAt
                }
              };
              
              // Add the notification to the UI
              this.addNotification(frontendNotification);
            });
            
          }
        }

      } catch (fallbackError) {
        // Silently fail on fallback error
      }
    }
  }
  
  /**
   * Check current notification permission status
   */
  checkNotificationPermission(): void {
    if ('Notification' in window) {
      this.notificationPermissionStatus = Notification.permission;
    }
  }
  
  /**
   * Request permission for push notifications
   */
  requestNotificationPermission(): void {
    this.pushNotificationService.requestPermission()
      .then(token => {
        this.firebaseToken = token;
        this.notificationPermissionStatus = 'granted';
      })
      .catch(() => {
        this.notificationPermissionStatus = Notification.permission;
      });
  }
  
  /**
   * Add a notification to the list
   */
  private addNotification(notification: any): void {
    // Filter out message-related notifications - they are shown in the separate messages icon
    const notificationType = notification.data?.type?.toUpperCase() || '';
    const messageTypes = ['NEW_MESSAGE', 'CLIENT_MESSAGE', 'ATTORNEY_MESSAGE', 'MESSAGE'];
    if (messageTypes.includes(notificationType)) {
      return;
    }

    // Handle timestamp - use backend timestamp if available, otherwise current time
    let timestamp = new Date();
    if (notification.data?.createdAt) {
      timestamp = new Date(notification.data.createdAt);
    }

    // Create a unique ID - use backend ID if available
    let notificationId = Date.now().toString();
    if (notification.data?.backendId) {
      notificationId = `backend_${notification.data.backendId}`;
    }

    // Check for duplicates based on ID
    const existingNotification = this.pushNotifications.find(n => n.id === notificationId);
    if (existingNotification) {
      return;
    }
    
    // Create a notification object
    const notificationObj = {
      id: notificationId,
      title: notification.notification?.title || 'New Notification',
      body: notification.notification?.body || '',
      timestamp: timestamp,
      read: notification.data?.read || false,
      data: notification.data || {},
      type: notification.data?.type || 'default',
      isFromBackend: notification.data?.isFromBackend || false
    };
    
    // Add to the beginning of the list, or sort by timestamp if from backend
    if (notification.data?.isFromBackend) {
      // For backend notifications, insert in chronological order
      this.pushNotifications = [notificationObj, ...this.pushNotifications];
      this.pushNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      this.pushNotifications = this.pushNotifications.slice(0, 50); // Keep only latest 50
    } else {
      // For real-time notifications, add to beginning
      this.pushNotifications = [notificationObj, ...this.pushNotifications.slice(0, 19)];
      
      // Trigger bell animation and sound only for new real-time notifications
      this.triggerBellAnimation();
      this.playNotificationSound();
    }
    
    // Update unread count
    this.updateUnreadCount();

    // Force UI update
    this.cdr.detectChanges();
  }
  
  /**
   * Update the count of unread notifications
   */
  private updateUnreadCount(): void {
    this.unreadNotificationCount = this.pushNotifications.filter(n => !n.read).length;
  }
  
  /**
   * Get the count of unread notifications
   */
  getUnreadCount(): number {
    return this.unreadNotificationCount;
  }
  
  /**
   * Play notification sound
   */
  private playNotificationSound(): void {
    try {
      // Check if notification sound exists
      const audioUrl = 'assets/sounds/notification.mp3';
      
      // Create new audio element
      const audio = new Audio(audioUrl);
      
      // Set volume and handle errors
      if (audio) {
        audio.volume = 0.3;
        
        // Add error handler to avoid console errors
        audio.addEventListener('error', () => {
          // Silently fail if sound cannot be played
        });

        // Try to play and catch any errors
        const playPromise = audio.play();

        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Audio playback prevented by browser policy
          });
        }
      }
    } catch (error) {
      // Notification sound not available
    }
  }
  
  /**
   * Get the appropriate icon class based on notification type
   */
  getNotificationIconClass(notification: any): string {
    switch (notification.type) {
      case 'deadline':
        return 'avatar-title bg-warning-subtle text-warning';
      case 'case':
        return 'avatar-title bg-info-subtle text-info';
      case 'document':
        return 'avatar-title bg-success-subtle text-success';
      case 'court':
        return 'avatar-title bg-purple-subtle text-purple';
      case 'alert':
        return 'avatar-title bg-danger-subtle text-danger';
      default:
        return 'avatar-title bg-primary-subtle text-primary';
    }
  }
  
  /**
   * Get the appropriate icon based on notification type
   */
  getNotificationIcon(notification: any): string {
    switch (notification.type) {
      case 'deadline':
        return 'bx bx-calendar-exclamation fs-16';
      case 'case':
        return 'bx bx-briefcase fs-16';
      case 'document':
        return 'bx bx-file fs-16';
      case 'court':
        return 'bx bx-buildings fs-16';
      case 'alert':
        return 'bx bx-error-circle fs-16';
      default:
        return 'bx bx-bell fs-16';
    }
  }
  
  /**
   * Handle notification dropdown toggle
   */
  onNotificationDropdownToggle(isOpen: boolean): void {
    if (isOpen) {
      // When dropdown is opened, clear the new notifications indicator
      this.hasNewNotifications = false;
      
      // Check if there are notifications and initialize them if needed
      if (this.pushNotifications.length === 0) {
        this.cdr.detectChanges();
      }
      
      // Force change detection to ensure dropdown opens properly
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 10);
    }
  }

  /**
   * Handle notification click
   */
  onNotificationClick(notification: any): void {
    // Stop event propagation to prevent dropdown close
    event?.stopPropagation();
    
    // Mark notification as read both locally and in backend
    if (!notification.read && notification.id) {
      // Update local state immediately for UI responsiveness
      notification.read = true;
      this.updateUnreadCount();
      this.cdr.detectChanges();
      
      // Extract the actual backend ID (remove 'backend_' prefix if present)
      let backendId = notification.id;
      if (notification.id.startsWith('backend_')) {
        backendId = notification.id.replace('backend_', '');
      }

      // Persist to backend using the correct ID format
      this.notificationService.markAsRead(backendId).subscribe({
        next: () => {
          // Successfully marked as read
        },
        error: () => {
          // Revert local state if backend call fails
          notification.read = false;
          this.updateUnreadCount();
          this.cdr.detectChanges();
        }
      });
    }
    
    // Show notification details in modal - with small delay to prevent interaction issues
    setTimeout(() => {
      this.showNotificationDetails(notification);
    }, 50);
  }
  
  /**
   * Show notification details in modal
   */
  showNotificationDetails(notification: any): void {
    const modalRef = this.modalService.open(this.removenotification, { 
      centered: true,
      size: 'lg'
    });
    
    // Set notification data
    this.activeNotification = notification;
    
    // Do not set title on modal component instance as it doesn't exist
    
    // Handle modal close
    modalRef.result.then(
      () => {
        // Handle modal close via confirmation
        if (notification.data && notification.data.url) {
          this.router.navigateByUrl(notification.data.url);
        }
      },
      () => {
        // Handle modal dismiss
      }
    );
  }
  
  /**
   * Get if there are new notifications
   */
  hasUnreadNotifications(): boolean {
    return this.unreadNotificationCount > 0;
  }
  
  /**
   * Mark all notifications as read
   */
  markAllAsRead(): void {
    if (this.pushNotifications.length === 0) return;
    
    // Update local state immediately for UI responsiveness
    const unreadNotifications = this.pushNotifications.filter(n => !n.read);
    this.pushNotifications = this.pushNotifications.map(notification => ({
      ...notification,
      read: true
    }));
    
    this.hasNewNotifications = false;
    this.unreadNotificationCount = 0;
    this.cdr.markForCheck();
    
    // Persist to backend if there are actually unread notifications
    if (unreadNotifications.length > 0) {
      this.notificationService.markAllAsRead().subscribe({
        next: () => {
          // Successfully marked all as read
        },
        error: () => {
          // Revert local state if backend call fails
          unreadNotifications.forEach(notification => {
            const localNotification = this.pushNotifications.find(n => n.id === notification.id);
            if (localNotification) {
              localNotification.read = false;
            }
          });
          this.updateUnreadCount();
          this.cdr.markForCheck();
        }
      });
    }
  }
  
  /**
   * Clear all notifications
   */
  clearAllNotifications(): void {
    this.pushNotifications = [];
    this.hasNewNotifications = false;
    this.unreadNotificationCount = 0;
    this.cdr.detectChanges();
  }
  
  /**
   * Send a test notification with realistic legal case data
   */
  sendTestNotification(): void {
    // Create several realistic test notifications
    this.sendLegalCaseNotification();
    
    // Wait a brief moment and send a deadline notification
    setTimeout(() => {
      this.sendDeadlineNotification();
    }, 800);
    
    // Wait another moment and send a document notification
    setTimeout(() => {
      this.sendDocumentNotification();
    }, 1600);
    
    // Force change detection to ensure the UI updates
    this.cdr.detectChanges();
  }
  
  /**
   * Send a legal case update notification
   */
  private sendLegalCaseNotification(): void {
    const caseNotification = {
      notification: {
        title: 'Case Update: Smith v. Johnson',
        body: 'The opposing counsel has filed a motion for summary judgment. Review required.'
      },
      data: {
        type: 'case',
        url: '/legal/cases/details/127',
        caseId: '127',
        priority: 'high'
      }
    };
    
    this.pushNotificationService.sendCustomNotification(caseNotification);
  }
  
  /**
   * Send a deadline notification
   */
  private sendDeadlineNotification(): void {
    const deadlineNotification = {
      notification: {
        title: 'Upcoming Deadline',
        body: 'Response to motion due in 7 days for case Williams v. State Bank'
      },
      data: {
        type: 'deadline',
        url: '/calendar',
        eventId: '89',
        priority: 'high'
      }
    };
    
    this.pushNotificationService.sendCustomNotification(deadlineNotification);
  }
  
  /**
   * Send a document notification
   */
  private sendDocumentNotification(): void {
    const documentNotification = {
      notification: {
        title: 'New Document Available',
        body: 'Expert witness report has been uploaded to Davidson Insurance case'
      },
      data: {
        type: 'document',
        url: '/legal/cases/documents/456',
        documentId: '456',
        caseId: '133'
      }
    };
    
    this.pushNotificationService.sendCustomNotification(documentNotification);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUserData() {
    this.userService.profile$()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response && response.data && response.data.user) {
            this.userService.setUserData(response.data.user);
            this.cdr.detectChanges();
          }
        },
        error: () => {
          this.userService.refreshToken$()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (refreshResponse) => {
                if (refreshResponse && refreshResponse.data && refreshResponse.data.user) {
                  this.userService.setUserData(refreshResponse.data.user);
                  this.cdr.detectChanges();
                }
              },
              error: () => {
                this.logOut();
              }
            });
        }
      });
  }

  /**
   * Toggle the menu bar when having mobile screen
   */
  toggleMobileMenu(event: any) {
    document.querySelector('.hamburger-icon')?.classList.toggle('open')
    event.preventDefault();
    this.mobileMenuButtonClicked.emit();
  }

  /**
   * Fullscreen method
   */
  fullscreen() {
    document.body.classList.toggle('fullscreen-enable');
    if (
      !document.fullscreenElement && !this.element.mozFullScreenElement &&
      !this.element.webkitFullscreenElement) {
      if (this.element.requestFullscreen) {
        this.element.requestFullscreen();
      } else if (this.element.mozRequestFullScreen) {
        /* Firefox */
        this.element.mozRequestFullScreen();
      } else if (this.element.webkitRequestFullscreen) {
        /* Chrome, Safari and Opera */
        this.element.webkitRequestFullscreen();
      } else if (this.element.msRequestFullscreen) {
        /* IE/Edge */
        this.element.msRequestFullscreen();
      }
    } else {
      if (this.document.exitFullscreen) {
        this.document.exitFullscreen();
      } else if (this.document.mozCancelFullScreen) {
        /* Firefox */
        this.document.mozCancelFullScreen();
      } else if (this.document.webkitExitFullscreen) {
        /* Chrome, Safari and Opera */
        this.document.webkitExitFullscreen();
      } else if (this.document.msExitFullscreen) {
        /* IE/Edge */
        this.document.msExitFullscreen();
      }
    }
  }
  /**
* Open modal
* @param content modal content
*/
  openModal(content: any) {
    // this.submitted = false;
    this.modalService.open(content, { centered: true });
  }

  toggleTheme() {
    // Toggle between light and dark mode
    if (this.mode === 'dark') {
      this.changeMode('light');
    } else {
      this.changeMode('dark');
    }
  }

  /**
  * Topbar Light-Dark Mode Change
  */
  changeMode(mode: string) {
    this.mode = mode;

    // Apply the selected theme to the entire page
    document.documentElement.setAttribute('data-bs-theme', mode);

    // Save the selected theme to localStorage
    localStorage.setItem('theme', mode);
  }


  /**
   * Logout the user
   */
  logOut(): void {
    this.userService.logOut();
    this.notificationService.onDefault('You\'ve been successfully logged out');
  }

  windowScroll() {
    if (document.body.scrollTop > 80 || document.documentElement.scrollTop > 80) {
      (document.getElementById("back-to-top") as HTMLElement).style.display = "block";
      document.getElementById('page-topbar')?.classList.add('topbar-shadow');
    } else {
      (document.getElementById("back-to-top") as HTMLElement).style.display = "none";
      document.getElementById('page-topbar')?.classList.remove('topbar-shadow');
    }
  }


  toggleDropdown(event: Event) {
    event.stopPropagation();
    if (this.isDropdownOpen) {
      this.isDropdownOpen = false;
    } else {
      this.isDropdownOpen = true;
    }
  }
  // Search Topbar
  Search() {
    var searchOptions = document.getElementById("search-close-options") as HTMLAreaElement;
    var dropdown = document.getElementById("search-dropdown") as HTMLAreaElement;
    var input: any, filter: any, ul: any, li: any, a: any | undefined, i: any, txtValue: any;
    input = document.getElementById("search-options") as HTMLAreaElement;
    filter = input.value.toUpperCase();
    var inputLength = filter.length;

    if (inputLength > 0) {
      dropdown.classList.add("show");
      searchOptions.classList.remove("d-none");
      var inputVal = input.value.toUpperCase();
      var notifyItem = document.getElementsByClassName("notify-item");

      Array.from(notifyItem).forEach(function (element: any) {
        var notifiTxt = ''
        if (element.querySelector("h6")) {
          var spantext = element.getElementsByTagName("span")[0].innerText.toLowerCase()
          var name = element.querySelector("h6").innerText.toLowerCase()
          if (name.includes(inputVal)) {
            notifiTxt = name
          } else {
            notifiTxt = spantext
          }
        } else if (element.getElementsByTagName("span")) {
          notifiTxt = element.getElementsByTagName("span")[0].innerText.toLowerCase()
        }
        if (notifiTxt)
          element.style.display = notifiTxt.includes(inputVal) ? "block" : "none";

      });
    } else {
      dropdown.classList.remove("show");
      searchOptions.classList.add("d-none");
    }
  }

  /**
   * Search Close Btn
   */
  closeBtn() {
    var searchOptions = document.getElementById("search-close-options") as HTMLAreaElement;
    var dropdown = document.getElementById("search-dropdown") as HTMLAreaElement;
    var searchInputReponsive = document.getElementById("search-options") as HTMLInputElement;
    dropdown.classList.remove("show");
    searchOptions.classList.add("d-none");
    searchInputReponsive.value = "";
  }

  // Remove Notification
  checkedValGet: any[] = [];
  onCheckboxChange(event: any, id: any) {
    this.notifyId = id
    var result;
    if (id == '1') {
      var checkedVal: any[] = [];
      for (var i = 0; i < this.allnotifications.length; i++) {
        if (this.allnotifications[i].state == true) {
          result = this.allnotifications[i].id;
          checkedVal.push(result);
        }
      }
      this.checkedValGet = checkedVal;
    } else {
      var checkedVal: any[] = [];
      for (var i = 0; i < this.messages.length; i++) {
        if (this.messages[i].state == true) {
          result = this.messages[i].id;
          checkedVal.push(result);
        }
      }
      this.checkedValGet = checkedVal;
    }
    checkedVal.length > 0 ? (document.getElementById("notification-actions") as HTMLElement).style.display = 'block' : (document.getElementById("notification-actions") as HTMLElement).style.display = 'none';
  }

  notificationDelete() {
    if (this.notifyId == '1') {
      for (var i = 0; i < this.checkedValGet.length; i++) {
        for (var j = 0; j < this.allnotifications.length; j++) {
          if (this.allnotifications[j].id == this.checkedValGet[i]) {
            this.allnotifications.splice(j, 1)
          }
        }
      }
    } else {
      for (var i = 0; i < this.checkedValGet.length; i++) {
        for (var j = 0; j < this.messages.length; j++) {
          if (this.messages[j].id == this.checkedValGet[i]) {
            this.messages.splice(j, 1)
          }
        }
      }
    }
    this.calculatenotification()
    this.modalService.dismissAll();
  }

  calculatenotification() {
    this.totalNotify = 0;
    this.checkedValGet = []

    this.checkedValGet.length > 0 ? (document.getElementById("notification-actions") as HTMLElement).style.display = 'block' : (document.getElementById("notification-actions") as HTMLElement).style.display = 'none';
    if (this.totalNotify == 0) {
      document.querySelector('.empty-notification-elem')?.classList.remove('d-none')
    }
  }

  /**
   * Trigger bell animation manually to indicate new notifications
   */
  triggerBellAnimation(): void {
    this.hasNewNotifications = true;
    
    // Force animation by removing and adding the class
    setTimeout(() => {
      this.hasNewNotifications = false;
      setTimeout(() => {
        this.hasNewNotifications = true;
        this.cdr.detectChanges();
      }, 10);
    }, 10);
  }

  /**
   * Open notification dropdown programmatically
   */
  openNotificationDropdown(): void {
    if (this.notificationDropdown) {
      this.notificationDropdown.open();
    }
  }

  /**
   * Close notification dropdown programmatically
   */
  closeNotificationDropdown(): void {
    if (this.notificationDropdown) {
      this.notificationDropdown.close();
    }
  }

  /**
   * Detect user role for UI display purposes
   * Note: Messaging state subscription is now handled separately in ngOnInit
   */
  private detectUserRole(): void {
    // Check current user immediately if available
    const currentUser = this.userService.getCurrentUser();
    if (currentUser) {
      this.isClientUser = currentUser.roleName === 'ROLE_CLIENT' ||
                          (currentUser as any).roles?.some((role: string) => role === 'ROLE_CLIENT') || false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Subscribe to centralized messaging state service
   * This ensures state persists across route navigation
   */
  private subscribeToMessagingState(): void {
    // Guard to prevent duplicate subscriptions
    if (this.messagingStateSubscribed) return;
    this.messagingStateSubscribed = true;

    // Subscribe to unread count from centralized service
    // OPTIMIZATION: Only update if value changed to prevent unnecessary re-renders
    this.messagingStateService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => {
        if (this.unreadMessageCount === count) {
          return; // Skip if unchanged
        }
        this.unreadMessageCount = count;
        // CRITICAL: For unread count badge, we need detectChanges to ensure immediate update
        // This is necessary because OnPush change detection may not catch BehaviorSubject emissions
        this.cdr.markForCheck();
        this.cdr.detectChanges();
        // NOTE: Do NOT play notification sound here!
        // The unread count can change for many reasons (polling, marking as read, etc.)
        // Notification sounds should ONLY be triggered by newMessage$ from WebSocket
        // which correctly identifies incoming messages from OTHER users.
      });

    // Subscribe to threads from centralized service
    // OPTIMIZATION: Only update if threads actually changed
    this.messagingStateService.threads$
      .pipe(takeUntil(this.destroy$))
      .subscribe(threads => {
        // Clone and take only top 5 most recent threads for dropdown
        const newThreads = (threads || [])
          .map(t => ({ ...t }))
          .sort((a, b) => {
            const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 5);

        // Skip update if data is the same (prevents flickering)
        if (this.areMessageThreadsEqual(this.messageThreads, newThreads)) {
          return;
        }

        this.messageThreads = newThreads;
        // For threads update, also need detectChanges to ensure dropdown updates
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });

    // Subscribe to loading state
    this.messagingStateService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        if (this.loadingMessages === loading) return; // Skip if unchanged
        this.loadingMessages = loading;
        this.cdr.markForCheck();
      });

    // Subscribe to new messages for notification sound/animation
    // The messaging-state.service already filters out own messages before emitting
    // We just need to check _playSoundAllowed flag for sound control
    this.messagingStateService.newMessage$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        // Only play notification sound if explicitly allowed by the service
        // (service sets _playSoundAllowed=true only when it can confirm message is from someone else)
        if (data?.message?._playSoundAllowed && !data.message._polled) {
          this.playMessageNotificationSound();
        }

        // Trigger visual update for new messages
        this.cdr.markForCheck();
      });

    // Force initial load of threads from centralized service (works for both clients and attorneys)
    // The MessagingService.getThreads() routes to the correct API based on user role
    // Use force=true to bypass debounce and ensure data loads immediately on component init
    this.messagingStateService.refreshThreads(true);

    // Also refresh after a short delay to catch any timing issues with service initialization
    setTimeout(() => {
      this.messagingStateService.refreshThreads(true);
      this.cdr.markForCheck();
    }, 500);
  }

  /**
   * Shallow equality check for message threads to prevent unnecessary re-renders
   */
  private areMessageThreadsEqual(current: any[], incoming: any[]): boolean {
    if (!current || !incoming) return false;
    if (current.length !== incoming.length) return false;

    for (let i = 0; i < current.length; i++) {
      const c = current[i];
      const n = incoming[i];
      if (c.id !== n.id ||
          c.unreadCount !== n.unreadCount ||
          c.lastMessage !== n.lastMessage ||
          c.lastMessageAt !== n.lastMessageAt) {
        return false;
      }
    }
    return true;
  }

  /**
   * Play notification sound for new messages
   */
  private playMessageNotificationSound(): void {
    try {
      const audioUrl = 'assets/sounds/notification.mp3';
      const audio = new Audio(audioUrl);
      if (audio) {
        audio.volume = 0.3;
        audio.addEventListener('error', () => {});
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      }
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Trigger visual notification for new message (e.g., pulse animation)
   */
  private triggerMessageNotification(): void {
    // Force change detection to ensure badge updates
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  /**
   * Load client message threads (for client users only)
   * Attorneys use the centralized MessagingStateService
   */
  private loadClientMessageThreads(): void {
    this.loadingMessages = true;
    this.clientPortalService.getMessageThreads()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (threads) => {
          this.clientMessageThreads = threads
            .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
            .slice(0, 5);
          // Also update unread count for clients
          this.unreadMessageCount = threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
          this.loadingMessages = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loadingMessages = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Handle message dropdown toggle
   */
  onMessageDropdownToggle(isOpen: boolean): void {
    if (isOpen) {
      // Force refresh threads when dropdown opens (bypasses debounce)
      // This ensures the dropdown always shows the latest data
      this.messagingStateService.refreshThreads(true);
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    }
  }

  /**
   * Navigate to specific message thread (for attorneys)
   */
  navigateToThread(thread: MessageThread): void {
    if (this.messageDropdown) {
      this.messageDropdown.close();
    }
    this.router.navigate(['/messages'], { queryParams: { threadId: thread.id } });
  }

  /**
   * Navigate to specific client message thread (for clients)
   */
  navigateToClientThread(thread: ClientMessageThread): void {
    if (this.messageDropdown) {
      this.messageDropdown.close();
    }
    this.router.navigate(['/client/messages'], { queryParams: { threadId: thread.id } });
  }

  /**
   * Navigate to messages page
   */
  navigateToMessages(): void {
    if (this.messageDropdown) {
      this.messageDropdown.close();
    }
    // Navigate to appropriate messages page based on user role
    if (this.isClientUser) {
      this.router.navigate(['/client/messages']);
    } else {
      this.router.navigate(['/messages']);
    }
  }

  /**
   * Format relative time for message dropdown
   */
  formatMessageTime(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /**
   * Get initials from name
   */
  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  /**
   * Get display threads - uses centralized state service for both clients and attorneys
   */
  getDisplayThreads(): any[] {
    return this.messageThreads;
  }

  /**
   * Handle thread click based on user type
   */
  onThreadClick(thread: any): void {
    if (this.isClientUser) {
      this.navigateToClientThread(thread as ClientMessageThread);
    } else {
      this.navigateToThread(thread as MessageThread);
    }
  }

  /**
   * Get thread sender name for display
   */
  getThreadDisplayName(thread: any): string {
    if (this.isClientUser) {
      // For clients, show attorney name
      return thread.attorneyName || 'Your Attorney';
    } else {
      // For attorneys, show client name
      return thread.clientName || 'Client';
    }
  }

  /**
   * Check if the last message in the thread was sent by the current user
   * IMPORTANT: For multi-attorney threads, MUST compare lastSenderId
   */
  isLastMessageByMe(thread: any): boolean {
    if (!thread) return false;

    // Primary check: compare lastSenderId with current user
    // This is critical for multi-attorney threads
    const currentUserId = this.userService.getCurrentUserId();
    if (thread.lastSenderId && currentUserId) {
      return thread.lastSenderId == currentUserId;
    }

    // For clients, senderType check is sufficient
    if (this.isClientUser && thread.lastSenderType) {
      return thread.lastSenderType === 'CLIENT';
    }

    // For attorneys without lastSenderId, default to false
    // This avoids showing "You" incorrectly for other attorneys' messages
    return false;
  }

  /**
   * Get the display name for the last message sender
   */
  getLastSenderDisplay(thread: any): string {
    if (this.isLastMessageByMe(thread)) {
      return 'You';
    }
    return thread.lastSenderName || (this.isClientUser ? 'Attorney' : 'Client');
  }

  // ==========================================
  // TIME TRACKING METHODS
  // ==========================================

  /**
   * Initialize time tracking - subscribe to active timers
   */
  private initializeTimeTracking(): void {
    // Subscribe to active timers from the service
    this.timerService.activeTimers$
      .pipe(takeUntil(this.destroy$))
      .subscribe(timers => {
        this.activeTimers = timers;
        this.cdr.detectChanges();
      });

    // Load active timers when user data is available
    this.userService.userData$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      if (user && user.id) {
        this.loadActiveTimers(user.id);
      }
    });
  }

  /**
   * Load active timers for current user
   */
  private loadActiveTimers(userId: number): void {
    this.loadingTimers = true;
    this.timerService.getActiveTimers(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (timers) => {
          this.activeTimers = timers;
          this.loadingTimers = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loadingTimers = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Handle timer dropdown toggle
   */
  onTimerDropdownToggle(isOpen: boolean): void {
    if (isOpen) {
      // Refresh timers when dropdown opens
      const user = this.userService.getCurrentUser();
      if (user && user.id) {
        this.loadActiveTimers(user.id);
      }
      // Load available cases for quick start
      this.loadAvailableCases();
    } else {
      // Reset quick start form when dropdown closes
      this.showQuickStartForm = false;
      this.quickStartCaseId = null;
      this.quickStartDescription = '';
    }
  }

  /**
   * Load available cases for quick start timer
   */
  private loadAvailableCases(): void {
    this.legalCaseService.getAllCases(0, 50)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          let cases: any[] = [];
          if (response?.data?.page?.content) {
            cases = response.data.page.content;
          } else if (Array.isArray(response?.data)) {
            cases = response.data;
          } else if (response?.content) {
            cases = response.content;
          }

          this.availableCases = cases;
          this.filteredCases = cases;

          // Set recent cases (first 4 active cases or most recent)
          this.recentCases = cases
            .filter((c: any) => c.status === 'ACTIVE' || c.status === 'OPEN' || !c.status)
            .slice(0, 4);

          // If no active cases, just use first 4
          if (this.recentCases.length === 0) {
            this.recentCases = cases.slice(0, 4);
          }

          this.cdr.detectChanges();
        },
        error: () => {
          // Silently fail
        }
      });
  }

  /**
   * Filter cases based on search query
   */
  filterCases(): void {
    if (!this.caseSearchQuery || this.caseSearchQuery.trim() === '') {
      this.filteredCases = this.availableCases;
    } else {
      const query = this.caseSearchQuery.toLowerCase().trim();
      this.filteredCases = this.availableCases.filter((c: any) =>
        (c.caseNumber && c.caseNumber.toLowerCase().includes(query)) ||
        (c.title && c.title.toLowerCase().includes(query)) ||
        (c.clientName && c.clientName.toLowerCase().includes(query))
      );
    }
    this.cdr.detectChanges();
  }

  /**
   * Select a case from the search results
   */
  selectCase(caseItem: any): void {
    this.quickStartCaseId = caseItem.id;
    this.caseSearchQuery = `${caseItem.caseNumber} - ${caseItem.title}`;
    this.cdr.detectChanges();
  }

  /**
   * Start timer for a specific case (one-click from recent cases)
   */
  startTimerForCase(caseItem: any): void {
    const user = this.userService.getCurrentUser();
    if (!user || !user.id) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Please log in to start a timer',
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }

    this.startingTimer = true;
    this.timerService.startTimer(user.id, {
      legalCaseId: caseItem.id,
      description: undefined
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (timer) => {
          this.startingTimer = false;
          this.cdr.detectChanges();

          Swal.fire({
            icon: 'success',
            title: 'Timer Started',
            html: `<p class="mb-0">Tracking time for <strong>${caseItem.caseNumber}</strong></p>`,
            timer: 1500,
            showConfirmButton: false
          });
        },
        error: (err) => {
          this.startingTimer = false;
          this.cdr.detectChanges();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err.error?.message || 'Failed to start timer'
          });
        }
      });
  }

  /**
   * Start a new timer from quick start form
   */
  startQuickTimer(): void {
    if (!this.quickStartCaseId) return;

    const user = this.userService.getCurrentUser();
    if (!user || !user.id) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Please log in to start a timer',
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }

    this.startingTimer = true;
    this.timerService.startTimer(user.id, {
      legalCaseId: this.quickStartCaseId,
      description: this.quickStartDescription || undefined
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (timer) => {
          this.startingTimer = false;
          this.showQuickStartForm = false;
          this.quickStartCaseId = null;
          this.quickStartDescription = '';
          this.cdr.detectChanges();

          Swal.fire({
            icon: 'success',
            title: 'Timer Started',
            text: `Tracking time for ${timer.caseName || 'Case #' + timer.legalCaseId}`,
            timer: 2000,
            showConfirmButton: false
          });
        },
        error: (err) => {
          this.startingTimer = false;
          this.cdr.detectChanges();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err.error?.message || 'Failed to start timer'
          });
        }
      });
  }

  /**
   * Check if there are any running timers (not paused)
   */
  hasRunningTimers(): boolean {
    return this.activeTimers.some(timer => timer.isActive);
  }

  /**
   * Get count of running timers
   */
  getRunningTimersCount(): number {
    return this.activeTimers.filter(timer => timer.isActive).length;
  }

  /**
   * Get count of paused timers
   */
  getPausedTimersCount(): number {
    return this.activeTimers.filter(timer => !timer.isActive).length;
  }

  /**
   * Get today's total tracked time
   */
  getTodayTotalTime(): string {
    let totalSeconds = 0;
    this.activeTimers.forEach(timer => {
      if (timer.formattedDuration) {
        const parts = timer.formattedDuration.split(':');
        if (parts.length === 3) {
          const hours = parseInt(parts[0], 10) || 0;
          const minutes = parseInt(parts[1], 10) || 0;
          const seconds = parseInt(parts[2], 10) || 0;
          totalSeconds += hours * 3600 + minutes * 60 + seconds;
        }
      }
    });
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  /**
   * Toggle timer (pause/resume)
   */
  toggleTimer(timer: ActiveTimer): void {
    const user = this.userService.getCurrentUser();
    if (!user || !user.id || !timer.id) return;

    if (timer.isActive) {
      // Pause the timer
      this.timerService.pauseTimer(user.id, timer.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.cdr.detectChanges();
          },
          error: () => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Failed to pause timer',
              timer: 2000,
              showConfirmButton: false
            });
          }
        });
    } else {
      // Resume the timer
      this.timerService.resumeTimer(user.id, timer.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.cdr.detectChanges();
          },
          error: () => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Failed to resume timer',
              timer: 2000,
              showConfirmButton: false
            });
          }
        });
    }
  }

  /**
   * Stop timer - show modal with Save or Discard options
   */
  stopTimer(timer: ActiveTimer): void {
    const user = this.userService.getCurrentUser();
    if (!user || !user.id || !timer.id) return;

    Swal.fire({
      title: 'Stop Timer',
      html: `
        <div class="text-center mb-3">
          <div class="fs-24 fw-bold text-primary mb-2" style="font-family: monospace;">${timer.formattedDuration || '00:00:00'}</div>
          <div class="text-muted fs-13">${timer.caseName || 'Untitled Case'}</div>
        </div>
        <div class="mb-3 text-start">
          <label class="form-label fs-13">Description</label>
          <textarea id="timer-description" class="form-control" rows="2" placeholder="What did you work on?">${timer.description || ''}</textarea>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonColor: '#0ab39c',
      denyButtonColor: '#f06548',
      cancelButtonColor: '#878a99',
      confirmButtonText: '<i class="ri-save-line me-1"></i> Save Entry',
      denyButtonText: '<i class="ri-delete-bin-line me-1"></i> Discard',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      focusConfirm: true,
      preConfirm: () => {
        const descriptionEl = document.getElementById('timer-description') as HTMLTextAreaElement;
        return descriptionEl?.value || timer.description || 'Time entry from timer';
      }
    }).then((result) => {
      if (result.isConfirmed && timer.id) {
        // Save time entry
        const description = result.value as string;
        this.timerService.convertTimerToTimeEntry(user.id!, timer.id, description)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              Swal.fire({
                icon: 'success',
                title: 'Time Entry Saved',
                text: 'Your time has been recorded',
                timer: 2000,
                showConfirmButton: false
              });
              this.cdr.detectChanges();
            },
            error: () => {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to save time entry'
              });
            }
          });
      } else if (result.isDenied && timer.id) {
        // Discard timer
        this.timerService.discardTimer(user.id!, timer.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              Swal.fire({
                icon: 'success',
                title: 'Timer Discarded',
                timer: 1500,
                showConfirmButton: false
              });
              this.cdr.detectChanges();
            },
            error: () => {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to discard timer'
              });
            }
          });
      }
    });
  }
}
