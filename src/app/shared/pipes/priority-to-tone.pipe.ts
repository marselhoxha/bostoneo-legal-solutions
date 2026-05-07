import { Pipe, PipeTransform } from '@angular/core';

/**
 * Maps a TaskPriority value to a CSS tone string used by `.pill-{tone}`.
 * Matches the brainstorm preview's red-for-most-severe gradient
 * (wave1-tasks-calendar-redesign-options.html):
 *  - URGENT  -> danger  (red — top of the severity ramp)
 *  - HIGH    -> orange
 *  - MEDIUM  -> warning (amber)
 *  - LOW     -> info    (blue, lowest urgency)
 *  - other   -> subtle
 */
@Pipe({ name: 'priorityToTone' })
export class PriorityToTonePipe implements PipeTransform {
  transform(priority: string | null | undefined): string {
    const p = (priority ?? '').toUpperCase();
    if (p === 'URGENT') return 'danger';
    if (p === 'HIGH') return 'orange';
    if (p === 'MEDIUM') return 'warning';
    if (p === 'LOW') return 'info';
    return 'subtle';
  }
}
