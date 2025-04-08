import { Component, OnInit } from '@angular/core';
import { CalendarService } from '../../../services/calendar.service';
import { CalendarEvent } from '../interfaces/calendar-event.interface';

@Component({
  selector: 'app-calendar-view',
  templateUrl: './calendar-view.component.html',
  styleUrls: ['./calendar-view.component.scss']
})
export class CalendarViewComponent implements OnInit {
  events: CalendarEvent[] = [];
  loading = false;
  error: string | null = null;

  constructor(private calendarService: CalendarService) {}

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.loading = true;
    this.error = null;
    
    this.calendarService.getEvents().subscribe({
      next: (events) => {
        this.events = events;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading calendar events:', err);
        this.error = 'Failed to load calendar events. Please try again later.';
        this.loading = false;
      }
    });
  }

  onEventClick(event: CalendarEvent): void {
    console.log('Event clicked:', event);
    // TODO: Implement event click handling (e.g., open event details modal)
  }
} 