import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Full-page detail layout placeholder. Renders a hero card on the left
 * and a sidebar card on the right (8/4 split). Use for case-detail,
 * client-detail, settings shell — any page with a hero + supporting
 * sidebar.
 *
 * Inputs:
 *   sidebarLines — number of text lines in the sidebar (default 5).
 *   label        — accessible loading label (default 'Loading details').
 */
@Component({
  selector: 'leg-skel-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="status" aria-busy="true" [attr.aria-label]="label"
         class="legience-skel-region leg-skel-detail">
      <div class="leg-skel-detail-hero">
        <span class="legience-skel skel-block size-sm w-25"
              style="margin-bottom: 14px;"></span>
        <span class="legience-skel skel-block size-xl w-70"
              style="margin-bottom: 10px;"></span>
        <span class="legience-skel skel-block size-md w-90"
              style="margin-bottom: 6px;"></span>
        <span class="legience-skel skel-block size-md w-90"
              style="margin-bottom: 6px;"></span>
        <span class="legience-skel skel-block size-md w-55"
              style="margin-bottom: 18px;"></span>
        <div class="leg-skel-detail-actions">
          <span class="legience-skel skel-btn" style="width: 132px;"></span>
          <span class="legience-skel skel-btn" style="width: 96px;"></span>
        </div>
      </div>
      <div class="leg-skel-detail-side">
        <span class="legience-skel skel-block size-sm w-55"
              style="margin-bottom: 14px;"></span>
        @for (line of sideLines; track $index) {
          <span class="legience-skel skel-block size-md"
                [style.width.%]="sideWidth($index)"
                style="margin-bottom: 6px;"></span>
        }
      </div>
    </div>
  `,
  styles: [`
    .leg-skel-detail {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 14px;
    }
    @media (max-width: 992px) {
      .leg-skel-detail { grid-template-columns: 1fr; }
    }
    .leg-skel-detail-hero,
    .leg-skel-detail-side {
      padding: 20px 22px;
      border: 1px solid var(--legience-border-hairline);
      border-radius: 10px;
      background: var(--legience-bg-card);
    }
    .leg-skel-detail-actions {
      display: flex;
      gap: 8px;
    }
  `],
})
export class LegSkelDetailComponent {
  @Input() sidebarLines = 5;
  @Input() label = 'Loading details';

  protected get sideLines(): number[] {
    return Array.from({ length: this.sidebarLines }, (_, i) => i);
  }

  protected sideWidth(i: number): number {
    const cycle = [80, 65, 75, 60, 70];
    return cycle[i % cycle.length];
  }
}
