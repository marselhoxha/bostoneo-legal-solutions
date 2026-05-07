import { NgModule } from '@angular/core';
import { LegSkelTextComponent } from './leg-skel-text.component';
import { LegSkelStatsComponent } from './leg-skel-stats.component';
import { LegSkelListComponent } from './leg-skel-list.component';
import { LegSkelCardComponent } from './leg-skel-card.component';
import { LegSkelTableComponent } from './leg-skel-table.component';
import { LegSkelGridComponent } from './leg-skel-grid.component';
import { LegSkelDetailComponent } from './leg-skel-detail.component';

/**
 * SkeletonModule — Layer 2 of the loading-state system.
 *
 * Aggregates the seven generic shape components so consumers can import
 * one module instead of seven standalone components individually:
 *
 *   imports: [SkeletonModule]
 *
 * The components themselves are also fully standalone — feel free to
 * import them directly in standalone components or new modules.
 *
 * Layer 1 (CSS) lives in `src/assets/scss/themes/rox/_skeletons.scss`
 * and is loaded globally via the Rox theme entry, so no per-component
 * style import is needed.
 *
 * Templates that don't fit any of these seven shapes can drop the
 * atomic `.legience-skel` class on a div directly (Layer 3 — escape
 * hatch).
 */
@NgModule({
  imports: [
    LegSkelTextComponent,
    LegSkelStatsComponent,
    LegSkelListComponent,
    LegSkelCardComponent,
    LegSkelTableComponent,
    LegSkelGridComponent,
    LegSkelDetailComponent,
  ],
  exports: [
    LegSkelTextComponent,
    LegSkelStatsComponent,
    LegSkelListComponent,
    LegSkelCardComponent,
    LegSkelTableComponent,
    LegSkelGridComponent,
    LegSkelDetailComponent,
  ],
})
export class SkeletonModule {}
