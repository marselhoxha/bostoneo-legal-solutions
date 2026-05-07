import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';

import { CalendarService } from '../../../services/calendar.service';
import { CalendarEvent } from '../interfaces/calendar-event.interface';

/**
 * Severity tiers for deadline-style events. Mapped from event metadata in
 * `tierFor()` below — the old `eventType` enum doesn't have a tier field, so
 * we derive one: high-priority deadlines = statute, deadlines = court, and
 * reminders = soft. Severity drives both color and the warning copy in the
 * modal banner.
 */
export type DeadlineTier = 'statute' | 'court' | 'soft';

/**
 * Modal mode — chooses which template branch renders. Detected from the
 * incoming event's `eventType` in `ngOnInit`. Keeping it as a single-letter
 * string keeps `*ngIf="mode === 'd2'"` checks short in the template.
 */
type ModalMode = 'd1' | 'd2';

/**
 * View-modal for the calendar. Read-only Rox-styled summary that branches on
 * event type:
 *
 * - **D1 (regular events)** — case pill + title + date/time/location/attendees/notes/reminders.
 *   Matches cal-d1 modal mockup. Edit + Delete buttons delegate to the
 *   existing `EventModalComponent` (which owns the full edit form).
 * - **D2 (deadlines)** — adds a tier badge to the head, a top warning banner
 *   with countdown days remaining, and a reminder-cascade list. Matches
 *   cal-d2 modal mockup. Adds a "Mark filed" action alongside Edit/Delete.
 *
 * D3 (billable-block) is stubbed to fall through to the D1 layout for now;
 * it'll get its own branch when the week/day time-grid views land.
 */
@Component({
  selector: 'app-calendar-event-view-modal',
  templateUrl: './calendar-event-view-modal.component.html',
  styleUrls: ['./calendar-event-view-modal.component.scss'],
})
export class CalendarEventViewModalComponent implements OnInit {
  @Input() event!: CalendarEvent;
  /** Stable color from the calendar-view's hash so the modal accent matches the chip. */
  @Input() caseColor: string | null = null;

  // ── Resolved metadata (derived from `event` in ngOnInit) ────────────────
  mode: ModalMode = 'd1';
  tier: DeadlineTier | null = null;
  daysRemaining: number | null = null;
  /** Pretty-printed range — "Tue, May 6, 2026 · 10:00 AM – 1:00 PM". */
  dateLabel = '';
  timeLabel = '';
  /** "Wed, May 20, 2026 · 5:00 PM" for the D2 hard-date row. */
  hardDateLabel = '';

  /**
   * Reminder cascade for deadlines (D2). Built from minute-offsets on the
   * event when present, otherwise from a sensible default schedule. The
   * mockup shows 30/14/7/1-day cascade — that's the default if the event
   * has no `additionalReminders`.
   */
  reminderCascade: Array<{ leadLabel: string; channel: string; isNow: boolean }> = [];

  constructor(
    public activeModal: NgbActiveModal,
    private calendarService: CalendarService,
    private toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    if (!this.event) return;

    this.tier = CalendarEventViewModalComponent.tierFor(this.event);
    this.mode = this.tier ? 'd2' : 'd1';
    this.dateLabel = this.formatDateLabel(this.event.start);
    this.hardDateLabel = this.formatHardDateLabel(this.event.start);
    this.timeLabel = this.formatTimeRange(this.event.start, this.event.end, this.event.allDay);
    this.daysRemaining = this.computeDaysRemaining(this.event.start);
    this.reminderCascade = this.buildReminderCascade();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tier / banner helpers (D2)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Derive a deadline tier from event metadata. Resolution order:
   *   1. Explicit `deadlineTier` field (V79+) — STATUTE | COURT | SOFT
   *   2. Inference from eventType + highPriority (legacy rows pre-V79):
   *        DEADLINE + highPriority → statute
   *        DEADLINE                → court
   *        COURT_DATE              → court
   *        REMINDER                → soft
   *        anything else           → null (regular event, render D1)
   */
  static tierFor(ev: CalendarEvent): DeadlineTier | null {
    if (ev.deadlineTier === 'STATUTE') return 'statute';
    if (ev.deadlineTier === 'COURT') return 'court';
    if (ev.deadlineTier === 'SOFT') return 'soft';

    const t = ev.eventType;
    if (t === 'DEADLINE' && ev.highPriority) return 'statute';
    if (t === 'DEADLINE') return 'court';
    if (t === 'COURT_DATE') return 'court';
    if (t === 'REMINDER') return 'soft';
    return null;
  }

  /** Human-readable tier label for the head pill ("Statute"/"Court"/"Soft"). */
  tierLabel(): string {
    return this.tier === 'statute' ? 'Statute'
         : this.tier === 'court'   ? 'Court'
         : this.tier === 'soft'    ? 'Soft'
         : '';
  }

  /** CSS class for the tier badge — drives the danger/orange/warning palette. */
  tierClass(): string {
    return this.tier ? `tier-${this.tier}` : '';
  }

  /**
   * Banner copy. Statute deadlines are uniquely catastrophic — missing one
   * forfeits the claim — so the copy explicitly says "cannot be extended".
   * Court / soft tiers get a softer warning.
   */
  bannerCopy(): { headline: string; sub: string } {
    const days = this.daysRemaining ?? 0;
    if (this.tier === 'statute') {
      return {
        headline: `⚠ Statute clock — ${days >= 0 ? days : 0} day${days === 1 ? '' : 's'} remaining`,
        sub: 'Failure to file before this deadline forfeits the claim. Cannot be extended.',
      };
    }
    if (this.tier === 'court') {
      return {
        headline: `Court deadline — ${days >= 0 ? days : 0} day${days === 1 ? '' : 's'} remaining`,
        sub: 'Court-imposed deadline. Extensions require a motion and judicial approval.',
      };
    }
    return {
      headline: `Soft deadline — ${days >= 0 ? days : 0} day${days === 1 ? '' : 's'} remaining`,
      sub: 'Firm-internal deadline. Adjustable if needed, but track for client expectations.',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  close(): void {
    this.activeModal.dismiss();
  }

  /**
   * Hand off to the existing `EventModalComponent` for the actual edit form.
   * Closing this modal with `action: 'edit'` lets the calendar-view's result
   * subscription chain into the edit modal — that path keeps the refetch tied
   * to the edit modal's own save result, so `loadEvents()` fires once the
   * user actually saves changes (not when this modal closes).
   */
  edit(): void {
    this.activeModal.close({ action: 'edit' });
  }

  /**
   * Confirm-then-delete flow. Uses Swal2 (already a project dep) with the
   * Rox-friendly settings the rest of the app uses (no body padding shift,
   * z-index above the drawer-modal stack).
   */
  async confirmDelete(): Promise<void> {
    if (!this.event?.id) return;
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete event?',
      text: `"${this.event.title}" will be removed from the calendar.`,
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Keep',
      confirmButtonColor: '#f24149',
      reverseButtons: true,
      heightAuto: false,
      scrollbarPadding: false,
    });
    if (!result.isConfirmed) return;
    this.calendarService.deleteEvent(String(this.event.id)).subscribe({
      next: () => {
        this.toastr.success('Event deleted');
        this.activeModal.close({ action: 'deleted' });
      },
      error: () => this.toastr.error('Failed to delete event'),
    });
  }

  /**
   * D2-only "Mark filed" action — flips status to COMPLETED so the event
   * disappears from the upcoming-deadlines strip on the next refresh. Keeps
   * the underlying record (filings get audited) instead of deleting.
   */
  markFiled(): void {
    if (!this.event?.id) return;
    const updated = { ...this.event, status: 'COMPLETED' as const };
    this.calendarService
      .updateEvent(String(this.event.id), this.toRequestShape(updated))
      .subscribe({
        next: () => {
          this.toastr.success('Marked as filed');
          this.activeModal.close({ action: 'filed' });
        },
        error: () => this.toastr.error('Failed to mark filed'),
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pure helpers
  // ─────────────────────────────────────────────────────────────────────────

  private computeDaysRemaining(d: Date | null | undefined): number | null {
    if (!d) return null;
    const target = new Date(d);
    if (isNaN(target.getTime())) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const ms = dDay.getTime() - today.getTime();
    return Math.round(ms / (24 * 3600 * 1000));
  }

  private formatDateLabel(d: Date | null | undefined): string {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  /** Like dateLabel but with the time appended — used for D2's "hard date" row. */
  private formatHardDateLabel(d: Date | null | undefined): string {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    const date = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const time = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${date} · ${time}`;
  }

  private formatTimeRange(start?: Date, end?: Date, allDay?: boolean): string {
    if (allDay) return 'All day';
    if (!start) return '';
    const startTime = new Date(start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (!end) return startTime;
    const endTime = new Date(end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${startTime} – ${endTime}`;
  }

  /**
   * Reminder cascade rows. Matches the cal-d2 mockup's "30 days · email",
   * "14 days · email + banner", etc. lines. Source order:
   *   1. event.additionalReminders (minutes-before) — preferred
   *   2. fall back to default 30/14/7/1-day cascade for deadlines
   *   3. for non-deadlines, use event.reminderMinutes single value
   */
  private buildReminderCascade(): Array<{ leadLabel: string; channel: string; isNow: boolean }> {
    const isDeadline = this.tier !== null;
    const defaultMinutes = isDeadline
      ? [30 * 24 * 60, 14 * 24 * 60, 7 * 24 * 60, 1 * 24 * 60]
      : [];

    const minutes = this.event?.additionalReminders?.length
      ? [...this.event.additionalReminders]
      : (this.event?.reminderMinutes ? [this.event.reminderMinutes] : defaultMinutes);

    const days = this.daysRemaining ?? 9999;
    return minutes
      .sort((a, b) => b - a) // farthest-out first
      .map((m) => {
        const daysOffset = Math.round(m / (24 * 60));
        const isNow = days <= daysOffset && days >= daysOffset - 1;
        const channel = daysOffset >= 30 ? 'email to lead attorney'
                      : daysOffset >= 14 ? (isNow ? 'email + dashboard banner (now)' : 'email + dashboard banner')
                      : daysOffset >= 7  ? 'email + SMS to all assignees'
                      :                    'daily email until filed';
        const leadLabel = daysOffset === 1 ? '1 day before'
                        : daysOffset >= 1   ? `${daysOffset} days before`
                        :                     `${m} min before`;
        return { leadLabel, channel, isNow };
      });
  }

  /**
   * Convert the rich CalendarEvent we read from the cache into the shape the
   * service's `updateEvent` expects. The two diverge mostly on field names
   * (start vs startTime). Defensive about missing dates so a partial record
   * still serializes.
   */
  private toRequestShape(ev: CalendarEvent): any {
    return {
      id: ev.id,
      title: ev.title,
      description: ev.description,
      startTime: ev.start,
      endTime: ev.end,
      location: ev.location,
      eventType: ev.eventType,
      status: ev.status,
      allDay: ev.allDay,
      caseId: ev.caseId,
      reminderMinutes: ev.reminderMinutes,
      highPriority: ev.highPriority,
      additionalReminders: ev.additionalReminders,
      // V79 deadline tier fields — preserved on update so "Mark filed"
      // doesn't accidentally strip the tier classification on the round-trip.
      deadlineTier: ev.deadlineTier,
      sourceAuthority: ev.sourceAuthority,
      requiredAction: ev.requiredAction,
    };
  }
}
