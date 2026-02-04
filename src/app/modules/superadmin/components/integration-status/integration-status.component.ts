import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import { IntegrationStatus } from '../../models/superadmin.models';

@Component({
  selector: 'app-integration-status',
  templateUrl: './integration-status.component.html',
  styleUrls: ['./integration-status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IntegrationStatusComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  integrations: IntegrationStatus[] = [];
  filteredIntegrations: IntegrationStatus[] = [];
  isLoading = true;
  error: string | null = null;

  // Filters
  filterIssuesOnly = false;
  filterNoIntegrations = false;
  searchTerm = '';

  // Stats
  totalOrgs = 0;
  orgsWithTwilio = 0;
  orgsWithBoldSign = 0;
  orgsWithIssues = 0;

  constructor(
    private superAdminService: SuperAdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadIntegrationStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadIntegrationStatus(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.superAdminService.getIntegrationStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (integrations) => {
          this.integrations = integrations;
          this.calculateStats();
          this.applyFilters();
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Failed to load integration status';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  calculateStats(): void {
    this.totalOrgs = this.integrations.length;
    this.orgsWithTwilio = this.integrations.filter(i => i.twilioEnabled).length;
    this.orgsWithBoldSign = this.integrations.filter(i => i.boldSignEnabled).length;
    this.orgsWithIssues = this.integrations.filter(i => i.hasIssues).length;
  }

  applyFilters(): void {
    let filtered = [...this.integrations];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(i =>
        i.organizationName.toLowerCase().includes(term)
      );
    }

    if (this.filterIssuesOnly) {
      filtered = filtered.filter(i => i.hasIssues);
    }

    if (this.filterNoIntegrations) {
      filtered = filtered.filter(i =>
        !i.twilioEnabled && !i.boldSignEnabled && !i.smsEnabled && !i.whatsappEnabled
      );
    }

    this.filteredIntegrations = filtered;
    this.cdr.markForCheck();
  }

  toggleIssuesFilter(): void {
    this.filterIssuesOnly = !this.filterIssuesOnly;
    if (this.filterIssuesOnly) this.filterNoIntegrations = false;
    this.applyFilters();
  }

  toggleNoIntegrationsFilter(): void {
    this.filterNoIntegrations = !this.filterNoIntegrations;
    if (this.filterNoIntegrations) this.filterIssuesOnly = false;
    this.applyFilters();
  }

  clearFilters(): void {
    this.filterIssuesOnly = false;
    this.filterNoIntegrations = false;
    this.searchTerm = '';
    this.applyFilters();
  }

  getStatusClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'bg-success-subtle text-success';
      case 'SUSPENDED': return 'bg-danger-subtle text-danger';
      case 'TRIAL': return 'bg-warning-subtle text-warning';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  getIntegrationIcon(enabled: boolean): string {
    return enabled ? 'ri-checkbox-circle-fill text-success' : 'ri-close-circle-line text-muted';
  }
}
