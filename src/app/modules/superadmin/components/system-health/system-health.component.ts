import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import { SystemHealth } from '../../models/superadmin.models';

@Component({
  selector: 'app-system-health',
  templateUrl: './system-health.component.html',
  styleUrls: ['./system-health.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SystemHealthComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  health: SystemHealth | null = null;
  isLoading = true;
  error: string | null = null;
  lastRefreshed: Date | null = null;

  constructor(
    private superAdminService: SuperAdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadHealth();
    // Auto-refresh every 30 seconds
    interval(30000).pipe(takeUntil(this.destroy$)).subscribe(() => this.loadHealth());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadHealth(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.superAdminService.getSystemHealth()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (health) => {
          this.health = health;
          this.lastRefreshed = new Date();
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = 'Failed to load system health';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  getStatusClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'HEALTHY':
      case 'UP': return 'success';
      case 'DEGRADED': return 'warning';
      case 'UNHEALTHY':
      case 'DOWN': return 'danger';
      default: return 'secondary';
    }
  }

  getStatusIcon(status: string): string {
    switch (status?.toUpperCase()) {
      case 'HEALTHY':
      case 'UP': return 'ri-checkbox-circle-fill';
      case 'DEGRADED': return 'ri-error-warning-fill';
      case 'UNHEALTHY':
      case 'DOWN': return 'ri-close-circle-fill';
      default: return 'ri-question-fill';
    }
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
  }
}
