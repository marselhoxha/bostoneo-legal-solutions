import { Pipe, PipeTransform } from '@angular/core';

/**
 * Maps a TaskStatus value to a CSS tone string used by `.pill-{tone}`.
 *  - TODO         -> subtle
 *  - IN_PROGRESS  -> accent
 *  - REVIEW       -> warning
 *  - BLOCKED      -> danger
 *  - COMPLETED    -> success
 *  - CANCELLED    -> subtle
 *  - other        -> subtle
 */
@Pipe({ name: 'statusToTone' })
export class StatusToTonePipe implements PipeTransform {
  transform(status: string | null | undefined): string {
    const s = (status ?? '').toUpperCase();
    if (s === 'TODO') return 'subtle';
    if (s === 'IN_PROGRESS') return 'accent';
    if (s === 'REVIEW') return 'warning';
    if (s === 'BLOCKED') return 'danger';
    if (s === 'COMPLETED') return 'success';
    if (s === 'CANCELLED') return 'subtle';
    return 'subtle';
  }
}
