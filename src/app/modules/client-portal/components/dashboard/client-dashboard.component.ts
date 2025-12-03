import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize, timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ClientPortalService, ClientDashboard, ClientCase, ClientActivity } from '../../services/client-portal.service';

@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './client-dashboard.component.html',
  styleUrls: ['./client-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientDashboardComponent implements OnInit, OnDestroy {
  dashboard: ClientDashboard | null = null;
  loading = true;
  error: string | null = null;
  currentDate = new Date();

  // UI state
  showAllCases = false;
  showAllActivities = false;

  private destroy$ = new Subject<void>();

  constructor(
    private clientPortalService: ClientPortalService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.clientPortalService.getDashboard()
      .pipe(
        takeUntil(this.destroy$),
        timeout(15000), // 15 second timeout
        catchError(err => {
          console.error('Error loading dashboard:', err);
          this.error = 'Failed to load dashboard data. Please try again.';
          this.loading = false;
          this.cdr.markForCheck();
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (data) => {
          if (data) {
            this.dashboard = data;
          }
          this.cdr.markForCheck();
        }
      });
  }

  // Greeting helpers
  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  getWelcomeMessage(): string {
    if (!this.dashboard) return 'Welcome to your client portal.';

    const parts: string[] = [];

    if (this.dashboard.activeCases > 0) {
      parts.push(`You have ${this.dashboard.activeCases} active case${this.dashboard.activeCases !== 1 ? 's' : ''}`);
    }

    if (this.dashboard.upcomingAppointments > 0) {
      parts.push(`${this.dashboard.upcomingAppointments} upcoming appointment${this.dashboard.upcomingAppointments !== 1 ? 's' : ''}`);
    }

    if (this.dashboard.unreadMessages > 0) {
      parts.push(`${this.dashboard.unreadMessages} unread message${this.dashboard.unreadMessages !== 1 ? 's' : ''}`);
    }

    if (parts.length === 0) {
      return 'Welcome to your client portal. Your dashboard is up to date.';
    }

    return parts.join(', ') + '.';
  }

  // Toggle methods
  toggleShowAllCases(): void {
    this.showAllCases = !this.showAllCases;
    this.cdr.markForCheck();
  }

  toggleShowAllActivities(): void {
    this.showAllActivities = !this.showAllActivities;
    this.cdr.markForCheck();
  }

  // Case helpers
  getCaseAvatarClass(caseType: string | undefined): string {
    const typeMap: { [key: string]: string } = {
      'Criminal': 'bg-danger-subtle text-danger',
      'Civil': 'bg-primary-subtle text-primary',
      'Family': 'bg-warning-subtle text-warning',
      'Corporate': 'bg-info-subtle text-info',
      'Immigration': 'bg-success-subtle text-success',
      'Real Estate': 'bg-secondary-subtle text-secondary',
      'Personal Injury': 'bg-danger-subtle text-danger',
      'Bankruptcy': 'bg-warning-subtle text-warning'
    };
    return typeMap[caseType || ''] || 'bg-primary-subtle text-primary';
  }

  getCaseIcon(caseType: string | undefined): string {
    const iconMap: { [key: string]: string } = {
      'Criminal': 'ri-scales-3-line',
      'Civil': 'ri-file-list-3-line',
      'Family': 'ri-parent-line',
      'Corporate': 'ri-building-line',
      'Immigration': 'ri-global-line',
      'Real Estate': 'ri-home-line',
      'Personal Injury': 'ri-heart-pulse-line',
      'Bankruptcy': 'ri-bank-line'
    };
    return iconMap[caseType || ''] || 'ri-briefcase-line';
  }

  getCaseStatusBadgeClass(status: string | undefined): string {
    const statusMap: { [key: string]: string } = {
      'OPEN': 'case-badge-primary',
      'ACTIVE': 'case-badge-primary',
      'IN_PROGRESS': 'case-badge-info',
      'DISCOVERY': 'case-badge-info',
      'PENDING': 'case-badge-warning',
      'CLOSED': 'case-badge-secondary',
      'SETTLED': 'case-badge-success',
      'WON': 'case-badge-success',
      'LOST': 'case-badge-danger'
    };
    return statusMap[status || ''] || 'case-badge-secondary';
  }

  formatStatus(status: string | undefined): string {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'OPEN': 'bg-primary',
      'ACTIVE': 'bg-primary',
      'IN_PROGRESS': 'bg-info',
      'DISCOVERY': 'bg-info',
      'PENDING': 'bg-warning',
      'CLOSED': 'bg-secondary',
      'SETTLED': 'bg-success',
      'WON': 'bg-success',
      'LOST': 'bg-danger'
    };
    return statusMap[status] || 'bg-secondary';
  }

  // Activity helpers
  getActivityIcon(activityType: string): string {
    const iconMap: { [key: string]: string } = {
      'DOCUMENT_UPLOADED': 'ri-upload-2-line',
      'DOCUMENT_DOWNLOADED': 'ri-download-2-line',
      'STATUS_CHANGED': 'ri-exchange-line',
      'HEARING_SCHEDULED': 'ri-calendar-check-line',
      'MESSAGE_RECEIVED': 'ri-message-2-line',
      'NOTE_ADDED': 'ri-sticky-note-line',
      'PAYMENT_RECEIVED': 'ri-money-dollar-circle-line',
      'CASE_CREATED': 'ri-briefcase-line',
      'CASE_UPDATED': 'ri-edit-line'
    };
    return iconMap[activityType] || 'ri-information-line';
  }

  getActivityColor(activityType: string): string {
    const colorMap: { [key: string]: string } = {
      'DOCUMENT_UPLOADED': 'primary',
      'DOCUMENT_DOWNLOADED': 'info',
      'STATUS_CHANGED': 'warning',
      'HEARING_SCHEDULED': 'danger',
      'MESSAGE_RECEIVED': 'success',
      'NOTE_ADDED': 'info',
      'PAYMENT_RECEIVED': 'success',
      'CASE_CREATED': 'primary',
      'CASE_UPDATED': 'info'
    };
    return colorMap[activityType] || 'secondary';
  }

  // Appointment helpers
  getAppointmentDay(dateString: string | undefined): string {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.getDate().toString();
  }

  getAppointmentMonth(dateString: string | undefined): string {
    if (!dateString) return '---';
    const date = new Date(dateString);
    return date.toLocaleString('default', { month: 'short' }).toUpperCase();
  }

  getTimeUntil(dateString: string | undefined): string {
    if (!dateString) return '--';

    const appointmentDate = new Date(dateString);
    const now = new Date();
    const diff = appointmentDate.getTime() - now.getTime();

    if (diff < 0) return 'Past';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    return `${minutes} min${minutes !== 1 ? 's' : ''}`;
  }

  // Format helpers
  formatDate(dateString: string | undefined): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatDateTime(dateString: string | undefined): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  formatCurrency(amount: number | undefined): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  }
}
