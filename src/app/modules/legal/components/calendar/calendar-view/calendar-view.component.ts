import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { Subject, of } from 'rxjs';
import { catchError, finalize, takeUntil, timeout } from 'rxjs/operators';

import { CalendarService } from '../../../services/calendar.service';
import { CalendarEvent } from '../interfaces/calendar-event.interface';
import { EventModalComponent } from '../event-modal/event-modal.component';
import {
  CalendarEventViewModalComponent,
  DeadlineTier,
} from '../calendar-event-view-modal/calendar-event-view-modal.component';

/**
 * One cell in the 6×7 month grid. `inMonth=false` for the leading/trailing
 * days from the previous/next month (rendered muted). Events are split into
 * `pins` (deadline-tier events → compact tier-colored pin) and `events`
 * (everything else → regular time-prefixed chip). Both render in the cell;
 * `moreCount` tells the template how many were hidden so it can render the
 * `+N more` link.
 */
interface DayCell {
  date: Date;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  pins: Array<{ event: CalendarEvent; tier: DeadlineTier }>;
  events: CalendarEvent[];
  moreCount: number;
}

/**
 * View-model for a card in the deadline track strip (D2). Pre-computed once
 * per fetch so the template stays trivial — just reads strings/colors.
 */
interface DeadlineCardVm {
  event: CalendarEvent;
  tier: DeadlineTier;
  /** Days until the deadline (negative = past). */
  daysRemaining: number;
  /** Banner label — "14 days", "47 days", "Today", "2 days late". */
  countdownLabel: string;
  /** Severity class on the countdown number — danger/warn/null. */
  countdownTone: 'danger' | 'warn' | null;
  /** Title row — uses event.title verbatim. */
  label: string;
  /** Sub-line — "Hoxha v. MGH · May 20". */
  caseLine: string;
}

/**
 * Tone class for a time-grid block (cal-d3). `billable` reads as "tracked
 * time", `event` as "scheduled meeting/court", `non-billable` as "internal
 * admin". Today these all default to `event` since `CalendarEvent` has no
 * `billable` field — adding one is a future schema change.
 */
type BlockTone = 'billable' | 'event' | 'non-billable';

/**
 * One day in the week/day-view time grid. `allDayBlocks` are events with
 * `allDay=true` — they render in the banner row above the hour grid.
 * `blocks` are timed events with computed positions.
 */
interface WeekDay {
  date: Date;
  dayNumber: number;
  weekday: string; // "Sun", "Mon" ...
  isToday: boolean;
  allDayBlocks: CalendarEvent[];
  blocks: TimeBlock[];
}

/**
 * Timed event with the position pre-computed for the time grid. `topPx` is
 * the offset from the top of the day column (0 = day-start hour); `heightPx`
 * is the duration in pixels. Both are clipped to the day-window so events
 * spilling outside 8a–7p still render compactly inside the visible grid.
 */
interface TimeBlock {
  event: CalendarEvent;
  topPx: number;
  heightPx: number;
  tone: BlockTone;
  timeLabel: string;     // "9:00–10:30"
  caseLineLabel: string; // "⚖ Hoxha v. MGH"
}

type ViewMode = 'day' | 'week' | 'month';

/**
 * Calendar — D1 Classic (cal-d1). Custom 7-column month grid styled to the
 * Rox/Legience design system. Replaces the previous FullCalendar embed: that
 * implementation couldn't accommodate the cal-d1 chrome (case-toggle bar,
 * today-circle on the day number, solid-vs-tinted event variants) without
 * fighting FullCalendar's fixed DOM. This component owns its own layout,
 * keeps the existing `CalendarService` data flow, and re-uses the existing
 * `EventModalComponent` for click-through. Day + Week views are stubbed for
 * V1 (toast on click); Month is fully functional.
 */
@Component({
  selector: 'app-calendar-view',
  templateUrl: './calendar-view.component.html',
  styleUrls: ['./calendar-view.component.scss'],
})
export class CalendarViewComponent implements OnInit, OnDestroy {
  // ── Data ────────────────────────────────────────────────────────────────
  /** All loaded events, kept around so month-nav re-bucketizes without refetch. */
  events: CalendarEvent[] = [];
  /** Day-headers in the locale's week order; Sunday-first to match cal-d1. */
  readonly dayHeaders: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ── Month-nav state ─────────────────────────────────────────────────────
  /** First day of the month currently being displayed. */
  currentMonth: Date = this.firstOfMonth(new Date());
  /** 42 cells (6 rows × 7 cols). Always full weeks for stable layout. */
  cells: DayCell[] = [];
  /** Header sub-label: "May 2026 · N events this week". */
  monthLabel = '';
  weekEventCount = 0;

  // ── Filter state ────────────────────────────────────────────────────────
  // The dormant filter set — kept around so the bucketing logic in buildCells
  // / buildWeekDays / rebuildDeadlineTrack can ignore hidden cases. The UI
  // toggle that populated this was removed to match the cal-d1/d2 mockup
  // chrome (case toggles live in the global app sidebar in those mockups, not
  // inside the calendar component). Always-empty in V1.
  private hiddenCases = new Set<string>();

  // ── D2 deadline track ───────────────────────────────────────────────────
  /**
   * Upcoming deadlines (90-day forward window) sorted tier-severity then
   * date. Drives both the deadline strip and the sub-label counts.
   */
  upcomingDeadlines: DeadlineCardVm[] = [];
  /** Headline counts for the page-head sub-label. */
  deadlinesIn90d = 0;
  statuteUnder60d = 0;

  // ── D3 week/day time grid ───────────────────────────────────────────────
  /**
   * Hour rows shown in the time grid — 8a–7p inclusive (12 rows). Outside
   * that window most legal work doesn't happen; blocks that fall outside
   * are clipped to fit. Adjustable with `DAY_START_HOUR` / `DAY_END_HOUR`.
   */
  readonly hours: number[] = Array.from({ length: 12 }, (_, i) => 8 + i); // 8..19
  /** First day of the week currently being displayed (Sunday). */
  weekStart: Date = this.startOfWeek(new Date());
  /** Days rendered in the grid — 7 for week view, 1 for day view. */
  weekDays: WeekDay[] = [];
  /** Header label for week mode: "Week of May 4 · 8 events". */
  weekLabel = '';
  /** Header label for day mode: "Tue, May 6". */
  dayLabel = '';

  /** First/last hour shown — controls grid height + block clipping. */
  private readonly DAY_START_HOUR = 8;
  private readonly DAY_END_HOUR = 19;
  /** Pixel height per hour row. Drives both row height and block sizing. */
  private readonly HOUR_HEIGHT_PX = 60;
  /**
   * Minimum block height in pixels — prevents 5-minute events from rendering
   * as invisible slivers. The chip still shows the real time range as text.
   */
  private readonly MIN_BLOCK_HEIGHT_PX = 26;

  /**
   * Event types that read as scheduled meetings / court appearances → 'event'
   * tone (warning yellow). Anything else falls through to 'non-billable'
   * (info violet) when we can't determine billable status. Once a `billable`
   * field lands on `CalendarEvent`, this defaults flip to 'billable' for true.
   */
  private static readonly EVENT_TONE_TYPES = new Set<string>([
    'COURT_DATE', 'DEPOSITION', 'CLIENT_MEETING', 'TEAM_MEETING',
    'MEDIATION', 'CONSULTATION', 'HEARING',
  ]);

  // ── View state ──────────────────────────────────────────────────────────
  /** Only 'month' is wired for V1. Day/Week toast and remain Month underneath. */
  viewMode: ViewMode = 'month';

  // ── Loading state ───────────────────────────────────────────────────────
  /**
   * Skeleton flag. Default false — only true on a cold fetch. Subsequent
   * month navigations rebuild from already-loaded events without a fetch
   * (and therefore without a skeleton flash). Honors the project-wide rule
   * that skeletons mirror real backend requests, never speculative loads.
   */
  loading = false;
  error: string | null = null;

  /**
   * Per-day event-display limit. After this many, the cell renders
   * "+N more" instead of additional chips. Three balances density vs
   * readability in the typical 110px row.
   */
  private readonly MAX_EVENTS_PER_DAY = 3;

  /**
   * Color palette shared with the tasks page so the same case shows the
   * same color across both pages. Six entries → enough variety, small
   * enough that hashing distributes evenly.
   */
  private static readonly CASE_PALETTE = [
    '#0b64e9', // blue
    '#16a34a', // green
    '#6b4aff', // violet
    '#ec4899', // pink
    '#f97006', // orange
    '#0c0a09', // ink
  ];

  // Deadline-tier events used to render as `c1-event-tinted-*` chips
  // (cal-d1 behavior). Now they render as full `c2-deadline-pin` bars
  // with a tier label ("STATUTE · ...", "COURT · ..."). The tinted-event
  // chip variant is reserved for all-day banners only — see `isTinted`.

  private destroy$ = new Subject<void>();

  constructor(
    private calendarService: CalendarService,
    private modalService: NgbModal,
    private toastr: ToastrService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.recomputeMonthLabel();
    this.loadEvents();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Data load
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch events from the backend and rebuild the grid. Uses the same
   * defensive response unwrapping the previous implementation had — backend
   * shape varies by environment (sometimes `{data: {events}}`, sometimes a
   * bare array) and the calendar still has to render in either case.
   */
  loadEvents(): void {
    this.loading = true;
    this.error = null;

    this.calendarService
      .getEvents()
      .pipe(
        timeout(10000),
        catchError(() => of([])),
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response: any) => {
          this.events = this.unwrapEvents(response);
          this.rebuildDeadlineTrack();
          this.buildCells();
          // Keep the week/day grid in sync too — toggling between views
          // should never re-fetch, so we have to rebuild both representations
          // here on every load. Cheap relative to the network round-trip.
          if (this.viewMode === 'week' || this.viewMode === 'day') {
            this.buildWeekDays(this.viewMode === 'week' ? 7 : 1);
          }
        },
        error: () => {
          this.events = [];
          this.rebuildDeadlineTrack();
          this.buildCells();
          if (this.viewMode === 'week' || this.viewMode === 'day') {
            this.buildWeekDays(this.viewMode === 'week' ? 7 : 1);
          }
        },
      });
  }

  private unwrapEvents(response: any): CalendarEvent[] {
    let raw: any[] = [];
    if (response && typeof response === 'object' && Array.isArray(response?.data?.events)) {
      raw = response.data.events;
    } else if (Array.isArray(response)) {
      raw = response;
    } else if (response?.data?.events) {
      // Single object wrapper — wrap it so map() still works.
      raw = [response.data.events];
    }

    return raw.map((event: any): CalendarEvent => ({
      id: event.id,
      title: event.title,
      description: event.description,
      // Backend uses startTime/endTime; older mocks use start/end. Accept either.
      start: event.start ? new Date(event.start) : new Date(event.startTime),
      end: event.end
        ? new Date(event.end)
        : event.endTime
          ? new Date(event.endTime)
          : undefined,
      location: event.location,
      eventType: event.eventType,
      status: event.status || 'SCHEDULED',
      allDay: event.allDay || false,
      recurrenceRule: event.recurrenceRule,
      color: event.color,
      caseId: event.caseId,
      caseTitle: event.caseTitle,
      caseNumber: event.caseNumber,
      // Cal-D2 deadline fields (V79). When the backend hasn't been deployed
      // with V79 yet, these come through as undefined — the render-time
      // tier-inference path (CalendarEventViewModalComponent.tierFor) handles
      // that case so the UI degrades gracefully.
      highPriority: event.highPriority,
      additionalReminders: event.additionalReminders,
      deadlineTier: event.deadlineTier,
      sourceAuthority: event.sourceAuthority,
      requiredAction: event.requiredAction,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Month navigation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Step ±1 unit in the current view (month, week, or day). The button bank
   * "‹ Today ›" is shared across views — same handler, behavior depends on
   * what's active.
   */
  prev(): void { this.step(-1); }
  next(): void { this.step(1); }

  /** Jump to the present in the current view. */
  goToday(): void {
    const today = new Date();
    if (this.viewMode === 'month') {
      this.currentMonth = this.firstOfMonth(today);
      this.recomputeMonthLabel();
      this.buildCells();
    } else if (this.viewMode === 'week') {
      this.weekStart = this.startOfWeek(today);
      this.recomputeWeekLabel();
      this.buildWeekDays(7);
    } else {
      this.weekStart = this.startOfDay(today);
      this.recomputeDayLabel();
      this.buildWeekDays(1);
    }
  }

  /** Back-compat aliases for the existing template bindings. */
  prevMonth(): void { this.prev(); }
  nextMonth(): void { this.next(); }

  private step(direction: 1 | -1): void {
    if (this.viewMode === 'month') {
      this.currentMonth = new Date(
        this.currentMonth.getFullYear(),
        this.currentMonth.getMonth() + direction,
        1,
      );
      this.recomputeMonthLabel();
      this.buildCells();
    } else if (this.viewMode === 'week') {
      this.weekStart = this.addDays(this.weekStart, 7 * direction);
      this.recomputeWeekLabel();
      this.buildWeekDays(7);
    } else {
      this.weekStart = this.addDays(this.weekStart, direction);
      this.recomputeDayLabel();
      this.buildWeekDays(1);
    }
  }

  /**
   * View-mode selector. Switches the active view and rebuilds the relevant
   * data — buildCells for month, buildWeekDays for week/day. Anchors the
   * new view on a sensible date: switching to Week from Month uses the
   * current week; switching to Day uses today (or whichever day you'd
   * arrived on if returning to Day later — we keep weekStart in sync).
   */
  setView(view: ViewMode): void {
    if (view === this.viewMode) return;
    this.viewMode = view;

    if (view === 'month') {
      this.recomputeMonthLabel();
      this.buildCells();
    } else if (view === 'week') {
      // Anchor the week to whichever date is currently in focus. From month
      // mode we don't have a "selected day" — use today's week, or the
      // current month's first week if today isn't visible.
      const anchor = this.isSameMonth(new Date(), this.currentMonth)
        ? new Date()
        : this.currentMonth;
      this.weekStart = this.startOfWeek(anchor);
      this.recomputeWeekLabel();
      this.buildWeekDays(7);
    } else {
      // Day view — anchor on today, or first-of-current-month if today's
      // not in the active month. Same intent as week-view anchoring.
      const anchor = this.isSameMonth(new Date(), this.currentMonth)
        ? new Date()
        : this.currentMonth;
      this.weekStart = this.startOfDay(anchor);
      this.recomputeDayLabel();
      this.buildWeekDays(1);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Grid construction
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build the 42 cells for the current month. Always 6 rows so the grid
   * height doesn't jump as months change (Feb 28 vs March 31). Leading
   * cells are filled from the previous month, trailing from the next, both
   * marked `inMonth=false` so the template renders them muted.
   *
   * Per-day events are split into two arrays: `pins` (deadline-style events
   * — tier-colored compact bars at the top of the cell) and `events` (regular
   * scheduled work — solid/tinted chips with time prefix). Both share the
   * MAX_EVENTS_PER_DAY budget so the cell height stays bounded; pins win
   * the budget first since they're more urgent.
   */
  private buildCells(): void {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();

    // First-of-month → its weekday tells us how many leading cells we need.
    const firstWeekday = new Date(year, month, 1).getDay(); // 0..6
    // Cell #0 starts (firstWeekday) days before the 1st of the month.
    const gridStart = new Date(year, month, 1 - firstWeekday);

    // Group events by their day key for O(1) lookup per cell. Filter hidden
    // cases here so the cap-at-3 logic operates on the visible set.
    const buckets = new Map<string, CalendarEvent[]>();
    for (const ev of this.events) {
      if (this.hiddenCases.has(this.caseKey(ev))) continue;
      const key = this.dayKey(ev.start);
      const arr = buckets.get(key) ?? [];
      arr.push(ev);
      buckets.set(key, arr);
    }
    // Sort each bucket: deadlines first (urgency), then all-day, then timed.
    for (const arr of buckets.values()) {
      arr.sort((a, b) => {
        const ta = this.tierFor(a);
        const tb = this.tierFor(b);
        if (ta && !tb) return -1;
        if (tb && !ta) return 1;
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return a.start.getTime() - b.start.getTime();
      });
    }

    const today = new Date();
    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const inMonth = date.getMonth() === month;
      const isToday = this.isSameDay(date, today);
      const all = buckets.get(this.dayKey(date)) ?? [];
      const visible = all.slice(0, this.MAX_EVENTS_PER_DAY);

      // Split visible events into pins (deadline-tier) vs regular chips.
      const pins: Array<{ event: CalendarEvent; tier: DeadlineTier }> = [];
      const events: CalendarEvent[] = [];
      for (const ev of visible) {
        const tier = this.tierFor(ev);
        if (tier) pins.push({ event: ev, tier });
        else events.push(ev);
      }

      cells.push({
        date,
        dayNumber: date.getDate(),
        inMonth,
        isToday,
        pins,
        events,
        moreCount: Math.max(0, all.length - visible.length),
      });
    }
    this.cells = cells;

    // Update "N events this week" sub-label from cells (uses already-filtered set).
    this.recomputeWeekCount();
  }

  /**
   * Build the 90-day deadline track strip — the persistent strip above the
   * month grid that shows upcoming deadlines sorted by tier severity (statute
   * → court → soft) then date. Recomputed whenever the underlying events
   * change so the strip always reflects the visible set.
   */
  private rebuildDeadlineTrack(): void {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const cutoff = new Date(startOfToday);
    cutoff.setDate(cutoff.getDate() + 90);

    const tierRank: Record<DeadlineTier, number> = { statute: 0, court: 1, soft: 2 };
    const cards: DeadlineCardVm[] = [];

    for (const ev of this.events) {
      if (this.hiddenCases.has(this.caseKey(ev))) continue;
      const tier = this.tierFor(ev);
      if (!tier) continue;
      if (!ev.start) continue;

      const evDate = new Date(ev.start);
      if (isNaN(evDate.getTime())) continue;
      // Forward-only window. Past deadlines don't appear in the upcoming
      // strip — they're history.
      if (evDate < startOfToday) continue;
      if (evDate > cutoff) continue;

      const dDay = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());
      const days = Math.round((dDay.getTime() - startOfToday.getTime()) / 86400000);

      // Severity tones — under 14 days is danger across all tiers, under 30
      // is warn, beyond is neutral. Statute always carries danger regardless
      // of distance because the consequences are catastrophic.
      const tone: 'danger' | 'warn' | null =
        tier === 'statute' && days <= 60 ? 'danger'
        : days <= 14 ? 'danger'
        : days <= 30 ? 'warn'
        : null;

      const countdownLabel =
        days < 0  ? `${Math.abs(days)} days late`
        : days === 0 ? 'Today'
        : days === 1 ? '1 day'
        :              `${days} days`;

      cards.push({
        event: ev,
        tier,
        daysRemaining: days,
        countdownLabel,
        countdownTone: tone,
        label: ev.title,
        caseLine: this.formatCaseLine(ev),
      });
    }

    cards.sort((a, b) => {
      const t = tierRank[a.tier] - tierRank[b.tier];
      if (t !== 0) return t;
      return a.daysRemaining - b.daysRemaining;
    });

    this.upcomingDeadlines = cards;
    this.deadlinesIn90d = cards.length;
    this.statuteUnder60d = cards.filter(
      (c) => c.tier === 'statute' && c.daysRemaining <= 60,
    ).length;
  }

  /**
   * Derive the deadline tier from event metadata. Mirrors the modal's
   * `tierFor` so the same event reads the same way in both. Source of
   * truth for "what is a deadline" across this component.
   */
  private tierFor(ev: CalendarEvent): DeadlineTier | null {
    return CalendarEventViewModalComponent.tierFor(ev);
  }

  /** Public alias the template uses for `[class]="'tier-' + cardTier(card)"`. */
  cardTier(card: DeadlineCardVm): DeadlineTier {
    return card.tier;
  }

  /** Pretty case-line for the deadline cards: "Hoxha v. MGH · May 20". */
  private formatCaseLine(ev: CalendarEvent): string {
    const parts: string[] = [];
    const c = ev.caseTitle || ev.caseNumber;
    if (c) parts.push(c);
    if (ev.start) {
      const dt = new Date(ev.start);
      if (!isNaN(dt.getTime())) {
        parts.push(dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      }
    }
    return parts.join(' · ');
  }

  /**
   * Count events falling within the calendar week that contains today.
   * Scans the cells we just built so the count agrees with what the user
   * actually sees on screen.
   */
  private recomputeWeekCount(): void {
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);

    let count = 0;
    for (const ev of this.events) {
      if (this.hiddenCases.has(this.caseKey(ev))) continue;
      if (ev.start >= weekStart && ev.start < weekEnd) count++;
    }
    this.weekEventCount = count;
  }

  private recomputeMonthLabel(): void {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    this.monthLabel = `${months[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}`;
  }

  /** "Week of May 4". Year is omitted unless we're crossing into a new year. */
  private recomputeWeekLabel(): void {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const ws = this.weekStart;
    const today = new Date();
    const yearSuffix = ws.getFullYear() !== today.getFullYear() ? `, ${ws.getFullYear()}` : '';
    this.weekLabel = `Week of ${months[ws.getMonth()]} ${ws.getDate()}${yearSuffix}`;
  }

  /** "Tue, May 6, 2026" for day view. */
  private recomputeDayLabel(): void {
    this.dayLabel = this.weekStart.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  /**
   * Build the day-column array for week (n=7) or day (n=1) view. Each day
   * gets:
   *   - `allDayBlocks` — events with allDay=true, rendered as a banner row
   *     above the hour grid.
   *   - `blocks` — timed events with computed top/height in pixels.
   *
   * Block positioning is independent (no collision detection in V1) — if
   * two events overlap they stack visually. Future polish: side-by-side
   * layout via column-index assignment.
   */
  private buildWeekDays(numDays: number): void {
    const today = new Date();
    const days: WeekDay[] = [];

    // Bucket events by day-key for O(1) lookup per column. Filter hidden
    // cases and skip events that are deadlines (those belong on the month
    // grid as pins; the hour grid is for scheduled time, not deadlines).
    const buckets = new Map<string, CalendarEvent[]>();
    for (const ev of this.events) {
      if (this.hiddenCases.has(this.caseKey(ev))) continue;
      if (this.tierFor(ev)) continue; // deadlines: month-only
      if (!ev.start) continue;
      const key = this.dayKey(ev.start);
      const arr = buckets.get(key) ?? [];
      arr.push(ev);
      buckets.set(key, arr);
    }

    for (let i = 0; i < numDays; i++) {
      const date = this.addDays(this.weekStart, i);
      const all = buckets.get(this.dayKey(date)) ?? [];

      const allDayBlocks: CalendarEvent[] = [];
      const blocks: TimeBlock[] = [];
      for (const ev of all) {
        if (ev.allDay) {
          allDayBlocks.push(ev);
        } else {
          const block = this.toTimeBlock(ev);
          if (block) blocks.push(block);
        }
      }
      // Sort timed blocks by start so they layer naturally (longer earlier
      // events sit behind shorter later ones — keeps overlap visible-ish).
      blocks.sort((a, b) => a.event.start.getTime() - b.event.start.getTime());

      const isToday = this.isSameDay(date, today);
      days.push({
        date,
        dayNumber: date.getDate(),
        // "Today" overrides the weekday name for the current day column —
        // matches the cal-d3 mockup, reads more clearly than re-decoding the
        // weekday once you're already in week view.
        weekday: isToday
          ? 'Today'
          : date.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday,
        allDayBlocks,
        blocks,
      });
    }
    this.weekDays = days;
  }

  /**
   * Convert a CalendarEvent → TimeBlock with pixel positioning, clipped to
   * the day window (8a–7p). Returns null for events that are entirely
   * outside the visible window — those don't render in this view (they
   * remain accessible from month view).
   */
  private toTimeBlock(ev: CalendarEvent): TimeBlock | null {
    const start = new Date(ev.start);
    if (isNaN(start.getTime())) return null;
    const end = ev.end ? new Date(ev.end) : new Date(start.getTime() + 60 * 60 * 1000); // default 1h
    if (isNaN(end.getTime())) return null;

    // Convert to fractional hours-since-midnight for math, clamp to window.
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const winStart = this.DAY_START_HOUR;
    const winEnd = this.DAY_END_HOUR;

    if (endHour <= winStart || startHour >= winEnd) return null;

    const clipStart = Math.max(startHour, winStart);
    const clipEnd = Math.min(endHour, winEnd);
    const topPx = (clipStart - winStart) * this.HOUR_HEIGHT_PX;
    const heightPx = Math.max(
      this.MIN_BLOCK_HEIGHT_PX,
      (clipEnd - clipStart) * this.HOUR_HEIGHT_PX - 4, // -4 = small visual gap
    );

    return {
      event: ev,
      topPx,
      heightPx,
      tone: this.blockTone(ev),
      timeLabel: this.formatTimeRange(start, end),
      caseLineLabel: this.formatBlockCaseLine(ev),
    };
  }

  /**
   * Tone for a time-grid block. Currently:
   *   - meetings/court/deposition/etc.   → 'event' (warning yellow)
   *   - everything else                  → 'non-billable' (info violet)
   * When `billable` lands on the schema, true = 'billable' (accent blue).
   */
  private blockTone(ev: CalendarEvent): BlockTone {
    if ((ev as any).billable === true) return 'billable';
    if (CalendarViewComponent.EVENT_TONE_TYPES.has(ev.eventType)) return 'event';
    return 'non-billable';
  }

  /**
   * Time range for a block in the time grid — "9:00–10:30", "1:00–3:10".
   * Uses colon-with-minutes formatting (no ampm) because the time grid's
   * hour col already establishes AM/PM context. Different from the month
   * chip's `formatShortTime` ("9a", "12p") which has to be self-contained.
   */
  private formatTimeRange(start: Date, end: Date): string {
    return `${this.formatBlockTime(start)}–${this.formatBlockTime(end)}`;
  }

  /** "9:00", "10:30", "1:00" — 12h with colon, no ampm. */
  private formatBlockTime(date: Date): string {
    const h24 = date.getHours();
    const m = date.getMinutes();
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(m).padStart(2, '0')}`;
  }

  /** "⚖ Hoxha v. MGH" — block sub-line. Empty when no case is linked. */
  private formatBlockCaseLine(ev: CalendarEvent): string {
    const c = ev.caseTitle || ev.caseNumber;
    return c ? `⚖ ${c}` : '';
  }

  // Date-math helpers for the week/day grid.
  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  private startOfWeek(d: Date): Date {
    const sod = this.startOfDay(d);
    sod.setDate(sod.getDate() - sod.getDay()); // back to Sunday
    return sod;
  }
  private addDays(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }
  private isSameMonth(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Click handlers
  // ─────────────────────────────────────────────────────────────────────────

  selectDay(cell: DayCell, ev?: Event): void {
    ev?.stopPropagation();
    if (!cell.inMonth) return; // muted leading/trailing days are non-actionable
    this.openCreateEventModal(cell.date);
  }

  /**
   * "+N more" handler — drills into Day view for the cell's date instead of
   * opening the create modal. Lets the user see every event on a busy day,
   * which is what they wanted when they clicked the truncation indicator.
   */
  expandDay(cell: DayCell, ev: Event): void {
    ev.stopPropagation();
    if (!cell.inMonth) return;
    this.weekStart = this.startOfDay(cell.date);
    this.viewMode = 'day';
    this.recomputeDayLabel();
    this.buildWeekDays(1);
  }

  /** Click target for a regular event chip in a day cell. */
  selectEvent(event: CalendarEvent, ev: Event): void {
    ev.stopPropagation();
    this.openViewEventModal(event);
  }

  /** Click target for a deadline pin in a day cell. */
  selectPin(pin: { event: CalendarEvent }, ev: Event): void {
    ev.stopPropagation();
    this.openViewEventModal(pin.event);
  }

  /** Click target for a card in the deadline track strip. */
  selectDeadlineCard(card: DeadlineCardVm, ev: Event): void {
    ev.stopPropagation();
    this.openViewEventModal(card.event);
  }

  openCreateEventModal(date?: Date): void {
    this.modalService.dismissAll();
    const modalRef = this.modalService.open(EventModalComponent, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      centered: true,
      windowClass: 'modal-snappy',
      backdropClass: 'modal-snappy',
    });

    modalRef.componentInstance.title = 'Create New Event';
    modalRef.componentInstance.caseId = null;

    if (date) {
      const partial: Partial<CalendarEvent> = {
        start: date,
        end: new Date(date.getTime() + 3600000),
      };
      modalRef.componentInstance.event = partial;
    }

    modalRef.result.then(
      (result) => {
        if (result) this.loadEvents();
      },
      () => {},
    );
  }

  /**
   * Opens the new Rox-styled view modal that branches on event type. The
   * existing `EventModalComponent` is still used for the actual edit form
   * (the new modal hands off to it via the Edit button) — splitting view
   * vs edit lets us redesign the read-only summary without reimplementing
   * the full create/update flow.
   */
  private openViewEventModal(event: CalendarEvent): void {
    this.modalService.dismissAll();
    const modalRef = this.modalService.open(CalendarEventViewModalComponent, {
      backdrop: 'static',
      keyboard: true,
      centered: true,
      // `cev-modal-window` strips the default Bootstrap modal-content chrome
      // (white bg + border) so our `.cev-modal` div fills the surface cleanly.
      // The override lives in src/styles.scss alongside `modal-snappy`.
      windowClass: 'cev-modal-window modal-snappy',
      backdropClass: 'modal-snappy',
    });

    modalRef.componentInstance.event = event;
    modalRef.componentInstance.caseColor = this.caseColor(event);

    // Modal close payloads: { action: 'edit' | 'deleted' | 'filed' }.
    //   - 'deleted' / 'filed' → server state already changed → refetch.
    //   - 'edit' → chain into the legacy edit form modal; it owns its own
    //     refetch trigger via its truthy-result-on-save contract.
    modalRef.result.then(
      (result) => {
        if (result?.action === 'deleted' || result?.action === 'filed') {
          this.loadEvents();
        } else if (result?.action === 'edit') {
          this.openEditEventModal(event);
        }
      },
      () => {},
    );
  }

  /**
   * Opens the legacy `EventModalComponent` in edit mode. Kept separate from
   * the view modal flow because the edit form is a distinct interaction
   * (full form, validation, save). The view modal's "Edit" button chains
   * here via `openViewEventModal`'s result handler.
   */
  private openEditEventModal(event: CalendarEvent): void {
    const ref = this.modalService.open(EventModalComponent, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      centered: true,
      windowClass: 'modal-snappy',
      backdropClass: 'modal-snappy',
    });
    ref.componentInstance.event = event;
    ref.componentInstance.title = 'Edit Event';
    ref.componentInstance.viewMode = false;
    ref.result.then(
      (result) => { if (result) this.loadEvents(); },
      () => {},
    );
  }

  navigateToLegal(): void {
    this.router.navigate(['/legal']);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Template helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns the per-event color (hex). Used by the template via
   * `[style.--ev-color]` so SCSS can read it for both the solid background
   * (color-mix-free) and the tinted variant (`color-mix(... transparent)`).
   * Same hashing the tasks page uses → same case color across both pages.
   */
  caseColor(keyOrEvent: string | CalendarEvent): string {
    const key = typeof keyOrEvent === 'string' ? keyOrEvent : this.caseKey(keyOrEvent);
    if (!key) return CalendarViewComponent.CASE_PALETTE[0];
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) - h + key.charCodeAt(i)) | 0;
    }
    const palette = CalendarViewComponent.CASE_PALETTE;
    return palette[Math.abs(h) % palette.length];
  }

  /**
   * Tinted iff the event is an all-day banner. Deadline-tier events have
   * been promoted to dedicated pins (`c2-deadline-pin`) and no longer pass
   * through this path — the pin handles its own coloring from `tier`.
   */
  isTinted(ev: CalendarEvent): boolean {
    return !!ev.allDay;
  }

  /**
   * Compact event-time prefix matching the cal-d1 mockup ("9a", "12p",
   * "11:30a"). All-day events show "all-day".
   */
  eventTimeLabel(ev: CalendarEvent): string {
    if (ev.allDay) return 'all-day';
    return this.formatShortTime(ev.start);
  }

  /**
   * Label rendered inside a deadline pin in a day cell. Format:
   *   "STATUTE · Hoxha SOL"  →  "STATUTE · Hoxha SOL"
   *   "COURT · Dorsey motion"
   * Uppercase tier prefix gives the row a "deadline banner" tone.
   */
  pinLabel(pin: { event: CalendarEvent; tier: DeadlineTier }): string {
    return `${pin.tier.toUpperCase()} · ${pin.event.title}`;
  }

  trackByCell(_: number, c: DayCell): number {
    return c.date.getTime();
  }
  trackByEvent(_: number, e: CalendarEvent): number | string {
    return e.id ?? `${e.title}-${e.start?.getTime?.()}`;
  }
  trackByPin(_: number, p: { event: CalendarEvent }): number | string {
    return p.event.id ?? `${p.event.title}-${p.event.start?.getTime?.()}`;
  }
  trackByDeadline(_: number, d: DeadlineCardVm): number | string {
    return d.event.id ?? `${d.event.title}-${d.event.start?.getTime?.()}`;
  }
  trackByDay(_: number, d: WeekDay): number {
    return d.date.getTime();
  }
  trackByBlock(_: number, b: TimeBlock): number | string {
    return b.event.id ?? `${b.event.title}-${b.event.start?.getTime?.()}`;
  }
  trackByHour(_: number, h: number): number {
    return h;
  }

  /**
   * Hour label for the leftmost column — "8 AM", "12 PM", "5 PM". 24h → 12h
   * with "noon"/"midnight" convention preserved as numerics for tabular
   * alignment in the column.
   */
  hourLabel(h: number): string {
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  }

  /** Total grid height in px — used by the inline-style on the day column. */
  get gridHeightPx(): number {
    return this.hours.length * this.HOUR_HEIGHT_PX;
  }

  /**
   * True if any day in the current week/day view has an all-day event. Used
   * to conditionally render the all-day banner row — keeps the row out of
   * the layout entirely when nobody needs it (so the hour grid sits flush
   * under the day-head).
   */
  get hasAnyAllDay(): boolean {
    return this.weekDays.some((d) => d.allDayBlocks.length > 0);
  }

  /** Click target for a time-block in the week/day grid. */
  selectBlock(block: TimeBlock, ev: Event): void {
    ev.stopPropagation();
    this.openViewEventModal(block.event);
  }

  /**
   * Click target for a day column header in week view — drills into Day
   * view for that date. Lets the user pick a single day to focus on.
   */
  drillIntoDay(day: WeekDay): void {
    this.weekStart = this.startOfDay(day.date);
    this.viewMode = 'day';
    this.recomputeDayLabel();
    this.buildWeekDays(1);
  }

  /**
   * Click target for an empty time-grid slot — opens the create modal with
   * the slot's date as the start time. Hour is implicit from `cell.date`'s
   * position in the column (hour-precision for V1; minute-precision is a
   * future polish via mouseY math).
   */
  selectTimeSlot(date: Date, hour: number, ev: Event): void {
    ev.stopPropagation();
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    this.openCreateEventModal(start);
  }

  /** Click target for an all-day banner block in the week/day view. */
  selectAllDayEvent(event: CalendarEvent, ev: Event): void {
    ev.stopPropagation();
    this.openViewEventModal(event);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pure helpers
  // ─────────────────────────────────────────────────────────────────────────

  private caseKey(ev: CalendarEvent): string {
    if (ev.caseId != null) return String(ev.caseId);
    if (ev.caseNumber) return `__num:${ev.caseNumber}`;
    return '__none';
  }

  private dayKey(date: Date): string {
    // YYYY-MM-DD in local time (not UTC) — events authored in local TZ
    // shouldn't slide to the previous day in eastern viewports.
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private firstOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  /**
   * "9a", "12p", "11:30a", "3:45p". Drops minutes on the hour (cleaner
   * with the cal-d1 mockup) and uses lowercase a/p to match the mockup's
   * compact tone — full "AM"/"PM" felt shouty in the small chip.
   */
  private formatShortTime(date: Date): string {
    const h24 = date.getHours();
    const m = date.getMinutes();
    const ampm = h24 >= 12 ? 'p' : 'a';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
  }
}
