import { Component, inject, OnInit, signal } from '@angular/core';
import { PiDashboardService, PiInsight } from '../../services/pi-dashboard.service';

/**
 * AI Insights row — predictive alerts surfaced from cross-case heuristics
 * (treatment gaps, settlement opportunities, anomaly detection). Loads on
 * init; renders nothing while loading and nothing when empty (matching the
 * existing dashboard's `*ngIf="!casesLoading && aiInsights.length > 0"`
 * gate).
 */
@Component({
  selector: 'app-pi-ai-insights',
  templateUrl: './pi-ai-insights.component.html',
  styleUrls: ['./pi-ai-insights.component.scss'],
})
export class PiAiInsightsComponent implements OnInit {
  private svc = inject(PiDashboardService);
  readonly insights = signal<PiInsight[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.svc.getInsights().subscribe({
      next: data => {
        this.insights.set(data ?? []);
        this.loading.set(false);
      },
      error: e => {
        this.error.set(e?.message ?? 'Failed to load insights');
        this.loading.set(false);
      },
    });
  }

  /**
   * Phase 5 stub — Phase 6 cutover wires real navigation. Logging keeps the
   * click feedback loop honest while we migrate.
   */
  onInsightAction(insight: PiInsight): void {
    console.debug('insight clicked', insight);
  }
}
