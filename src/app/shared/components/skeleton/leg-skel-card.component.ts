import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Generic card-detail placeholder. Eyebrow + title + description body
 * + optional inline pills + optional CTA buttons. Covers the Focus card,
 * settings panels, modal bodies, info cards, briefing cards.
 *
 * Inputs:
 *   pills   — number of inline pill placeholders below the body (default 0).
 *   actions — number of CTA-button placeholders at the bottom (default 0).
 *   eyebrow — render the small eyebrow line above the title (default true).
 *   label   — accessible loading label (default 'Loading card').
 */
@Component({
  selector: 'leg-skel-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="status" aria-busy="true" [attr.aria-label]="label"
         class="legience-skel-region leg-skel-card">
      @if (eyebrow) {
        <span class="legience-skel skel-block size-sm w-25"
              style="margin-bottom: 14px;"></span>
      }
      <span class="legience-skel skel-block size-xl w-70"
            style="margin-bottom: 10px;"></span>
      <span class="legience-skel skel-block size-xl w-55"
            style="margin-bottom: 16px;"></span>
      <span class="legience-skel skel-block size-md w-90"
            style="margin-bottom: 6px;"></span>
      <span class="legience-skel skel-block size-md w-70"
            style="margin-bottom: 22px;"></span>
      @if (pills > 0) {
        <div class="leg-skel-card-pills">
          @for (p of pillItems; track $index) {
            <span class="legience-skel skel-pill"
                  [style.width.px]="pillWidth($index)"
                  style="height: 28px;"></span>
          }
        </div>
      }
      @if (actions > 0) {
        <div class="leg-skel-card-actions">
          @for (a of actionItems; track $index) {
            <span class="legience-skel skel-btn"
                  [style.width.px]="actionWidth($index)"></span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .leg-skel-card {
      padding: 22px 24px;
      background: var(--legience-bg-card);
      border: 1px solid var(--legience-border-hairline);
      border-radius: 10px;
    }
    .leg-skel-card-pills {
      display: flex;
      gap: 8px;
      margin-bottom: 22px;
      flex-wrap: wrap;
    }
    .leg-skel-card-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
  `],
})
export class LegSkelCardComponent {
  @Input() pills = 0;
  @Input() actions = 0;
  @Input() eyebrow = true;
  @Input() label = 'Loading card';

  protected get pillItems(): number[] {
    return Array.from({ length: this.pills }, (_, i) => i);
  }

  protected get actionItems(): number[] {
    return Array.from({ length: this.actions }, (_, i) => i);
  }

  // Vary pill widths so they don't look mechanical
  protected pillWidth(i: number): number {
    const cycle = [96, 78, 110, 88, 70];
    return cycle[i % cycle.length];
  }

  // Vary action button widths
  protected actionWidth(i: number): number {
    const cycle = [156, 110, 132, 96];
    return cycle[i % cycle.length];
  }
}
