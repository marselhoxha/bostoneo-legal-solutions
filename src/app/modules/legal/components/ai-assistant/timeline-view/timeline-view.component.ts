import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineEvent } from '../../../models/action-item.model';
import { ActionItemService } from '../../../services/action-item.service';

@Component({
  selector: 'app-timeline-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="timeline-container">
      <h5 class="mb-3"><i class="bi bi-calendar-event me-2"></i>Timeline</h5>

      @if (timelineEvents.length === 0) {
        <p class="text-muted">No timeline events extracted</p>
      }

      <div class="timeline">
        @for (event of timelineEvents; track event.id) {
          <div class="timeline-item" [class.event-past]="isPast(event.eventDate)">
            <div class="timeline-marker" [class]="getMarkerClass(event.priority, event.eventType)">
              <i [class]="getEventIcon(event.eventType)"></i>
            </div>
            <div class="timeline-content">
              <div class="card">
                <div class="card-body p-3">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0">{{event.title}}</h6>
                    <span class="badge" [class]="getPriorityClass(event.priority)">
                      {{event.priority}}
                    </span>
                  </div>
                  <small class="text-muted d-block mb-2">
                    <i class="bi bi-calendar3 me-1"></i>
                    {{event.eventDate | date: 'EEEE, MMMM d, yyyy'}}
                    @if (getDaysUntil(event.eventDate) !== null) {
                      <span class="ms-2" [class.text-danger]="getDaysUntil(event.eventDate)! < 0">
                        ({{formatDaysUntil(getDaysUntil(event.eventDate)!)}})
                      </span>
                    }
                  </small>
                  @if (event.description) {
                    <p class="mb-2 small">{{event.description}}</p>
                  }
                  <div class="d-flex justify-content-between align-items-center">
                    <span class="badge bg-secondary">{{event.eventType}}</span>
                    @if (event.relatedSection) {
                      <small class="text-muted">
                        <i class="bi bi-link-45deg me-1"></i>{{event.relatedSection}}
                      </small>
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .timeline-container {
      margin-bottom: 1.5rem;
    }

    .timeline {
      position: relative;
      padding-left: 40px;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 15px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #dee2e6;
    }

    .timeline-item {
      position: relative;
      margin-bottom: 1.5rem;
    }

    .timeline-marker {
      position: absolute;
      left: -30px;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
      z-index: 1;
    }

    .timeline-marker.critical { background: #dc3545; }
    .timeline-marker.high { background: #ffc107; color: #000; }
    .timeline-marker.medium { background: #17a2b8; }
    .timeline-marker.low { background: #28a745; }

    .timeline-content {
      margin-left: 10px;
    }

    .event-past {
      opacity: 0.6;
    }

    .badge.bg-success { background-color: #28a745 !important; }
    .badge.bg-danger { background-color: #dc3545 !important; }
    .badge.bg-warning { background-color: #ffc107 !important; color: #000; }
    .badge.bg-info { background-color: #17a2b8 !important; }
  `]
})
export class TimelineViewComponent implements OnInit {
  @Input() analysisId!: number;

  private actionItemService = inject(ActionItemService);

  timelineEvents: TimelineEvent[] = [];

  ngOnInit() {
    this.loadTimelineEvents();
  }

  loadTimelineEvents() {
    this.actionItemService.getTimelineEvents(this.analysisId).subscribe(events => {
      this.timelineEvents = events;
    });
  }

  getMarkerClass(priority: string, eventType: string): string {
    return priority.toLowerCase();
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'CRITICAL': return 'bg-danger';
      case 'HIGH': return 'bg-warning';
      case 'MEDIUM': return 'bg-info';
      case 'LOW': return 'bg-success';
      default: return 'bg-secondary';
    }
  }

  getEventIcon(eventType: string): string {
    switch (eventType) {
      case 'DEADLINE': return 'bi bi-exclamation-circle-fill';
      case 'FILING': return 'bi bi-file-earmark-text-fill';
      case 'HEARING': return 'bi bi-megaphone-fill';
      case 'MILESTONE': return 'bi bi-flag-fill';
      default: return 'bi bi-calendar-event-fill';
    }
  }

  isPast(date: string): boolean {
    return new Date(date) < new Date();
  }

  getDaysUntil(date: string): number | null {
    const eventDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  formatDaysUntil(days: number): string {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days === -1) return '1 day ago';
    if (days > 0) return `${days} days from now`;
    return `${Math.abs(days)} days ago`;
  }
}
