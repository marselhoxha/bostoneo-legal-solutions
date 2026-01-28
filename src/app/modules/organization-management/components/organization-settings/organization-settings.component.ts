import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OrganizationService, Organization } from '../../../../core/services/organization.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-organization-settings',
  templateUrl: './organization-settings.component.html',
  styleUrls: ['./organization-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrganizationSettingsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  organization: Organization | null = null;
  isLoading = true;
  isSaving = false;
  organizationId: number | null = null;

  // Settings tabs
  activeSettingsTab = 'general';

  // Notification settings form
  notificationSettings = {
    smsEnabled: false,
    whatsappEnabled: false,
    emailEnabled: true,
    signatureReminderEmail: true,
    signatureReminderSms: false,
    signatureReminderWhatsapp: false,
    signatureReminderDays: '7,3,1'
  };

  constructor(
    private organizationService: OrganizationService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['id']) {
        this.organizationId = +params['id'];
        this.loadOrganization();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadOrganization(): void {
    if (!this.organizationId) return;

    this.organizationService.getOrganizationById(this.organizationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (org) => {
          this.organization = org;
          if (org) {
            this.notificationSettings = {
              smsEnabled: org.smsEnabled || false,
              whatsappEnabled: org.whatsappEnabled || false,
              emailEnabled: org.emailEnabled !== false,
              signatureReminderEmail: org.signatureReminderEmail !== false,
              signatureReminderSms: org.signatureReminderSms || false,
              signatureReminderWhatsapp: org.signatureReminderWhatsapp || false,
              signatureReminderDays: org.signatureReminderDays || '7,3,1'
            };
          }
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading = false;
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to load organization settings'
          }).then(() => {
            this.router.navigate(['/organizations/list']);
          });
        }
      });
  }

  setSettingsTab(tab: string): void {
    this.activeSettingsTab = tab;
    this.cdr.markForCheck();
  }

  backToDetails(): void {
    if (this.organizationId) {
      this.router.navigate(['/organizations/details', this.organizationId]);
    }
  }

  saveNotificationSettings(): void {
    if (!this.organizationId) return;

    this.isSaving = true;
    this.organizationService.updateNotificationPreferences(this.organizationId, this.notificationSettings)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (org) => {
          this.organization = org;
          this.isSaving = false;
          Swal.fire({
            icon: 'success',
            title: 'Settings Saved',
            text: 'Notification preferences have been updated.',
            timer: 2000,
            showConfirmButton: false
          });
        },
        error: (err) => {
          this.isSaving = false;
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err?.error?.message || 'Failed to save settings'
          });
        }
      });
  }

  getReminderDaysArray(): string[] {
    return this.notificationSettings.signatureReminderDays.split(',').map(d => d.trim()).filter(d => d);
  }

  formatReminderDays(): string {
    const days = this.getReminderDaysArray();
    if (days.length === 0) return 'No reminders configured';
    return days.map(d => `${d} day${d !== '1' ? 's' : ''}`).join(', ') + ' before deadline';
  }

  getPlanBadgeClass(planType: string | undefined): string {
    switch (planType) {
      case 'FREE': return 'bg-secondary';
      case 'STARTER': return 'bg-info';
      case 'PROFESSIONAL': return 'bg-primary';
      case 'ENTERPRISE': return 'bg-warning';
      default: return 'bg-secondary';
    }
  }
}
