import { Component, Input, Output, EventEmitter, OnInit, OnChanges, ChangeDetectorRef } from '@angular/core';
import { OrganizationService } from '../../../../core/services/organization.service';
import { NotificationService } from '../../../../service/notification.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-settings-organization-tab',
  templateUrl: './organization-tab.component.html',
  styleUrls: ['./organization-tab.component.scss']
})
export class OrganizationTabComponent implements OnInit, OnChanges {
  @Input() organizationId!: number;
  @Input() organization: any;
  @Output() organizationUpdated = new EventEmitter<any>();

  isEditing = false;
  isSaving = false;
  isLoading = false;
  stats: any = null;
  activeSubTab = 'details';

  // Editable copy
  form: any = {};

  constructor(
    private organizationService: OrganizationService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.organization && this.organizationId) {
      this.loadOrganization();
    } else {
      this.resetForm();
    }
    // Always load stats if we have an org ID
    if (this.organizationId) this.loadStats();
  }

  ngOnChanges(): void {
    this.resetForm();
    // Reload stats when org changes
    if (this.organizationId && !this.stats) {
      this.loadStats();
    }
  }

  private loadOrganization(): void {
    this.isLoading = true;
    this.organizationService.getOrganizationById(this.organizationId).subscribe({
      next: (org) => {
        this.organization = org;
        this.resetForm();
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private resetForm(): void {
    if (this.organization) {
      this.form = {
        name: this.organization.name || '',
        email: this.organization.email || '',
        phone: this.organization.phone || '',
        address: this.organization.address || '',
        website: this.organization.website || '',
        state: this.organization.state || ''
      };
    }
  }

  private loadStats(): void {
    if (!this.organizationId) return;
    this.organizationService.getOrganizationStats(this.organizationId).subscribe({
      next: (s) => { this.stats = s; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  startEditing(): void {
    this.resetForm();
    this.isEditing = true;
  }

  cancelEditing(): void {
    this.isEditing = false;
    this.resetForm();
  }

  saveOrganization(): void {
    this.isSaving = true;
    this.organizationService.updateOrganization(this.organizationId, this.form).subscribe({
      next: (response) => {
        this.isSaving = false;
        this.isEditing = false;
        // Merge changes into local org object
        this.organization = { ...this.organization, ...this.form };
        this.organizationUpdated.emit(this.organization);
        Swal.fire({
          icon: 'success',
          title: 'Saved',
          text: 'Organization details updated successfully',
          timer: 2000,
          showConfirmButton: false
        });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.isSaving = false;
        this.notificationService.onError(error?.error?.reason || 'Failed to update organization');
        this.cdr.markForCheck();
      }
    });
  }

  formatStorage(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    // Sentinel values for "unlimited" — Java Long.MAX_VALUE or large sentinel
    if (bytes >= 2147483647) return '∞';
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + ' MB';
    return (bytes / 1024).toFixed(0) + ' KB';
  }

  getPlanBadgeClass(): string {
    const plan = this.organization?.planType || '';
    const map: { [key: string]: string } = {
      'FREE': 'bg-secondary',
      'STARTER': 'bg-info',
      'PROFESSIONAL': 'bg-primary',
      'ENTERPRISE': 'bg-success'
    };
    return map[plan] || 'bg-secondary';
  }
}
