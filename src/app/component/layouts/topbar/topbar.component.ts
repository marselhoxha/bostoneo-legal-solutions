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
import { WebSocketService } from 'src/app/service/websocket.service';
import { Key } from 'src/app/enum/key.enum';
import { ClientPortalService, ClientMessageThread } from 'src/app/modules/client-portal/services/client-portal.service';

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
  @ViewChild('messageDropdown') messageDropdown!: NgbDropdown;

  constructor(@Inject(DOCUMENT) private document: any,   private modalService: NgbModal,
    public _cookiesService: CookieService, private userService: UserService, private notificationService: NotificationService,
    private router: Router, private cdr: ChangeDetectorRef, private pushNotificationService: PushNotificationService,
    private notificationManagerService: NotificationManagerService,
    private caseAssignmentService: CaseAssignmentService, private caseTaskService: CaseTaskService,
    private messagingService: MessagingService, private webSocketService: WebSocketService,
    private clientPortalService: ClientPortalService) {

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
          // Force change detection when user data changes
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

    // Detect user role and load messages accordingly
    this.detectUserRoleAndLoadMessages();
  }
  
  /**
   * Load case management data for dropdown
   */
  private loadCaseManagementData(): void {
    // Skip if user not authenticated
    if (!this.userService.isAuthenticated()) {
      console.log('User not authenticated, skipping case management data load');
      return;
    }
    
    this.userService.userData$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      if (!user || !user.id) {
        console.log('No user data available, retrying...');
        // Retry after a delay if user data not available
        setTimeout(() => {
          this.loadCaseManagementDataDirect();
        }, 500);
        return;
      }
      
      console.log('Loading case management data for user:', user.id);
      this.loadCaseDataForUser(user.id);
    });
  }
  
  /**
   * Direct load without subscription
   */
  private loadCaseManagementDataDirect(): void {
    const userData = this.userService.getCurrentUser();
    if (userData && userData.id) {
      console.log('Direct loading case management data for user:', userData.id);
      this.loadCaseDataForUser(userData.id);
    }
  }
  
  /**
   * Load case data for a specific user
   */
  private loadCaseDataForUser(userId: number): void {
    console.log('Loading case data for user ID:', userId);
      
      // Load user's case assignments
      this.caseAssignmentService.getUserAssignments(userId, 0, 10)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            console.log('Case assignments response:', response);
            if (response && response.data) {
              // Service now handles the mapping
              const assignments = response.data;
              console.log('Processed assignments:', assignments);
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
          error: (error) => {
            console.error('Error loading case assignments:', error);
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
            console.log('Workload response:', response);
            if (response && response.data) {
              // Service now handles the mapping
              const workload = response.data;
              this.teamWorkloadPercentage = Math.round(workload.capacityPercentage || 0);
              console.log('Team workload percentage:', this.teamWorkloadPercentage);
            }
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error loading workload:', error);
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
            console.log('Tasks response:', response);
            if (response && response.data) {
              // Service now handles the mapping
              const tasks = response.data;
              console.log('Processed tasks:', tasks);
              if (tasks.length > 0) {
                this.myTasksCount = tasks.filter((task: any) => 
                  task.status !== 'COMPLETED' && task.status !== 'CANCELLED'
                ).length;
              } else {
                this.myTasksCount = 0;
              }
              console.log('Active tasks count:', this.myTasksCount);
            }
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error loading tasks:', error);
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
          console.log('🔄 User changed, resetting notifications state');
          this.notificationsLoaded = false;
          this.pushNotifications = [];
          this.unreadNotificationCount = 0;
        }
        
        // Load notifications only if not already loaded for this user
        if (!this.notificationsLoaded) {
          console.log('🔔 Loading backend notifications for user (first time):', user.id);
          this.loadBackendNotifications(user.id);
          this.notificationsLoaded = true;
        }
        
        previousUserId = user.id;
      } else {
        // User logged out, reset everything
        console.log('🔄 User logged out, resetting notifications state');
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
      console.log('📡 Fetching backend notifications for user:', userId);
      
      // Use the NotificationManagerService to check for missed notifications
      // This will use the proper authentication and API setup
      await this.notificationManagerService.checkMissedNotifications(userId);
      
      console.log('✅ Requested backend notifications via NotificationManagerService');
      
    } catch (error) {
      console.error('❌ Error loading backend notifications:', error);
      
      // Fallback: Try direct API call as a backup
      try {
        console.log('🔄 Trying direct API call as fallback...');
        
        const response = await fetch(`http://localhost:8085/api/v1/notifications/user/${userId}?page=0&size=10`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('📬 Backend notifications response (fallback):', data);
          
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
            
            console.log(`✅ Loaded ${data.data.notifications.length} backend notifications (fallback)`);
          } else {
            console.log('📭 No backend notifications found (fallback)');
          }
        } else {
          console.error('❌ Fallback API call also failed:', response.status);
        }
        
      } catch (fallbackError) {
        console.error('❌ Fallback API call error:', fallbackError);
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
        console.log('Notification permission granted. Token:', token);
        this.firebaseToken = token;
        this.notificationPermissionStatus = 'granted';
      })
      .catch(error => {
        console.error('Error requesting notification permission:', error);
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
      console.log('📧 Skipping message notification (shown in messages icon):', notificationType);
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
      console.log('📝 Notification already exists, skipping:', notificationId);
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
    
    console.log('📝 Added notification:', notificationObj.title);
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
        audio.addEventListener('error', (e) => {
          console.log('Notification sound could not be played:', e.error);
        });
        
        // Try to play and catch any errors
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log('Audio playback prevented by browser policy:', error);
          });
        }
      }
    } catch (error) {
      console.log('Notification sound not available');
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
      
      console.log('🔄 Marking notification as read - UI ID:', notification.id, 'Backend ID:', backendId);
      
      // Persist to backend using the correct ID format
      this.notificationService.markAsRead(backendId).subscribe({
        next: () => {
          console.log('✅ Notification marked as read in backend:', backendId);
        },
        error: (error) => {
          console.error('❌ Failed to mark notification as read in backend:', error);
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
        console.log('Notification modal dismissed');
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
          console.log('✅ All notifications marked as read in backend');
        },
        error: (error) => {
          console.error('❌ Failed to mark all notifications as read in backend:', error);
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
        error: (error) => {
          console.error('Error fetching user profile:', error);
          this.userService.refreshToken$()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (refreshResponse) => {
                if (refreshResponse && refreshResponse.data && refreshResponse.data.user) {
                  this.userService.setUserData(refreshResponse.data.user);
                  this.cdr.detectChanges();
                }
              },
              error: (refreshError) => {
                console.error('Error refreshing token:', refreshError);
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
   * Detect user role and load messages accordingly
   */
  private detectUserRoleAndLoadMessages(): void {
    this.userService.userData$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      if (user) {
        // Check if user has ROLE_CLIENT
        this.isClientUser = user.roleName === 'ROLE_CLIENT' ||
                            user.roles?.some((role: string) => role === 'ROLE_CLIENT') || false;

        // Load messages based on user type
        this.loadUnreadMessageCount();
        this.loadMessageThreads();
        this.initMessageWebSocket();

        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Load unread message count from appropriate service
   */
  private loadUnreadMessageCount(): void {
    if (this.isClientUser) {
      // For clients, get unread count from dashboard or calculate from threads
      this.clientPortalService.getMessageThreads()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (threads) => {
            this.unreadMessageCount = threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error loading client unread message count:', err);
          }
        });
    } else {
      // For attorneys
      this.messagingService.getUnreadCount()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (count) => {
            this.unreadMessageCount = count;
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error loading unread message count:', err);
          }
        });
    }
  }

  /**
   * Load message threads for dropdown
   */
  private loadMessageThreads(): void {
    this.loadingMessages = true;

    if (this.isClientUser) {
      // For clients
      this.clientPortalService.getMessageThreads()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (threads) => {
            this.clientMessageThreads = threads
              .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
              .slice(0, 5);
            this.loadingMessages = false;
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error loading client message threads:', err);
            this.loadingMessages = false;
            this.cdr.detectChanges();
          }
        });
    } else {
      // For attorneys
      this.messagingService.getThreads()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (threads) => {
            this.messageThreads = threads
              .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
              .slice(0, 5);
            this.loadingMessages = false;
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error loading message threads:', err);
            this.loadingMessages = false;
            this.cdr.detectChanges();
          }
        });
    }
  }

  /**
   * Initialize WebSocket for real-time message notifications
   */
  private initMessageWebSocket(): void {
    const token = localStorage.getItem(Key.TOKEN);
    if (token) {
      this.webSocketService.connect(token);

      this.webSocketService.getMessages()
        .pipe(takeUntil(this.destroy$))
        .subscribe(msg => {
          if (msg.type === 'notification' && msg.data?.type === 'NEW_MESSAGE') {
            // Increment unread count when new message arrives
            this.unreadMessageCount++;
            // Refresh threads to show the new message
            this.loadMessageThreads();
            this.cdr.detectChanges();
          }
        });
    }
  }

  /**
   * Handle message dropdown toggle
   */
  onMessageDropdownToggle(isOpen: boolean): void {
    if (isOpen) {
      // Refresh threads when dropdown opens
      this.loadMessageThreads();
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
   * Get display threads based on user type
   */
  getDisplayThreads(): any[] {
    return this.isClientUser ? this.clientMessageThreads : this.messageThreads;
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
      // For clients, show "Attorney" or the attorney name
      return thread.lastSenderName || 'Attorney';
    } else {
      // For attorneys, show client name
      return thread.clientName || 'Client';
    }
  }
}
