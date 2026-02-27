import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subject, interval, forkJoin, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import {
  SystemHealth, ActiveSession, LoginEvent,
  OrgStorage, OrgErrors
} from '../../models/superadmin.models';

type HealthTab = 'status' | 'sessions' | 'infra';

@Component({
  selector: 'app-system-health',
  templateUrl: './system-health.component.html',
  styleUrls: ['./system-health.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SystemHealthComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Status tab
  health: SystemHealth | null = null;
  isLoading = true;
  error: string | null = null;
  lastRefreshed: Date | null = null;

  // Tab state
  activeTab: HealthTab = 'status';
  private tabLoaded: { [key: string]: boolean } = {};

  // Sessions tab
  activeSessions: ActiveSession[] | null = null;
  sessionWindow = '1h';
  loginEvents: LoginEvent[] | null = null;
  loginEventsPage = { number: 0, size: 20, totalElements: 0, totalPages: 0 };
  sessionsLoading = false;

  // Infrastructure tab
  storageByOrg: OrgStorage[] | null = null;
  errorsByOrg: OrgErrors[] | null = null;
  infraLoading = false;

  constructor(
    private superAdminService: SuperAdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadHealth();
    // Auto-refresh status every 30s
    interval(30000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.activeTab === 'status') {
        this.loadHealth(true);
      }
    });
    // Auto-refresh sessions every 60s
    interval(60000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.activeTab === 'sessions' && this.tabLoaded['sessions']) {
        this.loadSessionsData(true);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== DATA LOADING ====================

  loadHealth(silent = false): void {
    if (!silent) { this.isLoading = true; this.cdr.markForCheck(); }

    this.superAdminService.getSystemHealth()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (health) => {
          this.health = health;
          this.lastRefreshed = new Date();
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Failed to load system health';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  switchTab(tab: HealthTab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    if (tab === 'sessions' && !this.tabLoaded['sessions']) {
      this.loadSessionsData();
    } else if (tab === 'infra' && !this.tabLoaded['infra']) {
      this.loadInfraData();
    }
    this.cdr.markForCheck();
  }

  private loadSessionsData(silent = false): void {
    if (!silent) { this.sessionsLoading = true; this.cdr.markForCheck(); }

    forkJoin({
      sessions: this.superAdminService.getActiveSessions(this.sessionWindow).pipe(
        catchError(() => of([]))
      ),
      events: this.superAdminService.getLoginEvents(0, 20).pipe(
        catchError(() => of({ content: [], page: { number: 0, size: 20, totalElements: 0, totalPages: 0 } }))
      )
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ sessions, events }) => {
        this.activeSessions = sessions as ActiveSession[];
        this.loginEvents = events.content;
        this.loginEventsPage = events.page;
        this.tabLoaded['sessions'] = true;
        this.sessionsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.sessionsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private loadInfraData(): void {
    this.infraLoading = true;
    this.cdr.markForCheck();

    forkJoin({
      storage: this.superAdminService.getStorageByOrg().pipe(catchError(() => of([]))),
      errors: this.superAdminService.getErrorsByOrg().pipe(catchError(() => of([])))
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ storage, errors }) => {
        this.storageByOrg = storage as OrgStorage[];
        this.errorsByOrg = errors as OrgErrors[];
        this.tabLoaded['infra'] = true;
        this.infraLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.infraLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ==================== SESSION ACTIONS ====================

  changeSessionWindow(window: string): void {
    this.sessionWindow = window;
    this.superAdminService.getActiveSessions(window)
      .pipe(takeUntil(this.destroy$), catchError(() => of([])))
      .subscribe(sessions => {
        this.activeSessions = sessions;
        this.cdr.markForCheck();
      });
  }

  loadLoginEventsPage(page: number): void {
    if (page < 0 || page >= this.loginEventsPage.totalPages) return;
    this.superAdminService.getLoginEvents(page, 20)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.loginEvents = data.content;
          this.loginEventsPage = data.page;
          this.cdr.markForCheck();
        }
      });
  }

  // ==================== HELPERS ====================

  getStatusClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'HEALTHY': case 'UP': return 'success';
      case 'DEGRADED': return 'warning';
      case 'UNHEALTHY': case 'DOWN': return 'danger';
      default: return 'secondary';
    }
  }

  getStatusIcon(status: string): string {
    switch (status?.toUpperCase()) {
      case 'HEALTHY': case 'UP': return 'ri-checkbox-circle-fill';
      case 'DEGRADED': return 'ri-error-warning-fill';
      case 'UNHEALTHY': case 'DOWN': return 'ri-close-circle-fill';
      default: return 'ri-question-fill';
    }
  }

  getMemoryStatusClass(): string {
    const pct = this.health?.memory?.usagePercent ?? 0;
    if (pct < 60) return 'success';
    if (pct < 85) return 'warning';
    return 'danger';
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let val = bytes;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i++;
    }
    return `${val.toFixed(1)} ${units[i]}`;
  }

  formatNumber(value: number | undefined): string {
    if (value === undefined || value === null) return '0';
    return new Intl.NumberFormat('en-US').format(value);
  }

  formatTimeAgo(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  getPageNumbers(): number[] {
    const total = this.loginEventsPage.totalPages;
    const current = this.loginEventsPage.number;
    const pages: number[] = [];
    const start = Math.max(0, current - 2);
    const end = Math.min(total - 1, current + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }
}
