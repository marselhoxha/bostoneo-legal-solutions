import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OrganizationService } from '../../../../core/services/organization.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-settings-integrations-tab',
  templateUrl: './integrations-tab.component.html',
  styleUrls: ['./integrations-tab.component.scss']
})
export class IntegrationsTabComponent implements OnInit, OnDestroy {
  @Input() organizationId!: number;
  @Input() organization: any;

  private destroy$ = new Subject<void>();
  isSaving = false;

  // BoldSign
  showBoldsignSetup = false;
  boldsignApiKey = '';
  savingBoldsign = false;
  boldsignError = '';

  // Notification settings
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
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.organization) {
      this.notificationSettings = {
        smsEnabled: this.organization.smsEnabled || false,
        whatsappEnabled: this.organization.whatsappEnabled || false,
        emailEnabled: this.organization.emailEnabled !== false,
        signatureReminderEmail: this.organization.signatureReminderEmail !== false,
        signatureReminderSms: this.organization.signatureReminderSms || false,
        signatureReminderWhatsapp: this.organization.signatureReminderWhatsapp || false,
        signatureReminderDays: this.organization.signatureReminderDays || '7,3,1'
      };
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== Notification Settings ====================

  saveNotificationSettings(): void {
    this.isSaving = true;
    this.organizationService.updateNotificationPreferences(this.organizationId, this.notificationSettings)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSaving = false;
          Swal.fire({ icon: 'success', title: 'Saved', text: 'Notification settings updated', timer: 2000, showConfirmButton: false });
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSaving = false;
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'Failed to save' });
          this.cdr.markForCheck();
        }
      });
  }

  // ==================== BoldSign ====================

  connectBoldSign(): void {
    if (!this.organizationId || !this.boldsignApiKey) return;
    this.savingBoldsign = true;
    this.boldsignError = '';

    this.organizationService.validateBoldSignKey(this.organizationId, this.boldsignApiKey)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result: any) => {
          if (result?.data?.valid) {
            this.organizationService.updateBoldSignApiKey(this.organizationId, this.boldsignApiKey)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  this.savingBoldsign = false;
                  this.showBoldsignSetup = false;
                  this.boldsignApiKey = '';
                  if (this.organization) this.organization.boldsignConfigured = true;
                  Swal.fire({ icon: 'success', title: 'Connected', text: 'BoldSign connected successfully.', timer: 2000, showConfirmButton: false });
                  this.cdr.markForCheck();
                },
                error: (err) => {
                  this.savingBoldsign = false;
                  this.boldsignError = err?.error?.message || 'Failed to save API key';
                  this.cdr.markForCheck();
                }
              });
          } else {
            this.savingBoldsign = false;
            this.boldsignError = 'Invalid API key. Please check and try again.';
            this.cdr.markForCheck();
          }
        },
        error: () => {
          this.savingBoldsign = false;
          this.boldsignError = 'Could not validate API key.';
          this.cdr.markForCheck();
        }
      });
  }

  disconnectBoldSign(): void {
    if (!this.organizationId) return;
    Swal.fire({
      title: 'Disconnect BoldSign?',
      text: 'Existing requests won\'t be affected, but you won\'t be able to send new ones.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#405189',
      confirmButtonText: 'Disconnect'
    }).then((result) => {
      if (result.isConfirmed) {
        this.organizationService.updateBoldSignApiKey(this.organizationId, '')
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              if (this.organization) this.organization.boldsignConfigured = false;
              Swal.fire({ icon: 'success', title: 'Disconnected', timer: 2000, showConfirmButton: false });
              this.cdr.markForCheck();
            }
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
}
