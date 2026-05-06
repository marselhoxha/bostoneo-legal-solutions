import { Pipe, PipeTransform } from '@angular/core';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Formats a due date as a human-readable label:
 *  - null/invalid -> "—"
 *  - past         -> "1 day late" / "{N} days late"
 *  - today        -> "Today" (or "Today, {h}{a}" if non-zero time)
 *  - tomorrow     -> "Tomorrow"
 *  - within 6 days -> "{Mon,Tue,...}, MMM D"
 *  - else         -> "MMM D"
 */
@Pipe({ name: 'dueLabel' })
export class DueLabelPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (value == null || value === '') return '—';
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value as any);
    if (isNaN(d.getTime())) return '—';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayMs = 24 * 60 * 60 * 1000;

    const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((dDay.getTime() - startOfToday.getTime()) / dayMs);

    if (diffDays < 0) {
      const n = Math.abs(diffDays);
      return n === 1 ? '1 day late' : `${n} days late`;
    }

    if (diffDays === 0) {
      const h = d.getHours();
      const m = d.getMinutes();
      if (h === 0 && m === 0) return 'Today';
      const hour12 = ((h + 11) % 12) + 1;
      const ampm = h < 12 ? 'a' : 'p';
      const minStr = m === 0 ? '' : `:${String(m).padStart(2, '0')}`;
      return `Today, ${hour12}${minStr}${ampm}`;
    }

    if (diffDays === 1) return 'Tomorrow';

    if (diffDays <= 6) {
      return `${DAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
    }

    return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  }
}
