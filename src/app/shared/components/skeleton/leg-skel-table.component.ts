import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Data table placeholder. Renders a header row + N body rows × M columns.
 * Use for the Cases list, Billing, Time entries, Tasks list, Documents,
 * Client Invoices — anywhere a tabular display loads.
 *
 * Inputs:
 *   rows  — number of body rows (default 5).
 *   cols  — number of columns (default 4).
 *   label — accessible loading label (default 'Loading table').
 */
@Component({
  selector: 'leg-skel-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="status" aria-busy="true" [attr.aria-label]="label"
         class="legience-skel-region leg-skel-table"
         [style.grid-template-columns]="gridTemplate">
      <div class="leg-skel-table-head">
        @for (h of cells; track $index) {
          <span class="legience-skel skel-block size-sm"
                [style.width.%]="headerWidth($index)"></span>
        }
      </div>
      @for (row of bodyRows; track $index) {
        <div class="leg-skel-table-row">
          @for (c of cells; track $index) {
            <span class="legience-skel skel-block size-md"
                  [style.width.%]="cellWidth(row, $index)"></span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .leg-skel-table {
      border: 1px solid var(--legience-border-hairline);
      border-radius: 8px;
      background: var(--legience-bg-card);
      overflow: hidden;
    }
    .leg-skel-table-head,
    .leg-skel-table-row {
      display: grid;
      grid-template-columns: repeat(var(--cols, 4), 1fr);
      gap: 12px;
      padding: 14px 16px;
    }
    .leg-skel-table-head {
      background: var(--legience-bg-elevated);
      border-bottom: 1px solid var(--legience-border-hairline);
      padding-top: 12px;
      padding-bottom: 12px;
    }
    .leg-skel-table-row {
      border-bottom: 1px solid var(--legience-border-subtle, var(--legience-border-hairline));
    }
    .leg-skel-table-row:last-child {
      border-bottom: 0;
    }
  `],
})
export class LegSkelTableComponent {
  @Input() rows = 5;
  @Input() cols = 4;
  @Input() label = 'Loading table';

  protected get cells(): number[] {
    return Array.from({ length: this.cols }, (_, i) => i);
  }

  protected get bodyRows(): number[] {
    return Array.from({ length: this.rows }, (_, i) => i);
  }

  protected get gridTemplate(): string {
    return `repeat(${this.cols}, 1fr)`;
  }

  protected headerWidth(col: number): number {
    const cycle = [50, 60, 55, 40, 65];
    return cycle[col % cycle.length];
  }

  // Vary each cell's width using a 2D pseudo-random pattern so the table
  // doesn't look mechanical row-over-row.
  protected cellWidth(row: number, col: number): number {
    const seed = (row * 7 + col * 3) % 5;
    const cycle = [80, 65, 75, 55, 85];
    return cycle[seed];
  }
}
