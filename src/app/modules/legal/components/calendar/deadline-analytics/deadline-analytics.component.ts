import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarService } from '../../../services/calendar.service';
import { CalendarEvent } from '../interfaces/calendar-event.interface';

@Component({
  selector: 'app-deadline-analytics',
  templateUrl: './deadline-analytics.component.html',
  styleUrls: ['./deadline-analytics.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class DeadlineAnalyticsComponent implements OnInit {
  @Input() caseId?: number;
  
  analytics = {
    total: 0,
    upcoming: 0,
    approaching: 0,
    overdue: 0,
    completed: 0,
    cancelled: 0,
    highPriority: 0
  };

  isLoading = true;
  error: string | null = null;
  
  constructor(private calendarService: CalendarService) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  private loadAnalytics(): void {
    this.isLoading = true;
    
    // Determine which API call to make based on whether caseId is provided
    const deadlinesObs = this.caseId 
      ? this.calendarService.getEventsByCaseId(this.caseId)
      : this.calendarService.getEvents();
    
    deadlinesObs.subscribe({
      next: (events) => {
        // Filter only deadline events
        const deadlines = events.filter(event => event.eventType === 'DEADLINE');
        
        // Calculate analytics
        this.calculateAnalytics(deadlines);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading deadlines for analytics:', err);
        this.error = 'Failed to load deadline analytics.';
        this.isLoading = false;
      }
    });
  }

  private calculateAnalytics(deadlines: CalendarEvent[]): void {
    // Reset analytics
    this.analytics = {
      total: 0,
      upcoming: 0,
      approaching: 0,
      overdue: 0,
      completed: 0,
      cancelled: 0,
      highPriority: 0
    };
    
    // Count total deadlines
    this.analytics.total = deadlines.length;
    
    // Count by status and priority
    deadlines.forEach(deadline => {
      // Count by priority
      if (deadline.highPriority) {
        this.analytics.highPriority++;
      }
      
      // Count by status
      if (deadline.status === 'COMPLETED') {
        this.analytics.completed++;
        return;
      }
      
      if (deadline.status === 'CANCELLED') {
        this.analytics.cancelled++;
        return;
      }
      
      // Calculate days remaining
      const deadlineDate = new Date(deadline.start);
      const today = new Date();
      const timeDiff = deadlineDate.getTime() - today.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      if (daysDiff < 0) {
        this.analytics.overdue++;
      } else if (daysDiff <= 3) {
        this.analytics.approaching++;
      } else {
        this.analytics.upcoming++;
      }
    });
  }
  
  // Helper method to calculate percentage
  getPercentage(value: number): number {
    if (this.analytics.total === 0) return 0;
    return Math.round((value / this.analytics.total) * 100);
  }
} 