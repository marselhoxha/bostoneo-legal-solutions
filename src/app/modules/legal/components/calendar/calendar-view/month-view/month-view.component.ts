import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CalendarEvent } from '../../interfaces/calendar-event.interface';

@Component({
  selector: 'app-month-view',
  templateUrl: './month-view.component.html',
  styleUrls: ['./month-view.component.scss']
})
export class MonthViewComponent implements OnInit {
  @Input() events: CalendarEvent[] = [];
  @Output() eventClick = new EventEmitter<CalendarEvent>();

  weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  weeks: Date[][] = [];
  currentDate = new Date();

  ngOnInit() {
    this.generateCalendar();
  }

  generateCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    let currentWeek: Date[] = [];
    this.weeks = [];

    // Add days from previous month
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      currentWeek.push(new Date(year, month - 1, prevMonthDays - i));
    }

    // Add days from current month
    for (let day = 1; day <= totalDays; day++) {
      if (currentWeek.length === 7) {
        this.weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(new Date(year, month, day));
    }

    // Add days from next month
    const remainingDays = 7 - currentWeek.length;
    for (let day = 1; day <= remainingDays; day++) {
      currentWeek.push(new Date(year, month + 1, day));
    }
    this.weeks.push(currentWeek);
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  isOtherMonth(date: Date): boolean {
    return date.getMonth() !== this.currentDate.getMonth();
  }

  getEventsForDay(date: Date): CalendarEvent[] {
    return this.events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.getDate() === date.getDate() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getFullYear() === date.getFullYear();
    });
  }

  onEventClick(event: CalendarEvent) {
    this.eventClick.emit(event);
  }

  navigateMonth(direction: number) {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + direction,
      1
    );
    this.generateCalendar();
  }
} 