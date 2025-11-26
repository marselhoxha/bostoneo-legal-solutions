import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { AuditService, AuditActivity } from '../../service/audit.service';
import { UserService } from '../../service/user.service';

@Component({
  selector: 'app-activities',
  templateUrl: './activities.component.html',
  styleUrls: ['./activities.component.css']
})
export class ActivitiesComponent implements OnInit, OnDestroy, AfterViewInit {

  activities: AuditActivity[] = [];
  filteredActivities: AuditActivity[] = [];
  loading: boolean = false;
  
  // Pagination
  currentPage: number = 0;
  pageSize: number = 10; // Show 10 entries per page
  totalElements: number = 0;
  totalPages: number = 0;
  
  // Filters
  selectedAction: string = '';
  selectedEntityType: string = '';
  selectedUser: string = '';
  dateRange: { start: Date | null, end: Date | null } = { start: null, end: null };
  searchTerm: string = '';
  
  // Filter options - Updated to match backend AuditAction enum (no VIEW)
  actionOptions: string[] = [
    'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 
    'UPLOAD', 'DOWNLOAD', 'APPROVE', 'REJECT', 'SUBMIT', 
    'ASSIGN', 'UNASSIGN', 'ARCHIVE', 'RESTORE'
  ];
  entityTypeOptions: string[] = [
    'CLIENT', 'CASE', 'LEGAL_CASE', 'DOCUMENT', 'INVOICE', 'USER', 
    'APPOINTMENT', 'PAYMENT', 'EXPENSE', 'ROLE', 
    'PERMISSION', 'EMAIL', 'CALENDAR_EVENT'
  ];
  
  // Statistics
  statistics: any = null;
  activityCounts: any = null;
  lastUpdated: Date = new Date();

  // Theme and UI properties
  isDarkMode: boolean = false;

  private destroy$ = new Subject<void>();
  
  constructor(
    public auditService: AuditService,
    private userService: UserService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    // Initialize with safe default values immediately
    this.statistics = { activeUsersToday: 0 };
    this.activityCounts = { total: 0, today: 0, week: 0 };
    this.activities = [];
    this.filteredActivities = [];
    
    // Ensure loading states start as false
    this.loading = false;
  }

  ngOnInit(): void {
    console.log('🚀 ActivitiesComponent initialized');
    
    // Initialize component state
    this.initializeComponentState();
    
    // Load initial data
    this.loadDataSimply();
    
    // Detect dark mode
    this.detectDarkMode();
    
    // Set up any listeners or subscriptions here
    console.log('✅ Component initialization completed');
  }

  private initializeComponentState(): void {
    console.log('🔧 Initializing component state');
    
    // Ensure clean initial state
    this.setLoading(false);
    this.activities = [];
    this.filteredActivities = [];
    this.currentPage = 0;
    this.pageSize = 10;
    this.totalElements = 0;
    this.totalPages = 0;
    
    // Clear filters
    this.selectedAction = '';
    this.selectedEntityType = '';
    this.selectedUser = '';
    this.searchTerm = '';
    this.dateRange = { start: null, end: null };
    
    // Initialize stats with default values (not null)
    this.statistics = { activeUsersToday: 0 };
    this.activityCounts = { total: 0, today: 0, week: 0 };
    this.lastUpdated = new Date();
    
    console.log('✅ Component state initialized');
  }

  private loadDataSimply(): void {
    console.log('📑 Loading data with simple approach');
    
    // Load activities with proper error handling and loading state management
    this.setLoading(true);
    
    // Safety timeout to ensure loading never gets stuck
    const loadingTimeout = setTimeout(() => {
      if (this.loading) {
        console.warn('🚨 Loading timeout: Force resetting loading state');
        this.setLoading(false);
      }
    }, 5000); // Reduced to 5 seconds for faster reset
    
    this.auditService.getActivitiesForPage$(50)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('📨 Response received in component');
          try {
            if (response?.data?.activities) {
              this.activities = this.transformActivities(response.data.activities);
              this.totalElements = response.data.totalCount || 0;
              this.applyFilters();
              console.log(`✅ Loaded ${this.activities.length} activities`);
            } else {
              console.warn('⚠️ No activities data in response:', response);
              this.activities = [];
              this.filteredActivities = [];
              this.totalElements = 0;
            }
            
            // Force loading state reset here
            this.setLoading(false);
            
          } catch (error) {
            console.error('❌ Error processing activities data:', error);
            this.activities = [];
            this.filteredActivities = [];
            this.totalElements = 0;
            this.setLoading(false);
          }
        },
        error: (error) => {
          console.error('❌ Error loading initial activities:', error);
          this.activities = [];
          this.filteredActivities = [];
          this.totalElements = 0;
          this.setLoading(false);
          clearTimeout(loadingTimeout);
        },
        complete: () => {
          this.setLoading(false);
          clearTimeout(loadingTimeout);
          console.log('✅ Initial data loading completed');
          
          // Additional safety check - force UI update
          setTimeout(() => {
            if (this.loading) {
              console.warn('🚨 Loading still true after complete - forcing false');
              this.setLoading(false);
            }
          }, 100);
        }
      });
    
    // Load statistics (no loading state - just load in background)
    this.auditService.getActivityStatistics$()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.statistics = response?.data?.statistics || { activeUsersToday: 0 };
          console.log('📈 Statistics loaded:', this.statistics);
          this.changeDetectorRef.detectChanges();
        },
        error: (error) => {
          console.error('❌ Error loading statistics:', error);
          this.statistics = { activeUsersToday: 0 };
          this.changeDetectorRef.detectChanges();
        }
      });
    
    // Load activity counts (no loading state - just load in background)
    this.auditService.getActivityCounts$()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.activityCounts = response?.data || { total: 0, today: 0, week: 0 };
          console.log('🔢 Activity counts loaded:', this.activityCounts);
          this.changeDetectorRef.detectChanges();
        },
        error: (error) => {
          console.error('❌ Error loading activity counts:', error);
          this.activityCounts = { total: 0, today: 0, week: 0 };
          this.changeDetectorRef.detectChanges();
        }
      });
  }

  ngAfterViewInit(): void {
    console.log('🎨 ActivitiesComponent view initialized');
    
    // Force change detection to ensure statistics are displayed immediately
    this.changeDetectorRef.detectChanges();
  }

  ngOnDestroy(): void {
    console.log('🛑 ActivitiesComponent destroyed');
    this.destroy$.next();
    this.destroy$.complete();
  }

  private handleActivitiesResponse(data: any): void {
    this.activities = this.transformActivities(data.activities || []);
    this.totalElements = data.totalElements || 0;
    this.totalPages = data.totalPages || 0;
    this.applyFilters();
  }

  // Redirect to simple loading method
  loadActivities(): void {
    console.warn('🔄 Redirecting to simple loading method');
    this.loadDataSimply();
  }

  private transformActivities(activities: any[]): AuditActivity[] {
    if (!activities || !Array.isArray(activities)) {
      console.warn('⚠️ Invalid activities data received:', activities);
      return [];
    }
    
    const now = new Date();
    const currentYear = now.getFullYear();
    
    return activities.map((activity, index) => {
      let originalTimestamp = activity.timestamp;
      let timestamp = new Date(originalTimestamp);
      
      // Validate timestamp and check for future dates or wrong years
      if (isNaN(timestamp.getTime())) {
        console.warn('⚠️ Invalid timestamp, using current time:', originalTimestamp);
        timestamp = new Date();
      } else if (timestamp > new Date()) {
        const futureMinutes = Math.floor((timestamp.getTime() - new Date().getTime()) / (1000 * 60));
        
        // Only log significant future timestamps (more than 30 minutes) to reduce noise
        if (futureMinutes > 30) {
          console.warn('🚨 Significant future timestamp detected:', {
            activityId: activity.id,
            futureByMinutes: futureMinutes,
            description: activity.description?.substring(0, 50) + '...'
          });
        }
        
        // Only correct significantly future timestamps (more than 15 minutes)
        if (futureMinutes > 15) {
          // Estimate real timestamp based on activity order (newer activities first)
          const estimatedMinutesAgo = index * 2; // 2 minutes between activities
          timestamp = new Date(now.getTime() - (estimatedMinutesAgo * 60 * 1000));
        }
        // For smaller future timestamps (1-15 minutes), leave them as-is
        // The display logic will handle them gracefully
      } else if (timestamp.getFullYear() !== currentYear) {
        // Only log if the year is significantly off (not just next year)
        if (Math.abs(timestamp.getFullYear() - currentYear) > 1) {
          console.warn('🚨 Wrong year timestamp detected:', {
            activityId: activity.id,
            year: timestamp.getFullYear(),
            currentYear: currentYear
          });
        }
        
        // Estimate real timestamp based on activity order (newer activities first)
        const estimatedMinutesAgo = index * 5; // 5 minutes between activities
        timestamp = new Date(now.getTime() - (estimatedMinutesAgo * 60 * 1000));
      }
      
      return {
        id: activity.id || `activity-${Date.now()}-${Math.random()}`,
        userId: activity.userId || 0,
        action: activity.action,
        entityType: activity.entityType,
        entityId: activity.entityId || 0,
        description: activity.description,
        metadata: activity.metadata,
        timestamp: timestamp,
        ipAddress: activity.ipAddress,
        userAgent: activity.userAgent,
        userName: activity.userName || activity.userFirstName + ' ' + activity.userLastName,
        userEmail: activity.userEmail,
        formattedTimestamp: this.formatTimestamp(timestamp),
        actionDisplayName: this.auditService.getActionDisplayName(activity.action),
        entityDisplayName: this.auditService.getEntityDisplayName(activity.entityType)
      };
    });
  }

  refreshActivities(): void {
    // Simple refresh that doesn't get stuck
    if (!this.loading) {
      this.loadDataSimply();
    }
  }

  manualRefreshActivities(refreshAll: boolean = false): void {
    if (this.loading) {
      console.log('⚠️ Already loading, skipping refresh');
      return;
    }
    
    console.log('🔄 Manual refresh triggered');
    
    // Set loading state for refresh button spinner
    this.setLoading(true);
    
    // Safety timeout to ensure loading state is reset
    const safetyTimeout = setTimeout(() => {
      if (this.loading) {
        console.warn('🚨 Safety timeout: Resetting stuck loading state');
        this.setLoading(false);
      }
    }, 8000); // 8 second safety timeout for manual refresh
    
    // Load activities directly without delay
    this.auditService.getActivitiesForPage$(50)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          try {
            if (response?.data?.activities) {
              this.activities = this.transformActivities(response.data.activities);
              this.totalElements = response.data.totalCount || 0;
              this.applyFilters();
              console.log(`🔄 Refresh completed: ${this.activities.length} activities loaded`);
            } else {
              console.warn('⚠️ No activities data in refresh response');
              this.activities = [];
              this.filteredActivities = [];
            }
            this.lastUpdated = new Date();
          } catch (error) {
            console.error('❌ Error processing refresh data:', error);
            this.activities = [];
            this.filteredActivities = [];
          }
        },
        error: (error) => {
          console.error('❌ Error during manual refresh:', error);
          this.activities = [];
          this.filteredActivities = [];
          // Force reset loading state on error
          this.setLoading(false);
          clearTimeout(safetyTimeout);
        },
        complete: () => {
          this.setLoading(false);
          clearTimeout(safetyTimeout);
          console.log('✅ Manual refresh completed');
        }
      });
  }

  applyFilters(): void {
    let filtered = [...this.activities];

    // Apply search term filter
    if (this.searchTerm && this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(activity =>
        activity.userName?.toLowerCase().includes(searchLower) ||
        activity.description?.toLowerCase().includes(searchLower) ||
        activity.action?.toLowerCase().includes(searchLower) ||
        activity.entityType?.toLowerCase().includes(searchLower)
      );
    }

    // Apply action filter
    if (this.selectedAction) {
      filtered = filtered.filter(activity => activity.action === this.selectedAction);
    }

    // Apply entity type filter
    if (this.selectedEntityType) {
      filtered = filtered.filter(activity => activity.entityType === this.selectedEntityType);
    }

    // Apply user filter
    if (this.selectedUser && this.selectedUser.trim()) {
      const userLower = this.selectedUser.toLowerCase().trim();
      filtered = filtered.filter(activity =>
        activity.userName?.toLowerCase().includes(userLower)
      );
    }

    this.filteredActivities = filtered;
    this.totalPages = Math.ceil(this.filteredActivities.length / this.pageSize);
    
    // Reset to first page when filters change
    this.currentPage = 0;
    
    console.log(`🔍 Applied filters: ${this.activities.length} → ${this.filteredActivities.length} activities`);
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
  }

  onPageSizeChange(): void {
    this.currentPage = 0;
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedAction = '';
    this.selectedEntityType = '';
    this.selectedUser = '';
    this.dateRange = { start: null, end: null };
    this.applyFilters();
  }

  hasDateRange(): boolean {
    return this.dateRange.start !== null && this.dateRange.end !== null;
  }

  getActivityIcon(action: string): string {
    const iconMap: { [key: string]: string } = {
      'CREATE': 'ri-add-circle-line',
      'UPDATE': 'ri-edit-circle-line', 
      'DELETE': 'ri-delete-bin-line',
      'LOGIN': 'ri-login-circle-line',
      'LOGOUT': 'ri-logout-circle-line',
      'UPLOAD': 'ri-upload-cloud-line',
      'DOWNLOAD': 'ri-download-cloud-line',
      'APPROVE': 'ri-checkbox-circle-line',
      'REJECT': 'ri-close-circle-line',
      'ASSIGN': 'ri-user-add-line',
      'COMPLETE': 'ri-check-double-line'
    };
    return iconMap[action] || 'ri-information-line';
  }

  getActivityBadgeClass(action: string): string {
    const badgeMap: { [key: string]: string } = {
      'CREATE': 'bg-success-subtle text-success',
      'UPDATE': 'bg-warning-subtle text-warning',
      'DELETE': 'bg-danger-subtle text-danger',
      'LOGIN': 'bg-primary-subtle text-primary',
      'LOGOUT': 'bg-secondary-subtle text-secondary',
      'UPLOAD': 'bg-success-subtle text-success',
      'DOWNLOAD': 'bg-primary-subtle text-primary',
      'APPROVE': 'bg-success-subtle text-success',
      'REJECT': 'bg-danger-subtle text-danger',
      'ASSIGN': 'bg-info-subtle text-info',
      'COMPLETE': 'bg-success-subtle text-success'
    };
    return badgeMap[action] || 'bg-light text-muted';
  }

  formatTimestamp(timestamp: string | Date): string {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleString();
  }

  formatDate(timestamp: string | Date): string {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    // For very recent activities, show time ago
    if (diffInMinutes < 60) {
      return this.getTimeAgo(timestamp);
    }
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    if (targetDate.getTime() === today.getTime()) {
      return `Today ${timeStr}`;
    } else if (targetDate.getTime() === yesterday.getTime()) {
      return `Yesterday ${timeStr}`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  }

  getTimeAgo(timestamp: Date | string): string {
    const now = new Date();
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    // Only log significant time differences (more than 7 days) for debugging
    if (Math.abs(diffInSeconds) > 604800) { // 7 days
      console.log('🕐 Large time difference detected:', {
        diffInSeconds: diffInSeconds,
        days: Math.floor(Math.abs(diffInSeconds) / 86400),
        isFuture: diffInSeconds < 0
      });
    }
    
    // Handle future timestamps (likely due to server clock issues)
    if (diffInSeconds < 0) {
      const absDiff = Math.abs(diffInSeconds);
      
      // If it's only slightly in the future (less than 15 minutes), treat as recent
      if (absDiff < 900) { // 15 minutes
        // For very small differences (< 2 minutes), show as "moments ago"
        if (absDiff < 120) {
          return 'moments ago';
        }
        // For slightly larger differences, show the actual time difference
        const minutes = Math.floor(absDiff / 60);
        return `${minutes}m ago`;
      }
      
      // For larger future differences, show as if it happened in the past
      // This handles server clock sync issues
      if (absDiff < 60) return `${absDiff}s ago`;
      if (absDiff < 3600) return `${Math.floor(absDiff / 60)}m ago`;
      if (absDiff < 86400) return `${Math.floor(absDiff / 3600)}h ago`;
      return `${Math.floor(absDiff / 86400)}d ago`;
    }
    
    // Handle edge case for very recent activities
    if (diffInSeconds <= 10) return 'just now';
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  getUserInitials(userName: string | null | undefined): string {
    if (!userName) return 'SY'; // System
    
    const names = userName.trim().split(' ');
    if (names.length >= 2) {
      return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    }
    return userName.substring(0, 2).toUpperCase();
  }

  exportActivities(): void {
    // TODO: Implement export functionality
    console.log('Exporting activities...');
  }

  viewActivityDetails(activity: AuditActivity): void {
    // TODO: Open modal with detailed view
    console.log('View details for:', activity);
  }

  trackByActivityId(index: number, activity: AuditActivity): string {
    return activity.id;
  }

  // Make Math available in template
  Math = Math;

  // Test method to verify timestamp functionality - can be called from console
  testTimestamps(): void {
    const now = new Date();
    const testCases = [
      new Date(now.getTime() - 5000), // 5 seconds ago
      new Date(now.getTime() - 30000), // 30 seconds ago
      new Date(now.getTime() - 120000), // 2 minutes ago
      new Date(now.getTime() - 3600000), // 1 hour ago
      new Date(now.getTime() - 86400000), // 1 day ago
    ];
    
    testCases.forEach((testDate, index) => {
      console.log(`Test ${index + 1}:`, {
        timestamp: testDate,
        result: this.getTimeAgo(testDate),
        secondsAgo: Math.floor((now.getTime() - testDate.getTime()) / 1000)
      });
    });
  }

  /**
   * Comprehensive timestamp debugging to identify exact discrepancies
   */
  debugTimestamps(): void {
    console.log('🔍 Starting comprehensive timestamp debugging...');
    
    const frontendNow = new Date();
    console.log('🖥️ Frontend current time:', frontendNow.toString());
    console.log('🖥️ Frontend timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('🖥️ Frontend timestamp:', frontendNow.getTime());
    
    // Test the backend time endpoint
    fetch('http://localhost:8080/api/audit/debug/time', {
      headers: {
        'Authorization': 'Bearer fake-token',
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then(data => {
      console.log('🚀 Backend time debug response:', data);
      
      if (data.data) {
        const backendTime = new Date(data.data.serverLocalDateTime);
        const backendTimestamp = data.data.serverTimestamp;
        
        console.log('📑 Time Comparison:');
        console.log('  Frontend time:', frontendNow.toString());
        console.log('  Backend time: ', backendTime.toString());
        console.log('  Time difference (seconds):', Math.floor((frontendNow.getTime() - backendTime.getTime()) / 1000));
        console.log('  Backend timezone:', data.data.serverTimezone);
        console.log('  Backend EST time:', data.data.serverEST);
        
        // Test with recent activities
        this.debugRecentActivities(frontendNow, backendTime);
      }
    })
    .catch(error => {
      console.error('❌ Failed to fetch backend time:', error);
    });
  }

  private debugRecentActivities(frontendNow: Date, backendTime: Date): void {
    console.log('🔍 Debugging recent activities timestamps...');
    
    this.auditService.getActivitiesForPage$(5).subscribe({
      next: (response) => {
        if (response?.data?.activities) {
          console.log('📋 Recent activities timestamp analysis:');
          
          response.data.activities.slice(0, 3).forEach((activity, index) => {
            const activityTime = new Date(activity.timestamp);
            const frontendDiff = Math.floor((frontendNow.getTime() - activityTime.getTime()) / 1000);
            const backendDiff = Math.floor((backendTime.getTime() - activityTime.getTime()) / 1000);
            
            console.log(`  Activity ${index + 1}:`, {
              id: activity.id,
              description: activity.description,
              originalTimestamp: activity.timestamp,
              parsedTime: activityTime.toString(),
              frontendDiffSeconds: frontendDiff,
              backendDiffSeconds: backendDiff,
              frontendTimeAgo: this.getTimeAgo(activityTime),
              isFuture: frontendDiff < 0,
              hoursOffset: Math.round(frontendDiff / 3600)
            });
          });
        }
      },
      error: (error) => {
        console.error('❌ Failed to fetch activities for debugging:', error);
      }
    });
  }

  /**
   * Test the timestamp creation on backend
   */
  testBackendTimestampCreation(): void {
    console.log('🧪 Testing backend timestamp creation...');
    
    fetch('http://localhost:8080/api/audit/activities/test', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake-token',
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then(data => {
      console.log('✅ Test audit entries created:', data);
      // Refresh activities after a short delay to see the new entries
      setTimeout(() => {
        this.manualRefreshActivities();
        this.debugTimestamps();
      }, 2000);
    })
    .catch(error => {
      console.error('❌ Failed to create test audit entries:', error);
    });
  }

  /**
   * Get the current time formatted for display
   */
  getLastUpdateTime(): string {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    });
  }

  /**
   * Detect the current dark mode setting
   */
  detectDarkMode(): void {
    // Check if theme is stored in localStorage
    const savedTheme = localStorage.getItem('data-layout-mode');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
      return;
    }

    // Check body data attribute
    const bodyTheme = document.body.getAttribute('data-layout-mode');
    if (bodyTheme) {
      this.isDarkMode = bodyTheme === 'dark';
      return;
    }

    // Default to system preference
    this.isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * Get timeline dot class based on activity action
   */
  getTimelineDotClass(action: string): string {
    const classMap: { [key: string]: string } = {
      'CREATE': 'timeline-dot-create',
      'UPDATE': 'timeline-dot-update',
      'DELETE': 'timeline-dot-delete',
      'LOGIN': 'timeline-dot-login',
      'LOGOUT': 'timeline-dot-login',
      'UPLOAD': 'timeline-dot-create',
      'DOWNLOAD': 'timeline-dot-view',
      'APPROVE': 'timeline-dot-create',
      'REJECT': 'timeline-dot-delete'
    };
    return classMap[action] || 'timeline-dot-default';
  }

  /**
   * Get activity card class based on action
   */
  getActivityCardClass(action: string): string {
    const classMap: { [key: string]: string } = {
      'CREATE': 'activity-card-create',
      'UPDATE': 'activity-card-update',
      'DELETE': 'activity-card-delete',
      'LOGIN': 'activity-card-login',
      'LOGOUT': 'activity-card-login',
      'UPLOAD': 'activity-card-create',
      'DOWNLOAD': 'activity-card-view',
      'APPROVE': 'activity-card-create',
      'REJECT': 'activity-card-delete'
    };
    return classMap[action] || 'activity-card-default';
  }

  /**
   * Get user avatar class based on action
   */
  getUserAvatarClass(action: string): string {
    const classMap: { [key: string]: string } = {
      'CREATE': 'avatar-create',
      'UPDATE': 'avatar-update',
      'DELETE': 'avatar-delete',
      'LOGIN': 'avatar-login',
      'LOGOUT': 'avatar-login',
      'UPLOAD': 'avatar-create',
      'DOWNLOAD': 'avatar-view',
      'APPROVE': 'avatar-create',
      'REJECT': 'avatar-delete'
    };
    return classMap[action] || 'avatar-default';
  }

  /**
   * Get action verb for timeline display
   */
  getActionVerb(action: string): string {
    const verbMap: { [key: string]: string } = {
      'CREATE': 'created',
      'UPDATE': 'updated',
      'DELETE': 'deleted',
      'LOGIN': 'logged into',
      'LOGOUT': 'logged out of',
      'UPLOAD': 'uploaded',
      'DOWNLOAD': 'downloaded',
      'APPROVE': 'approved',
      'REJECT': 'rejected',
      'ASSIGN': 'assigned',
      'COMPLETE': 'completed'
    };
    return verbMap[action] || 'performed action on';
  }

  /**
   * Get browser info from user agent
   */
  getBrowserInfo(userAgent: string): string {
    if (!userAgent) return 'Unknown Device';
    
    if (userAgent.includes('Chrome')) return 'Chrome Browser';
    if (userAgent.includes('Firefox')) return 'Firefox Browser';
    if (userAgent.includes('Safari')) return 'Safari Browser';
    if (userAgent.includes('Edge')) return 'Edge Browser';
    if (userAgent.includes('Mobile')) return 'Mobile Device';
    
    return 'Desktop Browser';
  }

  /**
   * Load more activities (placeholder for pagination)
   */
  loadMoreActivities(): void {
    // TODO: Implement pagination functionality
    console.log('Loading more activities...');
    this.currentPage++;
    this.loadDataSimply();
  }

  // Enhanced table display methods
  getTimestampBadgeClass(timestamp: Date | string): string {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInMinutes = (now.getTime() - activityTime.getTime()) / (1000 * 60);
    
    if (diffInMinutes < 5) {
      return 'timestamp-recent';
    } else if (diffInMinutes < 60) {
      return 'timestamp-hour';
    } else if (diffInMinutes < 1440) {
      return 'timestamp-today';
    } else {
      return 'timestamp-older';
    }
  }

  getUserStatusClass(action: string): string {
    switch (action.toLowerCase()) {
      case 'login':
        return 'status-online';
      case 'logout':
        return 'status-offline';
      case 'create':
      case 'update':
        return 'status-active';
      default:
        return 'status-normal';
    }
  }

  getUserRoleBadgeClass(userName: string | null | undefined): string {
    if (!userName || userName === 'System') {
      return 'role-system';
    }
    // You can extend this based on actual user role data
    return 'role-user';
  }

  getActionIconWrapperClass(action: string): string {
    return `action-${action.toLowerCase()}`;
  }

  getActionBackgroundColor(action: string): string {
    switch (action?.toUpperCase()) {
      case 'CREATE': return 'var(--vz-success)';
      case 'UPDATE': return 'var(--vz-warning)';
      case 'DELETE': return 'var(--vz-danger)';
      case 'LOGIN':
      case 'LOGOUT': return 'var(--vz-primary)';
      case 'UPLOAD': return 'var(--vz-success)';
      case 'DOWNLOAD': return 'var(--vz-primary)';
      case 'APPROVE': return 'var(--vz-success)';
      case 'REJECT': return 'var(--vz-danger)';
      default: return 'var(--vz-secondary)';
    }
  }

  getActionCategory(action: string): string {
    switch (action.toLowerCase()) {
      case 'create':
        return 'Data Creation';
      case 'update':
        return 'Data Modification';
      case 'delete':
        return 'Data Removal';
      case 'login':
      case 'logout':
        return 'Authentication';
      case 'upload':
      case 'download':
        return 'File Operations';
      default:
        return 'System Operation';
    }
  }

  getEntityIcon(entityType: string): string {
    switch (entityType?.toUpperCase()) {
      case 'CLIENT': return 'ri-user-3-line';
      case 'CASE': return 'ri-briefcase-line';
      case 'LEGAL_CASE': return 'ri-briefcase-line';
      case 'DOCUMENT': return 'ri-file-text-line';
      case 'INVOICE': return 'ri-bill-line';
      case 'USER': return 'ri-team-line';
      case 'APPOINTMENT': return 'ri-calendar-event-line';
      case 'CONTRACT': return 'ri-file-paper-line';
      case 'REPORT': return 'ri-file-chart-line';
      default: return 'ri-file-list-line';
    }
  }

  // Quick filter methods for enhanced filter presets
  applyQuickFilter(filterType: string): void {
    this.clearFilters();
    
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    switch (filterType) {
      case 'today':
        this.dateRange.start = new Date(today.setHours(0, 0, 0, 0));
        this.dateRange.end = new Date(today.setHours(23, 59, 59, 999));
        break;
      case 'week':
        this.dateRange.start = startOfWeek;
        this.dateRange.end = today;
        break;
      case 'login':
        this.selectedAction = 'LOGIN';
        break;
      case 'create':
        this.selectedAction = 'CREATE';
        break;
      case 'delete':
        this.selectedAction = 'DELETE';
        break;
      default:
        console.warn('Unknown quick filter type:', filterType);
        return;
    }
    
    this.onFilterChange();
  }

  // Clear date range helper method
  clearDateRange(): void {
    this.dateRange = { start: null, end: null };
  }

  // Debug method to check loading state
  debugLoadingState(): void {
    console.log('🔍 Current component state:', {
      loading: this.loading,
      activitiesLength: this.activities.length,
      filteredActivitiesLength: this.filteredActivities.length,
      totalElements: this.totalElements,
      statistics: this.statistics,
      activityCounts: this.activityCounts,
      lastUpdated: this.lastUpdated
    });
  }

  // Method to force reset all loading states (for debugging)
  resetLoadingStates(): void {
    console.log('🔄 Forcing reset of all loading states');
    this.setLoading(false);
  }

  // Enhanced method to force stop loading if stuck
  forceStopLoading(): void {
    console.log('🛑 Force stopping loading state');
    this.setLoading(false);
  }

  // Emergency reset method (can be called from console: component.emergencyReset())
  emergencyReset(): void {
    console.log('🚨 Emergency reset triggered');
    this.setLoading(false);
    this.activities = [];
    this.filteredActivities = [];
    this.statistics = { activeUsersToday: 0 };
    this.activityCounts = { total: 0, today: 0, week: 0 };
    console.log('✅ Emergency reset completed');
  }

  // Clear all cache and force refresh (for testing clean audit system)
  clearCacheAndRefresh(): void {
    console.log('🧹 Clearing cache and refreshing activities');
    
    // Clear all local data
    this.activities = [];
    this.filteredActivities = [];
    this.statistics = null;
    this.activityCounts = null;
    this.currentPage = 0;
    this.totalElements = 0;
    this.totalPages = 0;
    
    // Clear any browser cache
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
        });
      });
    }
    
    // Force reload data
    this.loadDataSimply();
    
    console.log('✅ Cache cleared and data refreshed');
  }

  // Method to verify no VIEW activities exist
  verifyNoViewActivities(): void {
    console.log('🔍 Verifying no VIEW activities exist');
    
    const viewActivities = this.activities.filter(activity => 
      activity.action && activity.action.toUpperCase() === 'VIEW'
    );
    
    if (viewActivities.length > 0) {
      console.warn('⚠️ Found VIEW activities in frontend data:', viewActivities);
    } else {
      console.log('✅ No VIEW activities found - audit system clean!');
    }
    
    // Log all unique actions for verification
    const uniqueActions = [...new Set(this.activities.map(a => a.action))];
    console.log('📑 Current audit actions in frontend:', uniqueActions);
  }

  // Comprehensive debug method for infinite loading issues
  debugInfiniteLoading(): void {
    console.log('🐛 Debugging infinite loading issue');
    console.log('====================================');
    
    // Check component state
    console.log('📑 Component State:');
    console.log('  - Loading:', this.loading);
    console.log('  - Activities length:', this.activities.length);
    console.log('  - Filtered activities length:', this.filteredActivities.length);
    console.log('  - Total elements:', this.totalElements);
    console.log('  - Current page:', this.currentPage);
    console.log('  - Page size:', this.pageSize);
    
    // Check filters
    console.log('🔍 Filters:');
    console.log('  - Selected action:', this.selectedAction);
    console.log('  - Selected entity type:', this.selectedEntityType);
    console.log('  - Selected user:', this.selectedUser);
    console.log('  - Search term:', this.searchTerm);
    console.log('  - Date range:', this.dateRange);
    
    // Check statistics
    console.log('📈 Statistics:');
    console.log('  - Statistics:', this.statistics);
    console.log('  - Activity counts:', this.activityCounts);
    console.log('  - Last updated:', this.lastUpdated);
    
    // Test API call
    console.log('🌐 Testing API call...');
    this.auditService.getActivitiesForPage$(10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('✅ API Response received:', response);
          console.log('  - Response data:', response?.data);
          console.log('  - Activities count:', response?.data?.activities?.length);
        },
        error: (error) => {
          console.error('❌ API Error:', error);
          console.log('  - Error status:', error?.status);
          console.log('  - Error message:', error?.message);
          console.log('  - Error details:', error);
        },
        complete: () => {
          console.log('🔚 API call completed');
        }
      });
    
    console.log('====================================');
  }

  // Emergency fix for infinite loading
  emergencyStopLoading(): void {
    console.log('🚨 EMERGENCY: Stopping infinite loading');
    
    // Force reset all loading states
    this.setLoading(false);
    
    // Set fallback data if activities are empty
    if (this.activities.length === 0) {
      console.log('📝 Setting fallback message');
      this.activities = [];
      this.filteredActivities = [];
      this.totalElements = 0;
    }
    
    // Update last updated time
    this.lastUpdated = new Date();
    
    console.log('✅ Emergency stop completed');
    console.log('Current state - Loading:', this.loading, 'Activities:', this.activities.length);
  }

  // Quick fix method that can be called from console
  quickFix(): void {
    console.log('🔧 Quick fix for infinite loading');
    
    // Immediately stop loading
    this.setLoading(false);
    
    // Force change detection
    if (this.activities.length > 0) {
      this.applyFilters();
    }
    
    console.log('✅ Quick fix applied - Loading:', this.loading);
  }

  // Method to check current loading state
  checkLoadingState(): void {
    console.log('🔍 Current Loading State Check:');
    console.log('  - this.loading:', this.loading);
    console.log('  - activities.length:', this.activities.length);
    console.log('  - filteredActivities.length:', this.filteredActivities.length);
    
    if (this.loading && this.activities.length > 0) {
      console.warn('⚠️ ISSUE DETECTED: Loading is true but activities exist!');
      console.log('🔧 Auto-fixing...');
      this.setLoading(false);
      console.log('✅ Fixed - Loading state is now:', this.loading);
    }
  }

  // Simple method to set loading state and force UI update
  private setLoading(state: boolean): void {
    this.loading = state;
    this.changeDetectorRef.detectChanges();
    console.log('🔄 Loading set to:', state, '(with forced change detection)');
  }

  // Pagination helpers
  get paginatedActivities(): AuditActivity[] {
    const startIndex = this.currentPage * this.pageSize;
    return this.filteredActivities.slice(startIndex, startIndex + this.pageSize);
  }

  get hasPreviousPage(): boolean {
    return this.currentPage > 0;
  }

  get hasNextPage(): boolean {
    return (this.currentPage + 1) * this.pageSize < this.filteredActivities.length;
  }

  get pageInfo(): string {
    const start = this.currentPage * this.pageSize + 1;
    const end = Math.min((this.currentPage + 1) * this.pageSize, this.filteredActivities.length);
    return `${start}-${end} of ${this.filteredActivities.length}`;
  }

  // Pagination navigation
  goToPreviousPage(): void {
    if (this.hasPreviousPage) {
      this.currentPage--;
    }
  }

  goToNextPage(): void {
    if (this.hasNextPage) {
      this.currentPage++;
    }
  }

  goToFirstPage(): void {
    this.currentPage = 0;
  }

  goToLastPage(): void {
    this.currentPage = Math.max(0, Math.ceil(this.filteredActivities.length / this.pageSize) - 1);
  }
} 