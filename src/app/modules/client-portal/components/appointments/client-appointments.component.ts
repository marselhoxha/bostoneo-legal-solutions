import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ClientPortalService, ClientAppointment, ClientAppointmentRequest, ClientCase } from '../../services/client-portal.service';

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

  // View toggle
  activeTab: 'upcoming' | 'past' = 'upcoming';

  // Request modal
  showRequestModal = false;
  requestForm: ClientAppointmentRequest = {
    caseId: 0,
    title: '',
    description: '',
    type: 'CONSULTATION',
    preferredDateTime: '',
    alternativeDateTime: '',
    preferVirtual: false,
    notes: ''
  };

  appointmentTypes = [
    { value: 'CONSULTATION', label: 'Consultation' },
    { value: 'CASE_REVIEW', label: 'Case Review' },
    { value: 'DOCUMENT_SIGNING', label: 'Document Signing' },
    { value: 'COURT_PREPARATION', label: 'Court Preparation' },
    { value: 'DEPOSITION', label: 'Deposition' },
    { value: 'OTHER', label: 'Other' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private clientPortalService: ClientPortalService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['caseId']) {
        this.requestForm.caseId = parseInt(params['caseId']);
      }
    });

    this.loadAppointments();
    this.loadCases();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAppointments(): void {
    this.loading = true;
    this.error = null;

    this.clientPortalService.getAppointments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (appointments) => {
          this.appointments = appointments || [];
          this.categorizeAppointments();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading appointments:', err);
          this.error = 'Failed to load appointments. Please try again.';
          this.loading = false;
        }
      });
  }

  loadCases(): void {
    this.clientPortalService.getCases(0, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.cases = response.content || [];
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

    // Sort upcoming by date ascending, past by date descending
    this.upcomingAppointments.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    this.pastAppointments.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  setActiveTab(tab: 'upcoming' | 'past'): void {
    this.activeTab = tab;
  }

  get currentAppointments(): ClientAppointment[] {
    return this.activeTab === 'upcoming' ? this.upcomingAppointments : this.pastAppointments;
  }

  // Request modal methods
  openRequestModal(): void {
    this.showRequestModal = true;
    this.resetRequestForm();
  }

  closeRequestModal(): void {
    this.showRequestModal = false;
    this.resetRequestForm();
  }

  resetRequestForm(): void {
    this.requestForm = {
      caseId: 0,
      title: '',
      description: '',
      type: 'CONSULTATION',
      preferredDateTime: '',
      alternativeDateTime: '',
      preferVirtual: false,
      notes: ''
    };
  }

  submitRequest(): void {
    if (!this.requestForm.caseId || !this.requestForm.title || !this.requestForm.preferredDateTime) {
      return;
    }

    this.submitting = true;
    this.error = null;

    this.clientPortalService.requestAppointment(this.requestForm)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = 'Appointment request submitted successfully! Your attorney will confirm shortly.';
          this.submitting = false;
          this.closeRequestModal();
          this.loadAppointments();
          setTimeout(() => this.successMessage = null, 5000);
        },
        error: (err) => {
          console.error('Error requesting appointment:', err);
          this.error = 'Failed to submit appointment request. Please try again.';
          this.submitting = false;
        }
      });
  }

  cancelAppointment(appointment: ClientAppointment): void {
    if (!confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }

    this.clientPortalService.cancelAppointment(appointment.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = 'Appointment cancelled successfully.';
          this.loadAppointments();
          setTimeout(() => this.successMessage = null, 3000);
        },
        error: (err) => {
          console.error('Error cancelling appointment:', err);
          this.error = 'Failed to cancel appointment. Please try again.';
        }
      });
  }

  // Formatting methods
  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'SCHEDULED': 'bg-primary',
      'CONFIRMED': 'bg-success',
      'PENDING': 'bg-warning',
      'CANCELLED': 'bg-danger',
      'COMPLETED': 'bg-secondary',
      'RESCHEDULED': 'bg-info'
    };
    return statusMap[status] || 'bg-secondary';
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
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  formatType(type: string): string {
    if (!type) return '-';
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  canCancel(appointment: ClientAppointment): boolean {
    const startTime = new Date(appointment.startTime);
    const now = new Date();
    const hoursUntil = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntil > 24 && appointment.status !== 'CANCELLED' && appointment.status !== 'COMPLETED';
  }
}
