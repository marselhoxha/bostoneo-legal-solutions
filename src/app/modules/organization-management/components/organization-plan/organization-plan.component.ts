import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { OrganizationService, Organization, OrganizationStats } from '../../../../core/services/organization.service';
import { PLAN_LABELS, PLAN_COLORS, PlanType } from '../../models/organization.model';
import Swal from 'sweetalert2';

interface PlanFeature {
  name: string;
  free: boolean | string;
  starter: boolean | string;
  professional: boolean | string;
  enterprise: boolean | string;
}

@Component({
  selector: 'app-organization-plan',
  templateUrl: './organization-plan.component.html',
  styleUrls: ['./organization-plan.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrganizationPlanComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  organization: Organization | null = null;
  stats: OrganizationStats | null = null;
  isLoading = true;
  organizationId: number | null = null;

  planLabels = PLAN_LABELS;
  planColors = PLAN_COLORS;

  planFeatures: PlanFeature[] = [
    { name: 'Team Members', free: '3', starter: '10', professional: '50', enterprise: 'Unlimited' },
    { name: 'Active Cases', free: '25', starter: '100', professional: '500', enterprise: 'Unlimited' },
    { name: 'Storage', free: '1 GB', starter: '10 GB', professional: '50 GB', enterprise: 'Unlimited' },
    { name: 'Clients', free: '10', starter: '50', professional: '250', enterprise: 'Unlimited' },
    { name: 'API Access', free: false, starter: false, professional: true, enterprise: true },
    { name: 'Advanced Reporting', free: false, starter: false, professional: true, enterprise: true },
    { name: 'Custom Branding', free: false, starter: true, professional: true, enterprise: true },
    { name: 'Priority Support', free: false, starter: false, professional: false, enterprise: true },
  ];

  constructor(
    private organizationService: OrganizationService,
    private route: ActivatedRoute,
    private router: Router,
    private modalService: NgbModal,
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

  backToDetails(): void {
    if (this.organizationId) {
      this.router.navigate(['/organizations/details', this.organizationId]);
    }
  }

  openPlanComparison(content: any): void {
    this.modalService.open(content, { centered: true, size: 'xl', scrollable: true });
  }

  requestUpgrade(plan: string): void {
    Swal.fire({
      icon: 'info',
      title: 'Upgrade Request',
      html: `<p>To upgrade to the <strong>${plan}</strong> plan, please contact our sales team.</p>
             <p class="text-muted">A dedicated representative will reach out to discuss your needs.</p>`,
      confirmButtonText: 'Contact Sales',
      showCancelButton: true,
      cancelButtonText: 'Maybe Later'
    }).then((result) => {
      if (result.isConfirmed) {
        // In a real implementation, this would open a contact form or redirect
        Swal.fire({
          icon: 'success',
          title: 'Request Submitted',
          text: 'Our team will contact you shortly.',
          timer: 3000,
          showConfirmButton: false
        });
      }
    });
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

  getPlanCardClass(planType: string): string {
    switch (planType) {
      case 'FREE': return 'border-secondary';
      case 'STARTER': return 'border-info';
      case 'PROFESSIONAL': return 'border-primary';
      case 'ENTERPRISE': return 'border-warning';
      default: return '';
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

  getMaxClientsFormatted(): string {
    if (!this.stats?.planQuota?.maxClients) return 'N/A';
    if (this.stats.planQuota.maxClients >= 2147483647) return 'Unlimited';
    return this.stats.planQuota.maxClients.toString();
  }

  isCurrentPlan(plan: string): boolean {
    return this.organization?.planType === plan;
  }

  canUpgrade(plan: string): boolean {
    const planOrder = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
    const currentIndex = planOrder.indexOf(this.organization?.planType || 'FREE');
    const targetIndex = planOrder.indexOf(plan);
    return targetIndex > currentIndex;
  }
}
