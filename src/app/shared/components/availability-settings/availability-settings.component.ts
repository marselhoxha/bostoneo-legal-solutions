import { Component, OnInit, OnDestroy, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { AppointmentService, AttorneyAvailability } from 'src/app/core/services/appointment.service';

interface DayAvailability {
  dayOfWeek: number;
  dayName: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  bufferMinutes: number;
  id?: number;
}

@Component({
  selector: 'app-availability-settings',
  templateUrl: './availability-settings.component.html',
  styleUrls: ['./availability-settings.component.scss']
})
export class AvailabilitySettingsComponent implements OnInit, OnDestroy {
  @Output() saved = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  days: DayAvailability[] = [];
  loading = true;
  saving = false;
  error: string | null = null;

  timeSlots: string[] = [];
  durationOptions = [15, 30, 45, 60, 90, 120];
  bufferOptions = [0, 5, 10, 15, 30];

  private destroy$ = new Subject<void>();

  constructor(
    private appointmentService: AppointmentService,
    private cdr: ChangeDetectorRef
  ) {
    this.generateTimeSlots();
  }

  ngOnInit(): void {
    this.initializeDays();
    this.loadAvailability();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private generateTimeSlots(): void {
    for (let hour = 6; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const hourStr = hour.toString().padStart(2, '0');
        const minuteStr = minute.toString().padStart(2, '0');
        this.timeSlots.push(`${hourStr}:${minuteStr}`);
      }
    }
  }

  private initializeDays(): void {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    this.days = dayNames.map((name, index) => ({
      dayOfWeek: index,
      dayName: name,
      isActive: index >= 1 && index <= 5, // Mon-Fri active by default
      startTime: '09:00',
      endTime: '17:00',
      slotDurationMinutes: 30,
      bufferMinutes: 15
    }));
  }

  private loadAvailability(): void {
    this.loading = true;
    this.error = null;

    this.appointmentService.getMyAvailability()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (availability) => {
          if (availability && availability.length > 0) {
            // Update days with saved availability
            availability.forEach(avail => {
              const day = this.days.find(d => d.dayOfWeek === avail.dayOfWeek);
              if (day) {
                day.id = avail.id;
                day.isActive = avail.isActive;
                day.startTime = avail.startTime.substring(0, 5); // HH:mm format
                day.endTime = avail.endTime.substring(0, 5);
                day.slotDurationMinutes = avail.slotDurationMinutes;
                day.bufferMinutes = avail.bufferMinutes;
              }
            });
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading availability:', err);
          this.error = 'Failed to load availability settings';
        }
      });
  }

  saveAvailability(): void {
    this.saving = true;
    this.error = null;

    const availabilityList: AttorneyAvailability[] = this.days.map(day => ({
      attorneyId: 0, // Will be set by backend from auth
      dayOfWeek: day.dayOfWeek,
      startTime: day.startTime + ':00',
      endTime: day.endTime + ':00',
      slotDurationMinutes: day.slotDurationMinutes,
      bufferMinutes: day.bufferMinutes,
      isActive: day.isActive
    }));

    this.appointmentService.setMyAvailability(availabilityList)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: () => {
          this.saved.emit();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error saving availability:', err);
          this.error = 'Failed to save availability settings';
          this.cdr.detectChanges();
        }
      });
  }

  toggleDay(day: DayAvailability): void {
    // Note: ngModel already updates day.isActive, so we just need to trigger change detection
    this.cdr.detectChanges();
  }

  copyToWeekdays(sourceDay: DayAvailability): void {
    // Copy settings from source day to all weekdays (Mon-Fri)
    this.days.filter(d => d.dayOfWeek >= 1 && d.dayOfWeek <= 5).forEach(d => {
      d.startTime = sourceDay.startTime;
      d.endTime = sourceDay.endTime;
      d.slotDurationMinutes = sourceDay.slotDurationMinutes;
      d.bufferMinutes = sourceDay.bufferMinutes;
    });
    this.cdr.detectChanges();
  }

  cancel(): void {
    this.closed.emit();
  }

  formatTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  get activeDaysCount(): number {
    return this.days.filter(d => d.isActive).length;
  }
}
