import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { LegalCase, CaseStatus, CasePriority, PaymentStatus } from '../../../interfaces/case.interface';
import { CaseService } from '../../../services/case.service';
import Swal from 'sweetalert2';
import { BehaviorSubject, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { DataState } from 'src/app/enum/datastate.enum';

// ──────────────────────────────────────────────────────────────────
// Types & constants
// ──────────────────────────────────────────────────────────────────
type ViewMode = 'table' | 'board' | 'calendar' | 'map';
type FilterChip = 'status' | 'practice' | 'stage' | 'attorney' | 'value' | 'deadline';

interface AdvFilters {
  status: string[];
  practice: string[];
  stage: string[];
  attorney: string[];
  hasDeadlineThisWeek: boolean;
  valueGtKey: '' | 'gt100k' | 'gt500k' | 'gt1m';
}

interface SavedView {
  key: string;
  name: string;
  filters: AdvFilters;
  searchTerm: string;
  viewMode: ViewMode;
  builtIn?: boolean;
  count?: number;
}

interface CalendarCell {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  cases: LegalCase[];
}

interface MapPin {
  caseRef: LegalCase;
  city: string;
  x: number;       // 0–100 % of map canvas width
  y: number;       // 0–100 % of map canvas height
  urgency: 'urgent' | 'warn' | 'good';
}

const STORAGE_KEY = 'legience.caseList.savedViews';

// 7-stage PI lifecycle (also doubles as generic case lifecycle)
const STAGES = ['Intake', 'Investigation', 'Treatment', 'Pre-Demand', 'Demand Sent', 'Negotiation', 'Settled'] as const;
type Stage = typeof STAGES[number];

// Built-in saved views, available out of the box
const BUILT_IN_VIEWS: SavedView[] = [
  { key: 'all',         name: 'All',           filters: blankFilters(), searchTerm: '', viewMode: 'table', builtIn: true },
  { key: 'mine',        name: 'My Cases',      filters: blankFilters(), searchTerm: '', viewMode: 'table', builtIn: true },
  { key: 'thisWeek',    name: 'This Week',     filters: { ...blankFilters(), hasDeadlineThisWeek: true }, searchTerm: '', viewMode: 'table', builtIn: true },
  { key: 'demands',     name: 'Demands Due',   filters: { ...blankFilters(), stage: ['Pre-Demand', 'Demand Sent'] }, searchTerm: '', viewMode: 'table', builtIn: true },
  { key: 'unassigned',  name: 'Unassigned',    filters: blankFilters(), searchTerm: '', viewMode: 'table', builtIn: true },
];

function blankFilters(): AdvFilters {
  return { status: [], practice: [], stage: [], attorney: [], hasDeadlineThisWeek: false, valueGtKey: '' };
}

// City coordinates (Massachusetts metro area, normalized 0-100 of map canvas)
const CITY_COORDS: Record<string, { x: number; y: number }> = {
  'Boston':       { x: 65, y: 50 },
  'Cambridge':    { x: 60, y: 47 },
  'Quincy':       { x: 65, y: 60 },
  'Newton':       { x: 55, y: 50 },
  'Worcester':    { x: 30, y: 50 },
  'Lowell':       { x: 50, y: 30 },
  'Lynn':         { x: 70, y: 40 },
  'Springfield':  { x: 12, y: 55 },
  'Brockton':     { x: 60, y: 67 },
  'Framingham':   { x: 45, y: 53 },
};

@Component({
  selector: 'app-case-list',
  templateUrl: './case-list.component.html',
  styleUrls: ['./case-list.component.scss']
})
export class CaseListComponent implements OnInit, OnDestroy {

  // ────────────────────────────────────────────────────────────
  // Existing state (preserved for back-compat with services/tests)
  // ────────────────────────────────────────────────────────────
  cases: LegalCase[] = [];
  allCases: LegalCase[] = [];
  isLoading = false;
  error: string | null = null;
  isSearching = false;

  hearingsThisWeekCount = 0;
  deadlinesDueCount = 0;
  awaitingResponseCount = 0;
  needsAttentionCount = 0;

  searchTerm = '';
  selectedFilter: string | null = null;
  sortBy: string = 'deadline';

  state: { dataState: DataState, appData?: any } = { dataState: DataState.LOADING };
  readonly DataState = DataState;
  private currentPageSubject = new BehaviorSubject<number>(0);
  currentPage$ = this.currentPageSubject.asObservable();

  // ────────────────────────────────────────────────────────────
  // New state — view/filters/selection/drawer
  // ────────────────────────────────────────────────────────────
  viewMode: ViewMode = 'table';
  advFilters: AdvFilters = blankFilters();
  savedViews: SavedView[] = [];
  currentView: string = 'all';

  // Sort
  sortField: 'case' | 'stage' | 'attorney' | 'value' | 'deadline' = 'value';
  sortDir: 'asc' | 'desc' = 'desc';

  // Bulk selection
  selectedIds = new Set<string>();

  // Drawer
  drawerCase: LegalCase | null = null;

  // UI state
  openFilterChip: FilterChip | null = null;
  showSaveViewDialog = false;
  newViewName = '';
  newViewVisibility: 'me' | 'team' | 'firm' = 'me';

  // Calendar
  calendarMonth = new Date();

  // Constants for template
  readonly STAGES = STAGES;
  readonly STAGE_LIST = [...STAGES];

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private caseService: CaseService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadSavedViews();
    this.loadCases();
    this.setupSearchDebounce();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.drawerCase) this.closeDrawer();
    else if (this.showSaveViewDialog) this.closeSaveViewDialog();
    else if (this.openFilterChip) this.openFilterChip = null;
  }

  // ────────────────────────────────────────────────────────────
  // Data loading (preserved + extended)
  // ────────────────────────────────────────────────────────────
  loadCases(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.detectChanges();

    this.caseService.getCases(this.currentPageSubject.value).subscribe({
      next: (response) => {
        if (response?.data?.page?.content) {
          this.cases = response.data.page.content || [];
        } else if (response?.data?.cases) {
          this.cases = response.data.cases || [];
        } else if (Array.isArray(response?.data)) {
          this.cases = response.data;
        } else if (Array.isArray(response)) {
          this.cases = response;
        } else {
          this.cases = [];
        }
        this.allCases = [...this.cases];
        this.state = { dataState: DataState.LOADED, appData: response };
        this.calculateStats();
        this.refreshSavedViewCounts();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading cases:', err);
        this.error = 'Failed to load cases. Please try again later.';
        this.cases = [];
        this.allCases = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private setupSearchDebounce(): void {
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(term => {
        if (term && term.trim().length >= 2) this.performServerSearch(term.trim());
        else if (!term || term.trim().length === 0) {
          this.cases = [...this.allCases];
          this.isSearching = false;
          this.cdr.detectChanges();
        }
      });
  }

  private performServerSearch(query: string): void {
    this.isSearching = true;
    this.caseService.searchCases(query, 0, 50).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.cases = response?.data?.page?.content || response?.data?.page || [];
        this.isSearching = false;
        this.cdr.detectChanges();
      },
      error: () => {
        const q = query.toLowerCase();
        this.cases = this.allCases.filter(c =>
          c.caseNumber?.toLowerCase().includes(q) ||
          c.title?.toLowerCase().includes(q) ||
          c.clientName?.toLowerCase().includes(q) ||
          c.type?.toLowerCase().includes(q));
        this.isSearching = false;
        this.cdr.detectChanges();
      }
    });
  }

  goToPage(p: number): void { this.currentPageSubject.next(p); this.loadCases(); }
  goToNextOrPreviousPage(d?: string): void {
    this.goToPage(d === 'forward' ? this.currentPageSubject.value + 1 : this.currentPageSubject.value - 1);
  }

  // ────────────────────────────────────────────────────────────
  // Navigation + deletion (preserved)
  // ────────────────────────────────────────────────────────────
  viewCase(id: string): void { this.router.navigate(['/legal/cases', id]); }
  editCase(id: string): void { this.router.navigate(['/legal/cases/edit', id]); }
  createCase(): void { this.router.navigate(['/legal/cases/new']); }

  deleteCase(c: LegalCase): void {
    Swal.fire({
      title: 'Are you sure?',
      text: `You are about to delete case "${c.title}". This action cannot be undone.`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#d33', cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!', cancelButtonText: 'Cancel'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.isLoading = true; this.cdr.detectChanges();
      this.caseService.deleteCase(c.id).subscribe({
        next: () => {
          Swal.fire({ title: 'Deleted!', text: 'Case has been successfully deleted.', icon: 'success', confirmButtonColor: '#3085d6' })
            .then(() => this.loadCases());
        },
        error: (err) => {
          this.isLoading = false;
          if (err.status === 400) {
            Swal.fire({ title: 'Cannot Delete Case', html: `This case has related records (documents, notes, activities, etc.) that must be deleted first.<br><br>Please remove all documents, notes, and other related items before deleting this case.`, icon: 'warning', confirmButtonColor: '#3085d6', confirmButtonText: 'I Understand' });
          } else {
            Swal.fire({ title: 'Error!', text: 'Failed to delete case: ' + (err.error?.reason || err.error?.message || 'Please try again later.'), icon: 'error', confirmButtonColor: '#3085d6' });
          }
          this.cdr.detectChanges();
        }
      });
    });
  }

  // ────────────────────────────────────────────────────────────
  // KPI stats (preserved)
  // ────────────────────────────────────────────────────────────
  private calculateStats(): void {
    const now = new Date();
    const oneWeek = new Date(now.getTime() + 7 * 86400000);
    this.hearingsThisWeekCount = this.cases.filter(c => {
      const h = c.importantDates?.nextHearing;
      if (!h) return false;
      const d = new Date(h);
      return d >= now && d <= oneWeek;
    }).length;
    this.deadlinesDueCount = this.cases.filter(c => {
      if (!c.importantDates) return false;
      const f = c.importantDates.filingDate ? new Date(c.importantDates.filingDate) : null;
      const t = c.importantDates.trialDate ? new Date(c.importantDates.trialDate) : null;
      return (f && f >= now && f <= oneWeek) || (t && t >= now && t <= oneWeek);
    }).length;
    this.awaitingResponseCount = this.cases.filter(c => c.status === CaseStatus.PENDING).length;
    this.needsAttentionCount = this.cases.filter(c => {
      const high = c.priority === CasePriority.HIGH || c.priority === CasePriority.URGENT;
      const overdue = c.billingInfo?.paymentStatus === PaymentStatus.OVERDUE;
      const past = c.importantDates?.nextHearing && new Date(c.importantDates.nextHearing) < now;
      return high || overdue || past;
    }).length;
  }

  // ────────────────────────────────────────────────────────────
  // Filtering & sorting (extended — supports adv-filters)
  // ────────────────────────────────────────────────────────────
  getFilteredCases(): LegalCase[] {
    let out = [...this.cases];

    // Built-in saved-view scopes
    if (this.currentView === 'mine') out = out.filter(c => this.isMine(c));
    if (this.currentView === 'unassigned') out = out.filter(c => !this.getLeadAttorneyName(c));

    // Adv filter: status (multi)
    if (this.advFilters.status.length) out = out.filter(c => this.advFilters.status.includes(c.status));

    // Adv filter: practice area (multi)
    if (this.advFilters.practice.length) out = out.filter(c => this.advFilters.practice.includes(this.inferPractice(c)));

    // Adv filter: stage (multi)
    if (this.advFilters.stage.length) out = out.filter(c => this.advFilters.stage.includes(this.inferStage(c)));

    // Adv filter: attorney (multi by initials, simple match)
    if (this.advFilters.attorney.length) out = out.filter(c => this.advFilters.attorney.includes(this.getLeadAttorneyInitials(c)));

    // Adv filter: deadline this week
    if (this.advFilters.hasDeadlineThisWeek) {
      const now = new Date();
      const weekOut = new Date(now.getTime() + 7 * 86400000);
      out = out.filter(c => {
        const d = this.getNextDeadline(c);
        return d && d >= now && d <= weekOut;
      });
    }

    // Adv filter: value > N
    if (this.advFilters.valueGtKey) {
      const limit = this.advFilters.valueGtKey === 'gt1m' ? 1_000_000 : this.advFilters.valueGtKey === 'gt500k' ? 500_000 : 100_000;
      out = out.filter(c => (c.billingInfo?.totalAmount || 0) > limit);
    }

    // Free-text search (in addition to server-side debounce)
    if (this.searchTerm?.trim()) {
      const q = this.searchTerm.toLowerCase().trim();
      out = out.filter(c =>
        c.caseNumber?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.clientName?.toLowerCase().includes(q) ||
        c.type?.toLowerCase().includes(q) ||
        this.getLeadAttorneyName(c).toLowerCase().includes(q));
    }

    return this.sortCases(out);
  }

  sortCases(cs: LegalCase[]): LegalCase[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return [...cs].sort((a, b) => {
      let cmp = 0;
      switch (this.sortField) {
        case 'case': cmp = (a.title || '').localeCompare(b.title || ''); break;
        case 'stage': cmp = this.inferStage(a).localeCompare(this.inferStage(b)); break;
        case 'attorney': cmp = this.getLeadAttorneyName(a).localeCompare(this.getLeadAttorneyName(b)); break;
        case 'value': cmp = (a.billingInfo?.totalAmount || 0) - (b.billingInfo?.totalAmount || 0); break;
        case 'deadline':
          const da = this.getNextDeadline(a)?.getTime() ?? Infinity;
          const db = this.getNextDeadline(b)?.getTime() ?? Infinity;
          cmp = da - db; break;
      }
      return cmp * dir;
    });
  }

  toggleSort(field: 'case' | 'stage' | 'attorney' | 'value' | 'deadline'): void {
    if (this.sortField === field) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortField = field; this.sortDir = field === 'value' || field === 'deadline' ? 'desc' : 'asc'; }
  }

  filterByStatus(filter: string): void { this.selectedFilter = this.selectedFilter === filter ? null : filter; }
  clearFilter(): void { this.selectedFilter = null; this.searchTerm = ''; this.cases = [...this.allCases]; this.cdr.detectChanges(); }
  onSearch(): void { this.searchSubject.next(this.searchTerm); }

  // ────────────────────────────────────────────────────────────
  // View modes
  // ────────────────────────────────────────────────────────────
  setViewMode(m: ViewMode): void { this.viewMode = m; this.openFilterChip = null; }

  // ────────────────────────────────────────────────────────────
  // Saved views
  // ────────────────────────────────────────────────────────────
  private loadSavedViews(): void {
    let user: SavedView[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) user = JSON.parse(raw);
    } catch { /* ignore corrupt */ }
    this.savedViews = [...BUILT_IN_VIEWS.map(v => ({ ...v })), ...user];
    this.currentView = 'all';
  }

  private saveUserViews(): void {
    const user = this.savedViews.filter(v => !v.builtIn);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(user)); } catch {}
  }

  applySavedView(key: string): void {
    const v = this.savedViews.find(x => x.key === key);
    if (!v) return;
    this.currentView = key;
    this.advFilters = { ...blankFilters(), ...v.filters, status: [...v.filters.status], practice: [...v.filters.practice], stage: [...v.filters.stage], attorney: [...v.filters.attorney] };
    this.searchTerm = v.searchTerm || '';
    this.viewMode = v.viewMode || 'table';
    this.openFilterChip = null;
  }

  openSaveViewDialog(): void {
    this.newViewName = `Custom view ${this.savedViews.filter(v => !v.builtIn).length + 1}`;
    this.newViewVisibility = 'me';
    this.showSaveViewDialog = true;
  }
  closeSaveViewDialog(): void { this.showSaveViewDialog = false; }

  confirmSaveView(): void {
    if (!this.newViewName.trim()) return;
    const key = 'v_' + Date.now();
    this.savedViews.push({
      key, name: this.newViewName.trim(),
      filters: JSON.parse(JSON.stringify(this.advFilters)),
      searchTerm: this.searchTerm,
      viewMode: this.viewMode,
    });
    this.currentView = key;
    this.saveUserViews();
    this.closeSaveViewDialog();
  }

  deleteSavedView(key: string, ev: MouseEvent): void {
    ev.stopPropagation();
    this.savedViews = this.savedViews.filter(v => v.key !== key);
    if (this.currentView === key) this.applySavedView('all');
    this.saveUserViews();
  }

  private refreshSavedViewCounts(): void {
    // Count display per saved view (best-effort, uses current page data)
    const total = this.allCases.length;
    const mine = this.allCases.filter(c => this.isMine(c)).length;
    const unassigned = this.allCases.filter(c => !this.getLeadAttorneyName(c)).length;
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 86400000);
    const thisWeek = this.allCases.filter(c => {
      const d = this.getNextDeadline(c);
      return d && d >= now && d <= week;
    }).length;
    const demands = this.allCases.filter(c => {
      const s = this.inferStage(c);
      return s === 'Pre-Demand' || s === 'Demand Sent';
    }).length;
    this.savedViews.forEach(v => {
      switch (v.key) {
        case 'all': v.count = total; break;
        case 'mine': v.count = mine; break;
        case 'thisWeek': v.count = thisWeek; break;
        case 'demands': v.count = demands; break;
        case 'unassigned': v.count = unassigned; break;
      }
    });
  }

  // ────────────────────────────────────────────────────────────
  // Adv-filter chip dropdown
  // ────────────────────────────────────────────────────────────
  toggleFilterChip(c: FilterChip, ev?: MouseEvent): void {
    ev?.stopPropagation();
    this.openFilterChip = this.openFilterChip === c ? null : c;
  }
  closeFilterChip(): void { this.openFilterChip = null; }

  toggleFilterValue(category: 'status' | 'practice' | 'stage' | 'attorney', value: string): void {
    const arr = this.advFilters[category];
    const idx = arr.indexOf(value);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(value);
  }
  isFilterChecked(category: 'status' | 'practice' | 'stage' | 'attorney', value: string): boolean {
    return this.advFilters[category].includes(value);
  }
  clearFilterCategory(category: 'status' | 'practice' | 'stage' | 'attorney'): void { this.advFilters[category] = []; }
  clearAllFilters(): void {
    this.advFilters = blankFilters();
    this.searchTerm = '';
    this.openFilterChip = null;
  }
  toggleDeadlineThisWeek(): void { this.advFilters.hasDeadlineThisWeek = !this.advFilters.hasDeadlineThisWeek; }
  setValueGt(key: AdvFilters['valueGtKey']): void { this.advFilters.valueGtKey = this.advFilters.valueGtKey === key ? '' : key; }

  hasActiveFilters(): boolean {
    return !!(this.advFilters.status.length + this.advFilters.practice.length + this.advFilters.stage.length + this.advFilters.attorney.length)
      || this.advFilters.hasDeadlineThisWeek
      || !!this.advFilters.valueGtKey;
  }

  // ────────────────────────────────────────────────────────────
  // Bulk select
  // ────────────────────────────────────────────────────────────
  isSelected(id: string): boolean { return this.selectedIds.has(id); }

  toggleSelect(id: string, ev?: MouseEvent): void {
    ev?.stopPropagation();
    if (this.selectedIds.has(id)) this.selectedIds.delete(id); else this.selectedIds.add(id);
  }

  toggleSelectAllVisible(): void {
    const visible = this.getFilteredCases().map(c => c.id).filter(Boolean) as string[];
    const allSelected = visible.length > 0 && visible.every(id => this.selectedIds.has(id));
    if (allSelected) visible.forEach(id => this.selectedIds.delete(id));
    else visible.forEach(id => this.selectedIds.add(id));
  }

  allVisibleSelected(): boolean {
    const ids = this.getFilteredCases().map(c => c.id).filter(Boolean) as string[];
    return ids.length > 0 && ids.every(id => this.selectedIds.has(id));
  }

  clearSelection(): void { this.selectedIds.clear(); }

  selectedSummary(): string {
    if (this.selectedIds.size === 0) return '';
    const arr = this.cases.filter(c => c.id && this.selectedIds.has(c.id));
    const names = arr.slice(0, 2).map(c => c.title?.split(/\s+v\./i)[0] || c.title || c.caseNumber).filter(Boolean);
    if (arr.length > 2) names.push(`+${arr.length - 2} more`);
    return names.join(', ');
  }

  bulkAction(action: 'reassign' | 'priority' | 'message' | 'export' | 'archive'): void {
    const count = this.selectedIds.size;
    if (count === 0) return;

    if (action === 'archive') {
      Swal.fire({
        title: `Archive ${count} cases?`,
        html: `<div style="text-align:left;font-size:13px;color:#57534d;">Archived cases are hidden from active views but remain searchable. They can be restored anytime within 90 days.</div>`,
        icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#0b64e9', cancelButtonColor: '#a6a09b',
        confirmButtonText: `Archive ${count}`, cancelButtonText: 'Cancel',
      }).then(r => {
        if (r.isConfirmed) Swal.fire({ icon: 'success', title: 'Archived', text: `${count} cases archived. (Wire to backend in next iteration.)`, confirmButtonColor: '#0b64e9' });
      });
      return;
    }
    Swal.fire({ icon: 'info', title: this.bulkActionLabel(action), text: `Action will run on ${count} selected cases. (Wire to backend in next iteration.)`, confirmButtonColor: '#0b64e9' });
  }

  private bulkActionLabel(a: string): string {
    return ({ reassign: 'Reassign attorney', priority: 'Set priority', message: 'Send update', export: 'Export', archive: 'Archive' } as any)[a] || a;
  }

  // ────────────────────────────────────────────────────────────
  // Drawer
  // ────────────────────────────────────────────────────────────
  openDrawer(c: LegalCase, ev?: Event): void { ev?.stopPropagation(); this.drawerCase = c; }
  closeDrawer(): void { this.drawerCase = null; }

  // ────────────────────────────────────────────────────────────
  // Calendar
  // ────────────────────────────────────────────────────────────
  getCalendarMatrix(): CalendarCell[] {
    const month = this.calendarMonth.getMonth();
    const year = this.calendarMonth.getFullYear();
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay(); // 0 (Sun) - 6 (Sat)
    const startDate = new Date(year, month, 1 - startWeekday);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const cells: CalendarCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate.getTime() + i * 86400000);
      const dayKey = d.toISOString().slice(0, 10);
      const cases = this.getFilteredCases().filter(c => {
        const dl = this.getNextDeadline(c);
        return dl && dl.toISOString().slice(0, 10) === dayKey;
      });
      cells.push({
        date: d,
        inMonth: d.getMonth() === month,
        isToday: d.getTime() === today.getTime(),
        cases,
      });
    }
    return cells;
  }

  goPrevMonth(): void { this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() - 1, 1); }
  goNextMonth(): void { this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 1, 1); }
  goToday(): void { this.calendarMonth = new Date(); }

  formatMonthYear(): string {
    return this.calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  // ────────────────────────────────────────────────────────────
  // Map
  // ────────────────────────────────────────────────────────────
  getMapPins(): MapPin[] {
    return this.getFilteredCases().map(c => {
      const city = this.extractCity(c.clientAddress) || 'Boston';
      const coords = CITY_COORDS[city] || CITY_COORDS['Boston'];
      const days = this.getDaysUntilDeadline(c);
      const urgency: MapPin['urgency'] = days !== null && days < 0 ? 'urgent' : days !== null && days <= 7 ? 'warn' : 'good';
      return { caseRef: c, city, x: coords.x, y: coords.y, urgency };
    });
  }

  getMapClusters(): { x: number; y: number; city: string; count: number; urgency: MapPin['urgency']; pins: MapPin[] }[] {
    const groups = new Map<string, MapPin[]>();
    this.getMapPins().forEach(p => {
      const k = p.city;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    });
    return Array.from(groups.entries()).map(([city, pins]) => {
      const urgency: MapPin['urgency'] = pins.some(p => p.urgency === 'urgent') ? 'urgent' : pins.some(p => p.urgency === 'warn') ? 'warn' : 'good';
      return { x: pins[0].x, y: pins[0].y, city, count: pins.length, urgency, pins };
    });
  }

  private extractCity(addr?: string): string | null {
    if (!addr) return null;
    for (const city of Object.keys(CITY_COORDS)) {
      if (addr.toLowerCase().includes(city.toLowerCase())) return city;
    }
    return null;
  }

  // ────────────────────────────────────────────────────────────
  // Inferences from existing LegalCase fields
  // ────────────────────────────────────────────────────────────
  inferStage(c: LegalCase): Stage {
    // Use explicit stage if provided by backend, else map from status
    const explicit = (c as any).stage as string | undefined;
    if (explicit && (STAGES as readonly string[]).includes(explicit)) return explicit as Stage;
    switch (c.status) {
      case CaseStatus.OPEN:        return 'Pre-Demand';
      case CaseStatus.IN_PROGRESS: return 'Investigation';
      case CaseStatus.PENDING:     return 'Negotiation';
      case CaseStatus.CLOSED:      return 'Settled';
      case CaseStatus.ARCHIVED:    return 'Settled';
      default: return 'Intake';
    }
  }

  inferPractice(c: LegalCase): string {
    const t = (c.type || '').toLowerCase();
    if (/(injury|accident|medical|malpractice)/.test(t)) return 'Personal Injury';
    if (/(family|divorce|custody|adoption)/.test(t)) return 'Family Law';
    if (/(corporate|business|merger|contract)/.test(t)) return 'Business Law';
    if (/(real estate|property|landlord|tenant)/.test(t)) return 'Real Estate';
    if (/(estate|probate|trust|will)/.test(t)) return 'Estate Planning';
    if (/(employment|labor|discrimination|wrongful)/.test(t)) return 'Employment';
    if (/(criminal|defense|dui|felony)/.test(t)) return 'Criminal';
    if (/(bankruptcy|debt|insolvency)/.test(t)) return 'Bankruptcy';
    if (/(immigration|visa|asylum)/.test(t)) return 'Immigration';
    if (/(intellectual|patent|trademark)/.test(t)) return 'IP';
    return c.type || 'General';
  }

  practiceColorClass(c: LegalCase): string {
    const p = this.inferPractice(c);
    return ({ 'Personal Injury': 'pa-pi', 'Family Law': 'pa-fam', 'Business Law': 'pa-biz', 'Real Estate': 'pa-realestate',
             'Estate Planning': 'pa-estate', 'Employment': 'pa-emp', 'Criminal': 'pa-crim',
             'Bankruptcy': 'pa-bk', 'Immigration': 'pa-imm', 'IP': 'pa-ip' } as Record<string, string>)[p] || 'pa-default';
  }

  inferValue(c: LegalCase): string {
    const v = c.billingInfo?.totalAmount;
    if (!v) return '—';
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  }

  isMine(c: LegalCase): boolean {
    // Without current user injection, treat lead-attorney presence as a placeholder.
    // Wire to UserService in a follow-up.
    return !!this.getLeadAttorneyName(c);
  }

  // ────────────────────────────────────────────────────────────
  // Existing helpers (preserved)
  // ────────────────────────────────────────────────────────────
  getStatusClass(s: CaseStatus): string {
    return ({ [CaseStatus.OPEN]: 'pill pill-success', [CaseStatus.IN_PROGRESS]: 'pill pill-warning',
             [CaseStatus.PENDING]: 'pill pill-info', [CaseStatus.CLOSED]: 'pill pill-subtle',
             [CaseStatus.ARCHIVED]: 'pill pill-subtle' } as any)[s] || 'pill pill-subtle';
  }
  getPriorityClass(p: CasePriority): string {
    return ({ [CasePriority.LOW]: 'pill pill-success', [CasePriority.MEDIUM]: 'pill pill-warning',
             [CasePriority.HIGH]: 'pill pill-danger', [CasePriority.URGENT]: 'pill pill-danger' } as any)[p] || 'pill';
  }
  stagePillClass(stage: Stage): string {
    return ({ 'Intake': 'pill pill-subtle', 'Investigation': 'pill pill-accent',
             'Treatment': 'pill pill-info', 'Pre-Demand': 'pill pill-warning',
             'Demand Sent': 'pill pill-orange', 'Negotiation': 'pill pill-warning',
             'Settled': 'pill pill-success' } as Record<string, string>)[stage] || 'pill pill-subtle';
  }

  getNextDeadline(c: LegalCase): Date | null {
    if (!c.importantDates) return null;
    const ds = [c.importantDates.nextHearing, c.importantDates.filingDate, c.importantDates.trialDate]
      .filter(d => d && new Date(d) >= new Date()).map(d => new Date(d!));
    if (!ds.length) return null;
    return ds.reduce((m, d) => d < m ? d : m);
  }
  getDaysUntilDeadline(c: LegalCase): number | null {
    const d = this.getNextDeadline(c); if (!d) return null;
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  }
  getDeadlineUrgency(c: LegalCase): string {
    const d = this.getDaysUntilDeadline(c); if (d === null) return '';
    if (d < 0) return 'overdue'; if (d <= 3) return 'urgent'; if (d <= 7) return 'warn'; return 'good';
  }

  getLeadAttorneyName(c: LegalCase): string {
    if (c.assignedAttorneys?.length) {
      const lead = c.assignedAttorneys.find(a => a.roleType === 'LEAD') || c.assignedAttorneys[0];
      return `${lead.firstName} ${lead.lastName}`;
    }
    if (c.assignedTo) return `${c.assignedTo.firstName || ''} ${c.assignedTo.lastName || ''}`.trim();
    return '';
  }
  getLeadAttorneyInitials(c: LegalCase): string {
    const n = this.getLeadAttorneyName(c); if (!n) return '?';
    const parts = n.split(' ').filter(p => p);
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : n.substring(0, 2).toUpperCase();
  }
  attorneyAvatarColor(c: LegalCase): string {
    const initials = this.getLeadAttorneyInitials(c);
    if (initials === '?') return 'av-subtle';
    const hash = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
    return ['av-blue', 'av-green', 'av-violet', 'av-pink', 'av-orange'][hash % 5];
  }

  getRelativeTime(date?: Date | string): string {
    if (!date) return '—';
    const ms = Date.now() - new Date(date).getTime();
    const m = Math.floor(ms / 60000), h = Math.floor(ms / 3600000), d = Math.floor(ms / 86400000);
    if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`; if (h < 24) return `${h}h ago`;
    if (d < 7) return `${d}d ago`; if (d < 30) return `${Math.floor(d / 7)}w ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  formatDeadline(c: LegalCase): { label: string; sub: string; urgency: string } {
    const d = this.getNextDeadline(c);
    if (!d) return { label: '—', sub: '', urgency: '' };
    const days = this.getDaysUntilDeadline(c)!;
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const sub = days < 0 ? `Overdue · ${Math.abs(days)}d` : `${dateStr} · ${days}d`;
    return { label: this.getDeadlineLabel(c), sub, urgency: this.getDeadlineUrgency(c) };
  }
  private getDeadlineLabel(c: LegalCase): string {
    if (!c.importantDates) return 'Deadline';
    const next = this.getNextDeadline(c)?.getTime();
    if (next === new Date(c.importantDates.nextHearing as any).getTime()) return 'Hearing';
    if (next === new Date(c.importantDates.trialDate as any).getTime()) return 'Trial';
    if (next === new Date(c.importantDates.filingDate as any).getTime()) return 'Filing';
    return 'Deadline';
  }

  // Distinct lists for filter chip dropdowns
  distinctStatuses(): string[] { return Array.from(new Set(this.allCases.map(c => c.status).filter(Boolean) as string[])); }
  distinctPractices(): string[] { return Array.from(new Set(this.allCases.map(c => this.inferPractice(c)))).sort(); }
  distinctAttorneys(): string[] { return Array.from(new Set(this.allCases.map(c => this.getLeadAttorneyInitials(c)).filter(i => i !== '?'))).sort(); }

  // Counts for board
  casesInStage(stage: Stage): LegalCase[] { return this.getFilteredCases().filter(c => this.inferStage(c) === stage); }

  // Counts for KPI / pagination
  totalCount(): number { return this.allCases.length; }
  visibleCount(): number { return this.getFilteredCases().length; }
}
