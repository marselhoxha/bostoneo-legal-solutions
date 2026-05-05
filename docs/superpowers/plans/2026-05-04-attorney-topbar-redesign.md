# Attorney Topbar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Velzon-default attorney topbar with the dashboard-matched two-bar surface (Direction B from the brainstorm), introducing an active case context pill, global search affordance, primary "Ask Legience" CTA, live billable timer, and Lucide icons throughout the topbar.

**Architecture:** All work targets `/Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1` on `develop`. Two existing components are heavily edited (`topbar/`, `horizontal-topbar/`); two new services and one new component are introduced. SCSS lives in the component for layout + the global Rox theme for cross-cutting overrides (matches established pattern after the dashboard fix). Per CLAUDE.md: every commit must be approved by the user before running `git commit`.

**Tech Stack:** Angular 18, Geist font, Lucide via `lucide-angular`, RxJS Observables, SCSS with the existing Tier 1/Tier 2 token system (Velzon → `--legience-*`).

**Spec reference:** [docs/superpowers/specs/2026-05-04-attorney-topbar-redesign-design.md](../specs/2026-05-04-attorney-topbar-redesign-design.md)

**Phases (each independently shippable):**
- **Phase A — Foundation** (invisible): install Lucide, build services, mount drawer placeholder
- **Phase B — Bar 2 polish** (small visible change): update nav row icons + active state
- **Phase C — Bar 1 redesign** (big visible change): rebuild the top bar element-by-element
- **Phase D — Dark mode + responsive + cleanup**

---

## File Structure

### Created files

| Path | Responsibility |
|---|---|
| `src/app/core/services/active-case-context.service.ts` | Watches Router, detects `caseId` in route tree, fetches and caches case display name + number, exposes `activeCase$` Observable |
| `src/app/core/services/ai-drawer.service.ts` | Open/close trigger for the AI side-panel. State emitted via `BehaviorSubject` |
| `src/app/component/layouts/ai-quick-drawer/ai-quick-drawer.component.ts` | Slide-from-right panel. Subscribes to `AiDrawerService.isOpen$`. Phase 1 = placeholder content, Phase 2 = real AI interaction (out of this plan) |
| `src/app/component/layouts/ai-quick-drawer/ai-quick-drawer.component.html` | Drawer markup (header, body, close button) |
| `src/app/component/layouts/ai-quick-drawer/ai-quick-drawer.component.scss` | Drawer slide-in animation, backdrop, dark-mode treatment |
| `src/app/core/services/active-case-context.service.spec.ts` | Unit tests for the route-walking logic |

### Modified files

| Path | What changes |
|---|---|
| `package.json` | Add `lucide-angular` dependency |
| `src/app/app.module.ts` | Import `LucideAngularModule`, register icons used across the topbar |
| `src/app/component/layouts/topbar/topbar.component.html` | Significant rewrite of Bar 1 markup |
| `src/app/component/layouts/topbar/topbar.component.scss` | New Bar 1 layout, gradient, pills, button, cluster |
| `src/app/component/layouts/topbar/topbar.component.ts` | Inject services, add `activeCase$`, `activeTimer$`, `onAskLegience()`, drop case-mgmt dropdown methods |
| `src/app/component/layouts/horizontal-topbar/horizontal-topbar.component.html` | Lucide icons, `routerLinkActive` on each item |
| `src/app/component/layouts/horizontal-topbar/horizontal-topbar.component.scss` | Active state (accent underline), Lucide sizing |
| `src/app/component/layouts/horizontal-topbar/menu.ts` | Icon field updated from Remix → Lucide names |
| `src/app/component/layouts/layout.component.html` | Mount `<app-ai-quick-drawer>` as sibling of `<router-outlet>` |
| `src/app/component/layouts/layouts.module.ts` | Declare `AiQuickDrawerComponent` |
| `src/assets/scss/themes/rox/_foundation.scss` | Replace existing topbar Rox block with new structure |
| `src/assets/scss/themes/rox/_dashboard.scss` | Append topbar dark-mode overrides at end of Section 27 |

---

# PHASE A — Foundation

The whole phase is invisible to the user. Lucide is installed, services exist, drawer is mounted but never opened. No regression risk because nothing changes the rendered topbar yet.

## Task A1: Install lucide-angular

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install the dependency**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1
npm install lucide-angular@0.453.0
```

Expected: `package.json` and `package-lock.json` updated. Bundle size delta is small because we use tree-shakable per-icon imports in Task A2.

- [ ] **Step 2: Verify the package resolves**

```bash
node -e "console.log(require('lucide-angular/package.json').version)"
```

Expected: prints `0.453.0`.

- [ ] **Step 3: Stage and ask for commit approval**

```bash
git add package.json package-lock.json
```

Tell the user: "Staged the lucide-angular install. OK to commit with message `chore: add lucide-angular dependency`?"

Wait for explicit approval before running `git commit`.

---

## Task A2: Register Lucide icons in app.module

**Files:**
- Modify: `src/app/app.module.ts`

- [ ] **Step 1: Add the import + module registration**

Find the existing `imports:` array in `@NgModule({ ... })`. Add the Lucide import at the top with other module imports:

```typescript
import { LucideAngularModule, Search, Bell, MessageSquare, Moon, Sun, Sparkles,
         Clock, FolderOpen, LayoutDashboard, Folder, Calendar, CheckSquare,
         Wrench, Users, DollarSign, Headphones, PenTool, Briefcase, X, ChevronDown } from 'lucide-angular';
```

Then inside the `imports` array, register the picked icons:

```typescript
LucideAngularModule.pick({
  Search, Bell, MessageSquare, Moon, Sun, Sparkles, Clock, FolderOpen,
  LayoutDashboard, Folder, Calendar, CheckSquare, Wrench, Users,
  DollarSign, Headphones, PenTool, Briefcase, X, ChevronDown
})
```

The `X` and `ChevronDown` icons are for the AI drawer close button and dropdown affordances later.

- [ ] **Step 2: Visually verify nothing broke**

In the browser, navigate to any page. The app should still load and look identical to before. (Lucide icons aren't used yet — we just registered the module.)

- [ ] **Step 3: Stage + ask for commit approval**

```bash
git add src/app/app.module.ts
```

Commit message: `feat(topbar): register lucide icons globally`

---

## Task A3: Create ActiveCaseContextService

**Files:**
- Create: `src/app/core/services/active-case-context.service.ts`
- Create: `src/app/core/services/active-case-context.service.spec.ts`

- [ ] **Step 1: Write the service**

```typescript
import { Injectable } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { filter, switchMap, catchError, distinctUntilChanged } from 'rxjs/operators';
import { LegalCaseService } from '../../modules/legal/services/legal-case.service';
import { LegalCase } from '../../modules/legal/models/legal-case.model';

export interface ActiveCaseContext {
  id: number;
  displayName: string;
  caseNumber: string;
}

@Injectable({ providedIn: 'root' })
export class ActiveCaseContextService {
  private readonly subject = new BehaviorSubject<ActiveCaseContext | null>(null);
  readonly activeCase$: Observable<ActiveCaseContext | null> = this.subject.asObservable();
  private readonly cache = new Map<number, ActiveCaseContext>();

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly caseService: LegalCaseService,
  ) {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      switchMap(() => {
        const caseId = this.findCaseIdInRoute(this.route.snapshot);
        if (caseId == null) return of(null);
        if (this.cache.has(caseId)) return of(this.cache.get(caseId)!);
        return this.caseService.getCaseById(String(caseId)).pipe(
          // Map the LegalCase shape → our minimal ActiveCaseContext
          // (decoupled — topbar shouldn't carry the full LegalCase tree)
          switchMap((c: LegalCase) => {
            const ctx: ActiveCaseContext = {
              id: caseId,
              displayName: c.title || c.clientName || `Case #${caseId}`,
              caseNumber: c.caseNumber || String(caseId),
            };
            this.cache.set(caseId, ctx);
            return of(ctx);
          }),
          catchError(() => of(null))
        );
      }),
      distinctUntilChanged((a, b) => a?.id === b?.id),
    ).subscribe(ctx => this.subject.next(ctx));
  }

  /**
   * Recursively walk the route tree starting from the snapshot, returning
   * the first numeric `caseId` param found at any depth. Falls back to
   * `id` only when the URL path includes "cases" or "case" — otherwise the
   * `id` of an unrelated entity (user, document) would falsely activate
   * the case pill.
   */
  private findCaseIdInRoute(snapshot: ActivatedRouteSnapshot): number | null {
    let current: ActivatedRouteSnapshot | null = snapshot;
    while (current) {
      if (current.params['caseId']) {
        const id = Number(current.params['caseId']);
        return Number.isFinite(id) ? id : null;
      }
      const segments = current.url.map(u => u.path.toLowerCase());
      if (current.params['id'] && (segments.includes('cases') || segments.includes('case'))) {
        const id = Number(current.params['id']);
        return Number.isFinite(id) ? id : null;
      }
      current = current.firstChild;
    }
    return null;
  }
}
```

- [ ] **Step 2: Write the unit test**

```typescript
import { TestBed } from '@angular/core/testing';
import { Router, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { ActiveCaseContextService } from './active-case-context.service';
import { LegalCaseService } from '../../modules/legal/services/legal-case.service';

describe('ActiveCaseContextService', () => {
  let routerEvents$: Subject<any>;
  let routerSnapshot: any;
  let caseService: jasmine.SpyObj<LegalCaseService>;

  function buildSnapshot(params: any, urlSegments: string[] = [], child?: any): ActivatedRouteSnapshot {
    return {
      params,
      url: urlSegments.map(p => ({ path: p })),
      firstChild: child ?? null,
    } as unknown as ActivatedRouteSnapshot;
  }

  beforeEach(() => {
    routerEvents$ = new Subject();
    routerSnapshot = buildSnapshot({});
    caseService = jasmine.createSpyObj('LegalCaseService', ['getCaseById']);

    TestBed.configureTestingModule({
      providers: [
        ActiveCaseContextService,
        { provide: Router, useValue: { events: routerEvents$ } },
        { provide: 'ActivatedRoute', useValue: { snapshot: routerSnapshot } },
        { provide: LegalCaseService, useValue: caseService },
      ],
    });
  });

  it('emits null when no caseId is in the route', (done) => {
    const svc = TestBed.inject(ActiveCaseContextService);
    routerEvents$.next(new NavigationEnd(1, '/dashboard', '/dashboard'));
    svc.activeCase$.subscribe(v => { expect(v).toBeNull(); done(); });
  });

  it('emits ActiveCaseContext when caseId is in the route tree', (done) => {
    routerSnapshot.firstChild = buildSnapshot({ caseId: '42' }, ['legal', 'cases', '42']);
    caseService.getCaseById.and.returnValue(of({
      id: 42, title: 'Smith v. Acme', caseNumber: '2025-PI-0847'
    } as any));

    const svc = TestBed.inject(ActiveCaseContextService);
    routerEvents$.next(new NavigationEnd(1, '/legal/cases/42', '/legal/cases/42'));

    svc.activeCase$.subscribe(v => {
      if (v) {
        expect(v.id).toBe(42);
        expect(v.displayName).toBe('Smith v. Acme');
        expect(v.caseNumber).toBe('2025-PI-0847');
        done();
      }
    });
  });

  it('caches case lookups (only fetches once for repeated navigations)', (done) => {
    routerSnapshot.firstChild = buildSnapshot({ caseId: '42' }, ['legal', 'cases', '42']);
    caseService.getCaseById.and.returnValue(of({
      id: 42, title: 'Smith v. Acme', caseNumber: '2025-PI-0847'
    } as any));

    const svc = TestBed.inject(ActiveCaseContextService);
    routerEvents$.next(new NavigationEnd(1, '/legal/cases/42', '/legal/cases/42'));
    routerEvents$.next(new NavigationEnd(2, '/legal/cases/42/medical', '/legal/cases/42/medical'));
    setTimeout(() => {
      expect(caseService.getCaseById).toHaveBeenCalledTimes(1);
      done();
    }, 50);
  });

  it('emits null when case fetch errors', (done) => {
    routerSnapshot.firstChild = buildSnapshot({ caseId: '99' }, ['legal', 'cases', '99']);
    caseService.getCaseById.and.returnValue(throwError(() => new Error('not found')));

    const svc = TestBed.inject(ActiveCaseContextService);
    routerEvents$.next(new NavigationEnd(1, '/legal/cases/99', '/legal/cases/99'));
    svc.activeCase$.subscribe(v => { if (v === null) { done(); } });
  });

  it('does not trigger on non-case routes that have an id param', (done) => {
    routerSnapshot.firstChild = buildSnapshot({ id: '42' }, ['settings', 'users', '42']);
    const svc = TestBed.inject(ActiveCaseContextService);
    routerEvents$.next(new NavigationEnd(1, '/settings/users/42', '/settings/users/42'));
    svc.activeCase$.subscribe(v => { expect(v).toBeNull(); done(); });
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1
npx ng test --include='**/active-case-context.service.spec.ts' --watch=false --browsers=ChromeHeadless
```

Expected: 5 tests pass.

- [ ] **Step 4: Stage + ask for commit approval**

```bash
git add src/app/core/services/active-case-context.service.ts \
        src/app/core/services/active-case-context.service.spec.ts
```

Commit message: `feat(topbar): add ActiveCaseContextService`

---

## Task A4: Create AiDrawerService

**Files:**
- Create: `src/app/core/services/ai-drawer.service.ts`

- [ ] **Step 1: Write the service**

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ActiveCaseContext } from './active-case-context.service';

export interface AiDrawerState {
  context?: { activeCase?: ActiveCaseContext | null };
  openedAt: number;
}

@Injectable({ providedIn: 'root' })
export class AiDrawerService {
  private readonly subject = new BehaviorSubject<AiDrawerState | null>(null);
  readonly state$: Observable<AiDrawerState | null> = this.subject.asObservable();

  open(context?: AiDrawerState['context']): void {
    this.subject.next({ context, openedAt: Date.now() });
  }

  close(): void {
    this.subject.next(null);
  }

  toggle(context?: AiDrawerState['context']): void {
    if (this.subject.value) this.close();
    else this.open(context);
  }
}
```

- [ ] **Step 2: Stage + ask for commit approval**

```bash
git add src/app/core/services/ai-drawer.service.ts
```

Commit message: `feat(topbar): add AiDrawerService`

---

## Task A5: Create AiQuickDrawerComponent (placeholder)

**Files:**
- Create: `src/app/component/layouts/ai-quick-drawer/ai-quick-drawer.component.ts`
- Create: `src/app/component/layouts/ai-quick-drawer/ai-quick-drawer.component.html`
- Create: `src/app/component/layouts/ai-quick-drawer/ai-quick-drawer.component.scss`

- [ ] **Step 1: Write the component class**

```typescript
import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { AiDrawerService, AiDrawerState } from '../../../core/services/ai-drawer.service';

@Component({
  selector: 'app-ai-quick-drawer',
  templateUrl: './ai-quick-drawer.component.html',
  styleUrls: ['./ai-quick-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiQuickDrawerComponent implements OnInit, OnDestroy {
  state: AiDrawerState | null = null;
  private sub?: Subscription;

  constructor(private readonly drawer: AiDrawerService, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.sub = this.drawer.state$.subscribe(s => {
      this.state = s;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  close(): void {
    this.drawer.close();
  }
}
```

- [ ] **Step 2: Write the template**

```html
<div class="ai-drawer-backdrop" *ngIf="state" (click)="close()"></div>

<aside class="ai-drawer" [class.open]="state">
  <header class="ai-drawer-header">
    <span class="ai-drawer-title">
      <i-lucide name="sparkles" size="18"></i-lucide>
      Ask Legience
    </span>
    <button type="button" class="ai-drawer-close" (click)="close()" aria-label="Close drawer">
      <i-lucide name="x" size="18"></i-lucide>
    </button>
  </header>

  <div class="ai-drawer-context" *ngIf="state?.context?.activeCase as activeCase">
    <span class="ai-drawer-context-label">Context</span>
    <span class="ai-drawer-context-value">{{ activeCase.displayName }}</span>
  </div>

  <div class="ai-drawer-body">
    <p class="ai-drawer-placeholder">
      The full Ask Legience interaction lands in a follow-up spec.
      For now, this drawer slides in to confirm the wiring works.
    </p>
  </div>
</aside>
```

- [ ] **Step 3: Write the styles**

```scss
.ai-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.30);
  z-index: 1080;
  animation: fadeIn 0.2s ease;
}

.ai-drawer {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: 420px;
  max-width: calc(100vw - 24px);
  background: var(--legience-bg-card);
  border-left: 1px solid var(--legience-border-hairline);
  box-shadow: -8px 0 24px -8px rgba(0, 0, 0, 0.10);
  z-index: 1090;
  transform: translateX(100%);
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  display: flex;
  flex-direction: column;
  font-family: 'Geist', system-ui, sans-serif;

  &.open { transform: translateX(0); }
}

.ai-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--legience-border-hairline);
}

.ai-drawer-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--legience-text-primary);

  i-lucide { color: var(--legience-accent); stroke-width: 2; }
}

.ai-drawer-close {
  width: 30px; height: 30px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--legience-text-muted);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;

  &:hover { background: rgba(28, 25, 23, 0.05); color: var(--legience-text-primary); }
}

.ai-drawer-context {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 12px 18px;
  background: rgba(11, 100, 233, 0.04);
  border-bottom: 1px solid var(--legience-border-hairline);
  font-size: 13px;
}

.ai-drawer-context-label {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--legience-text-muted);
  font-weight: 600;
}

.ai-drawer-context-value {
  color: var(--legience-text-primary);
  font-weight: 500;
}

.ai-drawer-body {
  flex: 1;
  padding: 24px 18px;
  overflow-y: auto;
}

.ai-drawer-placeholder {
  font-size: 13.5px;
  font-weight: 300;
  color: var(--legience-text-secondary);
  line-height: 1.6;
  letter-spacing: -0.008em;
}

[data-bs-theme="dark"] {
  .ai-drawer { box-shadow: -8px 0 24px -8px rgba(0, 0, 0, 0.40); }
  .ai-drawer-context { background: rgba(11, 100, 233, 0.10); }
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
```

- [ ] **Step 4: Stage + ask for commit approval**

```bash
git add src/app/component/layouts/ai-quick-drawer/
```

Commit message: `feat(topbar): add Ask Legience side-panel placeholder`

---

## Task A6: Mount the drawer + declare in module

**Files:**
- Modify: `src/app/component/layouts/layouts.module.ts`
- Modify: `src/app/component/layouts/layout.component.html`

- [ ] **Step 1: Declare the component in layouts.module.ts**

Find the existing `declarations:` array. Add the import at the top:

```typescript
import { AiQuickDrawerComponent } from './ai-quick-drawer/ai-quick-drawer.component';
```

Add `AiQuickDrawerComponent` to the `declarations:` array.

- [ ] **Step 2: Mount the drawer in layout.component.html**

Open the file and find the closing `</div>` after `<router-outlet>`. Place the drawer right before the closing of the layout container, as a sibling to router-outlet:

```html
<!-- ... existing layout content + router-outlet ... -->
<app-ai-quick-drawer></app-ai-quick-drawer>
```

The drawer is fixed-positioned, so location in the markup doesn't matter visually — but keeping it inside the main layout container makes it clear it's part of the app shell.

- [ ] **Step 3: Visually verify the app loads**

In the browser: app should look identical, no drawer visible (state is null until someone calls `open()`).

- [ ] **Step 4: Stage + ask for commit approval**

```bash
git add src/app/component/layouts/layouts.module.ts \
        src/app/component/layouts/layout.component.html
```

Commit message: `feat(topbar): mount Ask Legience drawer in app shell`

---

# PHASE B — Bar 2 polish

Smaller scope, lower risk than Bar 1. Ships an immediately visible improvement (clear active state, refined Lucide icons) and proves the Lucide setup works end-to-end before the bigger Bar 1 work.

## Task B1: Update menu.ts with Lucide icon names

**Files:**
- Modify: `src/app/component/layouts/horizontal-topbar/menu.ts`

- [ ] **Step 1: Read the current menu.ts**

```bash
cat /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/src/app/component/layouts/horizontal-topbar/menu.ts
```

Note the existing structure — each MENU item has an `icon` field with a Remix class like `'ri-dashboard-3-line'` or similar. Some items are nested (sub-menus); we update the top-level icons only because Bar 2 in the new design doesn't render submenu icons.

- [ ] **Step 2: Add a `lucideIcon` field next to each existing `icon`**

We add a new field (rather than replacing) so existing code that reads `icon` keeps working through the transition. The new template will read `lucideIcon` first and fall back to `icon`. Apply this mapping to top-level menu entries:

| Label | `lucideIcon` value |
|---|---|
| Dashboard | `'layout-dashboard'` |
| Case Management | `'folder'` |
| Calendar | `'calendar'` |
| Tasks | `'check-square'` |
| LegiTools | `'wrench'` |
| Clients | `'users'` |
| Billing | `'dollar-sign'` |
| CRM | `'headphones'` |
| E-Signatures | `'pen-tool'` |

For each top-level MENU entry, edit the object literal to include the new field:

```typescript
{
  id: 1,  // or whatever existing id
  label: 'MENUITEMS.DASHBOARDS.TEXT',  // or whatever existing label
  icon: 'ri-dashboard-3-line',         // unchanged
  lucideIcon: 'layout-dashboard',      // ADDED
  link: '/dashboard',                  // unchanged
  // ... rest of existing fields
},
```

If a menu item's label key doesn't match the table above (e.g. uses i18n keys or different wording), match by `link:` instead — the route is the canonical identity.

- [ ] **Step 3: Visually verify nothing changed**

The current template still reads `icon`, so the page still renders Remix. We just added a sibling field.

- [ ] **Step 4: Stage + ask for commit approval**

```bash
git add src/app/component/layouts/horizontal-topbar/menu.ts
```

Commit message: `feat(topbar): add lucide icon names to nav menu`

---

## Task B2: Update horizontal-topbar template to use Lucide + routerLinkActive

**Files:**
- Modify: `src/app/component/layouts/horizontal-topbar/horizontal-topbar.component.html`

- [ ] **Step 1: Read the existing template to find the nav-item rendering loop**

```bash
grep -n "menuItem\|nav-link\|routerLink\|i class" /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/src/app/component/layouts/horizontal-topbar/horizontal-topbar.component.html | head -30
```

Locate the loop that renders top-level menu items (likely an `*ngFor="let item of menuItems"` or similar).

- [ ] **Step 2: Replace the icon rendering inside that loop**

Find the Remix icon element (something like `<i class="ri-..." [class]="item.icon"></i>`). Replace with:

```html
<i-lucide [name]="item.lucideIcon || 'square'" class="nav-icon"></i-lucide>
```

The `'square'` fallback is a safe Lucide name in case a menu item is missing `lucideIcon` — it renders a neutral square instead of crashing.

- [ ] **Step 3: Add routerLinkActive for active state binding**

On the same anchor/router link element that wraps the icon + label, add:

```html
[routerLinkActive]="'active'"
[routerLinkActiveOptions]="{ exact: false }"
```

(Use `{ exact: true }` only on the `/dashboard` item, since `/dashboard` is a prefix of `/dashboard/whatever` only if a sub-route exists.)

- [ ] **Step 4: Visually verify in browser**

The nav row should now show Lucide icons (slightly thinner stroke than Remix) and the active item has the `active` class applied. Without the next task's CSS, the active class is invisible — that's expected.

- [ ] **Step 5: Stage + ask for commit approval**

```bash
git add src/app/component/layouts/horizontal-topbar/horizontal-topbar.component.html
```

Commit message: `feat(topbar): swap nav icons to lucide + bind routerLinkActive`

---

## Task B3: Add active state styling to horizontal-topbar SCSS

**Files:**
- Modify: `src/app/component/layouts/horizontal-topbar/horizontal-topbar.component.scss`

- [ ] **Step 1: Add the new active state rules**

Append to the existing file:

```scss
:host {
  // Bar 2 nav items — match dashboard tab pattern: thin accent underline,
  // accent text, weight 500. Hover shifts color but no background. Lucide
  // icons sit at 15px, stroke 1.75, with reduced opacity that lifts to 1
  // on the active item.
  .nav-link, a[routerLinkActive] {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 12px 14px;
    font-family: 'Geist', system-ui, sans-serif;
    font-size: 13px;
    font-weight: 400;
    letter-spacing: -0.005em;
    color: var(--legience-text-secondary);
    position: relative;
    transition: color 0.12s ease;
    text-decoration: none;

    .nav-icon {
      width: 15px;
      height: 15px;
      stroke-width: 1.75;
      opacity: 0.85;
      flex-shrink: 0;
    }

    &:hover {
      color: var(--legience-text-primary);
      background: transparent;
    }

    &.active {
      color: var(--legience-accent);
      font-weight: 500;
      background: transparent;

      .nav-icon { opacity: 1; }

      &::after {
        content: '';
        position: absolute;
        left: 14px;
        right: 14px;
        bottom: -1px;
        height: 2px;
        background: var(--legience-accent);
        border-radius: 2px 2px 0 0;
      }
    }
  }
}
```

(Note: the selector `.nav-link, a[routerLinkActive]` is broad enough to catch whatever class Velzon's template uses. If the template uses something different — say, `.menu-link` — adjust the selector to match.)

- [ ] **Step 2: Visually verify**

In the browser, navigate between Dashboard / Cases / Calendar etc. The active item should now show:
- Accent blue text (`#0b64e9`)
- Slight weight bump (500 vs 400)
- Thin 2px underline at the bottom
- Icon opacity 1 (vs 0.85 on inactive)

- [ ] **Step 3: Stage + ask for commit approval**

```bash
git add src/app/component/layouts/horizontal-topbar/horizontal-topbar.component.scss
```

Commit message: `feat(topbar): add accent underline active state to nav row`

---

# PHASE C — Bar 1 redesign

The big visible change. Built incrementally so the topbar remains functional after each task — even if the visual progresses through intermediate states.

## Task C1: Replace Bar 1 base layout (skeleton + gradient + hairline)

**Files:**
- Modify: `src/app/component/layouts/topbar/topbar.component.html`
- Modify: `src/app/component/layouts/topbar/topbar.component.scss`

- [ ] **Step 1: Replace the `<header id="page-topbar">` content with the new skeleton**

Open `topbar.component.html` and replace everything inside `<header id="page-topbar" data-scroll-header>` with:

```html
<div class="layout-width">
  <div class="topbar-bar1">

    <!-- LOGO BLOCK -->
    <div class="topbar-logo">
      <a [routerLink]="['/']" class="topbar-logo-link">
        <img class="topbar-logo-img logo-light" src="assets/images/legience-logo-blue.svg" height="28" alt="legience">
        <img class="topbar-logo-img logo-dark"  src="assets/images/legience-logo-white.svg" height="28" alt="legience">
      </a>
      <span class="topbar-firm" *ngIf="firmName">{{ firmName }}</span>
    </div>

    <!-- ACTIVE CASE PILL placeholder (filled in C3) -->
    <ng-container *ngTemplateOutlet="contextPillTpl"></ng-container>

    <!-- Sysadmin org switcher — keep existing component -->
    <app-organization-switcher class="topbar-org-switcher"></app-organization-switcher>

    <!-- Hamburger (mobile) -->
    <button type="button" class="btn btn-sm fs-16 vertical-menu-btn topnav-hamburger" id="topnav-hamburger-icon" (click)="toggleMobileMenu($event)">
      <span class="hamburger-icon"><span></span><span></span><span></span></span>
    </button>

    <span class="topbar-spacer"></span>

    <!-- SEARCH placeholder (filled in C4) -->
    <ng-container *ngTemplateOutlet="searchTpl"></ng-container>

    <!-- ASK LEGIENCE placeholder (filled in C5) -->
    <ng-container *ngTemplateOutlet="aiBtnTpl"></ng-container>

    <!-- TIMER PILL placeholder (filled in C6) -->
    <ng-container *ngTemplateOutlet="timerPillTpl"></ng-container>

    <!-- ICON CLUSTER placeholder (filled in C7) -->
    <ng-container *ngTemplateOutlet="iconClusterTpl"></ng-container>

    <!-- USER BLOCK placeholder (filled in C8) -->
    <ng-container *ngTemplateOutlet="userBlockTpl"></ng-container>

  </div>
</div>

<!-- Templates filled by later tasks -->
<ng-template #contextPillTpl></ng-template>
<ng-template #searchTpl></ng-template>
<ng-template #aiBtnTpl></ng-template>
<ng-template #timerPillTpl></ng-template>
<ng-template #iconClusterTpl></ng-template>
<ng-template #userBlockTpl></ng-template>
```

This deliberately uses `<ng-template>` outlets for the new pieces so subsequent tasks can fill them in one at a time without leaving the topbar broken in between. After this task, the topbar shows: logo + org switcher + hamburger + spacer (empty right side). That's intentional — incrementally we add each element.

- [ ] **Step 2: Add the base SCSS for Bar 1**

Open `topbar.component.scss` and add at the top (or replace the entire file with — your judgment, the existing file is largely Velzon adjustments that we're rewriting):

```scss
@import 'src/assets/scss/variables';

#page-topbar {
  position: sticky;
  top: 0;
  z-index: 1020;
}

.topbar-bar1 {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 22px;
  height: 70px;  // outer Velzon default — preserved to avoid page-content shift
  background:
    linear-gradient(135deg,
      #ffffff 0%,
      rgba(11, 100, 233, 0.025) 50%,
      rgba(11, 100, 233, 0.06) 100%);
  border-bottom: 1px solid var(--legience-border-hairline);
  font-family: 'Geist', system-ui, sans-serif;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -60px;
    right: -60px;
    width: 240px;
    height: 240px;
    background: radial-gradient(circle, rgba(11, 100, 233, 0.08) 0%, transparent 60%);
    border-radius: 50%;
    pointer-events: none;
  }

  > * { position: relative; z-index: 1; }
}

.topbar-spacer { flex: 1; }

.topbar-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding-right: 14px;
}

.topbar-logo-link { display: inline-flex; align-items: center; }
.topbar-logo-img.logo-dark { display: none; }
[data-bs-theme="dark"] .topbar-logo-img.logo-light { display: none; }
[data-bs-theme="dark"] .topbar-logo-img.logo-dark  { display: inline-block; }

.topbar-firm {
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--legience-text-muted);
  line-height: 1.2;
  margin-left: 2px;
}

// Hide the firm subtitle and organisation switcher row on mobile — they crowd the bar
@media (max-width: 991.98px) {
  .topbar-firm { display: none; }
}
```

- [ ] **Step 3: Add `firmName` getter to topbar.component.ts**

The component already has `userData: any` (line 55) populated from `userService.userData$`. Add inside the class:

```typescript
get firmName(): string | null {
  return this.userData?.organization?.name
      ?? this.userData?.organizationName
      ?? null;
}
```

(Both property paths covered because `User`/`UserDTO` shapes vary across the codebase. Whichever the API actually returns will resolve; the other returns undefined and falls through.)

- [ ] **Step 4: Visually verify**

The topbar now shows: logo + firm name (if user has one) + org switcher + hamburger, with the new white→blue gradient background and a soft radial glow in the top-right corner. Right side is empty. The gradient should match the dashboard hero card visually.

- [ ] **Step 5: Stage + ask for commit approval**

```bash
git add src/app/component/layouts/topbar/topbar.component.html \
        src/app/component/layouts/topbar/topbar.component.scss \
        src/app/component/layouts/topbar/topbar.component.ts
```

Commit message: `feat(topbar): rebuild bar 1 skeleton with dashboard gradient`

---

## Task C2: Wire ActiveCaseContextService into topbar.component.ts

**Files:**
- Modify: `src/app/component/layouts/topbar/topbar.component.ts`

- [ ] **Step 1: Inject the service and expose the observable**

Add to the imports:

```typescript
import { ActiveCaseContextService, ActiveCaseContext } from '../../../core/services/active-case-context.service';
import { Observable } from 'rxjs';
```

Add to the class body (typically below other observables / above the constructor):

```typescript
activeCase$: Observable<ActiveCaseContext | null>;
```

Inject in the constructor:

```typescript
constructor(
  // ... existing constructor args ...
  private activeCaseContext: ActiveCaseContextService,
) {
  this.activeCase$ = this.activeCaseContext.activeCase$;
}
```

(Append to the existing constructor's parameter list and assign in the body — don't replace the whole constructor.)

- [ ] **Step 2: Stage + ask for commit approval**

```bash
git add src/app/component/layouts/topbar/topbar.component.ts
```

Commit message: `feat(topbar): inject ActiveCaseContextService into topbar`

---

## Task C3: Render the active case pill

**Files:**
- Modify: `src/app/component/layouts/topbar/topbar.component.html`
- Modify: `src/app/component/layouts/topbar/topbar.component.scss`

- [ ] **Step 1: Fill the contextPillTpl template**

Replace the empty `<ng-template #contextPillTpl></ng-template>` with:

```html
<ng-template #contextPillTpl>
  <a class="topbar-context-pill"
     *ngIf="activeCase$ | async as activeCase"
     [routerLink]="['/legal/cases', activeCase.id]">
    <i-lucide name="folder-open" class="topbar-context-icon"></i-lucide>
    <strong>{{ activeCase.displayName }}</strong>
    <span class="topbar-context-num">· #{{ activeCase.caseNumber }}</span>
  </a>
</ng-template>
```

- [ ] **Step 2: Add SCSS for the pill**

Append to `topbar.component.scss`:

```scss
.topbar-context-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid var(--legience-border-hairline);
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: -0.005em;
  color: var(--legience-text-primary);
  text-decoration: none;
  transition: background 0.12s ease, border-color 0.12s ease;

  &:hover {
    background: var(--legience-bg-card);
    border-color: rgba(11, 100, 233, 0.30);
    color: var(--legience-text-primary);
  }

  .topbar-context-icon {
    width: 13px;
    height: 13px;
    stroke-width: 2;
    color: var(--legience-accent);
    flex-shrink: 0;
  }

  strong {
    color: var(--legience-accent);
    font-weight: 600;
  }

  .topbar-context-num {
    color: var(--legience-text-muted);
    font-weight: 400;
    font-size: 11.5px;
  }
}

@media (max-width: 991.98px) {
  .topbar-context-pill { display: none; }
}
```

- [ ] **Step 3: Visually verify**

Navigate to `/dashboard` — pill should NOT appear. Navigate to `/legal/cases/<some-existing-case-id>` — pill should appear with the case name and number. Click the pill — it routes to the same case detail page.

- [ ] **Step 4: Stage + ask for commit approval**

```bash
git add src/app/component/layouts/topbar/topbar.component.html \
        src/app/component/layouts/topbar/topbar.component.scss
```

Commit message: `feat(topbar): show active case pill on case routes`

---

## Task C4: Render the search input

**Files:**
- Modify: `src/app/component/layouts/topbar/topbar.component.html`
- Modify: `src/app/component/layouts/topbar/topbar.component.scss`
- Modify: `src/app/component/layouts/topbar/topbar.component.ts`

- [ ] **Step 1: Add the openSearch handler in topbar.component.ts**

Add a method:

```typescript
openSearch(): void {
  // Phase 1: trigger the existing search dropdown.
  // The current code has a Bootstrap dropdown with id="page-header-search-dropdown"
  // that we keep mounted (off-screen on desktop) for now. The proper ⌘K
  // command palette is a separate spec.
  const trigger = document.getElementById('page-header-search-dropdown');
  trigger?.click();
}
```

- [ ] **Step 2: Fill the searchTpl template**

```html
<ng-template #searchTpl>
  <button type="button" class="topbar-search d-none d-lg-inline-flex" (click)="openSearch()">
    <i-lucide name="search" class="topbar-search-icon"></i-lucide>
    <span class="topbar-search-text">Search&hellip;</span>
    <span class="topbar-kbd">⌘ K</span>
  </button>
</ng-template>
```

(`d-none d-lg-inline-flex` is Bootstrap shorthand for "hidden below lg breakpoint".)

- [ ] **Step 3: Add SCSS**

```scss
.topbar-search {
  width: 320px;
  padding: 8px 14px;
  background: var(--legience-bg-card);
  border: 1px solid var(--legience-border-hairline);
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--legience-text-muted);
  font-family: 'Geist', system-ui, sans-serif;
  font-size: 12.5px;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
  text-align: left;

  &:hover { border-color: rgba(11, 100, 233, 0.30); }

  .topbar-search-icon {
    width: 14px;
    height: 14px;
    stroke-width: 1.75;
    color: var(--legience-text-muted);
    flex-shrink: 0;
  }

  .topbar-search-text { flex: 1; }
}

.topbar-kbd {
  display: inline-flex;
  padding: 2px 6px;
  background: rgba(28, 25, 23, 0.05);
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 500;
  color: var(--legience-text-muted);
  font-family: 'Geist', system-ui, sans-serif;
  letter-spacing: 0.02em;
}
```

- [ ] **Step 4: Visually verify**

Search bar appears at the right side of Bar 1, between the spacer and the (still-missing) Ask Legience button. Click → existing search dropdown opens. On viewports < 992px, the search bar disappears and the existing mobile search dropdown remains the entry point.

- [ ] **Step 5: Stage + ask for commit approval**

```bash
git add src/app/component/layouts/topbar/topbar.component.html \
        src/app/component/layouts/topbar/topbar.component.scss \
        src/app/component/layouts/topbar/topbar.component.ts
```

Commit message: `feat(topbar): add visible search affordance with ⌘K hint`

---

## Task C5: Render the Ask Legience button

**Files:**
- Modify: `src/app/component/layouts/topbar/topbar.component.html`
- Modify: `src/app/component/layouts/topbar/topbar.component.scss`
- Modify: `src/app/component/layouts/topbar/topbar.component.ts`

- [ ] **Step 1: Inject AiDrawerService and add handler**

Add the import:

```typescript
import { AiDrawerService } from '../../../core/services/ai-drawer.service';
```

Inject in the constructor (append to existing args):

```typescript
private aiDrawer: AiDrawerService,
```

Inside the class, add a helper that snapshots the active case and delegates:

```typescript
async onAskLegience(): Promise<void> {
  const { firstValueFrom } = await import('rxjs');
  const activeCase = await firstValueFrom(this.activeCase$);
  this.aiDrawer.open({ activeCase });
}
```

(The dynamic `await import` is just to avoid adding `firstValueFrom` to the top-level imports if it's not already there. If it is, use a direct import and skip the dynamic form.)

- [ ] **Step 2: Fill the aiBtnTpl template**

```html
<ng-template #aiBtnTpl>
  <button type="button" class="topbar-ai-btn" (click)="onAskLegience()">
    <i-lucide name="sparkles" class="topbar-ai-icon"></i-lucide>
    <span class="topbar-ai-label">Ask Legience</span>
  </button>
</ng-template>
```

- [ ] **Step 3: Add SCSS**

```scss
.topbar-ai-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 13px;
  border-radius: 8px;
  background: linear-gradient(135deg, #0b64e9 0%, #1e3a8a 100%);
  color: #ffffff;
  font-family: 'Geist', system-ui, sans-serif;
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: -0.005em;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px -2px rgba(11, 100, 233, 0.45);
  transition: transform 0.12s ease, box-shadow 0.12s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px -2px rgba(11, 100, 233, 0.55);
    color: #ffffff;
  }

  .topbar-ai-icon {
    width: 14px;
    height: 14px;
    stroke-width: 2;
    color: #ffffff;
    flex-shrink: 0;
  }
}

@media (max-width: 991.98px) {
  .topbar-ai-label { display: none; }
  .topbar-ai-btn { padding: 8px 10px; }
}
```

- [ ] **Step 4: Visually verify**

Button renders to the right of the search bar with the blue gradient + soft accent shadow. Hover lifts it 1px. Click opens the side-panel drawer (slides in from the right). On mobile (<992px), only the sparkle icon is visible — no label.

- [ ] **Step 5: Stage + ask for commit approval**

```bash
git add src/app/component/layouts/topbar/topbar.component.html \
        src/app/component/layouts/topbar/topbar.component.scss \
        src/app/component/layouts/topbar/topbar.component.ts
```

Commit message: `feat(topbar): add Ask Legience primary CTA button`

---

## Task C6: Render the active timer pill

**Files:**
- Modify: `src/app/component/layouts/topbar/topbar.component.ts`
- Modify: `src/app/component/layouts/topbar/topbar.component.html`
- Modify: `src/app/component/layouts/topbar/topbar.component.scss`

- [ ] **Step 1: Inject TimerService + expose first-active-timer observable**

Add to imports:

```typescript
import { TimerService, ActiveTimer } from '../../../modules/time-tracking/services/timer.service';
import { map } from 'rxjs/operators';
```

Inject in constructor:

```typescript
private timerService: TimerService,
```

Add to the class body:

```typescript
firstActiveTimer$: Observable<ActiveTimer | null> = this.timerService.activeTimers$.pipe(
  map(timers => timers?.[0] ?? null)
);

// Plain mm:ss / hh:mm:ss formatter — reads ActiveTimer.currentDurationSeconds
// (set by TimerService's internal interval that already ticks every second).
formatTimer(t: ActiveTimer | null): string {
  if (!t) return '00:00';
  const total = t.currentDurationSeconds ?? 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
```

(Note: `TimerService` already starts a 1s interval internally — see `startTimerUpdates()` in the service. So we don't need to spin our own interval in the component; just bind the observable and the template re-renders every emission.)

- [ ] **Step 2: Fill the timerPillTpl template**

```html
<ng-template #timerPillTpl>
  <div class="topbar-timer-pill" *ngIf="firstActiveTimer$ | async as timer">
    <span class="topbar-timer-pulse"></span>
    <i-lucide name="clock" class="topbar-timer-icon"></i-lucide>
    <span class="topbar-timer-time">{{ formatTimer(timer) }}</span>
  </div>
</ng-template>
```

- [ ] **Step 3: Add SCSS**

```scss
.topbar-timer-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  background: rgba(22, 163, 74, 0.08);
  border: 1px solid rgba(22, 163, 74, 0.20);
  border-radius: 8px;
  font-family: 'Geist', system-ui, sans-serif;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--legience-success);
  letter-spacing: -0.003em;
  font-variant-numeric: tabular-nums;
  cursor: default;

  .topbar-timer-pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--legience-success);
    animation: topbarTimerPulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }

  .topbar-timer-icon {
    width: 12px;
    height: 12px;
    stroke-width: 2;
    flex-shrink: 0;
  }
}

@keyframes topbarTimerPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(0.85); }
}

@media (max-width: 991.98px) {
  .topbar-timer-pill .topbar-timer-icon { display: none; }
}
```

- [ ] **Step 4: Visually verify**

Start a timer somewhere in the time-tracking module. Pill should appear in the topbar with green pulse dot, clock icon, and the live `mm:ss` ticking up every second. Stop the timer — pill disappears.

- [ ] **Step 5: Stage + ask for commit approval**

```bash
git add src/app/component/layouts/topbar/topbar.component.html \
        src/app/component/layouts/topbar/topbar.component.scss \
        src/app/component/layouts/topbar/topbar.component.ts
```

Commit message: `feat(topbar): show live billable timer pill when timer active`

---

## Task C7: Replace icon cluster (drop case-mgmt dropdown, keep bell + chat + theme)

**Files:**
- Modify: `src/app/component/layouts/topbar/topbar.component.html`
- Modify: `src/app/component/layouts/topbar/topbar.component.scss`
- Modify: `src/app/component/layouts/topbar/topbar.component.ts` (add notification + theme handlers)

- [ ] **Step 1: Add helper getters and handlers in topbar.component.ts**

```typescript
// Combined notification count = existing notifications + the case-mgmt
// pendingAssignments that used to be a separate dropdown.
get totalNotificationCount(): number {
  return (this.notificationCount ?? 0) + (this.pendingAssignments ?? 0);
}

get isDarkMode(): boolean {
  return document.documentElement.getAttribute('data-bs-theme') === 'dark';
}

toggleTheme(): void {
  // The component already exposes `changeMode(mode: string)` (line ~955)
  // which handles the document attribute + localStorage persistence + ngrx
  // dispatch. We just delegate.
  this.changeMode(this.isDarkMode ? 'light' : 'dark');
}

openNotifications(): void {
  // Existing notifications dropdown — keep its current trigger pattern.
  const trigger = document.getElementById('page-header-notifications-dropdown');
  trigger?.click();
}

openMessages(): void {
  this.router.navigate(['/messages']);
}
```

(`dispatchThemeChange` is whatever method the existing component uses to persist the theme — wire to the existing one. If the component uses `this.store.dispatch(changeMode({ mode: next }))`, replace the `?.()` call with that.)

- [ ] **Step 2: Fill the iconClusterTpl template**

```html
<ng-template #iconClusterTpl>
  <div class="topbar-icon-cluster">

    <button type="button" class="topbar-ic-btn" (click)="openNotifications()" aria-label="Notifications">
      <i-lucide name="bell"></i-lucide>
      <span class="topbar-ic-badge" *ngIf="totalNotificationCount > 0">{{ totalNotificationCount }}</span>
    </button>

    <button type="button" class="topbar-ic-btn" (click)="openMessages()" aria-label="Messages">
      <i-lucide name="message-square"></i-lucide>
      <span class="topbar-ic-dot" *ngIf="hasUnreadMessages"></span>
    </button>

    <button type="button" class="topbar-ic-btn" (click)="toggleTheme()" [attr.aria-label]="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'">
      <i-lucide [name]="isDarkMode ? 'sun' : 'moon'"></i-lucide>
    </button>

  </div>
</ng-template>
```

- [ ] **Step 3: Add SCSS**

```scss
.topbar-icon-cluster {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding-right: 6px;
  border-right: 1px solid var(--legience-border-hairline);
  margin-right: 2px;
}

.topbar-ic-btn {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--legience-text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;

  &:hover {
    background: rgba(28, 25, 23, 0.05);
    color: var(--legience-text-primary);
  }

  i-lucide {
    width: 18px;
    height: 18px;
    stroke-width: 1.75;
  }
}

.topbar-ic-badge {
  position: absolute;
  top: 4px;
  right: 3px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--legience-warning);
  color: #ffffff;
  font-family: 'Geist', system-ui, sans-serif;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 1.5px var(--legience-bg-card);
  letter-spacing: 0;
}

.topbar-ic-dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--legience-warning);
  box-shadow: 0 0 0 1.5px var(--legience-bg-card);
}
```

- [ ] **Step 4: Visually verify**

Right side of Bar 1 now shows: timer pill (if active) + cluster (bell with combined badge, chat with dot if unread, sun/moon for theme) + a vertical hairline. The old case-management dropdown is gone — its count rolled into the bell badge. The expand/fullscreen and clock icons are also gone (timer pill replaces clock; expand isn't reintroduced).

- [ ] **Step 5: Stage + ask for commit approval**

```bash
git add src/app/component/layouts/topbar/topbar.component.html \
        src/app/component/layouts/topbar/topbar.component.scss \
        src/app/component/layouts/topbar/topbar.component.ts
```

Commit message: `feat(topbar): consolidate icon cluster, drop case-mgmt dropdown`

---

## Task C8: Replace user block

**Files:**
- Modify: `src/app/component/layouts/topbar/topbar.component.html`
- Modify: `src/app/component/layouts/topbar/topbar.component.scss`

- [ ] **Step 1: Fill userBlockTpl**

Find the existing user dropdown in `topbar.component.html` (the `<div class="dropdown ms-sm-3 header-item topbar-user">` block). Move the `<div ngbDropdownMenu>...</div>` inner content unchanged — that's the user menu. Replace the trigger button with our new pill design:

```html
<ng-template #userBlockTpl>
  <div class="topbar-user" ngbDropdown placement="bottom-end">
    <button type="button" class="topbar-user-btn" ngbDropdownToggle aria-label="User menu">
      <span class="topbar-user-avatar-wrap">
        <span class="topbar-user-avatar" [style.background]="userAvatarBg">{{ userInitials }}</span>
        <span class="topbar-user-status"></span>
      </span>
      <span class="topbar-user-meta d-none d-lg-flex">
        <span class="topbar-user-name">{{ userData?.firstName }} {{ userData?.lastName }}</span>
        <span class="topbar-user-role">{{ (userData?.roleName || userData?.primaryRole || '') | titlecase }}</span>
      </span>
    </button>
    <div class="dropdown-menu dropdown-menu-end" ngbDropdownMenu>
      <!-- PASTE existing user menu items here verbatim, unchanged -->
    </div>
  </div>
</ng-template>
```

(Where `userInitials` and `userAvatarBg` are computed properties — add them to topbar.component.ts as in step 2.)

- [ ] **Step 2: Add the helper getters in topbar.component.ts**

```typescript
get userInitials(): string {
  const f = this.userData?.firstName?.[0] ?? '';
  const l = this.userData?.lastName?.[0] ?? '';
  return (f + l).toUpperCase() || 'U';
}

get userAvatarBg(): string {
  // Hash-based gradient — same approach as dashboard's getClientAvatarBg.
  // Stable per-user so the same person always has the same colour.
  const seed = `${this.userData?.firstName ?? ''}${this.userData?.lastName ?? ''}`;
  const hue = [...seed].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 65%, 70%), hsl(${(hue + 30) % 360}, 60%, 45%))`;
}
```

- [ ] **Step 3: Add SCSS**

```scss
.topbar-user {
  display: inline-block;

  .topbar-user-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 4px 12px 4px 4px;
    border-radius: 999px;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.12s ease;

    &:hover { background: rgba(28, 25, 23, 0.04); }
    &:focus { outline: none; box-shadow: 0 0 0 3px rgba(11, 100, 233, 0.15); }
  }
}

.topbar-user-avatar-wrap {
  position: relative;
  display: inline-flex;
}

.topbar-user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-family: 'Geist', system-ui, sans-serif;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.topbar-user-status {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--legience-success);
  border: 2px solid var(--legience-bg-card);
}

.topbar-user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  text-align: left;
}

.topbar-user-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--legience-text-primary);
  letter-spacing: -0.008em;
  font-family: 'Geist', system-ui, sans-serif;
}

.topbar-user-role {
  font-size: 10.5px;
  font-weight: 400;
  color: var(--legience-text-muted);
  letter-spacing: 0.02em;
  margin-top: 2px;
  font-family: 'Geist', system-ui, sans-serif;
}
```

- [ ] **Step 4: Visually verify**

User block on the far right now shows: pill-shaped wrapper with circular avatar (gradient + initials) + status dot (green) + name (12.5px Geist 600) + role (10.5px Geist 400 muted). Hover reveals subtle background pill. Click opens the existing dropdown menu unchanged. On <992px, only the avatar circle is visible (name+role hidden).

- [ ] **Step 5: Stage + ask for commit approval**

```bash
git add src/app/component/layouts/topbar/topbar.component.html \
        src/app/component/layouts/topbar/topbar.component.scss \
        src/app/component/layouts/topbar/topbar.component.ts
```

Commit message: `feat(topbar): replace user block with avatar+status+name pill`

---

# PHASE D — Dark mode + responsive cleanup

## Task D1: Dark mode for the new topbar

**Files:**
- Modify: `src/assets/scss/themes/rox/_dashboard.scss` (append to Section 27)

- [ ] **Step 1: Add dark-mode rules at the END of Section 27**

The lesson learned from the dashboard pulse-pill bug: dark-mode overrides for topbar elements need to live in the global Rox `_dashboard.scss` Section 27 to outrank the component's emulated-encapsulation rules. Append at the end of the existing `:root[data-design="rox"][data-bs-theme="dark"] { ... }` block (after the existing `.dashboard-focus-card` rules):

```scss
    // ── TOPBAR — Bar 1 dark-mode treatment ────────────────────────
    .topbar-bar1 {
      background: linear-gradient(135deg, #141414 0%, rgba(37, 99, 235, 0.10) 100%) !important;
      border-bottom-color: rgba(245, 245, 244, 0.08) !important;

      &::before {
        background: radial-gradient(circle, rgba(91, 157, 255, 0.10) 0%, transparent 60%) !important;
      }
    }

    .topbar-firm { color: #a8a29e !important; }

    .topbar-context-pill {
      background: rgba(255, 255, 255, 0.04) !important;
      border-color: rgba(255, 255, 255, 0.10) !important;
      color: #ffffff !important;

      strong { color: #5b9dff !important; }
      .topbar-context-num { color: #a8a29e !important; }
      .topbar-context-icon { color: #5b9dff !important; }

      &:hover {
        background: rgba(255, 255, 255, 0.08) !important;
        border-color: rgba(91, 157, 255, 0.40) !important;
      }
    }

    .topbar-search {
      background: #1c1917 !important;
      border-color: #44403c !important;
      color: #a8a29e !important;

      &:hover { border-color: #5b9dff !important; }
    }

    .topbar-kbd {
      background: rgba(255, 255, 255, 0.06) !important;
      color: #d4d2d1 !important;
    }

    // Ask Legience button keeps its gradient (the gradient looks great on dark already)

    .topbar-timer-pill {
      background: rgba(22, 163, 74, 0.14) !important;
      border-color: rgba(22, 163, 74, 0.35) !important;
      color: #6ee7b7 !important;

      .topbar-timer-pulse { background: #6ee7b7 !important; }
    }

    .topbar-icon-cluster {
      border-right-color: rgba(245, 245, 244, 0.08) !important;
    }

    .topbar-ic-btn {
      color: #a8a29e !important;

      &:hover {
        background: rgba(255, 255, 255, 0.05) !important;
        color: #ffffff !important;
      }
    }

    .topbar-ic-badge,
    .topbar-ic-dot {
      box-shadow: 0 0 0 1.5px #141414 !important;
    }

    .topbar-user-btn:hover {
      background: rgba(255, 255, 255, 0.04) !important;
    }

    .topbar-user-name { color: #ffffff !important; }
    .topbar-user-role { color: #a8a29e !important; }
    .topbar-user-status { border-color: #141414 !important; }

    // ── BAR 2 NAV — dark-mode treatment ───────────────────────────
    app-horizontal-topbar a.active {
      color: #5b9dff !important;
      &::after { background: #5b9dff !important; }
    }

    app-horizontal-topbar a:not(.active) {
      color: #a8a29e !important;
      &:hover { color: #ffffff !important; }
    }
```

- [ ] **Step 2: Visually verify in dark mode**

Toggle dark mode (theme button in the new icon cluster). The topbar should:
- Background flips to dark navy gradient (matches dashboard hero card dark mode)
- Hairline borders flip to translucent white
- Active case pill background goes translucent-white-on-dark, accent text shifts to brighter blue (#5b9dff)
- Search bar background goes solid dark stone
- Timer pill stays green-tinted but with brighter green text
- Icon buttons: hover background brightens, icons shift to light grey then white on hover
- User name in white, role in muted light stone
- Bar 2: active item shifts to brighter blue accent, inactive items in light stone

- [ ] **Step 3: Stage + ask for commit approval**

```bash
git add src/assets/scss/themes/rox/_dashboard.scss
```

Commit message: `feat(topbar): dark-mode treatment for new bar 1 + nav`

---

## Task D2: Mobile / responsive sweep

**Files:**
- Modify: `src/app/component/layouts/topbar/topbar.component.scss` (append)

- [ ] **Step 1: Add the unified responsive block**

Append at the end of the file:

```scss
// ── < 992px (Bootstrap lg breakpoint) ──────────────────────────
// Velzon already collapses Bar 2 into a hamburger menu at this width
// via its [data-layout="horizontal"] mobile transform. We trim Bar 1
// to fit the narrower viewport without horizontal scroll.
@media (max-width: 991.98px) {
  .topbar-bar1 {
    padding: 0 14px;
    gap: 8px;
  }

  // Already-hidden elements (handled inline above): firm subtitle,
  // context pill, search bar. We also hide the Ask Legience label
  // (icon-only on mobile) and the user name+role.
  .topbar-firm,
  .topbar-context-pill { display: none; }

  .topbar-ai-btn .topbar-ai-label,
  .topbar-user-meta { display: none; }

  .topbar-icon-cluster { padding-right: 4px; margin-right: 0; }
}

// ── < 576px ────────────────────────────────────────────────────
// Even tighter: drop the timer pill entirely (timer state still tracked,
// just no chrome surface for it on phone). Centre the AI button as a
// pure icon. Vertical bar between cluster and user collapses.
@media (max-width: 575.98px) {
  .topbar-bar1 { padding: 0 10px; gap: 6px; }

  .topbar-timer-pill { display: none; }

  .topbar-icon-cluster { border-right: none; padding-right: 0; }
}
```

- [ ] **Step 2: Visually verify by resizing the browser**

- 1200px: full layout — logo+firm, context pill, org switcher, spacer, search, AI button, timer pill, cluster, user (avatar+name+role)
- 991px: firm name hidden, context pill hidden, search hidden, AI button shows icon only, user shows avatar only
- 575px: timer pill also hidden, gap shrinks further, no border between cluster and user

- [ ] **Step 3: Stage + ask for commit approval**

```bash
git add src/app/component/layouts/topbar/topbar.component.scss
```

Commit message: `feat(topbar): responsive trims for <992px and <576px`

---

## Task D3: Cleanup — remove dead handlers + unused dropdown code

**Files:**
- Modify: `src/app/component/layouts/topbar/topbar.component.ts`
- Modify: `src/app/component/layouts/topbar/topbar.component.html`

- [ ] **Step 1: Identify dead methods**

Search topbar.component.ts for methods that were only used by the dropped case-management dropdown markup. Likely candidates (verify each before deleting):

- `loadCaseManagementDataDirect()` — was called by `(openChange)="$event && loadCaseManagementDataDirect()"`
- Any methods like `myCasesCount`, `myTasksCount`, `pendingAssignments` — keep `pendingAssignments` because it's still used in `totalNotificationCount`. Remove `myCasesCount`, `myTasksCount` if they're only used in the dropped quick-stats panel.
- Any private fields that hold the dropdown's loading state (e.g., `caseDropdownLoading`)

For each candidate:

```bash
grep -n "loadCaseManagementDataDirect\|myCasesCount\|myTasksCount" src/app/component/layouts/topbar/topbar.component.html
```

If the only references are inside the now-deleted dropdown HTML (which is gone after Task C7), the method is dead — delete it.

- [ ] **Step 2: Delete the dead methods + their fields**

Remove the identified dead code from the .ts file. Keep `pendingAssignments` because `totalNotificationCount` reads it.

- [ ] **Step 3: Verify nothing else in the codebase reads them**

```bash
grep -rn "loadCaseManagementDataDirect" src/app/
```

Should return zero hits after deletion.

- [ ] **Step 4: Visually verify the topbar still works end-to-end**

Click every interactive element in the topbar (logo, search, Ask Legience, theme toggle, bell, chat, user dropdown) and confirm none throw errors in the browser console.

- [ ] **Step 5: Stage + ask for commit approval**

```bash
git add src/app/component/layouts/topbar/topbar.component.ts \
        src/app/component/layouts/topbar/topbar.component.html
```

Commit message: `chore(topbar): remove dead case-mgmt dropdown handlers`

---

## Task D4: Acceptance criteria walkthrough

**Files:** none — verification only

- [ ] **Step 1: Walk through the spec's Section 9 acceptance criteria one by one**

Open [docs/superpowers/specs/2026-05-04-attorney-topbar-redesign-design.md](../specs/2026-05-04-attorney-topbar-redesign-design.md), scroll to Section 9, and verify each checkbox in the running app:

- [ ] Bar 1 background gradient matches the dashboard hero focus card
- [ ] No `ri-*` classes inside `topbar/` or `horizontal-topbar/` directories (`grep -r "ri-" src/app/component/layouts/topbar/ src/app/component/layouts/horizontal-topbar/` should return zero hits)
- [ ] Geist font on every text element in both bars (inspect via DevTools)
- [ ] Active case pill appears on `/legal/cases/:id` and sub-routes, disappears on `/dashboard`
- [ ] Active case pill click navigates back to case detail
- [ ] Timer pill renders only when active timer exists, ticks once per second, formatted `mm:ss`/`hh:mm:ss`
- [ ] Ask Legience button has gradient + soft shadow + hover lift
- [ ] Click Ask Legience opens the side-panel drawer
- [ ] Bell badge count = notifications + (former case-mgmt) pendingAssignments
- [ ] Old case-mgmt dropdown removed (`grep "caseDropdown\|loadCaseManagementDataDirect" src/app/component/layouts/topbar/` returns zero hits)
- [ ] Bar 2 active nav item shows accent text + 2px accent underline
- [ ] Sysadmin org-switcher still renders for sysadmin users only
- [ ] Mobile (<992px): firm subtitle hidden, search hidden, AI icon-only, user name+role hidden
- [ ] Dark mode: Bar 1 gradient flips, all elements readable
- [ ] No layout shift when active case pill / timer pill appear

- [ ] **Step 2: Fix any failing items**

If any criterion fails, write a small fix back into the relevant task's file scope, run a follow-up step, and re-verify.

- [ ] **Step 3: Final commit (or prepare PR)**

If any patches were made in step 2:

```bash
git add <touched files>
```

Commit message: `chore(topbar): final acceptance criteria fixes`

Otherwise this task ends without a commit — Phase D is complete.

---

# Done

The attorney topbar is now matched to the dashboard, uses Lucide throughout, surfaces active case + timer + AI assistant, and ships dark mode + responsive treatments. Total tasks: **18** across **4 phases**, each phase independently shippable.

**Out-of-scope follow-ups** (separate specs):
- Real ⌘K command palette to replace the placeholder search trigger
- Full Ask Legience drawer interaction model (current is a slide-in shell with a placeholder paragraph)
- App-wide Lucide migration (this plan only swaps topbar icons)
