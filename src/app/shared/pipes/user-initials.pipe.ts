import { Pipe, PipeTransform } from '@angular/core';

type NameLike =
  | string
  | { firstName?: string | null; lastName?: string | null; name?: string | null }
  | null
  | undefined;

/**
 * Returns up to 2 uppercase initials.
 * Accepts a flat name string ("Jane Doe"), a user object with
 * firstName/lastName, or a single `name` field. Defensive about nulls.
 */
@Pipe({ name: 'userInitials' })
export class UserInitialsPipe implements PipeTransform {
  transform(value: NameLike): string {
    if (!value) return '';

    let first = '';
    let last = '';

    if (typeof value === 'string') {
      const parts = value.trim().split(/\s+/).filter(Boolean);
      first = parts[0] ?? '';
      last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
    } else {
      first = (value.firstName ?? '').trim();
      last = (value.lastName ?? '').trim();
      if (!first && !last && value.name) {
        const parts = value.name.trim().split(/\s+/).filter(Boolean);
        first = parts[0] ?? '';
        last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
      }
    }

    const a = first ? first.charAt(0).toUpperCase() : '';
    const b = last ? last.charAt(0).toUpperCase() : '';
    return (a + b) || a;
  }
}
