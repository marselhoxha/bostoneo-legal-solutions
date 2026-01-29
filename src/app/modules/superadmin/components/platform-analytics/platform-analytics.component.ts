import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import { PlatformAnalytics } from '../../models/superadmin.models';

@Component({
  selector: 'app-platform-analytics',
  templateUrl: './platform-analytics.component.html',
  styleUrls: ['./platform-analytics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlatformAnalyticsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  analytics: PlatformAnalytics | null = null;
  isLoading = true;
  error: string | null = null;
  selectedPeriod = 'week';

  constructor(
    private superAdminService: SuperAdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAnalytics(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.superAdminService.getAnalytics(this.selectedPeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (analytics) => {
          this.analytics = analytics;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = 'Failed to load analytics';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onPeriodChange(): void {
    this.loadAnalytics();
  }

  getObjectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }
}
