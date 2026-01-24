import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, filter, debounceTime } from 'rxjs/operators';
import { ClientPortalService, ClientAppointment, ClientAppointmentRequest, ClientCase } from '../../services/client-portal.service';
import { AppointmentService, AvailableSlot } from 'src/app/core/services/appointment.service';
import { PushNotificationService } from 'src/app/core/services/push-notification.service';
import Swal from 'sweetalert2';

interface BookingStep {
  number: number;
  title: string;
  icon: string;
  completed: boolean;
}

@Component({
  selector: 'app-client-appointments',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './client-appointments.component.html',
  styleUrls: ['./client-appointments.component.scss']
})
export class ClientAppointmentsComponent implements OnInit, OnDestroy {
  appointments: ClientAppointment[] = [];
  upcomingAppointments: ClientAppointment[] = [];
  pastAppointments: ClientAppointment[] = [];
  cases: ClientCase[] = [];

  loading = true;
  submitting = false;
  error: string | null = null;
  successMessage: string | null = null;
  slotError: string | null = null;

  // View toggle
  activeTab: 'upcoming' | 'past' = 'upcoming';

  // Booking modal state
  showBookingModal = false;
  currentStep = 1;
  bookingSteps: BookingStep[] = [
    { number: 1, title: 'Case', icon: 'ri-briefcase-line', completed: false },
    { number: 2, title: 'Date', icon: 'ri-calendar-line', completed: false },
    { number: 3, title: 'Time', icon: 'ri-time-line', completed: false },
    { number: 4, title: 'Confirm', icon: 'ri-check-double-line', completed: false }
  ];

  // Slot selection
  availableSlots: AvailableSlot[] = [];
  loadingSlots = false;
  selectedDate: string = '';
  selectedSlot: AvailableSlot | null = null;
  selectedAttorneyId: number | null = null;
  selectedAttorneyName: string = '';
  useCustomTime = false;
  attorneyHasNoAvailability = false;

  // Attorney's active days (0=Sunday, 1=Monday, etc.)
  attorneyActiveDays: number[] = [];
  loadingActiveDays = false;

  // Available dates (next 30 days)
  availableDates: Date[] = [];

  // Reschedule modal state
  showRescheduleModal = false;
  rescheduleAppointment: ClientAppointment | null = null;
  rescheduleDate: string = '';
  rescheduleSlots: AvailableSlot[] = [];
  loadingRescheduleSlots = false;
  selectedRescheduleSlot: AvailableSlot | null = null;
  rescheduling = false;
  rescheduleReason: string = '';

  // Request form
  requestForm: ClientAppointmentRequest = {
    caseId: 0,
    title: '',
    description: '',
    type: 'CLIENT_MEETING',
    preferredDateTime: '',
    alternativeDateTime: '',
    preferVirtual: false,
    notes: ''
  };

  appointmentTypes = [
    { value: 'CLIENT_MEETING', label: 'Client Meeting', icon: 'ri-user-line' },
    { value: 'CONSULTATION', label: 'Consultation', icon: 'ri-chat-3-line' },
    { value: 'CASE_REVIEW', label: 'Case Review', icon: 'ri-file-search-line' },
    { value: 'DOCUMENT_SIGNING', label: 'Document Signing', icon: 'ri-file-edit-line' },
    { value: 'COURT_PREPARATION', label: 'Court Preparation', icon: 'ri-gavel-line' },
    { value: 'DEPOSITION', label: 'Deposition', icon: 'ri-mic-line' },
    { value: 'OTHER', label: 'Other', icon: 'ri-calendar-event-line' }
  ];

  private destroy$ = new Subject<void>();
  private refreshTrigger$ = new Subject<void>();
  private hasLoadedOnce = false;

  constructor(
    private clientPortalService: ClientPortalService,
    private appointmentService: AppointmentService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private pushNotificationService: PushNotificationService
  ) {
    this.initializeAvailableDates();

    // Debounce refresh triggers to prevent rapid consecutive reloads
    this.refreshTrigger$.pipe(
      debounceTime(500),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.loadAppointmentsQuiet();
    });
  }

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['caseId']) {
        this.requestForm.caseId = parseInt(params['caseId']);
      }
    });

    // Always load fresh data when component initializes
    this.loadAppointments();
    this.loadCases();
    this.subscribeToNotifications();

    // Also refresh when route is activated (handles navigation back to this page)
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      filter((event: NavigationEnd) => event.urlAfterRedirects.includes('/client/appointments')),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      // Refresh data when navigating to this page
      this.loadAppointmentsQuiet();
    });
  }

  /**
   * Subscribe to push notifications for real-time appointment updates
   * Only refreshes when relevant appointment notification is received
   */
  private subscribeToNotifications(): void {
    this.pushNotificationService.notification$
      .pipe(
        takeUntil(this.destroy$),
        filter(notification => {
          if (!notification) return false;
          // Only refresh for appointment-related notifications
          const type = (notification?.data?.type || '').toUpperCase();
          return type.includes('APPOINTMENT') || type.includes('CALENDAR');
        })
      )
      .subscribe(() => {
        this.refreshTrigger$.next();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeAvailableDates(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Include all days including weekends - attorney availability will determine what's available
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      this.availableDates.push(date);
    }
  }

  loadAppointments(): void {
    // Only show loading spinner if we have no data to display yet
    if (!this.hasLoadedOnce || this.appointments.length === 0) {
      this.loading = true;
      this.cdr.detectChanges();
    }
    this.error = null;

    this.clientPortalService.getAppointments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (appointments) => {
          this.appointments = appointments || [];
          this.categorizeAppointments();
          this.loading = false;
          this.hasLoadedOnce = true;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading appointments:', err);
          this.error = 'Failed to load appointments. Please try again.';
          this.loading = false;
          this.hasLoadedOnce = true;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Quiet refresh - updates data without showing loading spinner
   */
  private loadAppointmentsQuiet(): void {
    this.clientPortalService.getAppointments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (appointments) => {
          this.appointments = appointments || [];
          this.categorizeAppointments();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading appointments:', err);
        }
      });
  }

  loadCases(): void {
    this.clientPortalService.getCases(0, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.cases = response.content || [];
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading cases:', err);
        }
      });
  }

  categorizeAppointments(): void {
    const now = new Date();
    this.upcomingAppointments = this.appointments.filter(a => new Date(a.startTime) >= now);
    this.pastAppointments = this.appointments.filter(a => new Date(a.startTime) < now);

    this.upcomingAppointments.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    this.pastAppointments.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    this.cdr.detectChanges();
  }

  setActiveTab(tab: 'upcoming' | 'past'): void {
    this.activeTab = tab;
  }

  // TrackBy functions to optimize *ngFor rendering and prevent flickering
  trackByAppointmentId(index: number, appt: ClientAppointment): number {
    return appt.id;
  }

  trackByCaseId(index: number, c: ClientCase): number {
    return c.id;
  }

  trackBySlotTime(index: number, slot: AvailableSlot): string {
    return slot.startTime;
  }

  trackByDate(index: number, date: Date): number {
    return date.getTime();
  }

  get currentAppointments(): ClientAppointment[] {
    return this.activeTab === 'upcoming' ? this.upcomingAppointments : this.pastAppointments;
  }

  // =====================================================
  // BOOKING MODAL METHODS
  // =====================================================

  openBookingModal(): void {
    this.showBookingModal = true;
    this.resetBooking();
    this.cdr.detectChanges();
  }

  closeBookingModal(): void {
    this.showBookingModal = false;
    this.resetBooking();
    this.cdr.detectChanges();
  }

  resetBooking(): void {
    this.currentStep = 1;
    this.bookingSteps.forEach(s => s.completed = false);
    this.selectedDate = '';
    this.selectedSlot = null;
    this.selectedAttorneyId = null;
    this.selectedAttorneyName = '';
    this.availableSlots = [];
    this.useCustomTime = false;
    this.slotError = null;
    this.attorneyHasNoAvailability = false;
    this.requestForm = {
      caseId: 0,
      title: '',
      description: '',
      type: 'CLIENT_MEETING',
      preferredDateTime: '',
      alternativeDateTime: '',
      preferVirtual: false,
      notes: ''
    };
    this.cdr.detectChanges();
  }

  // Step 1: Case Selection
  onCaseSelected(): void {
    if (this.requestForm.caseId) {
      const selectedCase = this.cases.find(c => c.id === this.requestForm.caseId);
      if (selectedCase) {
        this.selectedAttorneyName = selectedCase.attorneyName || selectedCase.leadAttorney || 'Your Attorney';
        this.bookingSteps[0].completed = true;
        this.currentStep = 2;
        this.cdr.detectChanges();

        // Fetch attorney's active days for the date picker
        this.loadAttorneyActiveDays();
      }
    }
  }

  // Load attorney's availability to know which days are available
  private loadAttorneyActiveDays(): void {
    if (!this.requestForm.caseId) return;

    this.loadingActiveDays = true;
    this.attorneyActiveDays = [];

    this.clientPortalService.getCaseAttorneyId(this.requestForm.caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (attorneyId) => {
          if (attorneyId) {
            this.selectedAttorneyId = attorneyId;
            // Fetch attorney's availability settings
            this.appointmentService.getAttorneyAvailability(attorneyId)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (availability) => {
                  // Get active days (dayOfWeek values where isActive is true)
                  this.attorneyActiveDays = availability
                    .filter(a => a.isActive)
                    .map(a => a.dayOfWeek);
                  this.loadingActiveDays = false;
                  this.cdr.detectChanges();
                },
                error: () => {
                  // If we can't get availability, allow all days (fallback)
                  this.attorneyActiveDays = [0, 1, 2, 3, 4, 5, 6];
                  this.loadingActiveDays = false;
                  this.cdr.detectChanges();
                }
              });
          } else {
            this.loadingActiveDays = false;
            this.cdr.detectChanges();
          }
        },
        error: () => {
          this.loadingActiveDays = false;
          this.cdr.detectChanges();
        }
      });
  }

  // Check if a date is available based on attorney's active days
  isDayAvailable(date: Date): boolean {
    if (this.loadingActiveDays || this.attorneyActiveDays.length === 0) {
      return true; // Allow all days while loading or if no data
    }
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    return this.attorneyActiveDays.includes(dayOfWeek);
  }

  // Step 2: Date Selection
  selectDate(date: Date): void {
    this.selectedDate = this.formatDateForApi(date);
    this.useCustomTime = false;
    this.slotError = null;
    this.attorneyHasNoAvailability = false;

    // Immediately transition to step 3 to show loading state
    this.bookingSteps[1].completed = true;
    this.currentStep = 3;
    this.cdr.detectChanges();

    // Then load the available slots
    this.loadAvailableSlots();
  }

  loadAvailableSlots(): void {
    if (!this.requestForm.caseId || !this.selectedDate) return;

    this.loadingSlots = true;
    this.availableSlots = [];
    this.slotError = null;
    this.attorneyHasNoAvailability = false;
    this.cdr.detectChanges();

    this.clientPortalService.getCaseAttorneyId(this.requestForm.caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (attorneyId) => {
          if (attorneyId) {
            this.selectedAttorneyId = attorneyId;
            this.fetchSlotsForAttorney(attorneyId);
          } else {
            this.loadingSlots = false;
            this.slotError = 'No attorney assigned to this case yet. Please use custom time request.';
            this.attorneyHasNoAvailability = true;
            this.cdr.detectChanges();
          }
        },
        error: (err) => {
          console.error('Error getting attorney ID:', err);
          this.loadingSlots = false;
          this.slotError = 'Could not load attorney information. Please try again.';
          this.cdr.detectChanges();
        }
      });
  }

  fetchSlotsForAttorney(attorneyId: number): void {
    this.appointmentService.getAvailableSlots(attorneyId, this.selectedDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (slots) => {
          this.availableSlots = slots.filter(s => s.available);
          this.loadingSlots = false;

          if (this.availableSlots.length === 0) {
            this.slotError = 'No available slots on this date. Try another date or request a custom time.';
          }

          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading slots:', err);
          this.loadingSlots = false;
          this.slotError = 'Could not load available times. Try another date or request a custom time.';
          this.cdr.detectChanges();
        }
      });
  }

  // Step 3: Time Selection
  selectSlot(slot: AvailableSlot): void {
    this.selectedSlot = slot;
    this.requestForm.preferredDateTime = slot.startTime;
    this.selectedAttorneyName = slot.attorneyName;
    this.useCustomTime = false;
    this.bookingSteps[2].completed = true;
    this.currentStep = 4;
    this.cdr.detectChanges();
  }

  toggleCustomTime(): void {
    this.useCustomTime = !this.useCustomTime;
    if (this.useCustomTime) {
      this.selectedSlot = null;
    }
    this.cdr.detectChanges();
  }

  onCustomTimeSelected(): void {
    if (this.requestForm.preferredDateTime) {
      this.bookingSteps[2].completed = true;
      this.currentStep = 4;
      this.cdr.detectChanges();
    }
  }

  // Step 4: Confirmation & Submit
  submitBooking(): void {
    if (!this.requestForm.caseId || !this.requestForm.preferredDateTime) {
      return;
    }

    // Set default title if not provided
    if (!this.requestForm.title) {
      const typeLabel = this.appointmentTypes.find(t => t.value === this.requestForm.type)?.label || 'Appointment';
      this.requestForm.title = typeLabel;
    }

    this.submitting = true;
    this.error = null;
    this.cdr.detectChanges();

    this.clientPortalService.requestAppointment(this.requestForm)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = this.selectedSlot
            ? 'Appointment booked successfully! Your attorney will confirm shortly.'
            : 'Appointment request submitted! Your attorney will review and confirm the time.';
          this.submitting = false;
          this.closeBookingModal();
          this.loadAppointments();
          this.cdr.detectChanges();
          setTimeout(() => {
            this.successMessage = null;
            this.cdr.detectChanges();
          }, 5000);
        },
        error: (err) => {
          console.error('Error requesting appointment:', err);
          this.error = 'Failed to submit appointment request. Please try again.';
          this.submitting = false;
          this.cdr.detectChanges();
        }
      });
  }

  // Navigation
  goToStep(step: number): void {
    if (step < this.currentStep) {
      // Reset downstream data when going back
      if (step <= 2) {
        this.availableSlots = [];
        this.selectedSlot = null;
        this.useCustomTime = false;
        this.slotError = null;
      }
      if (step <= 1) {
        this.selectedDate = '';
      }
      this.currentStep = step;
      this.cdr.detectChanges();
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.goToStep(this.currentStep - 1);
    }
  }

  // =====================================================
  // RESCHEDULE MODAL METHODS
  // =====================================================

  openRescheduleModal(appointment: ClientAppointment): void {
    this.rescheduleAppointment = appointment;
    this.rescheduleDate = '';
    this.rescheduleSlots = [];
    this.selectedRescheduleSlot = null;
    this.rescheduleReason = '';
    this.showRescheduleModal = true;
    this.cdr.detectChanges();
  }

  closeRescheduleModal(): void {
    this.showRescheduleModal = false;
    this.rescheduleAppointment = null;
    this.rescheduleDate = '';
    this.rescheduleSlots = [];
    this.selectedRescheduleSlot = null;
    this.rescheduling = false;
    this.rescheduleReason = '';
    this.cdr.detectChanges();
  }

  selectRescheduleDate(date: Date): void {
    this.rescheduleDate = this.formatDateForApi(date);
    this.loadRescheduleSlots();
    this.cdr.detectChanges();
  }

  loadRescheduleSlots(): void {
    if (!this.rescheduleAppointment || !this.rescheduleDate) return;

    this.loadingRescheduleSlots = true;
    this.rescheduleSlots = [];
    this.cdr.detectChanges();

    // Get attorney ID from the appointment's case
    this.clientPortalService.getCaseAttorneyId(this.rescheduleAppointment.caseId!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (attorneyId) => {
          if (attorneyId) {
            this.appointmentService.getAvailableSlots(attorneyId, this.rescheduleDate)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (slots) => {
                  this.rescheduleSlots = slots.filter(s => s.available);
                  this.loadingRescheduleSlots = false;
                  this.cdr.detectChanges();
                },
                error: () => {
                  this.loadingRescheduleSlots = false;
                  this.cdr.detectChanges();
                }
              });
          } else {
            this.loadingRescheduleSlots = false;
            this.cdr.detectChanges();
          }
        },
        error: () => {
          this.loadingRescheduleSlots = false;
          this.cdr.detectChanges();
        }
      });
  }

  selectRescheduleSlot(slot: AvailableSlot): void {
    this.selectedRescheduleSlot = slot;
    this.cdr.detectChanges();
  }

  confirmReschedule(): void {
    if (!this.rescheduleAppointment || !this.selectedRescheduleSlot) return;

    this.rescheduling = true;
    this.cdr.detectChanges();

    this.clientPortalService.rescheduleAppointment(
      this.rescheduleAppointment.id,
      this.selectedRescheduleSlot.startTime,
      this.rescheduleReason || undefined
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = 'Reschedule request sent! Your attorney will review and confirm.';
          this.rescheduling = false;
          this.closeRescheduleModal();
          this.loadAppointments();
          setTimeout(() => {
            this.successMessage = null;
          }, 5000);
        },
        error: (err) => {
          console.error('Error rescheduling appointment:', err);
          this.error = 'Failed to reschedule appointment. Please try again.';
          this.rescheduling = false;
          this.cdr.detectChanges();
        }
      });
  }

  isRescheduleDateSelected(date: Date): boolean {
    return this.rescheduleDate === this.formatDateForApi(date);
  }

  // Cancel appointment
  cancelAppointment(appointment: ClientAppointment): void {
    Swal.fire({
      title: 'Cancel Appointment?',
      text: `Are you sure you want to cancel your appointment "${appointment.title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, cancel it',
      cancelButtonText: 'No, keep it'
    }).then((result) => {
      if (result.isConfirmed) {
        this.clientPortalService.cancelAppointment(appointment.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              Swal.fire({
                title: 'Cancelled!',
                text: 'Your appointment has been cancelled.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
              });
              this.loadAppointments();
              this.cdr.detectChanges();
            },
            error: (err) => {
              console.error('Error cancelling appointment:', err);
              Swal.fire({
                title: 'Error',
                text: 'Failed to cancel appointment. Please try again.',
                icon: 'error'
              });
              this.cdr.detectChanges();
            }
          });
      }
    });
  }

  canReschedule(appointment: ClientAppointment): boolean {
    const startTime = new Date(appointment.startTime);
    const now = new Date();
    const hoursUntil = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    // Allow reschedule if more than 2 hours before appointment
    // Don't allow if already pending reschedule
    return hoursUntil > 2 &&
           appointment.status !== 'CANCELLED' &&
           appointment.status !== 'COMPLETED' &&
           appointment.status !== 'PENDING_RESCHEDULE' &&
           (appointment.status === 'CONFIRMED' || appointment.status === 'PENDING');
  }

  isPendingReschedule(appointment: ClientAppointment): boolean {
    return appointment.status === 'PENDING_RESCHEDULE';
  }

  // =====================================================
  // FORMATTING HELPERS
  // =====================================================

  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'SCHEDULED': 'badge-primary',
      'CONFIRMED': 'badge-success',
      'PENDING': 'badge-warning',
      'CANCELLED': 'badge-danger',
      'COMPLETED': 'badge-secondary',
      'RESCHEDULED': 'badge-info',
      'PENDING_RESCHEDULE': 'badge-warning'
    };
    return statusMap[status] || 'badge-secondary';
  }

  getTypeIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      'CONSULTATION': 'ri-chat-3-line',
      'CASE_REVIEW': 'ri-file-search-line',
      'DOCUMENT_SIGNING': 'ri-file-edit-line',
      'COURT_PREPARATION': 'ri-gavel-line',
      'DEPOSITION': 'ri-mic-line',
      'HEARING': 'ri-government-line',
      'OTHER': 'ri-calendar-event-line'
    };
    return iconMap[type] || 'ri-calendar-event-line';
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatTime(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  formatSlotTime(slot: AvailableSlot): string {
    const start = new Date(slot.startTime);
    return start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  formatDateForApi(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  formatDateDisplay(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  formatDuration(start: string, end: string): string {
    if (!start || !end) return '-';
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    if (diff < 60) return `${diff} min`;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  formatStatus(status: string): string {
    if (!status) return '-';
    const statusMap: { [key: string]: string } = {
      'PENDING': 'Awaiting Approval',
      'CONFIRMED': 'Confirmed',
      'SCHEDULED': 'Scheduled',
      'CANCELLED': 'Cancelled',
      'COMPLETED': 'Completed',
      'RESCHEDULED': 'Rescheduled',
      'DECLINED': 'Declined',
      'PENDING_RESCHEDULE': 'Reschedule Pending'
    };
    return statusMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  canCancel(appointment: ClientAppointment): boolean {
    const startTime = new Date(appointment.startTime);
    const now = new Date();
    const hoursUntil = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    // Allow cancel if more than 2 hours before appointment
    return hoursUntil > 2 && appointment.status !== 'CANCELLED' && appointment.status !== 'COMPLETED';
  }

  getSelectedCaseName(): string {
    const selectedCase = this.cases.find(c => c.id === this.requestForm.caseId);
    return selectedCase ? `${selectedCase.caseNumber} - ${selectedCase.title}` : '';
  }

  isDateSelected(date: Date): boolean {
    return this.selectedDate === this.formatDateForApi(date);
  }

  getDayOfWeek(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  getDayNumber(date: Date): string {
    return date.getDate().toString();
  }

  getMonth(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short' });
  }

  isWeekend(date: Date): boolean {
    return date.getDay() === 0 || date.getDay() === 6;
  }
}
