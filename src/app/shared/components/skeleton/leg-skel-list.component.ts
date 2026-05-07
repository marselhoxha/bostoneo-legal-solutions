import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Avatar + text rows — covers the most common list pattern in the app
 * (Urgent Items, Client Communication, Activity Feed, Appointment Requests,
 * message lists, contact lists). Each row is: optional leading avatar/icon
 * placeholder + primary line + secondary line + optional trailing badge.
 *
 * Inputs:
 *   rows     — number of rows to render (default 3).
 *   avatar   — render leading 36×36 circle (default true).
 *   trailing — 'pill' | 'none' — render a trailing badge placeholder (default 'pill').
 *   label    — accessible loading label (default 'Loading list').
 */
@Component({
  selector: 'leg-skel-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="status" aria-busy="true" [attr.aria-label]="label"
         class="legience-skel-region leg-skel-list">
      @for (row of items; track $index) {
        <div class="leg-skel-list-row" [class.has-avatar]="avatar">
          @if (avatar) {
            <span class="legience-skel skel-circle"
                  style="width: 36px; height: 36px;"></span>
          }
          <div class="leg-skel-list-meta">
            <span class="legience-skel skel-block size-md"
                  [style.width.%]="primaryWidth($index)"
                  style="margin-bottom: 6px;"></span>
            <span class="legience-skel skel-block size-sm"
                  [style.width.%]="secondaryWidth($index)"></span>
          </div>
          @if (trailing === 'pill') {
            <span class="legience-skel skel-pill" style="width: 70px;"></span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .leg-skel-list-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 14px 18px;
      border-top: 1px solid var(--legience-border-subtle, var(--legience-border-hairline));
    }
    .leg-skel-list-row.has-avatar {
      grid-template-columns: 36px 1fr auto;
    }
    .leg-skel-list-row:first-child {
      border-top: 0;
    }
    .leg-skel-list-meta {
      min-width: 0;
    }
  `],
})
export class LegSkelListComponent {
  @Input() rows = 3;
  @Input() avatar = true;
  @Input() trailing: 'pill' | 'none' = 'pill';
  @Input() label = 'Loading list';

  protected get items(): number[] {
    return Array.from({ length: this.rows }, (_, i) => i);
  }

  // Vary widths so the rows don't look like a uniform stack.
  protected primaryWidth(i: number): number {
    const cycle = [38, 32, 42, 36, 40];
    return cycle[i % cycle.length];
  }

  protected secondaryWidth(i: number): number {
    const cycle = [60, 55, 50, 65, 58];
    return cycle[i % cycle.length];
  }
}
