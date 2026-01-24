import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { User } from 'src/app/interface/user';
import { ClientPortalService, ClientCase } from 'src/app/modules/client-portal/services/client-portal.service';

@Component({
  selector: 'app-client-dashboard',
  templateUrl: './client-dashboard.component.html',
  styleUrls: ['./client-dashboard.component.css']
})
export class ClientDashboardComponent implements OnInit, OnDestroy {

  @Input() currentUser: User | null = null;
  @Input() isDarkMode: boolean = false;

  // Date and UI state
  currentDate = new Date();
  showAllCases = false;

  // Client specific stats
  myCases = 0;
  activeDocuments = 0;
  pendingInvoices = 0;
  totalDue = 0;
  upcomingAppointments = 0;
  unreadMessages = 0;

  // Client data
  clientCases: any[] = [];
  recentDocuments: any[] = [];
  clientInvoices: any[] = [];
  appointments: any[] = [];
  caseTimeline: any[] = [];
  
  // Charts
  caseProgressChart: any = null;
  paymentHistoryChart: any = null;

  // Loading states
  isLoading = true;
  casesLoading = false;
  documentsLoading = false;
  invoicesLoading = false;

  // Next appointment
  nextAppointment: any = null;

  // Countdown timer
  countdownDays = 0;
  countdownHours = 0;
  countdownMinutes = 0;
  countdownSeconds = 0;
  private countdownInterval: any = null;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private clientPortalService: ClientPortalService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.initializeClient();
    this.loadClientData();
    this.initializeCharts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  private initializeClient(): void {
    // The ClientPortalService handles user-to-client mapping on the backend
    // No need for client-side mapping
  }

  private loadClientData(): void {
    this.isLoading = true;
    
    // Load client-specific cases
    this.loadClientCases();
    this.loadClientDocuments();
    this.loadClientInvoices();
    this.loadAppointments();
    
    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 1000);
  }

  private loadClientCases(): void {
    this.casesLoading = true;

    // Use ClientPortalService which handles user-to-client mapping on the backend
    this.clientPortalService.getCases(0, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.content) {
            this.clientCases = response.content.map((c: ClientCase) => ({
              id: c.id,
              caseNumber: c.caseNumber,
              title: c.title,
              status: c.status,
              caseType: c.type,
              attorney: c.attorneyName,
              progress: this.calculateProgress(c.status),
              documentCount: c.documentCount,
              upcomingAppointments: c.upcomingAppointments,
              createdAt: c.openDate,
              lastUpdated: c.lastUpdated
            }));
            this.myCases = response.totalElements || this.clientCases.length;
          }
          this.casesLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading cases:', error);
          this.casesLoading = false;
          this.clientCases = [];
          this.myCases = 0;
          this.cdr.detectChanges();
        }
      });
  }

  private calculateProgress(status: string): number {
    const progressMap: { [key: string]: number } = {
      'OPEN': 10,
      'ACTIVE': 40,
      'IN_PROGRESS': 60,
      'PENDING': 30,
      'UNDER_REVIEW': 50,
      'SETTLED': 90,
      'CLOSED': 100,
      'WON': 100,
      'LOST': 100
    };
    return progressMap[status] || 25;
  }

  private loadClientDocuments(): void {
    this.documentsLoading = true;

    // Use ClientPortalService to load documents
    this.clientPortalService.getDocuments(0, 5)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.content) {
            this.recentDocuments = response.content.map((d: any) => ({
              id: d.id,
              name: d.fileName || d.title,
              title: d.title,
              type: d.category,
              uploadDate: d.uploadedAt,
              size: this.formatFileSize(d.fileSize),
              caseNumber: d.caseNumber,
              caseName: d.caseName
            }));
            this.activeDocuments = response.totalElements || this.recentDocuments.length;
          }
          this.documentsLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading documents:', error);
          this.documentsLoading = false;
          this.recentDocuments = [];
          this.activeDocuments = 0;
          this.cdr.detectChanges();
        }
      });
  }

  private formatFileSize(bytes: number): string {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  private loadClientInvoices(): void {
    this.invoicesLoading = true;

    // Use ClientPortalService for invoices
    this.clientPortalService.getInvoices(0, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.content) {
            this.clientInvoices = response.content;

            // Calculate pending invoices and total due
            this.pendingInvoices = this.clientInvoices.filter(inv =>
              inv.status === 'PENDING' || inv.status === 'OVERDUE'
            ).length;

            this.totalDue = this.clientInvoices
              .filter(inv => inv.status !== 'PAID')
              .reduce((sum, inv) => sum + (inv.balanceDue || inv.amount || 0), 0);
          }
          this.invoicesLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading invoices:', error);
          this.invoicesLoading = false;
          this.clientInvoices = [];
          this.pendingInvoices = 0;
          this.totalDue = 0;
          this.cdr.detectChanges();
        }
      });
  }

  private loadAppointments(): void {
    // Use ClientPortalService to load appointments
    this.clientPortalService.getAppointments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (appointments) => {
          this.appointments = (appointments || []).map(apt => ({
            id: apt.id,
            title: apt.title,
            date: new Date(apt.startTime),
            time: new Date(apt.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            attorney: apt.attorneyName,
            type: apt.isVirtual ? 'Virtual' : 'In-Person',
            caseNumber: apt.caseNumber,
            location: apt.location
          }));

          this.upcomingAppointments = this.appointments.length;
          this.nextAppointment = this.appointments.length > 0 ? this.appointments[0] : null;
          this.startCountdownTimer();
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading appointments:', error);
          this.appointments = [];
          this.upcomingAppointments = 0;
          this.nextAppointment = null;
          this.cdr.detectChanges();
        }
      });
  }

  // Countdown timer methods
  private startCountdownTimer(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.updateCountdown();
    this.countdownInterval = setInterval(() => {
      this.updateCountdown();
    }, 1000);
  }

  private updateCountdown(): void {
    if (!this.nextAppointment?.date) {
      this.countdownDays = 0;
      this.countdownHours = 0;
      this.countdownMinutes = 0;
      this.countdownSeconds = 0;
      return;
    }

    const targetDate = new Date(this.nextAppointment.date);
    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();

    if (diff <= 0) {
      this.countdownDays = 0;
      this.countdownHours = 0;
      this.countdownMinutes = 0;
      this.countdownSeconds = 0;
      return;
    }

    this.countdownDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    this.countdownHours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    this.countdownMinutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    this.countdownSeconds = Math.floor((diff % (1000 * 60)) / 1000);
    this.cdr.detectChanges();
  }

  getNextAppointmentWeekday(): string {
    if (!this.nextAppointment?.date) return '';
    const date = new Date(this.nextAppointment.date);
    return date.toLocaleString('default', { weekday: 'long' });
  }

  private loadCaseTimeline(caseId: number): void {
    // Timeline is loaded as part of case details - we can add this later
    // For now, we just initialize an empty timeline
    this.caseTimeline = [];
    this.cdr.detectChanges();
  }

  private initializeCharts(): void {
    // Initialize case progress chart
    this.caseProgressChart = {
      series: [65],
      chart: {
        type: 'radialBar',
        height: 200,
        toolbar: { show: false }
      },
      plotOptions: {
        radialBar: {
          hollow: { size: '70%' },
          dataLabels: {
            show: true,
            name: { show: false },
            value: {
              formatter: (val: any) => val + '%',
              fontSize: '16px',
              fontWeight: 'bold'
            }
          }
        }
      },
      colors: ['#6658dd'],
      labels: ['Case Progress']
    };

    // Initialize payment history chart
    this.paymentHistoryChart = {
      series: [{
        name: 'Payments',
        data: [2500, 3000, 2000, 4000, 3500, 5000]
      }],
      chart: {
        type: 'area',
        height: 250,
        toolbar: { show: false }
      },
      xaxis: {
        categories: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']
      },
      stroke: { curve: 'smooth', width: 2 },
      fill: { opacity: 0.1 },
      colors: ['#10b981']
    };
  }
  
  // Navigation methods
  navigateToCases(): void {
    // Show all cases on dashboard instead of navigating away
    this.showAllCases = true;
  }
  
  navigateToDocuments(): void {
    this.router.navigate(['/client/documents']);
  }

  navigateToInvoices(): void {
    this.router.navigate(['/client/invoices']);
  }
  
  navigateToAppointments(): void {
    this.router.navigate(['/client/appointments']);
  }

  viewCase(caseId: number): void {
    this.router.navigate(['/client/cases', caseId]);
  }

  viewDocument(documentId: number): void {
    this.router.navigate(['/client/documents', documentId]);
  }

  viewInvoice(invoiceId: number): void {
    this.router.navigate(['/client/invoices', invoiceId]);
  }

  payInvoice(invoiceId: number): void {
    this.router.navigate(['/client/payment'], { queryParams: { invoiceId } });
  }

  sendMessage(): void {
    this.router.navigate(['/client/messages/new']);
  }

  // Helper methods
  getCaseStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'Active': 'badge bg-success',
      'In Progress': 'badge bg-primary',
      'Pending': 'badge bg-warning',
      'Closed': 'badge bg-secondary'
    };
    return statusClasses[status] || 'badge bg-secondary';
  }

  getDocumentTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'Contract': 'ri-file-text-line',
      'Evidence': 'ri-file-shield-line',
      'Motion': 'ri-file-paper-line',
      'Brief': 'ri-file-list-line',
      'Letter': 'ri-mail-line'
    };
    return icons[type] || 'ri-file-line';
  }

  getInvoiceStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'PAID': 'badge bg-success',
      'PENDING': 'badge bg-warning',
      'OVERDUE': 'badge bg-danger',
      'DRAFT': 'badge bg-secondary'
    };
    return statusClasses[status] || 'badge bg-secondary';
  }

  getAppointmentTypeIcon(type: string): string {
    return type === 'Virtual' ? 'ri-video-line' : 'ri-map-pin-line';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  // Helper methods for template
  getCurrentTime(): string {
    return new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'America/New_York'
    });
  }

  getWeatherInfo(): string {
    return '72°F Sunny';
  }

  getNextAppointmentFormatted(): string {
    if (!this.nextAppointment) return 'No upcoming appointments';
    
    return this.nextAppointment.date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }) + ' at ' + this.nextAppointment.time;
  }

  refreshDashboard(): void {
    this.loadClientData();
  }

  // Greeting helpers
  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  getWelcomeMessage(): string {
    const parts: string[] = [];

    if (this.myCases > 0) {
      parts.push(`You have ${this.myCases} active case${this.myCases !== 1 ? 's' : ''}`);
    }

    if (this.upcomingAppointments > 0) {
      parts.push(`${this.upcomingAppointments} upcoming appointment${this.upcomingAppointments !== 1 ? 's' : ''}`);
    }

    if (this.unreadMessages > 0) {
      parts.push(`${this.unreadMessages} unread message${this.unreadMessages !== 1 ? 's' : ''}`);
    }

    if (parts.length === 0) {
      return 'Welcome to your client portal. Your dashboard is up to date.';
    }

    return parts.join(', ') + '.';
  }

  // Toggle methods
  toggleShowAllCases(): void {
    this.showAllCases = !this.showAllCases;
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
      'Active': 'case-badge-primary',
      'In Progress': 'case-badge-info',
      'Pending': 'case-badge-warning',
      'Closed': 'case-badge-secondary',
      'Settled': 'case-badge-success',
      'Won': 'case-badge-success',
      'Lost': 'case-badge-danger'
    };
    return statusMap[status || ''] || 'case-badge-secondary';
  }

  formatStatus(status: string | undefined): string {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ');
  }

  // Appointment helpers
  getAppointmentDay(date: Date | string | undefined): string {
    if (!date) return '--';
    const d = new Date(date);
    return d.getDate().toString();
  }

  getAppointmentMonth(date: Date | string | undefined): string {
    if (!date) return '---';
    const d = new Date(date);
    return d.toLocaleString('default', { month: 'short' }).toUpperCase();
  }

  getTimeUntil(date: Date | string | undefined): string {
    if (!date) return '--';

    const appointmentDate = new Date(date);
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
} 