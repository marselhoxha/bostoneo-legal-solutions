import { Component, inject, OnInit, signal } from '@angular/core';
import {
  PiCrossMatterPattern,
  PiDashboardService,
} from '../../services/pi-dashboard.service';

/**
 * Cross-Matter Intelligence card — surfaces patterns AI detects across
 * multiple matters (similar treatment paths, comparable settlements). The
 * backend may return `null` when not enough cases exist to form a pattern,
 * so the component gates rendering on `pattern() != null` — same semantics as
 * the existing `*ngIf="!casesLoading && crossMatterPattern"` guard.
 */
@Component({
  selector: 'app-pi-cross-matter-intel',
  templateUrl: './pi-cross-matter-intel.component.html',
  styleUrls: ['./pi-cross-matter-intel.component.scss'],
})
export class PiCrossMatterIntelComponent implements OnInit {
  private svc = inject(PiDashboardService);
  readonly pattern = signal<PiCrossMatterPattern | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.svc.getCrossMatterPattern().subscribe({
      next: data => {
        this.pattern.set(data);
        this.loading.set(false);
      },
      error: e => {
        this.error.set(e?.message ?? 'Failed to load cross-matter pattern');
        this.loading.set(false);
      },
    });
  }

  /** Phase 5 stubs — Phase 6 wires the underlying intents. */
  onCrossMatterPrimary(): void {
    console.debug('cross-matter primary action clicked');
  }

  onCrossMatterSecondary(): void {
    console.debug('cross-matter secondary action clicked');
  }
}
