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
import { CaseAssignmentService } from 'src/app/service/case-assignment.service';
import { CaseTaskService } from 'src/app/service/case-task.service';
import { CaseAssignment } from 'src/app/interface/case-assignment';

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
  @ViewChild('notificationDropdown') notificationDropdown!: NgbDropdown;
  
  // Case Management Properties
  pendingAssignments = 0;
  myCasesCount = 0;
  myTasksCount = 0;
  teamWorkloadPercentage = 0;
  recentAssignments: any[] = [];

  constructor(@Inject(DOCUMENT) private document: any,   private modalService: NgbModal,
    public _cookiesService: CookieService, private userService: UserService, private notificationService: NotificationService,
    private router: Router, private cdr: ChangeDetectorRef, private pushNotificationService: PushNotificationService,
    private caseAssignmentService: CaseAssignmentService, private caseTaskService: CaseTaskService) {
      
     }

  ngOnInit(): void {
    // Initialize user data
    this.user$ = this.userService.userData$;
    
    // Load user data if authenticated
    if (this.userService.isAuthenticated()) {
      this.loadUserData();
    }
    
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

    // Subscribe to router events to refresh user data
    this.router.events.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.userService.refreshUserData();
      }
    });
    
    // Initialize push notifications
    this.initializePushNotifications();
    
    // Initialize unread notification count
    this.updateUnreadCount();
    
    // Initialize dropdown component with a small delay to ensure proper rendering
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 100);
    
    // Load case management data
    this.loadCaseManagementData();
  }
  
  /**
   * Load case management data for dropdown
   */
  private loadCaseManagementData(): void {
    // Skip if user not authenticated
    if (!this.userService.isAuthenticated()) return;
    
    this.userService.userData$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      if (!user) return;
      
      // Load user's case assignments
      this.caseAssignmentService.getUserAssignments(user.id, 0, 10)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.data) {
              // Handle paginated response
              const data = response.data as any;
              const assignments = data.content ? data.content : 
                                 Array.isArray(data) ? data : [];
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
              }
            }
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error loading case assignments:', error);
          }
        });
      
      // Load user's workload
      this.caseAssignmentService.calculateUserWorkload(user.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.data) {
              this.teamWorkloadPercentage = Math.round(response.data.capacityPercentage || 0);
            }
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error loading workload:', error);
          }
        });
      
      // Load active tasks count
      this.caseTaskService.getUserTasks(user.id, { page: 0, size: 100 })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.data) {
              const data = response.data as any;
              const tasks = data.content ? data.content : 
                           Array.isArray(data) ? data : [];
              if (tasks.length > 0) {
                this.myTasksCount = tasks.filter((task: any) => 
                  task.status !== 'COMPLETED' && task.status !== 'CANCELLED'
                ).length;
              }
            }
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error loading tasks:', error);
          }
        });
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
   * Request permission for push notifications
   */
  requestNotificationPermission(): void {
    this.pushNotificationService.requestPermission()
      .then(token => {
        console.log('Notification permission granted. Token:', token);
        this.firebaseToken = token;
      })
      .catch(error => {
        console.error('Error requesting notification permission:', error);
      });
  }
  
  /**
   * Add a notification to the list
   */
  private addNotification(notification: any): void {
    // Create a notification object
    const notificationObj = {
      id: Date.now().toString(),
      title: notification.notification?.title || 'New Notification',
      body: notification.notification?.body || '',
      timestamp: new Date(),
      read: false,
      data: notification.data || {},
      type: notification.data?.type || 'default'
    };
    
    // Add to the beginning of the list
    this.pushNotifications = [notificationObj, ...this.pushNotifications.slice(0, 19)];
    
    // Update unread count
    this.updateUnreadCount();
    
    // Trigger bell animation
    this.triggerBellAnimation();
    
    // Force UI update
    this.cdr.detectChanges();
    
    // Try to play notification sound
    this.playNotificationSound();
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
    
    // Mark notification as read
    notification.read = true;
    
    // Update unread count
    this.updateUnreadCount();
    
    // Force update UI
    this.cdr.detectChanges();
    
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
    
    this.pushNotifications = this.pushNotifications.map(notification => ({
      ...notification,
      read: true
    }));
    
    this.hasNewNotifications = false;
    this.unreadNotificationCount = 0;
    this.cdr.markForCheck();
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
}
