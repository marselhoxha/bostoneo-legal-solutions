import { Component, Input, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CaseActivitiesService } from '../../../services/case-activities.service';
import { CaseActivity } from '../../../models/case-activity.model';
import { ActivityType } from '../../../models/case-activity.model';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { Subscription, catchError, finalize, of } from 'rxjs';
import { 
  faFileUpload, 
  faFileDownload, 
  faFileAlt, 
  faStickyNote, 
  faExchangeAlt, 
  faUserEdit, 
  faCalendarAlt, 
  faCheckCircle, 
  faTimesCircle, 
  faMoneyBillWave, 
  faGavel, 
  faPlusCircle, 
  faEdit, 
  faTrashAlt, 
  faQuestionCircle 
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-case-timeline',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule],
  template: `
    <div class="card shadow-sm">
      <div class="card-header bg-light-subtle py-3 d-flex justify-content-between align-items-center">
        <h5 class="card-title mb-0 text-white-dark">
          <i class="ri-history-line me-2 text-primary"></i> Case Timeline
        </h5>
        <button *ngIf="!isLoading" class="btn btn-sm btn-soft-primary" (click)="refreshTimeline()" [disabled]="isLoading">
          <i class="ri-refresh-line align-middle" [class.ri-loader-4-line]="isLoading" [class.animate-spin]="isLoading"></i> 
          {{isLoading ? 'Loading...' : 'Refresh'}}
        </button>
      </div>
      <div class="card-body p-0">
        <!-- Loading state -->
        <div *ngIf="isLoading" class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading timeline...</span>
          </div>
          <p class="mt-3 text-muted">Loading case activity...</p>
        </div>
        
        <!-- Error state -->
        <div *ngIf="!isLoading && error" class="alert alert-danger m-3">
          <i class="ri-error-warning-line me-2"></i> {{error}}
          <button class="btn btn-sm btn-link ms-2" (click)="loadActivities()">Try Again</button>
        </div>
        
        <!-- Empty state -->
        <div *ngIf="!isLoading && !error && (!activities || activities.length === 0)" class="text-center py-5">
          <div class="avatar-lg mx-auto mb-4">
            <div class="avatar-title bg-soft-secondary text-secondary rounded-circle fs-1">
              <i class="ri-history-line"></i>
            </div>
          </div>
          <h5>No Activity Found</h5>
          <p class="text-muted">No activity has been recorded for this case yet.</p>
        </div>

        <!-- Timeline content - Now with max-height and scrolling -->
        <div class="timeline-container" *ngIf="!isLoading && !error && activities && activities.length > 0">
          <div class="timeline" >
          <div *ngFor="let activity of activities; trackBy: trackByActivityId" class="timeline-item">
              <div class="timeline-marker" [ngClass]="getActivityClass(activity.activityType)">
                <fa-icon [icon]="getActivityIcon(activity.activityType)" class="timeline-icon"></fa-icon>
            </div>
            <div class="timeline-content">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="mb-0 text-white-dark">{{activity.description}}</h6>
                  <small class="text-muted">{{formatDate(activity.createdAt)}}</small>
              </div>
              <div class="d-flex align-items-center mb-2">
                <div *ngIf="activity.user" class="user-avatar me-2" [style.backgroundColor]="getAvatarColor(activity.user)">
                  {{activity.user?.firstName?.charAt(0) || '?'}}{{activity.user?.lastName?.charAt(0) || ''}}
                </div>
                  <div *ngIf="!activity.user && activity.userId" class="user-avatar system-avatar me-2">
                    <i class="ri-user-line"></i>
                </div>
                <div>
                  <small class="d-block">
                    <strong class="text-white-dark">
                        {{activity.user ? (activity.user.firstName + ' ' + activity.user.lastName) : 
                         (activity.userId ? 'User #' + activity.userId : 'System')}}
                    </strong>
                      <span class="badge ms-2" [ngClass]="getBadgeClass(activity.activityType)">
                        {{formatActivityType(activity.activityType)}}
                    </span>
                  </small>
                </div>
              </div>
              <div *ngIf="activity.metadata" class="timeline-metadata">
                <small class="text-muted">
                  <div *ngFor="let key of getMetadataKeys(activity.metadata)" class="metadata-item">
                    <span class="metadata-label">{{formatMetadataKey(key)}}:</span>
                    <span class="metadata-value">{{formatMetadataValue(activity.metadata[key])}}</span>
                  </div>
                </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div *ngIf="!isLoading && !error && activities && activities.length > 0" class="card-footer bg-light-subtle py-2">
        <div class="d-flex justify-content-between align-items-center">
          <small class="text-muted">Showing {{activities.length}} activities</small>
          <small class="text-muted">Last updated: {{lastUpdated | date:'medium'}}</small>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .timeline-container {
      max-height: 500px;
      overflow-y: auto;
      padding: 20px 15px;
      scrollbar-width: thin;
    }

    .timeline-container::-webkit-scrollbar {
      width: 5px;
    }

    .timeline-container::-webkit-scrollbar-track {
      background: #f1f1f1;
    }

    .timeline-container::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 4px;
    }

    .timeline-container::-webkit-scrollbar-thumb:hover {
      background: #555;
    }

    .timeline {
      position: relative;
      padding: 0;
    }

    .timeline::before {
      content: '';
      position: absolute;
      top: 0;
      left: 24px;
      height: 100%;
      width: 2px;
      background: linear-gradient(to bottom, #e9ecef 0%, #dee2e6 100%);
    }

    .timeline-item {
      position: relative;
      padding-left: 60px;
      margin-bottom: 30px;
    }

    .timeline-marker {
      position: absolute;
      left: 15px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #fff;
      border: 2px solid #0d6efd;
      box-shadow: 0 0 0 4px rgba(13, 110, 253, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
    }

    .timeline-icon {
      font-size: 10px;
      color: #0d6efd;
    }

    .timeline-content {
      padding: 15px;
      background: rgba(102, 145, 231, 0.1);
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      transition: all 0.3s ease;
    }

    .timeline-content:hover {
      background: rgba(102, 145, 231, 0.15);
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }

    .user-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: #0d6efd;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 12px;
      text-transform: uppercase;
    }
    
    .system-avatar {
      background: #6c757d;
    }

    .timeline-metadata {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed #607D8B
    }

    .metadata-item {
      display: flex;
      margin-bottom: 4px;
    }

    .metadata-label {
      font-weight: 500;
      margin-right: 5px;
      min-width: 80px;
    }

    .metadata-value {
      color: #495057;
    }

    /* Activity type specific colors */
    .marker-document { border-color: #0d6efd; }
    .marker-document .timeline-icon { color: #0d6efd; }
    .badge-document { background-color: #cfe2ff; color: #084298; }

    .marker-note { border-color: #198754; }
    .marker-note .timeline-icon { color: #198754; }
    .badge-note { background-color: #d1e7dd; color: #0f5132; }

    .marker-status { border-color: #6f42c1; }
    .marker-status .timeline-icon { color: #6f42c1; }
    .badge-status { background-color: #e2d9f3; color: #5a3d8f; }

    .marker-assignment { border-color: #fd7e14; }
    .marker-assignment .timeline-icon { color: #fd7e14; }
    .badge-assignment { background-color: #fff3cd; color: #856404; }

    .marker-deadline { border-color: #dc3545; }
    .marker-deadline .timeline-icon { color: #dc3545; }
    .badge-deadline { background-color: #f8d7da; color: #842029; }

    .marker-payment { border-color: #20c997; }
    .marker-payment .timeline-icon { color: #20c997; }
    .badge-payment { background-color: #d1fae5; color: #065f46; }

    .marker-hearing { border-color: #6610f2; }
    .marker-hearing .timeline-icon { color: #6610f2; }
    .badge-hearing { background-color: #e8e3f7; color: #4a2b9c; }

    .marker-other { border-color: #6c757d; }
    .marker-other .timeline-icon { color: #6c757d; }
    .badge-other { background-color: #e9ecef; color: #495057; }

    /* Avatar styles for empty state */
    .avatar-lg {
      height: 5rem;
      width: 5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
    }
    
    .avatar-title {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Enhanced timeline item styling */
    .timeline-item:hover .timeline-marker {
      transform: scale(1.2);
      transition: transform 0.2s ease;
    }

    .timeline-item:last-child {
      margin-bottom: 0;
    }

    /* Dark mode styles */
    :host-context(.dark-mode) .card {
      background-color: #1a1d21;
      border-color: #2a2e34;
    }

    :host-context(.dark-mode) .card-header {
      background-color: #1a1d21 !important;
      border-bottom-color: #2a2e34;
    }

    :host-context(.dark-mode) .timeline::before {
      background: linear-gradient(to bottom, #2a2e34 0%, #1a1d21 100%);
    }

    :host-context(.dark-mode) .timeline-marker {
      background: #1a1d21;
      border-color: #0d6efd;
      box-shadow: 0 0 0 4px rgba(13, 110, 253, 0.2);
    }

    :host-context(.dark-mode) .timeline-content {
      background: rgba(102, 145, 231, 0.1);
      border: 1px solid #2a2e34;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    :host-context(.dark-mode) .timeline-content:hover {
      background: rgba(102, 145, 231, 0.15);
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    }

    :host-context(.dark-mode) .metadata-value {
      color: #adb5bd;
    }

    :host-context(.dark-mode) .timeline-metadata {
      border-top: 1px dashed #2a2e34;
    }

    :host-context(.dark-mode) .text-muted {
      color: #adb5bd !important;
    }

    :host-context(.dark-mode) .badge-document { background-color: #0d6efd; color: #ffffff; }
    :host-context(.dark-mode) .badge-note { background-color: #198754; color: #ffffff; }
    :host-context(.dark-mode) .badge-status { background-color: #6f42c1; color: #ffffff; }
    :host-context(.dark-mode) .badge-assignment { background-color: #fd7e14; color: #ffffff; }
    :host-context(.dark-mode) .badge-deadline { background-color: #dc3545; color: #ffffff; }
    :host-context(.dark-mode) .badge-payment { background-color: #20c997; color: #ffffff; }
    :host-context(.dark-mode) .badge-hearing { background-color: #6610f2; color: #ffffff; }
    :host-context(.dark-mode) .badge-other { background-color: #6c757d; color: #ffffff; }

    .animate-spin {
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class CaseTimelineComponent implements OnInit, OnChanges, OnDestroy {
  @Input() caseId!: string;
  activities: CaseActivity[] = [];
  isLoading = false;
  error: string | null = null;
  lastUpdated = new Date();
  private subscription = new Subscription();
  private _previousCaseId: string | null = null;

  // FontAwesome icons
  faFileUpload = faFileUpload;
  faFileDownload = faFileDownload;
  faFileAlt = faFileAlt;
  faStickyNote = faStickyNote;
  faExchangeAlt = faExchangeAlt;
  faUserEdit = faUserEdit;
  faCalendarAlt = faCalendarAlt;
  faCheckCircle = faCheckCircle;
  faTimesCircle = faTimesCircle;
  faMoneyBillWave = faMoneyBillWave;
  faGavel = faGavel;
  faPlusCircle = faPlusCircle;
  faEdit = faEdit;
  faTrashAlt = faTrashAlt;
  faQuestionCircle = faQuestionCircle;

  constructor(
    private activitiesService: CaseActivitiesService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadActivities();

    // Subscribe to refresh notifications
    this.subscription.add(
      this.activitiesService.getRefreshObservable().subscribe(refreshCaseId => {
        // Stringify for safer comparison
        if (String(refreshCaseId) === String(this.caseId)) {
          // Set a small delay to ensure backend has processed the new activity
          setTimeout(() => {
            this.loadActivities();
          }, 500); // Small delay to ensure backend has processed the activity
        }
      })
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['caseId'] && changes['caseId'].currentValue !== changes['caseId'].previousValue) {
      this._previousCaseId = changes['caseId'].previousValue;
      if (changes['caseId'].currentValue) {
        this.loadActivities();
      }
    }
  }
  
  ngOnDestroy(): void {
      this.subscription.unsubscribe();
  }

  refreshTimeline(): void {
    if (!this.isLoading) {
      this.loadActivities();
    }
  }

  loadActivities(): void {
    if (!this.caseId) {
      this.error = 'No case ID provided';
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.activities = []; // Clear existing activities
    this.cdr.detectChanges();

    this.activitiesService.getActivities(this.caseId)
      .pipe(finalize(() => {
            this.isLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (activitiesData) => {
          if (!activitiesData || activitiesData.length === 0) {
            this.activities = [];
            this.cdr.detectChanges();
            return;
          }

          try {
            // Map and normalize activity data
            const processedActivities = this.processActivityData(activitiesData);

            // Sort by createdAt, newest first
            this.activities = processedActivities.sort((a, b) => {
              // Ensure we have valid dates
              const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
              const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);

              // Sort newest first
              return dateB.getTime() - dateA.getTime();
            });

            this.lastUpdated = new Date();
          } catch (err) {
            console.error('Error processing activities:', err);
            this.error = 'Error processing timeline data';
            this.activities = [];
          }

          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading activities:', err);
          this.error = 'Failed to load timeline activities';
          this.activities = [];
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Process activity data from API and convert to component format
   */
  private processActivityData(activitiesData: any[]): CaseActivity[] {
    // Map each activity to our component model
    return activitiesData.map(activity => {
      // Skip invalid activities
      if (!activity) return null;

      // Normalize activity type for display purposes only
      let normalizedType = this.normalizeActivityType(activity.activityType);
      
      // Match CaseActivity model structure
                return {
                  id: activity.id || `temp-${Math.random().toString(36).substring(2, 9)}`,
        caseId: Number(activity.caseId) || Number(this.caseId),
        userId: activity.userId ? Number(activity.userId) : null,
        user: activity.user || null,
        activityType: normalizedType,
        referenceId: activity.referenceId,
        referenceType: activity.referenceType,
                  description: activity.description || 'Activity recorded',
        metadata: this.parseMetadata(activity),
        createdAt: activity.createdAt ? new Date(activity.createdAt) : new Date()
      } as CaseActivity;
    }).filter(activity => activity !== null) as CaseActivity[]; // Only filter out null values, not duplicates
  }
  
  /**
   * Normalize activity type from various formats
   */
  private normalizeActivityType(activityType: string): string {
    if (!activityType) return 'OTHER';
    
    // Convert single character codes to full strings
    switch (activityType) {
      case 'N': return 'NOTE_ADDED';
      case 'U': return 'NOTE_UPDATED';
      case 'D': return 'NOTE_DELETED';
      default: return activityType;
    }
  }

  /**
   * Parse metadata from various activity formats
   */
  private parseMetadata(activity: any): any {
    if (!activity) return {};
    
    // Handle direct metadata object
    if (activity.metadata && typeof activity.metadata === 'object') {
      return activity.metadata;
    }
    
    // Try JSON string in metadataJson field
    if (activity.metadataJson) {
      try {
        return JSON.parse(activity.metadataJson);
      } catch (e) {
        console.error('Error parsing metadataJson:', e);
      }
    }
    
    // Try any string field that might be JSON
    for (const key of ['metadata', 'metadataJson']) {
      if (activity[key] && typeof activity[key] === 'string' && activity[key].startsWith('{')) {
        try {
          return JSON.parse(activity[key]);
        } catch (e) {
          console.error(`Error parsing ${key}:`, e);
        }
      }
    }
    
    return {};
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    
    // If today, show time only
    const today = new Date();
    if (d.getDate() === today.getDate() && 
        d.getMonth() === today.getMonth() && 
        d.getFullYear() === today.getFullYear()) {
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    
    // If this year, show date without year
    if (d.getFullYear() === today.getFullYear()) {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + 
             ' at ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    
    // Otherwise show full date
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  
  formatActivityType(type: string): string {
    if (!type) return 'Other';
    
    // Convert to string for consistent handling
    const typeStr = String(type);
    
    return typeStr
      .replace(/_/g, ' ')
      .replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
      .replace(/Document |Note |Status |Assignment |Deadline |Payment |Hearing |Case /g, '');
  }
  
  formatMetadataKey(key: string): string {
    if (!key) return '';
    
    // Convert camelCase to Title Case
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }
  
  formatMetadataValue(value: any): string {
    if (value === null || value === undefined) return '';
    
    if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
      return this.formatDate(value);
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  }
  
  getMetadataKeys(metadata: any): string[] {
    if (!metadata || typeof metadata !== 'object') return [];
    return Object.keys(metadata).filter(key => {
      // Filter out nullish values and empty strings
      const value = metadata[key];
      return value !== null && value !== undefined && value !== '';
    });
  }

  getActivityIcon(type: string): any {
    switch (String(type)) {
      case 'CASE_CREATED': return this.faPlusCircle;
      case 'CASE_UPDATED': return this.faEdit;
      case 'DOCUMENT_UPLOADED':
      case 'DOCUMENT_ADDED': return this.faFileUpload;
      case 'DOCUMENT_DOWNLOADED': return this.faFileDownload;
      case 'DOCUMENT_VERSION_ADDED': return this.faFileAlt;
      case 'NOTE_ADDED':
      case 'NOTE_UPDATED':
      case 'NOTE_DELETED': return this.faStickyNote;
      case 'STATUS_CHANGED': return this.faExchangeAlt;
      case 'ASSIGNMENT_CHANGED': return this.faUserEdit;
      case 'DEADLINE_SET':
      case 'DEADLINE_UPDATED': return this.faCalendarAlt;
      case 'DEADLINE_MET': return this.faCheckCircle;
      case 'DEADLINE_MISSED': return this.faTimesCircle;
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_SCHEDULED':
      case 'PAYMENT_MISSED': return this.faMoneyBillWave;
      case 'HEARING_SCHEDULED':
      case 'HEARING_COMPLETED':
      case 'HEARING_CANCELLED': return this.faGavel;
      case 'TASK_CREATED':
      case 'TASK_UPDATED':
      case 'TASK_COMPLETED':
      case 'TASK_DELETED': return this.faCalendarAlt;
      default: return this.faQuestionCircle;
    }
  }

  getActivityClass(type: string): string {
    if (!type) return 'marker-other';
    
    const typeStr = String(type);
    
    if (typeStr.includes('DOCUMENT')) return 'marker-document';
    if (typeStr.includes('NOTE')) return 'marker-note';
    if (typeStr.includes('STATUS')) return 'marker-status';
    if (typeStr.includes('ASSIGNMENT')) return 'marker-assignment';
    if (typeStr.includes('DEADLINE')) return 'marker-deadline';
    if (typeStr.includes('PAYMENT')) return 'marker-payment';
    if (typeStr.includes('HEARING')) return 'marker-hearing';
    if (typeStr.includes('TASK')) return 'marker-deadline';
    return 'marker-other';
  }

  getBadgeClass(type: string): string {
    if (!type) return 'badge-other';
    
    const typeStr = String(type);
    
    if (typeStr.includes('DOCUMENT')) return 'badge-document';
    if (typeStr.includes('NOTE')) return 'badge-note';
    if (typeStr.includes('STATUS')) return 'badge-status';
    if (typeStr.includes('ASSIGNMENT')) return 'badge-assignment';
    if (typeStr.includes('DEADLINE')) return 'badge-deadline';
    if (typeStr.includes('PAYMENT')) return 'badge-payment';
    if (typeStr.includes('HEARING')) return 'badge-hearing';
    if (typeStr.includes('TASK')) return 'badge-deadline';
    return 'badge-other';
  }
  
  trackByActivityId(index: number, activity: CaseActivity): string {
    return String(activity.id);
  }
  
  getAvatarColor(user: any): string {
    if (!user || !user.firstName) return '#0d6efd';
    
    const nameStr = `${user.firstName}${user.lastName || ''}`;
    let hash = 0;
    
    for (let i = 0; i < nameStr.length; i++) {
      hash = nameStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      '#4e73df', '#1cc88a', '#f6c23e', '#e74a3b', '#36b9cc',
      '#6f42c1', '#fd7e14', '#20c997', '#6610f2'
    ];
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }
} 