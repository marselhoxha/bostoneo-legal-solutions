import { Component, OnInit, Input, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { NotificationPreferencesService } from '../../../../core/services/notification-preferences.service';
import { Subject, takeUntil, finalize } from 'rxjs';
import Swal from 'sweetalert2';

export interface NotificationPreference {
  id?: number;
  userId: number;
  eventType: string;
  enabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationCategory {
  name: string;
  description: string;
  icon: string;
  events: NotificationPreference[];
}

@Component({
  selector: 'app-notification-preferences',
  templateUrl: './notification-preferences.component.html',
  styleUrls: ['./notification-preferences.component.css']
})
export class NotificationPreferencesComponent implements OnInit, OnDestroy {
  @Input() userId!: number;
  @Input() userRole!: string;

  private destroy$ = new Subject<void>();
  
  isLoading = false;
  isSaving = false;
  preferences: NotificationPreference[] = [];
  categories: NotificationCategory[] = [];
  
  // Master toggles
  allNotificationsEnabled = true;
  allEmailEnabled = false;
  allPushEnabled = false;
  allInAppEnabled = true;

  constructor(
    private notificationPreferencesService: NotificationPreferencesService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.userId) {
      // Small delay to ensure proper initialization
      setTimeout(() => {
        this.loadPreferences();
      }, 100);
    } else {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPreferences(): void {
    this.isLoading = true;
    this.cdr.detectChanges(); // Force UI update for loading state
    
    this.notificationPreferencesService.getUserPreferences(this.userId)
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (preferences) => {
          // If no preferences exist, initialize with defaults
          if (!preferences || preferences.length === 0) {
            this.initializeDefaultPreferences();
          } else {
            this.preferences = preferences;
            // Check for missing notification types and add them
            this.addMissingNotificationTypes();
          }
          this.organizePreferencesIntoCategories();
          this.updateMasterToggles();
          this.isLoading = false;
          this.cdr.detectChanges(); // Force UI update
        },
        error: (error) => {
          console.error('Error loading notification preferences:', error);
          // Initialize with defaults on error
          this.initializeDefaultPreferences();
          this.organizePreferencesIntoCategories();
          this.updateMasterToggles();
          this.isLoading = false;
          this.cdr.detectChanges(); // Force UI update
        }
      });
  }

  private initializeDefaultPreferences(): void {
    const eventTypes = [
      'CASE_STATUS_CHANGED',
      'CASE_PRIORITY_CHANGED',
      'CASE_ASSIGNMENT_ADDED',
      'TASK_CREATED',
      'TASK_ASSIGNED',
      'TASK_STATUS_CHANGED',
      'TASK_DEADLINE_APPROACHING',
      'DOCUMENT_UPLOADED',
      'DOCUMENT_VERSION_UPDATED',
      'INVOICE_CREATED',
      'PAYMENT_RECEIVED',
      'EXPENSE_SUBMITTED',
      'LEAD_STATUS_CHANGED',
      'INTAKE_FORM_SUBMITTED',
      'CALENDAR_EVENT_CREATED',
      'SYSTEM_ISSUE'
    ];

    this.preferences = eventTypes.map(eventType => ({
      userId: this.userId,
      eventType: eventType,
      enabled: true,
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      priority: 'NORMAL' as 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
    }));
  }

  private addMissingNotificationTypes(): void {
    const allEventTypes = [
      'CASE_STATUS_CHANGED',
      'CASE_PRIORITY_CHANGED',
      'CASE_ASSIGNMENT_ADDED',
      'TASK_CREATED',
      'TASK_ASSIGNED',
      'TASK_STATUS_CHANGED',
      'TASK_DEADLINE_APPROACHING',
      'DOCUMENT_UPLOADED',
      'DOCUMENT_VERSION_UPDATED',
      'INVOICE_CREATED',
      'PAYMENT_RECEIVED',
      'EXPENSE_SUBMITTED',
      'LEAD_STATUS_CHANGED',
      'INTAKE_FORM_SUBMITTED',
      'CALENDAR_EVENT_CREATED',
      'SYSTEM_ISSUE'
    ];

    const existingEventTypes = this.preferences.map(p => p.eventType);
    const missingEventTypes = allEventTypes.filter(eventType => !existingEventTypes.includes(eventType));

    // Add missing notification types with default settings
    missingEventTypes.forEach(eventType => {
      this.preferences.push({
        userId: this.userId,
        eventType: eventType,
        enabled: true,
        emailEnabled: true,
        pushEnabled: true,
        inAppEnabled: true,
        priority: 'NORMAL' as 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
      });
    });

    console.log(`Added ${missingEventTypes.length} missing notification types:`, missingEventTypes);
  }

  organizePreferencesIntoCategories(): void {
    this.categories = [
      {
        name: 'Case Management',
        description: 'Notifications related to case activities and status changes',
        icon: 'ri-briefcase-line',
        events: this.preferences.filter(p => 
          ['CASE_STATUS_CHANGED', 'CASE_PRIORITY_CHANGED', 'CASE_ASSIGNMENT_ADDED'].includes(p.eventType)
        )
      },
      {
        name: 'Task Management',
        description: 'Notifications for task creation, updates, and deadlines',
        icon: 'ri-task-line',
        events: this.preferences.filter(p => 
          ['TASK_CREATED', 'TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'TASK_DEADLINE_APPROACHING'].includes(p.eventType)
        )
      },
      {
        name: 'Document Management',
        description: 'Notifications for document uploads and version updates',
        icon: 'ri-file-text-line',
        events: this.preferences.filter(p => 
          ['DOCUMENT_UPLOADED', 'DOCUMENT_VERSION_UPDATED'].includes(p.eventType)
        )
      },
      {
        name: 'Financial',
        description: 'Notifications for invoices, payments, and expenses',
        icon: 'ri-money-dollar-circle-line',
        events: this.preferences.filter(p => 
          ['INVOICE_CREATED', 'PAYMENT_RECEIVED', 'EXPENSE_SUBMITTED'].includes(p.eventType)
        )
      },
      {
        name: 'CRM & Leads',
        description: 'Notifications for lead management and client intake',
        icon: 'ri-customer-service-line',
        events: this.preferences.filter(p => 
          ['LEAD_STATUS_CHANGED', 'INTAKE_FORM_SUBMITTED'].includes(p.eventType)
        )
      },
      {
        name: 'Calendar & System',
        description: 'Notifications for calendar events and system issues',
        icon: 'ri-calendar-line',
        events: this.preferences.filter(p => 
          ['CALENDAR_EVENT_CREATED', 'SYSTEM_ISSUE'].includes(p.eventType)
        )
      }
    ];
  }

  updateMasterToggles(): void {
    if (this.preferences.length === 0) return;

    this.allNotificationsEnabled = this.preferences.every(p => p.enabled);
    this.allEmailEnabled = this.preferences.every(p => p.emailEnabled);
    this.allPushEnabled = this.preferences.every(p => p.pushEnabled);
    this.allInAppEnabled = this.preferences.every(p => p.inAppEnabled);
  }

  toggleAllNotifications(): void {
    this.allNotificationsEnabled = !this.allNotificationsEnabled;
    this.preferences.forEach(p => {
      p.enabled = this.allNotificationsEnabled;
      // If disabling all notifications, also disable email and in-app
      if (!this.allNotificationsEnabled) {
        p.emailEnabled = false;
        p.inAppEnabled = false;
      }
    });
    
    // Update master toggles
    if (!this.allNotificationsEnabled) {
      this.allEmailEnabled = false;
      this.allInAppEnabled = false;
    }
    
    this.organizePreferencesIntoCategories();
  }

  toggleAllEmail(): void {
    this.allEmailEnabled = !this.allEmailEnabled;
    this.preferences.forEach(p => p.emailEnabled = this.allEmailEnabled);
    this.organizePreferencesIntoCategories();
  }

  toggleAllPush(): void {
    this.allPushEnabled = !this.allPushEnabled;
    this.preferences.forEach(p => p.pushEnabled = this.allPushEnabled);
    this.organizePreferencesIntoCategories();
  }

  toggleAllInApp(): void {
    this.allInAppEnabled = !this.allInAppEnabled;
    this.preferences.forEach(p => p.inAppEnabled = this.allInAppEnabled);
    this.organizePreferencesIntoCategories();
  }

  updatePreference(preference: NotificationPreference, field: keyof NotificationPreference, value: any): void {
    (preference as any)[field] = value;
    this.updateMasterToggles();
  }

  toggleCategoryEnabled(category: NotificationCategory): void {
    const allEnabled = category.events.every(e => e.enabled);
    category.events.forEach(e => e.enabled = !allEnabled);
    this.updateMasterToggles();
  }

  isCategoryEnabled(category: NotificationCategory): boolean {
    return category.events.some(e => e.enabled);
  }

  areAllCategoryEventsEnabled(category: NotificationCategory): boolean {
    return category.events.length > 0 && category.events.every(e => e.enabled);
  }

  savePreferences(): void {
    // Prevent saving empty preferences
    if (!this.preferences || this.preferences.length === 0) {
      console.error('No preferences to save');
      Swal.fire({
        icon: 'warning',
        title: 'No Preferences',
        text: 'No notification preferences to save.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#0ab39c'
      });
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges(); // Force UI update for spinner

    this.notificationPreferencesService.updateUserPreferences(this.userId, this.preferences)
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (updatedPreferences) => {
          console.log('Preferences saved successfully:', updatedPreferences);
          this.preferences = updatedPreferences;
          this.organizePreferencesIntoCategories();
          this.isSaving = false; // Stop spinner on success
          this.cdr.detectChanges(); // Force UI update to remove spinner
          
          // Show success message with SweetAlert2
          Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: 'Notification preferences saved successfully!',
            confirmButtonText: 'OK',
            confirmButtonColor: '#0ab39c',
            timer: 2000,
            timerProgressBar: true
          });
        },
        error: (error) => {
          console.error('Error saving notification preferences:', error);
          this.isSaving = false; // Ensure spinner stops on error
          this.cdr.detectChanges(); // Force UI update to remove spinner
          
          // Show error message with SweetAlert2
          Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: 'Failed to save notification preferences. Please try again.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#f06548'
          });
        }
      });
  }

  resetToDefaults(): void {
    Swal.fire({
      title: 'Reset to Defaults?',
      text: 'Are you sure you want to reset all notification preferences to role-based defaults? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, reset!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading = true;

        this.notificationPreferencesService.resetToRoleDefaults(this.userId, this.userRole)
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => this.isLoading = false)
          )
          .subscribe({
            next: (preferences) => {
              this.preferences = preferences;
              this.organizePreferencesIntoCategories();
              this.updateMasterToggles();
              
              // Show success message
              Swal.fire({
                icon: 'success',
                title: 'Reset Complete!',
                text: 'Notification preferences have been reset to defaults.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#0ab39c',
                timer: 2000,
                timerProgressBar: true
              });
            },
            error: (error) => {
              console.error('Error resetting notification preferences:', error);
              
              // Show error message
              Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'Failed to reset notification preferences. Please try again.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#f06548'
              });
            }
          });
      }
    });
  }

  getEventDisplayName(eventType: string): string {
    const displayNames: { [key: string]: string } = {
      'CASE_STATUS_CHANGED': 'Case Status Changes',
      'CASE_PRIORITY_CHANGED': 'Case Priority Changes',
      'CASE_ASSIGNMENT_ADDED': 'Case Assignments',
      'TASK_CREATED': 'New Tasks',
      'TASK_ASSIGNED': 'Task Assignments',
      'TASK_STATUS_CHANGED': 'Task Status Updates',
      'TASK_DEADLINE_APPROACHING': 'Task Deadline Alerts',
      'DOCUMENT_UPLOADED': 'Document Uploads',
      'DOCUMENT_VERSION_UPDATED': 'Document Updates',
      'INVOICE_CREATED': 'New Invoices',
      'PAYMENT_RECEIVED': 'Payment Received',
      'EXPENSE_SUBMITTED': 'Expense Submissions',
      'LEAD_STATUS_CHANGED': 'Lead Status Changes',
      'INTAKE_FORM_SUBMITTED': 'New Intake Forms',
      'CALENDAR_EVENT_CREATED': 'Calendar Events',
      'SYSTEM_ISSUE': 'System Issues'
    };
    return displayNames[eventType] || eventType;
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'CRITICAL': return 'badge bg-danger';
      case 'HIGH': return 'badge bg-warning';
      case 'NORMAL': return 'badge bg-primary';
      case 'LOW': return 'badge bg-secondary';
      default: return 'badge bg-secondary';
    }
  }

  getPriorityDisplayName(priority: string): string {
    switch (priority) {
      case 'CRITICAL': return 'Critical';
      case 'HIGH': return 'High';
      case 'NORMAL': return 'Normal';
      case 'LOW': return 'Low';
      default: return priority;
    }
  }

  trackByCategory(index: number, category: NotificationCategory): string {
    return category.name;
  }

  trackByEvent(index: number, event: NotificationPreference): string {
    return event.eventType;
  }
}