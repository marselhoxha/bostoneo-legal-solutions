import { Component, inject, OnInit, signal } from '@angular/core';
import { PiDashboardService, PiRiskAlert } from '../../services/pi-dashboard.service';

/**
 * Risk Alerts band — surfaces compliance and exposure flags (statute-of-
 * limitations countdowns, stale documentation, communication gaps). Renders
 * conditionally on data availability — matches the existing
 * `*ngIf="!casesLoading && riskAlerts.length > 0"` gate. Severity tones are
 * applied per-row via `severity-{value}` classes.
 */
@Component({
  selector: 'app-pi-risk-alerts',
  templateUrl: './pi-risk-alerts.component.html',
  styleUrls: ['./pi-risk-alerts.component.scss'],
})
export class PiRiskAlertsComponent implements OnInit {
  private svc = inject(PiDashboardService);
  readonly alerts = signal<PiRiskAlert[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.svc.getRiskAlerts().subscribe({
      next: data => {
        this.alerts.set(data ?? []);
        this.loading.set(false);
      },
      error: e => {
        this.error.set(e?.message ?? 'Failed to load risk alerts');
        this.loading.set(false);
      },
    });
  }

  /**
   * Phase 5 stub — Phase 6 wires real navigation (review queue, case detail).
   */
  onRiskAction(): void {
    console.debug('risk action clicked');
  }
}
