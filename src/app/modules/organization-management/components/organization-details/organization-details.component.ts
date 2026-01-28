import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OrganizationService, Organization, OrganizationStats } from '../../../../core/services/organization.service';
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

  // Tab management
  activeTab = 'overview';

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
        this.loadStats();
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
            this.router.navigate(['/organizations/list']);
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

  editOrganization(): void {
    if (this.organizationId) {
      this.router.navigate(['/organizations/edit', this.organizationId]);
    }
  }

  backToList(): void {
    this.router.navigate(['/organizations/list']);
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

  navigateToSettings(): void {
    if (this.organizationId) {
      this.router.navigate(['/organizations/details', this.organizationId, 'settings']);
    }
  }

  navigateToPlan(): void {
    if (this.organizationId) {
      this.router.navigate(['/organizations/details', this.organizationId, 'plan']);
    }
  }
}
