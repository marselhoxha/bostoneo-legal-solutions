import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CaseActivitiesService } from '../../../services/case-activities.service';
import { CaseActivity, ActivityType } from '../../../interfaces/case.interface';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
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
      <div class="card-header bg-light-subtle py-3">
        <h5 class="card-title mb-0 text-white-dark">
          <i class="fas fa-history me-2 text-primary"></i> Case Timeline
        </h5>
      </div>
      <div class="card-body">
        <div class="timeline">
          @for (activity of activities; track activity.id) {
            <div class="timeline-item">
              <div class="timeline-marker" [ngClass]="getActivityClass(activity.type)">
                <fa-icon [icon]="getActivityIcon(activity.type)" class="timeline-icon"></fa-icon>
              </div>
              <div class="timeline-content">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <h6 class="mb-0 text-white-dark">{{activity.description}}</h6>
                  <small class="text-muted">{{activity.timestamp | date:'medium'}}</small>
                </div>
                <div class="d-flex align-items-center mb-2">
                  <div class="user-avatar me-2">
                    {{activity.user?.firstName?.charAt(0)}}{{activity.user?.lastName?.charAt(0)}}
                  </div>
                  <div>
                    <small class="d-block">
                      <strong class="text-white-dark">{{activity.user?.firstName}} {{activity.user?.lastName}}</strong>
                      <span class="badge ms-2" [ngClass]="getBadgeClass(activity.type)">
                        {{formatActivityType(activity.type)}}
                      </span>
                    </small>
                  </div>
                </div>
                @if (activity.metadata) {
                  <div class="timeline-metadata">
                    <small class="text-muted">
                      @for (key of getMetadataKeys(activity.metadata); track key) {
                        <div class="metadata-item">
                          <span class="metadata-label">{{formatMetadataKey(key)}}:</span>
                          <span class="metadata-value">{{formatMetadataValue(activity.metadata[key])}}</span>
                        </div>
                      }
                    </small>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .timeline {
      position: relative;
      padding: 20px 0;
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
    }

    .timeline-metadata {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed #dee2e6;
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
  `]
})
export class CaseTimelineComponent implements OnInit {
  @Input() caseId!: string;
  activities: CaseActivity[] = [];

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

  constructor(private activitiesService: CaseActivitiesService) {}

  ngOnInit(): void {
    this.loadActivities();
  }

  loadActivities(): void {
    this.activitiesService.getActivities(this.caseId).subscribe({
      next: (activities) => {
        this.activities = activities;
      },
      error: (error) => {
        console.error('Error loading activities:', error);
        // Fallback to dummy data
        this.activitiesService.getDummyActivities(this.caseId).subscribe(
          activities => this.activities = activities
        );
      }
    });
  }

  getMetadataKeys(metadata: any): string[] {
    return Object.keys(metadata).filter(key => 
      !['documentId', 'noteId'].includes(key) && 
      typeof metadata[key] !== 'object'
    );
  }

  getActivityIcon(type: ActivityType): any {
    switch (type) {
      case ActivityType.CASE_CREATED:
        return this.faPlusCircle;
      case ActivityType.CASE_UPDATED:
        return this.faEdit;
      case ActivityType.DOCUMENT_UPLOADED:
        return this.faFileUpload;
      case ActivityType.DOCUMENT_DOWNLOADED:
        return this.faFileDownload;
      case ActivityType.DOCUMENT_VERSION_ADDED:
        return this.faFileAlt;
      case ActivityType.NOTE_ADDED:
      case ActivityType.NOTE_UPDATED:
      case ActivityType.NOTE_DELETED:
        return this.faStickyNote;
      case ActivityType.STATUS_CHANGED:
        return this.faExchangeAlt;
      case ActivityType.ASSIGNMENT_CHANGED:
        return this.faUserEdit;
      case ActivityType.DEADLINE_SET:
      case ActivityType.DEADLINE_UPDATED:
        return this.faCalendarAlt;
      case ActivityType.DEADLINE_MET:
        return this.faCheckCircle;
      case ActivityType.DEADLINE_MISSED:
        return this.faTimesCircle;
      case ActivityType.PAYMENT_RECEIVED:
      case ActivityType.PAYMENT_SCHEDULED:
      case ActivityType.PAYMENT_MISSED:
        return this.faMoneyBillWave;
      case ActivityType.HEARING_SCHEDULED:
      case ActivityType.HEARING_COMPLETED:
      case ActivityType.HEARING_CANCELLED:
        return this.faGavel;
      default:
        return this.faQuestionCircle;
    }
  }

  getActivityClass(type: ActivityType): string {
    if (type.includes('DOCUMENT')) return 'marker-document';
    if (type.includes('NOTE')) return 'marker-note';
    if (type.includes('STATUS')) return 'marker-status';
    if (type.includes('ASSIGNMENT')) return 'marker-assignment';
    if (type.includes('DEADLINE')) return 'marker-deadline';
    if (type.includes('PAYMENT')) return 'marker-payment';
    if (type.includes('HEARING')) return 'marker-hearing';
    return 'marker-other';
  }

  getBadgeClass(type: ActivityType): string {
    if (type.includes('DOCUMENT')) return 'badge-document';
    if (type.includes('NOTE')) return 'badge-note';
    if (type.includes('STATUS')) return 'badge-status';
    if (type.includes('ASSIGNMENT')) return 'badge-assignment';
    if (type.includes('DEADLINE')) return 'badge-deadline';
    if (type.includes('PAYMENT')) return 'badge-payment';
    if (type.includes('HEARING')) return 'badge-hearing';
    return 'badge-other';
  }

  formatActivityType(type: ActivityType): string {
    return type.replace(/_/g, ' ').toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  formatMetadataKey(key: string): string {
    return key.replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }

  formatMetadataValue(value: any): string {
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return value;
  }
} 