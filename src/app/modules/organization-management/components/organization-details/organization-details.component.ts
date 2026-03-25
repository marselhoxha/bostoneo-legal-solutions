import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import { OrganizationService, Organization, OrganizationStats } from '../../../../core/services/organization.service';
import { RbacService } from '../../../../core/services/rbac.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-organization-details',
  templateUrl: './organization-details.component.html',
  styleUrls: ['./organization-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrganizationDetailsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  organization: Organization | null = null;
  stats: OrganizationStats | null = null;
  isLoading = true;
  organizationId: number | null = null;
  isSuperAdmin = false;

  // Tab management
  activeTab = 'overview';

  // Inline org info editing
  isEditingOrgInfo = false;
  isSavingOrgInfo = false;
  selectedLogoFile: File | null = null;
  logoPreviewUrl: string | null = null;
  orgInfo = {
    name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    logoUrl: '',
    state: ''
  };

  // All 50 US states + DC for dropdown
  usStates = [
    { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
    { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
    { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
    { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
    { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
    { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
    { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
    { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
    { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
  ];

  // Notification settings (for the Notifications tab)
  isSavingNotifications = false;
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
    private rbacService: RbacService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isSuperAdmin = this.rbacService.hasRole('ROLE_SUPERADMIN');
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['id']) {
        const requestedOrgId = +params['id'];

        // Non-SUPERADMIN can only access their own org
        if (!this.isSuperAdmin) {
          const userOrgId = this.organizationService.getCurrentOrganizationId();
          if (!userOrgId || userOrgId !== requestedOrgId) {
            this.router.navigate(['/home']);
            return;
          }
        }

        this.organizationId = requestedOrgId;
        this.loadOrganization();
        this.loadStats();
      }
    });

    // Support deep-linking via ?tab=team, ?tab=invitations, ?tab=notifications, etc.
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(queryParams => {
      const tab = queryParams['tab'];
      if (tab && ['overview', 'team', 'invitations', 'notifications'].includes(tab)) {
        this.activeTab = tab;
        this.cdr.markForCheck();
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
            this.orgInfo = {
              name: org.name || '',
              email: org.email || '',
              phone: org.phone || '',
              website: org.website || '',
              address: org.address || '',
              logoUrl: org.logoUrl || '',
              state: org.state || ''
            };
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
            text: 'Failed to load organization'
          }).then(() => {
            this.router.navigate([this.isSuperAdmin ? '/organizations/list' : '/home']);
          });
        }
      });
  }

  private loadStats(): void {
    if (!this.organizationId) return;

    this.organizationService.getOrganizationStats(this.organizationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
          this.cdr.markForCheck();
        },
        error: () => {
          // Stats loading failed silently
        }
      });
  }

  // --- Inline Org Info Edit/Save ---

  toggleEditOrgInfo(): void {
    this.isEditingOrgInfo = !this.isEditingOrgInfo;
    if (!this.isEditingOrgInfo) {
      // Cancel — reset to original values
      if (this.organization) {
        this.orgInfo = {
          name: this.organization.name || '',
          email: this.organization.email || '',
          phone: this.organization.phone || '',
          website: this.organization.website || '',
          address: this.organization.address || '',
          logoUrl: this.organization.logoUrl || '',
          state: this.organization.state || ''
        };
      }
      this.selectedLogoFile = null;
      this.logoPreviewUrl = null;
    }
    this.cdr.markForCheck();
  }

  onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedLogoFile = input.files[0];
      this.logoPreviewUrl = URL.createObjectURL(this.selectedLogoFile);
      this.cdr.markForCheck();
    }
  }

  saveOrgInfo(): void {
    if (!this.organizationId || !this.orgInfo.name?.trim()) return;

    this.isSavingOrgInfo = true;
    this.cdr.markForCheck();

    // If a new logo was selected, upload it first
    if (this.selectedLogoFile) {
      const formData = new FormData();
      formData.append('file', this.selectedLogoFile);
      this.http.post<any>(`${environment.apiUrl}/api/organizations/${this.organizationId}/logo`, formData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            // Logo uploaded, now save the rest of the org info
            this.orgInfo.logoUrl = res.data?.logoUrl || this.orgInfo.logoUrl;
            this.saveOrgInfoFields();
          },
          error: () => {
            // Logo upload failed, still save other fields
            this.saveOrgInfoFields();
          }
        });
    } else {
      this.saveOrgInfoFields();
    }
  }

  private saveOrgInfoFields(): void {
    this.organizationService.updateOrganization(this.organizationId!, this.orgInfo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (org) => {
          this.organization = org;
          this.isEditingOrgInfo = false;
          this.isSavingOrgInfo = false;
          this.selectedLogoFile = null;
          this.logoPreviewUrl = null;
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'success',
            title: 'Saved',
            text: 'Organization info updated.',
            timer: 2000,
            showConfirmButton: false
          });
        },
        error: (err) => {
          this.isSavingOrgInfo = false;
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err?.error?.message || 'Failed to save organization info'
          });
        }
      });
  }

  backToList(): void {
    this.router.navigate(['/organizations/list']);
  }

  editOrganization(): void {
    if (this.organizationId) {
      this.router.navigate(['/organizations/edit', this.organizationId]);
    }
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

  getUsageClass(percent: number): string {
    if (percent >= 90) return 'bg-danger';
    if (percent >= 70) return 'bg-warning';
    return 'bg-success';
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getMaxStorageFormatted(): string {
    if (!this.stats?.planQuota?.maxStorageBytes) return 'N/A';
    if (this.stats.planQuota.maxStorageBytes >= Number.MAX_SAFE_INTEGER) return 'Unlimited';
    return this.formatBytes(this.stats.planQuota.maxStorageBytes);
  }

  getMaxUsersFormatted(): string {
    if (!this.stats?.planQuota?.maxUsers) return 'N/A';
    if (this.stats.planQuota.maxUsers >= 2147483647) return 'Unlimited';
    return this.stats.planQuota.maxUsers.toString();
  }

  getMaxCasesFormatted(): string {
    if (!this.stats?.planQuota?.maxCases) return 'N/A';
    if (this.stats.planQuota.maxCases >= 2147483647) return 'Unlimited';
    return this.stats.planQuota.maxCases.toString();
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  navigateToPlan(): void {
    if (this.organizationId) {
      this.router.navigate(['/organizations/details', this.organizationId, 'plan']);
    }
  }

  // --- Notification Settings ---

  saveNotificationSettings(): void {
    if (!this.organizationId) return;

    this.isSavingNotifications = true;
    this.cdr.markForCheck();

    this.organizationService.updateNotificationPreferences(this.organizationId, this.notificationSettings)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (org) => {
          this.organization = org;
          this.isSavingNotifications = false;
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'success',
            title: 'Settings Saved',
            text: 'Notification preferences have been updated.',
            timer: 2000,
            showConfirmButton: false
          });
        },
        error: (err) => {
          this.isSavingNotifications = false;
          this.cdr.markForCheck();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err?.error?.message || 'Failed to save settings'
          });
        }
      });
  }

  /** Resolve logo URL — relative paths need the API base URL prefix */
  getLogoUrl(logoUrl: string | undefined): string | null {
    if (!logoUrl) return null;
    // If it's already absolute (https://...), return as-is
    if (logoUrl.startsWith('http')) return logoUrl;
    // Relative path like /api/organizations/11/logo-image → prepend backend URL
    return `${environment.apiUrl}${logoUrl}`;
  }

  getStateName(code: string | undefined): string {
    if (!code) return '';
    return this.usStates.find(s => s.code === code)?.name || code;
  }

  formatReminderDays(): string {
    const days = this.notificationSettings.signatureReminderDays.split(',').map(d => d.trim()).filter(d => d);
    if (days.length === 0) return 'No reminders configured';
    return days.map(d => `${d} day${d !== '1' ? 's' : ''}`).join(', ') + ' before deadline';
  }
}
