import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Generic paragraph-style placeholder. Renders N stacked text-line shapes
 * with varying widths so the result reads like real text instead of a
 * uniform block. Use anywhere prose loads (descriptions, summaries,
 * notes, briefings, body text in modals).
 *
 * Inputs:
 *   lines  — number of text lines to render (default 3).
 *   label  — accessible loading label (default 'Loading content').
 */
@Component({
  selector: 'leg-skel-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="status" aria-busy="true" [attr.aria-label]="label" class="legience-skel-region">
      @for (w of widths; track $index) {
        <span class="legience-skel skel-block size-md"
              [style.width.%]="w"
              [style.margin-bottom.px]="6"></span>
      }
    </div>
  `,
})
export class LegSkelTextComponent {
  @Input() lines = 3;
  @Input() label = 'Loading content';

  // Cycle through varied widths so the paragraph doesn't look like a
  // uniform stack of identical bars. Last line of any group is shorter
  // (60%) to mimic prose ending mid-line.
  protected get widths(): number[] {
    const pattern = [92, 96, 78, 88];
    const result: number[] = [];
    for (let i = 0; i < this.lines; i++) {
      const isLast = i === this.lines - 1;
      result.push(isLast ? 60 : pattern[i % pattern.length]);
    }
    return result;
  }
}
