import { Pipe, PipeTransform } from '@angular/core';

/**
 * Maps a TaskPriority value to a CSS tone string used by `.pill-{tone}`.
 *  - URGENT  -> orange  (distinguishes from HIGH visually)
 *  - HIGH    -> danger
 *  - MEDIUM  -> warning
 *  - LOW     -> info
 *  - other   -> subtle
 */
@Pipe({ name: 'priorityToTone' })
export class PriorityToTonePipe implements PipeTransform {
  transform(priority: string | null | undefined): string {
    const p = (priority ?? '').toUpperCase();
    if (p === 'URGENT') return 'orange';
    if (p === 'HIGH') return 'danger';
    if (p === 'MEDIUM') return 'warning';
    if (p === 'LOW') return 'info';
    return 'subtle';
  }
}
