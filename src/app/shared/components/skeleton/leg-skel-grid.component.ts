import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Card grid placeholder. Renders N tiles in a column grid. Each tile is
 * a mini-card with avatar + 2 text lines + 2 status pills. Use for the
 * My Ongoing Cases grid, Client cards, Document tiles.
 *
 * Inputs:
 *   count — number of tiles (default 3).
 *   cols  — number of grid columns at the xl breakpoint (default 3).
 *   label — accessible loading label (default 'Loading grid').
 */
@Component({
  selector: 'leg-skel-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="status" aria-busy="true" [attr.aria-label]="label"
         class="legience-skel-region leg-skel-grid"
         [style.--cols]="cols">
      @for (cell of cells; track $index) {
        <div class="leg-skel-grid-cell">
          <span class="legience-skel skel-circle"
                style="display: block; width: 36px; height: 36px; margin-bottom: 14px;"></span>
          <span class="legience-skel skel-block size-md w-70"
                style="margin-bottom: 6px;"></span>
          <span class="legience-skel skel-block size-sm w-90"
                style="margin-bottom: 14px;"></span>
          <div class="leg-skel-grid-pills">
            <span class="legience-skel skel-pill" style="width: 50px; height: 20px;"></span>
            <span class="legience-skel skel-pill" style="width: 60px; height: 20px;"></span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .leg-skel-grid {
      display: grid;
      grid-template-columns: repeat(var(--cols, 3), 1fr);
      gap: 16px;
    }
    @media (max-width: 992px) {
      .leg-skel-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 576px) {
      .leg-skel-grid { grid-template-columns: 1fr; }
    }
    .leg-skel-grid-cell {
      padding: 16px;
      border: 1px solid var(--legience-border-hairline);
      border-radius: 16px;
      background: var(--legience-bg-card);
    }
    .leg-skel-grid-pills {
      display: flex;
      gap: 6px;
    }
  `],
})
export class LegSkelGridComponent {
  @Input() count = 3;
  @Input() cols = 3;
  @Input() label = 'Loading grid';

  protected get cells(): number[] {
    return Array.from({ length: this.count }, (_, i) => i);
  }
}
