import { Component, Input, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { TimelineEvent } from '../../../models/action-item.model';
import { ActionItemService } from '../../../services/action-item.service';
import { CalendarService } from '../../../services/calendar.service';
import { CreateEventRequest } from '../../calendar/interfaces/calendar-event.interface';

interface TimelineEventWithStatus extends TimelineEvent {
  addedToCalendar?: boolean;
}

@Component({
  selector: 'app-timeline-view',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule],
  templateUrl: './timeline-view.component.html',
  styleUrls: ['./timeline-view.component.scss']
})
export class TimelineViewComponent implements OnInit {
  @Input() analysisId!: number;
  @Input() caseId?: number;

  private actionItemService = inject(ActionItemService);
  private calendarService = inject(CalendarService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);

  timelineEvents: TimelineEventWithStatus[] = [];

  ngOnInit() {
    this.loadTimelineEvents();
  }

  loadTimelineEvents() {
    this.actionItemService.getTimelineEvents(this.analysisId).subscribe(events => {
      // Check calendarEventId from backend to determine if already added
      this.timelineEvents = events.map(e => ({
        ...e,
        addedToCalendar: !!e.calendarEventId
      }));
      this.cdr.detectChanges();
    });
  }

  // ==================== Date/Time Helpers ====================

  isPast(date: string): boolean {
    return new Date(date) < new Date();
  }

  isToday(date: string): boolean {
    const eventDate = new Date(date);
    const today = new Date();
    return eventDate.toDateString() === today.toDateString();
  }

  isUpcoming(date: string): boolean {
    const days = this.getDaysUntil(date);
    return days !== null && days > 0 && days <= 7;
  }

  /**
   * Determines if an event is actionable and should be added to calendar.
   * Past events and informational milestones are not calendar-worthy.
   */
  isCalendarWorthy(event: TimelineEventWithStatus): boolean {
    // Already added - not actionable
    if (event.addedToCalendar) return false;
    // Past events - informational only
    if (this.isPast(event.eventDate)) return false;
    // Milestones are typically informational (e.g., "incident occurred on X date")
    if (event.eventType?.toUpperCase() === 'MILESTONE') return false;
    return true;
  }

  getDaysUntil(date: string): number | null {
    const eventDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    const diffTime = eventDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  formatDaysUntil(days: number): string {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days === -1) return 'Yesterday';

    const absDays = Math.abs(days);
    const suffix = days > 0 ? '' : ' ago';

    if (absDays < 30) {
      return `${absDays}d${suffix}`;
    } else if (absDays < 365) {
      const months = Math.round(absDays / 30);
      return `${months}mo${suffix}`;
    } else {
      const years = Math.round(absDays / 365);
      return `${years}yr${suffix}`;
    }
  }

  getDaysUntilClass(days: number | null): string {
    if (days === null) return '';
    if (days < 0) return 'days-overdue';
    if (days === 0) return 'days-today';
    if (days <= 3) return 'days-soon';
    if (days <= 14) return 'days-upcoming';
    return 'days-future';
  }

  getDaysUntilBadgeClass(days: number | null): string {
    if (days === null) return '';
    if (days < 0) return 'days-overdue';
    if (days === 0) return 'days-today';
    if (days <= 3) return 'days-soon';
    if (days <= 14) return 'days-upcoming';
    return 'days-future';
  }

  getAvatarBgClass(priority: string, eventDate: string): string {
    if (this.isPast(eventDate)) return 'bg-light text-secondary';
    if (this.isToday(eventDate)) return 'bg-primary-subtle text-primary';
    switch (priority?.toUpperCase()) {
      case 'CRITICAL': return 'bg-danger-subtle text-danger';
      case 'HIGH': return 'bg-warning-subtle text-warning';
      case 'MEDIUM': return 'bg-info-subtle text-info';
      case 'LOW': return 'bg-success-subtle text-success';
      default: return 'bg-primary-subtle text-primary';
    }
  }

  getUpcomingCount(): number {
    return this.timelineEvents.filter(e => {
      const days = this.getDaysUntil(e.eventDate);
      return days !== null && days > 0 && days <= 7;
    }).length;
  }

  getOverdueCount(): number {
    return this.timelineEvents.filter(e => {
      const days = this.getDaysUntil(e.eventDate);
      return days !== null && days < 0;
    }).length;
  }

  getProgressWidth(date: string): number {
    const days = this.getDaysUntil(date);
    if (days === null || days <= 0) return 100;
    if (days >= 30) return 0;
    return 100 - (days / 30) * 100;
  }

  // ==================== Styling Helpers ====================

  getMarkerBgClass(priority: string): string {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL': return 'bg-soft-danger';
      case 'HIGH': return 'bg-soft-warning';
      case 'MEDIUM': return 'bg-soft-info';
      case 'LOW': return 'bg-soft-success';
      default: return 'bg-soft-primary';
    }
  }

  getPriorityBadgeClass(priority: string): string {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL': return 'priority-critical';
      case 'HIGH': return 'priority-high';
      case 'MEDIUM': return 'priority-medium';
      case 'LOW': return 'priority-low';
      default: return 'bg-soft-secondary text-secondary';
    }
  }

  getProgressBarClass(priority: string): string {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL': return 'bg-danger';
      case 'HIGH': return 'bg-warning';
      case 'MEDIUM': return 'bg-info';
      case 'LOW': return 'bg-success';
      default: return 'bg-primary';
    }
  }

  getEventIcon(eventType: string): string {
    switch (eventType?.toUpperCase()) {
      case 'DEADLINE': return 'ri-alarm-warning-line';
      case 'FILING': return 'ri-file-text-line';
      case 'HEARING': return 'ri-government-line';
      case 'MILESTONE': return 'ri-flag-line';
      case 'COURT_DATE': return 'ri-scales-3-line';
      case 'DEPOSITION': return 'ri-user-voice-line';
      case 'MEETING': return 'ri-team-line';
      default: return 'ri-calendar-event-line';
    }
  }

  getEventTypeIcon(eventType: string): string {
    switch (eventType?.toUpperCase()) {
      case 'DEADLINE': return 'ri-alarm-warning-line';
      case 'FILING': return 'ri-file-text-line';
      case 'HEARING': return 'ri-government-line';
      case 'MILESTONE': return 'ri-flag-line';
      case 'COURT_DATE': return 'ri-scales-3-line';
      default: return 'ri-calendar-line';
    }
  }

  getEventTypeBadgeClass(eventType: string): string {
    switch (eventType?.toUpperCase()) {
      case 'DEADLINE': return 'event-deadline';
      case 'FILING': return 'event-filing';
      case 'HEARING': return 'event-hearing';
      case 'MILESTONE': return 'event-milestone';
      default: return 'event-default';
    }
  }

  formatEventType(eventType: string): string {
    if (!eventType) return 'Event';
    return eventType.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // ==================== Calendar Integration ====================

  addToInternalCalendar(event: TimelineEventWithStatus): void {
    if (!event.id) {
      this.toastr.error('Event ID is missing', 'Error');
      return;
    }

    const calendarEvent: CreateEventRequest = {
      title: event.title,
      description: event.description || `Timeline event from document analysis`,
      startTime: new Date(event.eventDate),
      endTime: new Date(new Date(event.eventDate).getTime() + 60 * 60 * 1000), // 1 hour duration
      eventType: this.mapToCalendarEventType(event.eventType),
      status: 'SCHEDULED',
      caseId: this.caseId,
      highPriority: event.priority === 'CRITICAL' || event.priority === 'HIGH',
      reminderMinutes: 60
    };

    this.calendarService.createEvent(calendarEvent).subscribe({
      next: (createdEvent) => {
        // Persist the link to backend
        const calendarEventId = createdEvent?.id;
        if (calendarEventId && event.id) {
          this.actionItemService.linkTimelineEventToCalendar(event.id, calendarEventId).subscribe({
            next: () => {
              event.addedToCalendar = true;
              event.calendarEventId = calendarEventId;
              this.cdr.detectChanges();
              this.toastr.success('Event added to calendar', 'Calendar');
            },
            error: (err) => {
              console.error('Failed to persist calendar link:', err);
              // Still mark as added locally even if persistence fails
              event.addedToCalendar = true;
              this.cdr.detectChanges();
              this.toastr.success('Event added to calendar', 'Calendar');
            }
          });
        } else {
          event.addedToCalendar = true;
          this.cdr.detectChanges();
          this.toastr.success('Event added to calendar', 'Calendar');
        }
      },
      error: (err) => {
        console.error('Failed to add to calendar:', err);
        this.toastr.error('Failed to add event to calendar', 'Error');
      }
    });
  }

  addAllToCalendar(): void {
    const eventsToAdd = this.timelineEvents.filter(e => this.isCalendarWorthy(e) && e.id);

    if (eventsToAdd.length === 0) {
      this.toastr.info('No upcoming events to add', 'Calendar');
      return;
    }

    let successCount = 0;
    const totalEvents = eventsToAdd.length;

    eventsToAdd.forEach(event => {
      const calendarEvent: CreateEventRequest = {
        title: event.title,
        description: event.description || `Timeline event from document analysis`,
        startTime: new Date(event.eventDate),
        endTime: new Date(new Date(event.eventDate).getTime() + 60 * 60 * 1000),
        eventType: this.mapToCalendarEventType(event.eventType),
        status: 'SCHEDULED',
        caseId: this.caseId,
        highPriority: event.priority === 'CRITICAL' || event.priority === 'HIGH',
        reminderMinutes: 60
      };

      this.calendarService.createEvent(calendarEvent).subscribe({
        next: (createdEvent) => {
          const calendarEventId = createdEvent?.id;
          if (calendarEventId && event.id) {
            this.actionItemService.linkTimelineEventToCalendar(event.id, calendarEventId).subscribe({
              next: () => {
                event.addedToCalendar = true;
                event.calendarEventId = calendarEventId;
                successCount++;
                this.cdr.detectChanges();
                if (successCount === totalEvents) {
                  this.toastr.success(`${successCount} events added to calendar`, 'Calendar');
                }
              },
              error: () => {
                event.addedToCalendar = true;
                successCount++;
                this.cdr.detectChanges();
                if (successCount === totalEvents) {
                  this.toastr.success(`${successCount} events added to calendar`, 'Calendar');
                }
              }
            });
          } else {
            event.addedToCalendar = true;
            successCount++;
            this.cdr.detectChanges();
            if (successCount === totalEvents) {
              this.toastr.success(`${successCount} events added to calendar`, 'Calendar');
            }
          }
        },
        error: (err) => console.error('Failed to add event:', err)
      });
    });
  }

  getGoogleCalendarUrl(event: TimelineEvent): string {
    const startDate = new Date(event.eventDate);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${formatDate(startDate)}/${formatDate(endDate)}`,
      details: event.description || '',
      sf: 'true'
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  getOutlookCalendarUrl(event: TimelineEvent): string {
    const startDate = new Date(event.eventDate);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: event.title,
      startdt: startDate.toISOString(),
      enddt: endDate.toISOString(),
      body: event.description || ''
    });

    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }

  getYahooCalendarUrl(event: TimelineEvent): string {
    const startDate = new Date(event.eventDate);
    const formatYahooDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const params = new URLSearchParams({
      v: '60',
      title: event.title,
      st: formatYahooDate(startDate),
      dur: '0100',
      desc: event.description || ''
    });

    return `https://calendar.yahoo.com/?${params.toString()}`;
  }

  downloadIcs(event: TimelineEvent): void {
    const startDate = new Date(event.eventDate);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const formatIcsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//BostoneoSolutions//Legal//EN',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@bostoneosolutions.com`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(startDate)}`,
      `DTEND:${formatIcsDate(endDate)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private mapToCalendarEventType(eventType: string): 'COURT_DATE' | 'DEADLINE' | 'CLIENT_MEETING' | 'TEAM_MEETING' | 'DEPOSITION' | 'MEDIATION' | 'CONSULTATION' | 'REMINDER' | 'OTHER' {
    switch (eventType?.toUpperCase()) {
      case 'DEADLINE': return 'DEADLINE';
      case 'HEARING':
      case 'COURT_DATE': return 'COURT_DATE';
      case 'DEPOSITION': return 'DEPOSITION';
      case 'MEETING': return 'CLIENT_MEETING';
      default: return 'DEADLINE';
    }
  }
}
