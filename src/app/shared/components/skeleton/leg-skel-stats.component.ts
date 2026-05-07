import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * KPI tile strip. Renders N stat tiles in a horizontal row. Each tile is
 * a label line + number line inside a Rox-card-like surface. Use for
 * dashboard summary bars, counts-at-a-glance, header pulse rows.
 *
 * Inputs:
 *   count — number of tiles (default 4).
 *   label — accessible loading label (default 'Loading stats').
 */
@Component({
  selector: 'leg-skel-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="status" aria-busy="true" [attr.aria-label]="label"
         class="legience-skel-region leg-skel-stats">
      @for (i of items; track $index) {
        <div class="leg-skel-stats-tile">
          <span class="legience-skel skel-block size-sm w-55"
                style="margin-bottom: 10px;"></span>
          <span class="legience-skel skel-block size-xl w-40"></span>
        </div>
      }
    </div>
  `,
  styles: [`
    .leg-skel-stats {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .leg-skel-stats-tile {
      flex: 1;
      min-width: 140px;
      padding: 14px 16px;
      border: 1px solid var(--legience-border-hairline);
      border-radius: 8px;
      background: var(--legience-bg-card);
    }
  `],
})
export class LegSkelStatsComponent {
  @Input() count = 4;
  @Input() label = 'Loading stats';

  protected get items(): number[] {
    return Array.from({ length: this.count }, (_, i) => i);
  }
}
