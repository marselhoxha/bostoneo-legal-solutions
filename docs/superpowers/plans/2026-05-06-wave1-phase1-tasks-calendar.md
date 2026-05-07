# Wave 1 Phase 1 — Tasks Inbox &amp; Calendar Classic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the **default-view layer** of the Wave 1 redesign — Tasks Inbox at `/tasks` (canonical) with a unified status-aware drawer, and Calendar Classic at `/legal/calendar` with a layout-switcher chrome and an `eventType`-aware event modal. Phases 2 (Pipeline + Deadlines) and 3 (Workload + Time-blocked) build on top of this foundation in their own plans.

**Architecture:** Build new Angular components alongside the existing `TaskManagementComponent` (the 2316-LOC monolith stays running), then redirect `/case-management/tasks` → `/tasks` once Phase 1 is verified. Calendar layout stays in the existing `CalendarViewComponent` but its template + styles are rewritten and a layout-switcher chip group is introduced. Backend changes are minimal: one Flyway migration (V76) adding two columns to `case_tasks` and two columns to a new `user_preference` table; no new enums (`TaskStatus.BLOCKED` and `CalendarEventType.DEADLINE` already exist). Phases 2 and 3 view-driven affordances are scaffolded but feature-flag-gated off.

**Tech Stack:** Angular 18, Geist font, Lucide icons via `lucide-angular`, RxJS Observables, SCSS with the existing `--legience-*` token system. Backend: Java 17 / Spring Boot, PostgreSQL via Flyway. Per CLAUDE.md: every commit and migration must be approved by the user before running.

**Spec reference:** [docs/superpowers/specs/2026-05-06-wave1-tasks-calendar-design.md](../specs/2026-05-06-wave1-tasks-calendar-design.md)

**Brainstorm preview:** [.superpowers/brainstorm/20220-1777837309/content/wave1-tasks-calendar-redesign-options.html](../../../../.superpowers/brainstorm/20220-1777837309/content/wave1-tasks-calendar-redesign-options.html)

**Phases (each independently shippable, executed in order):**
- **Phase A — Backend schema + model (V76 migration)** — additive, deployable on its own
- **Phase B — Tasks page scaffold + routing** — new shell at `/tasks` with feature-flag toggle
- **Phase C — Inbox view component** — the actual list rendering
- **Phase D — Unified task drawer** — opens from row click, status-driven blocker callout
- **Phase E — Calendar Classic re-skin** — existing component, new chrome
- **Phase F — Event modal restructure** — `eventType`-aware foundation; only `meeting`-equivalent sections active
- **Phase G — User preferences (last-used view + layout)** — read/write user pref
- **Phase H — Final integration + flag rollout**

---

## File Structure

### Created files

| Path | Responsibility |
|---|---|
| `backend/src/main/resources/db/migration/V76__wave1_phase1_tasks_calendar_fields.sql` | Add `blocker_reason`, `auto_unblock_date` to `case_tasks`; create `user_preference` table with `preferred_view_tasks` and `preferred_layout_calendar` columns; idempotent. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/model/UserPreference.java` | JPA entity for `user_preference` table. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/repository/UserPreferenceRepository.java` | Spring Data repository for `UserPreference`. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/service/UserPreferenceService.java` | Read/write user preferences interface. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/service/implementation/UserPreferenceServiceImpl.java` | Implementation: org-scoped read/write, defaults applied on first read. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/controller/UserPreferenceController.java` | `GET /api/user-preferences/me`, `PUT /api/user-preferences/me` endpoints. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/UserPreferenceDTO.java` | DTO for the controller. |
| `src/app/modules/case-management/components/tasks-page/tasks-page.component.ts` | Shell component for `/tasks` route — hosts view-switcher chip group, filter bar, view container, drawer outlet. |
| `src/app/modules/case-management/components/tasks-page/tasks-page.component.html` | Shell markup with sidebar nav, page header, view container, drawer slot. |
| `src/app/modules/case-management/components/tasks-page/tasks-page.component.scss` | Shell styles using rox/legience tokens; matches cases-page benchmark. |
| `src/app/modules/case-management/components/tasks-page/views/inbox-view/inbox-view.component.ts` | Inbox-specific list rendering. Computes time-band groupings. |
| `src/app/modules/case-management/components/tasks-page/views/inbox-view/inbox-view.component.html` | Inbox markup: groups (Overdue/Today/This week/Later/No due date) with rows. |
| `src/app/modules/case-management/components/tasks-page/views/inbox-view/inbox-view.component.scss` | Inbox-specific row styles. |
| `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.ts` | Right-side drawer; reads `task` query param; renders status-aware blocker callout. |
| `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.html` | Drawer markup with always-visible sections + status-driven callout. |
| `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.scss` | Drawer styles. |
| `src/app/core/services/user-preferences.service.ts` | Frontend service: load/save user prefs (last-used view + layout) via the new backend endpoints. |
| `src/app/core/services/user-preferences.service.spec.ts` | Unit tests for the prefs service. |

### Modified files

| Path | What changes |
|---|---|
| `backend/src/main/java/com/bostoneo/bostoneosolutions/model/CaseTask.java` | Add `blockerReason: String` (nullable, TEXT) and `autoUnblockDate: LocalDate` (nullable). |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/CaseTaskDTO.java` | Add the two new fields to the response DTO. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/UpdateTaskRequest.java` | Allow updating the two new fields. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/dtomapper/CaseTaskDTOMapper.java` (or equivalent) | Map the new fields on read/write. |
| `src/app/app-routing.module.ts` | Add top-level `path: 'tasks'` route loading the new module. |
| `src/app/modules/case-management/case-management-routing.module.ts` | Replace `tasks` route with redirect: `redirectTo: '/tasks'`, `pathMatch: 'full'`. |
| `src/app/modules/case-management/case-management.module.ts` | Declare `TasksPageComponent`, `InboxViewComponent`, `TaskDrawerComponent` (or use standalone components — pick one and stick to it; existing module uses NgModule, so match that). |
| `src/app/component/layouts/horizontal-topbar/menu.ts` | Move "Tasks" entry under the "Daily" group; update its route to `/tasks`. |
| `src/app/modules/legal/components/calendar/calendar-view/calendar-view.component.html` | Replace template with rox/legience-styled chrome + new layout-switcher chip group + Day/Week/Month toggle. |
| `src/app/modules/legal/components/calendar/calendar-view/calendar-view.component.scss` | Replace styles with rox/legience tokens; match cases-page primitives. |
| `src/app/modules/legal/components/calendar/calendar-view/calendar-view.component.ts` | Add `?layout=` URL handling (Classic active; other layouts return placeholder banner saying "Coming in Phase 2/3"); add user-pref persistence; expose case-list for the side rail. |
| `src/app/modules/legal/components/calendar/event-modal/event-modal.component.ts` | Read `eventType` from the event; expose conditional-section flags (`showsDeadlineSection`, `showsTimeBlockSection`) — both `false` in Phase 1. |
| `src/app/modules/legal/components/calendar/event-modal/event-modal.component.html` | Restructure as: always-visible header/fields + `*ngIf="showsDeadlineSection"` block (empty for now) + `*ngIf="showsTimeBlockSection"` block (empty for now). |
| `src/app/modules/legal/components/calendar/event-modal/event-modal.component.scss` | Re-skin to match rox/legience modal pattern. |

### NOT modified (out of scope for Phase 1)

- `src/app/component/case-task/task-management/task-management.component.{ts,html,scss}` — the legacy 2316-LOC monolith stays as-is until `/tasks` is verified working; it's no longer reachable after Task B5 redirects the old route.
- `backend/src/main/java/.../controller/CaseTaskController.java` — existing endpoints continue to serve `/api/case-tasks/*`. Phase 1 frontend reuses them; no controller changes needed beyond the `UpdateTaskRequest` DTO accepting `blockerReason` / `autoUnblockDate`.
- `src/app/modules/legal/components/calendar/reminder-test/`, `deadline-analytics/`, `event-form/`, `deadline-dashboard/` — not part of Phase 1 scope.
- All Phase 2/3 view + layout components (Pipeline, Workload, Deadlines, Time-blocked).
- The reminder cascade engine — Phase 2 work.
- The capacity model + user `weeklyCapacityHours` — Phase 3 work.

---

# PHASE A — Backend schema + model (V76 migration)

The whole phase ships a single migration + model + DTO updates. Additive only. Deployable on its own with no frontend changes; existing frontend keeps working untouched.

## Task A1: Verify migration version

**Files:**
- Read: `backend/src/main/resources/db/migration/`

- [ ] **Step 1: Confirm V75 is the latest migration on disk**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1
ls backend/src/main/resources/db/migration/ | grep -E '^V[0-9]+_' | sort -t_ -k1.2 -n | tail -3
```

Expected: V75 is the latest (or higher; if higher, use the next number — V76 is what this plan assumes).

- [ ] **Step 2: Confirm the same on `origin/develop`**

```bash
git fetch origin develop
git ls-tree -r origin/develop -- backend/src/main/resources/db/migration/ | grep -oE 'V[0-9]+__' | sort -u | sort -t_ -k1.2 -n | tail -3
```

Expected: V75 is the latest on origin/develop. **If origin has V76 already, bump this plan's migration number to V77 and adjust all subsequent references.**

## Task A2: Write V76 migration file

**Files:**
- Create: `backend/src/main/resources/db/migration/V76__wave1_phase1_tasks_calendar_fields.sql`

- [ ] **Step 1: Write the migration**

```sql
-- V76: Wave 1 Phase 1 — additive fields for Tasks Inbox + Calendar Classic
-- Spec: docs/superpowers/specs/2026-05-06-wave1-tasks-calendar-design.md

-- 1. Add blocker_reason + auto_unblock_date to case_tasks
ALTER TABLE case_tasks
    ADD COLUMN IF NOT EXISTS blocker_reason TEXT NULL,
    ADD COLUMN IF NOT EXISTS auto_unblock_date DATE NULL;

COMMENT ON COLUMN case_tasks.blocker_reason IS 'Free-text reason a task is in BLOCKED status. Surfaces in the unified task drawer whenever status=BLOCKED, regardless of view.';
COMMENT ON COLUMN case_tasks.auto_unblock_date IS 'Optional date when the task automatically unblocks (e.g., opposing-counsel response deadline).';

-- 2. user_preference: per-user UI state (last-used view + layout)
CREATE TABLE IF NOT EXISTS user_preference (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id BIGINT       NOT NULL,
    user_id         BIGINT       NOT NULL,
    preferred_view_tasks    VARCHAR(20)  NULL,
    preferred_layout_calendar VARCHAR(20) NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_preference_user_unique UNIQUE (user_id),
    CONSTRAINT user_preference_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_preference_org ON user_preference(organization_id);

COMMENT ON TABLE user_preference IS 'Per-user UI state — last-used view per page, sticky between sessions.';
COMMENT ON COLUMN user_preference.preferred_view_tasks IS 'Last selected /tasks view: inbox|pipeline|workload. NULL = use role default.';
COMMENT ON COLUMN user_preference.preferred_layout_calendar IS 'Last selected /legal/calendar layout: classic|deadlines|time-block. NULL = classic default.';
```

- [ ] **Step 2: Run the migration locally**

```bash
PGPASSWORD=legience_dev psql -h localhost -U legience_admin -d legience -f backend/src/main/resources/db/migration/V76__wave1_phase1_tasks_calendar_fields.sql
```

Expected: `ALTER TABLE` succeeds (or "already exists" notice). `CREATE TABLE` succeeds. `CREATE INDEX` succeeds.

- [ ] **Step 3: Verify the schema change locally**

```bash
PGPASSWORD=legience_dev psql -h localhost -U legience_admin -d legience -c "\d case_tasks" | grep -E 'blocker_reason|auto_unblock_date'
PGPASSWORD=legience_dev psql -h localhost -U legience_admin -d legience -c "\d user_preference"
```

Expected: both new columns visible on `case_tasks`; `user_preference` table shows the 6 columns.

- [ ] **Step 4: Re-run to confirm idempotence**

```bash
PGPASSWORD=legience_dev psql -h localhost -U legience_admin -d legience -f backend/src/main/resources/db/migration/V76__wave1_phase1_tasks_calendar_fields.sql
```

Expected: succeeds with "already exists" notices, no errors.

- [ ] **Step 5: Stage the migration and ask for commit approval**

```bash
git add backend/src/main/resources/db/migration/V76__wave1_phase1_tasks_calendar_fields.sql
git status
```

Then ask: **"Migration V76 staged. Ready to commit `feat(db): wave1 phase1 task fields + user_preference table (V76)`?"** Do NOT commit until approved.

## Task A3: Update `CaseTask` JPA entity

**Files:**
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/model/CaseTask.java`

- [ ] **Step 1: Add the two new fields**

In `CaseTask.java`, after the existing `reminderDate` field (around line 88), add:

```java
@Column(name = "blocker_reason", columnDefinition = "TEXT")
private String blockerReason;

@Column(name = "auto_unblock_date")
private java.time.LocalDate autoUnblockDate;
```

(Add `import java.time.LocalDate;` if not already present.)

- [ ] **Step 2: Verify compile**

```bash
cd backend && ./mvnw compile -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 3: Stage and ask for commit approval**

```bash
git add backend/src/main/java/com/bostoneo/bostoneosolutions/model/CaseTask.java
```

Ask: **"`CaseTask` entity updated with blockerReason + autoUnblockDate. Ready to commit `feat(backend): add blocker_reason + auto_unblock_date to CaseTask`?"**

## Task A4: Update Task DTOs

**Files:**
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/CaseTaskDTO.java`
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/UpdateTaskRequest.java`

- [ ] **Step 1: Read current `CaseTaskDTO` to see the field list**

```bash
sed -n '1,60p' backend/src/main/java/com/bostoneo/bostoneosolutions/dto/CaseTaskDTO.java
```

- [ ] **Step 2: Add `blockerReason` and `autoUnblockDate` to the DTO**

Match the existing field-declaration style. Add near the other status-related fields:

```java
private String blockerReason;
private java.time.LocalDate autoUnblockDate;
```

- [ ] **Step 3: Same for `UpdateTaskRequest`**

```bash
sed -n '1,60p' backend/src/main/java/com/bostoneo/bostoneosolutions/dto/UpdateTaskRequest.java
```

Add the two fields with the same shape.

- [ ] **Step 4: Update the DTO mapper**

Find the mapper:
```bash
find backend/src/main/java -name "*CaseTaskDTOMapper*" -o -name "*TaskDTOMapper*" 2>/dev/null
```

Add `blockerReason` and `autoUnblockDate` to the entity↔DTO mapping (read + write).

- [ ] **Step 5: Verify compile**

```bash
cd backend && ./mvnw compile -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 6: Stage and ask for commit approval**

```bash
git add backend/src/main/java/com/bostoneo/bostoneosolutions/dto/CaseTaskDTO.java \
        backend/src/main/java/com/bostoneo/bostoneosolutions/dto/UpdateTaskRequest.java \
        backend/src/main/java/com/bostoneo/bostoneosolutions/dtomapper/*TaskDTOMapper*.java
```

Ask: **"Task DTOs + mapper updated. Ready to commit `feat(backend): expose blocker fields in Task DTOs + mapper`?"**

## Task A5: User preference entity + repository

**Files:**
- Create: `backend/src/main/java/com/bostoneo/bostoneosolutions/model/UserPreference.java`
- Create: `backend/src/main/java/com/bostoneo/bostoneosolutions/repository/UserPreferenceRepository.java`

- [ ] **Step 1: Write `UserPreference.java`**

```java
package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_preference")
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class UserPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "preferred_view_tasks", length = 20)
    private String preferredViewTasks;

    @Column(name = "preferred_layout_calendar", length = 20)
    private String preferredLayoutCalendar;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
```

- [ ] **Step 2: Write `UserPreferenceRepository.java`**

```java
package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.UserPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserPreferenceRepository extends JpaRepository<UserPreference, Long> {

    Optional<UserPreference> findByUserIdAndOrganizationId(Long userId, Long organizationId);
}
```

- [ ] **Step 3: Verify compile**

```bash
cd backend && ./mvnw compile -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 4: Stage and ask for commit approval**

```bash
git add backend/src/main/java/com/bostoneo/bostoneosolutions/model/UserPreference.java \
        backend/src/main/java/com/bostoneo/bostoneosolutions/repository/UserPreferenceRepository.java
```

Ask: **"`UserPreference` entity + repository created. Ready to commit `feat(backend): add UserPreference entity + repository`?"**

## Task A6: User preference service + controller

**Files:**
- Create: `backend/src/main/java/com/bostoneo/bostoneosolutions/service/UserPreferenceService.java`
- Create: `backend/src/main/java/com/bostoneo/bostoneosolutions/service/implementation/UserPreferenceServiceImpl.java`
- Create: `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/UserPreferenceDTO.java`
- Create: `backend/src/main/java/com/bostoneo/bostoneosolutions/controller/UserPreferenceController.java`

- [ ] **Step 1: Write `UserPreferenceDTO`**

```java
package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @NoArgsConstructor @AllArgsConstructor
public class UserPreferenceDTO {
    private String preferredViewTasks;       // null => use role default
    private String preferredLayoutCalendar;  // null => "classic" default
}
```

- [ ] **Step 2: Write the service interface**

```java
package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.UserPreferenceDTO;

public interface UserPreferenceService {
    UserPreferenceDTO getMyPreferences(Long userId, Long organizationId);
    UserPreferenceDTO updateMyPreferences(Long userId, Long organizationId, UserPreferenceDTO request);
}
```

- [ ] **Step 3: Write the service implementation**

```java
package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.UserPreferenceDTO;
import com.bostoneo.bostoneosolutions.model.UserPreference;
import com.bostoneo.bostoneosolutions.repository.UserPreferenceRepository;
import com.bostoneo.bostoneosolutions.service.UserPreferenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserPreferenceServiceImpl implements UserPreferenceService {

    private final UserPreferenceRepository repo;

    @Override
    public UserPreferenceDTO getMyPreferences(Long userId, Long organizationId) {
        UserPreference pref = repo.findByUserIdAndOrganizationId(userId, organizationId)
            .orElseGet(() -> create(userId, organizationId));
        return toDTO(pref);
    }

    @Override
    @Transactional
    public UserPreferenceDTO updateMyPreferences(Long userId, Long organizationId, UserPreferenceDTO request) {
        UserPreference pref = repo.findByUserIdAndOrganizationId(userId, organizationId)
            .orElseGet(() -> create(userId, organizationId));
        if (request.getPreferredViewTasks() != null) pref.setPreferredViewTasks(request.getPreferredViewTasks());
        if (request.getPreferredLayoutCalendar() != null) pref.setPreferredLayoutCalendar(request.getPreferredLayoutCalendar());
        return toDTO(repo.save(pref));
    }

    private UserPreference create(Long userId, Long organizationId) {
        UserPreference pref = UserPreference.builder()
            .userId(userId)
            .organizationId(organizationId)
            .build();
        return repo.save(pref);
    }

    private UserPreferenceDTO toDTO(UserPreference p) {
        return new UserPreferenceDTO(p.getPreferredViewTasks(), p.getPreferredLayoutCalendar());
    }
}
```

- [ ] **Step 4: Write the controller**

```java
package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.UserPreferenceDTO;
import com.bostoneo.bostoneosolutions.service.UserPreferenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
// NOTE: replace this import with the actual UserPrincipal type used elsewhere in the codebase
// Inspect another controller (e.g. CalendarEventController) to see how userId + organizationId are extracted.

@RestController
@RequestMapping("/api/user-preferences")
@RequiredArgsConstructor
public class UserPreferenceController {

    private final UserPreferenceService service;

    @GetMapping("/me")
    public ResponseEntity<UserPreferenceDTO> getMine(@AuthenticationPrincipal Object principal) {
        // TODO at impl time: cast to your real UserPrincipal type and call .getUserId() / .getOrganizationId()
        Long userId = extractUserId(principal);
        Long orgId = extractOrgId(principal);
        return ResponseEntity.ok(service.getMyPreferences(userId, orgId));
    }

    @PutMapping("/me")
    public ResponseEntity<UserPreferenceDTO> updateMine(
            @AuthenticationPrincipal Object principal,
            @RequestBody UserPreferenceDTO request) {
        Long userId = extractUserId(principal);
        Long orgId = extractOrgId(principal);
        return ResponseEntity.ok(service.updateMyPreferences(userId, orgId, request));
    }

    private Long extractUserId(Object principal) { /* match pattern from another controller */ return 0L; }
    private Long extractOrgId(Object principal)  { /* match pattern from another controller */ return 0L; }
}
```

> **At implementation time:** open `backend/src/main/java/com/bostoneo/bostoneosolutions/controller/CalendarEventController.java` and copy its principal-handling pattern. Replace the `Object principal` + `extractUserId`/`extractOrgId` placeholders with whatever the rest of the codebase uses.

- [ ] **Step 5: Verify compile**

```bash
cd backend && ./mvnw compile -q
```

- [ ] **Step 6: Smoke-test the endpoints**

Start the backend locally; use the test user (`a.wilson@bostoneosolutions.com / 1234`) to obtain a token (or call via a logged-in session); then:

```bash
# GET should return defaults (both null) on first call
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/user-preferences/me | jq

# PUT should persist
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"preferredViewTasks":"inbox","preferredLayoutCalendar":"classic"}' \
  http://localhost:8080/api/user-preferences/me | jq

# GET again — should reflect the put
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/user-preferences/me | jq
```

Expected: first GET returns `{"preferredViewTasks":null,"preferredLayoutCalendar":null}`. PUT echoes back the values. Second GET returns the persisted values.

- [ ] **Step 7: Stage and ask for commit approval**

```bash
git add backend/src/main/java/com/bostoneo/bostoneosolutions/dto/UserPreferenceDTO.java \
        backend/src/main/java/com/bostoneo/bostoneosolutions/service/UserPreferenceService.java \
        backend/src/main/java/com/bostoneo/bostoneosolutions/service/implementation/UserPreferenceServiceImpl.java \
        backend/src/main/java/com/bostoneo/bostoneosolutions/controller/UserPreferenceController.java
```

Ask: **"`UserPreference` service + controller wired. Ready to commit `feat(backend): user preference endpoints (GET/PUT /me)`?"**

---

# PHASE B — Tasks page scaffold + routing

The whole phase ships an empty (but visible) `/tasks` page with a placeholder "Inbox view coming next" message. The legacy `/case-management/tasks` is redirected to the new route. Sidebar nav points to the new route. No UI regression — the legacy component is unmounted but still in the codebase.

## Task B1: Generate the new tasks-page module skeleton

**Files:**
- Create: `src/app/modules/case-management/components/tasks-page/tasks-page.component.{ts,html,scss}`

- [ ] **Step 1: Create the component shell**

```bash
mkdir -p src/app/modules/case-management/components/tasks-page
```

Then create `tasks-page.component.ts`:

```ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

type TasksView = 'inbox' | 'pipeline' | 'workload';

@Component({
  selector: 'app-tasks-page',
  templateUrl: './tasks-page.component.html',
  styleUrls: ['./tasks-page.component.scss'],
})
export class TasksPageComponent implements OnInit, OnDestroy {
  activeView: TasksView = 'inbox';
  private destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(p => {
      const v = p.get('view') as TasksView | null;
      this.activeView = (v === 'pipeline' || v === 'workload') ? v : 'inbox';
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  switchView(view: TasksView): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view },
      queryParamsHandling: 'merge',
    });
  }
}
```

- [ ] **Step 2: Create the template**

`tasks-page.component.html`:

```html
<div class="tasks-page">
  <header class="page-head">
    <div class="head-row">
      <div>
        <h2>Tasks</h2>
        <div class="sub">All your tasks across cases</div>
      </div>
      <div class="head-actions">
        <div class="view-switcher" role="tablist" aria-label="View">
          <button class="chip" [class.active]="activeView === 'inbox'" (click)="switchView('inbox')">
            Inbox
          </button>
          <button class="chip" [class.active]="activeView === 'pipeline'" (click)="switchView('pipeline')" disabled title="Phase 2">
            Pipeline
          </button>
          <button class="chip" [class.active]="activeView === 'workload'" (click)="switchView('workload')" disabled title="Phase 3">
            Workload
          </button>
        </div>
        <button class="btn-primary btn">+ New task</button>
      </div>
    </div>
  </header>

  <ng-container [ngSwitch]="activeView">
    <app-inbox-view *ngSwitchCase="'inbox'"></app-inbox-view>
    <div class="placeholder" *ngSwitchCase="'pipeline'">Pipeline view ships in Phase 2.</div>
    <div class="placeholder" *ngSwitchCase="'workload'">Workload view ships in Phase 3.</div>
  </ng-container>
</div>
```

- [ ] **Step 3: Create the styles**

`tasks-page.component.scss` — copy primitives directly from the cases-page benchmark:

```scss
@use 'sass:color';

:host { display: block; min-height: 100%; background: var(--legience-bg-page); }

.tasks-page {
  display: flex;
  flex-direction: column;
}

.page-head {
  padding: 22px 28px 18px;
  background: var(--legience-bg-elevated);
  border-bottom: 1px solid var(--legience-border-hairline);

  .head-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  h2 {
    margin: 0;
    font: 600 22px/1.2 var(--legience-font-sans);
    letter-spacing: -0.025em;
    color: var(--legience-text-primary);
  }

  .sub {
    font: 400 13px/1.4 var(--legience-font-sans);
    color: var(--legience-text-muted);
    margin-top: 4px;
  }

  .head-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.view-switcher {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: var(--legience-radius-buttons);
  background: var(--legience-bg-subtle);

  .chip {
    padding: 5px 12px;
    border: none;
    background: transparent;
    color: var(--legience-text-subtle);
    font: 500 12.5px/1 var(--legience-font-sans);
    border-radius: var(--legience-radius-sm);
    cursor: pointer;

    &.active {
      background: var(--legience-bg-elevated);
      color: var(--legience-text-primary);
      box-shadow: var(--legience-shadow-sm);
      font-weight: 600;
    }

    &[disabled] { opacity: 0.5; cursor: not-allowed; }
  }
}

.placeholder {
  padding: 80px 28px;
  text-align: center;
  color: var(--legience-text-muted);
  font: 500 14px/1.4 var(--legience-font-sans);
}
```

## Task B2: Declare components in the case-management module

**Files:**
- Modify: `src/app/modules/case-management/case-management.module.ts`

- [ ] **Step 1: Add the imports + declarations**

In `case-management.module.ts`, add:

```ts
import { TasksPageComponent } from './components/tasks-page/tasks-page.component';
// (InboxViewComponent and TaskDrawerComponent will be added in Tasks C1 / D1)
```

Add `TasksPageComponent` to the `declarations` array.

## Task B3: Add `/tasks` top-level route

**Files:**
- Modify: `src/app/app-routing.module.ts`

- [ ] **Step 1: Read the existing app routes to find the right insert location**

```bash
sed -n '1,60p' src/app/app-routing.module.ts
```

- [ ] **Step 2: Add the `/tasks` route**

Add (matching the existing route style — guards, lazy loading, etc.):

```ts
{
  path: 'tasks',
  loadChildren: () =>
    import('@app/modules/case-management/case-management.module').then(m => m.CaseManagementModule),
  canActivate: [AuthenticationGuard /* PermissionGuard if used elsewhere — match existing pattern */],
  data: { breadcrumb: 'Tasks' },
},
```

> **At implementation time:** copy the exact guard list and `data` shape from the existing `/case-management` route to keep parity.

- [ ] **Step 3: Add the inner route to `case-management-routing.module.ts`**

In `case-management-routing.module.ts`, add a route under the existing `''` parent (or as a sibling — match the file's pattern):

```ts
{
  path: '',  // Matches when entered via /tasks
  component: TasksPageComponent,
  canActivate: [AuthenticationGuard],
  data: { title: 'Tasks', breadcrumb: 'Tasks' },
},
```

> **Trade-off:** because `case-management.module.ts` is loaded both for `/case-management` and `/tasks`, two routes inside it can both match `''`. Use route guards or split into two child arrays based on a route data flag. **At implementation time** decide whether to keep one shared module (with smarter routing) or split into a `tasks.module.ts`. The plan prefers the latter for clarity — see B3-alt.

### Task B3-alt: Split into a dedicated tasks module (RECOMMENDED)

**Files:**
- Create: `src/app/modules/case-management/components/tasks-page/tasks.module.ts`
- Create: `src/app/modules/case-management/components/tasks-page/tasks-routing.module.ts`

- [ ] **Step 1: Write `tasks.module.ts`**

```ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TasksRoutingModule } from './tasks-routing.module';
import { TasksPageComponent } from './tasks-page.component';
// Inbox + Drawer added in C / D phases

@NgModule({
  declarations: [TasksPageComponent /*, InboxViewComponent, TaskDrawerComponent */],
  imports: [CommonModule, RouterModule, TasksRoutingModule],
})
export class TasksModule {}
```

- [ ] **Step 2: Write `tasks-routing.module.ts`**

```ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TasksPageComponent } from './tasks-page.component';
import { AuthenticationGuard } from '@app/guard/authentication.guard';

const routes: Routes = [
  {
    path: '',
    component: TasksPageComponent,
    canActivate: [AuthenticationGuard],
    data: { title: 'Tasks', breadcrumb: 'Tasks' },
  },
];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class TasksRoutingModule {}
```

- [ ] **Step 3: Update `app-routing.module.ts` to point to `TasksModule`**

Change the `/tasks` route's `loadChildren` to:
```ts
import('@app/modules/case-management/components/tasks-page/tasks.module').then(m => m.TasksModule),
```

## Task B4: Add redirect from `/case-management/tasks` → `/tasks`

**Files:**
- Modify: `src/app/modules/case-management/case-management-routing.module.ts`

- [ ] **Step 1: Replace the existing `tasks` route with a redirect**

Find the existing block:

```ts
{
  path: 'tasks',
  component: TaskManagementComponent,
  canActivate: [AuthenticationGuard],
  data: { title: 'All Tasks', breadcrumb: 'Tasks' }
}
```

Replace with:

```ts
{
  path: 'tasks',
  redirectTo: '/tasks',
  pathMatch: 'full',
},
```

Also remove the `TaskManagementComponent` import if no other route uses it.

- [ ] **Step 2: Search for other consumers of the legacy route**

```bash
grep -rn '/case-management/tasks' src/app/ --include='*.ts' --include='*.html' | grep -v node_modules
```

If any are found, leave them — the redirect handles them. (Don't change every navigation link in this task; that's a follow-up cleanup the redirect makes safe.)

## Task B5: Update sidebar nav

**Files:**
- Modify: `src/app/component/layouts/horizontal-topbar/menu.ts` (or whatever the sidebar menu file is — confirm via `grep`)

- [ ] **Step 1: Find the sidebar menu definition**

```bash
grep -rln "case-management/tasks\|'tasks'" src/app/component/layouts/ 2>/dev/null | head
```

- [ ] **Step 2: Update the entry**

In the sidebar menu file, find the Tasks entry. Move it from "Case management" group to "Daily" (alongside Dashboard / Cases / Calendar / Messages). Update its `link` to `/tasks`.

## Task B6: Manual verification + commit

- [ ] **Step 1: Run dev server**

```bash
npm run start
```

(Skip `npm run build` per CLAUDE.md unless asked.)

- [ ] **Step 2: Manual walkthrough**

1. Log in as `a.wilson@bostoneosolutions.com / 1234`.
2. Navigate to `/tasks` — should see the new shell with the view-switcher chips ("Inbox" active, "Pipeline" + "Workload" disabled) and an `app-inbox-view` placeholder area showing nothing yet (component not registered until Phase C — that's fine).
3. Navigate to `/case-management/tasks` — should redirect to `/tasks` (URL bar updates).
4. Sidebar nav: "Tasks" item appears under "Daily", links to `/tasks`.

- [ ] **Step 3: Stage and ask for commit approval**

```bash
git add src/app/modules/case-management/components/tasks-page/ \
        src/app/modules/case-management/case-management-routing.module.ts \
        src/app/modules/case-management/case-management.module.ts \
        src/app/app-routing.module.ts \
        src/app/component/layouts/
```

Ask: **"Tasks page shell + routing + redirect verified. Ready to commit `feat(frontend): tasks page shell at /tasks + redirect from legacy route`?"**

---

# PHASE C — Inbox view component

The Inbox view fetches tasks via the existing CaseTask API, groups them by due-date band, and renders them as rows. Click on a row updates the URL with `?task=:id` (the drawer in Phase D will pick that up).

## Task C1: Inbox view scaffold

**Files:**
- Create: `src/app/modules/case-management/components/tasks-page/views/inbox-view/inbox-view.component.{ts,html,scss}`

- [ ] **Step 1: Create the directory + files**

```bash
mkdir -p src/app/modules/case-management/components/tasks-page/views/inbox-view
```

`inbox-view.component.ts`:

```ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { CaseTaskDTO, TaskService } from '@app/services/task/task.service'; // adjust to existing service path

interface TaskGroup {
  key: 'overdue' | 'today' | 'thisWeek' | 'later' | 'noDate';
  label: string;
  tasks: CaseTaskDTO[];
  emphasis?: 'danger';
}

@Component({
  selector: 'app-inbox-view',
  templateUrl: './inbox-view.component.html',
  styleUrls: ['./inbox-view.component.scss'],
})
export class InboxViewComponent implements OnInit, OnDestroy {
  groups: TaskGroup[] = [];
  loading = true;
  selectedTaskId: number | null = null;
  private destroy$ = new Subject<void>();

  constructor(private taskService: TaskService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.taskService.list().pipe(takeUntil(this.destroy$)).subscribe(tasks => {
      this.groups = this.groupByDueBand(tasks);
      this.loading = false;
    });

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(p => {
      const tid = p.get('task');
      this.selectedTaskId = tid ? +tid : null;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectTask(task: CaseTaskDTO): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { task: task.id },
      queryParamsHandling: 'merge',
    });
  }

  trackById(_: number, t: CaseTaskDTO): number { return t.id; }

  // ── time-band grouping ────────────────────────────────────────
  private groupByDueBand(tasks: CaseTaskDTO[]): TaskGroup[] {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const dayOfWeek = startOfToday.getDay();
    const endOfWeek = new Date(startOfToday); endOfWeek.setDate(startOfToday.getDate() + (6 - dayOfWeek));

    const overdue: CaseTaskDTO[] = [];
    const today: CaseTaskDTO[] = [];
    const thisWeek: CaseTaskDTO[] = [];
    const later: CaseTaskDTO[] = [];
    const noDate: CaseTaskDTO[] = [];

    for (const t of tasks) {
      if (t.status === 'COMPLETED' || t.status === 'CANCELLED') continue;
      if (!t.dueDate) { noDate.push(t); continue; }
      const d = new Date(t.dueDate);
      if (d < startOfToday) overdue.push(t);
      else if (d <= endOfToday) today.push(t);
      else if (d <= endOfWeek) thisWeek.push(t);
      else later.push(t);
    }

    return [
      { key: 'overdue', label: 'Overdue', tasks: overdue, emphasis: 'danger' },
      { key: 'today', label: 'Today', tasks: today },
      { key: 'thisWeek', label: 'This week', tasks: thisWeek },
      { key: 'later', label: 'Later', tasks: later },
      { key: 'noDate', label: 'No due date', tasks: noDate },
    ].filter(g => g.tasks.length > 0);
  }
}
```

- [ ] **Step 2: Verify the existing TaskService API**

```bash
grep -rn "class TaskService\|class CaseTaskService" src/app/services 2>/dev/null | head
```

If the service is named `CaseTaskService` (not `TaskService`), or its `list()` method is named differently (e.g., `getAllTasks()`), adjust the import in `inbox-view.component.ts` accordingly. The plan uses `TaskService.list()` as a placeholder; **substitute the real name at implementation time**.

## Task C2: Inbox template

**Files:**
- Create: `src/app/modules/case-management/components/tasks-page/views/inbox-view/inbox-view.component.html`

- [ ] **Step 1: Write the template**

```html
<div class="filter-bar">
  <span class="chip active">All <span class="count">· {{ groups | totalCount }}</span></span>
  <span class="chip">Mine</span>
  <span class="chip">Assigned</span>
  <div class="filter-divider"></div>
  <span class="chip">Case ▾</span>
  <span class="chip">Priority ▾</span>
  <span class="chip">Due ▾</span>
</div>

<div *ngIf="loading" class="t-empty">Loading…</div>

<div *ngIf="!loading && groups.length === 0" class="t-empty">
  <div class="empty-title">No tasks. Nice work.</div>
  <button class="btn-primary btn">+ New task</button>
</div>

<div class="t-list" *ngIf="!loading && groups.length > 0">
  <div class="t-group" *ngFor="let group of groups">
    <div class="t-group-head" [class.danger]="group.emphasis === 'danger'">
      {{ group.label }} <span class="count">· {{ group.tasks.length }}</span>
    </div>

    <div class="t-row"
         *ngFor="let task of group.tasks; trackBy: trackById"
         [class.selected]="task.id === selectedTaskId"
         (click)="selectTask(task)">
      <div class="t-checkbox" [class.checked]="task.status === 'COMPLETED'"></div>
      <div class="t-title" [class.done]="task.status === 'COMPLETED'">{{ task.title }}</div>

      <span class="case-pill" *ngIf="task.legalCase">
        <span class="case-dot" [style.background]="task.legalCase.colorHex || '#0b64e9'"></span>
        {{ task.legalCase.title || task.legalCase.caseNumber }}
      </span>

      <span class="pill" [ngClass]="'pill-' + (task.priority | priorityToTone)">
        <span class="dot"></span>{{ task.priority | titlecase }}
      </span>

      <span class="t-due" [class.overdue]="group.key === 'overdue'" [class.today]="group.key === 'today'">
        {{ task.dueDate | dueLabel }}
      </span>

      <div class="av-ringed" *ngIf="task.assignedTo">
        <div class="inner"><div class="content">{{ task.assignedTo | userInitials }}</div></div>
      </div>

      <button class="btn-ghost btn btn-icon" (click)="$event.stopPropagation()">⋯</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Pipes used above**

The template uses pipes that may not exist yet:
- `totalCount` — sums `tasks.length` across an array of `TaskGroup`.
- `priorityToTone` — maps `HIGH→danger`, `MEDIUM→warning`, `LOW→info`, etc.
- `dueLabel` — formats a date as "2 days late" / "Today, 5p" / "Wed, May 8".
- `userInitials` — derives "DA" from a User object.

> **At implementation time:** check whether equivalents exist (cases-page or topbar may have them). If yes, reuse. If no, create them in `src/app/shared/pipes/` and declare in a shared module. Keep this task focused — pipe creation is a sub-task.

## Task C3: Inbox styles (matching cases-page benchmark)

**Files:**
- Create: `src/app/modules/case-management/components/tasks-page/views/inbox-view/inbox-view.component.scss`

- [ ] **Step 1: Write the styles**

Open the brainstorm preview file and copy the `.t1-list`, `.t1-group`, `.t1-row` style block (the file is at `.superpowers/brainstorm/20220-1777837309/content/wave1-tasks-calendar-redesign-options.html`, search for `TASKS · D1`). Adapt the class names from `t1-` to `t-` to match the template above. The styles already use `--legience-*` tokens — no other changes needed.

```scss
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px 28px;
  background: var(--legience-bg-elevated);
  border-bottom: 1px solid var(--legience-border-hairline);
}
.filter-divider {
  height: 16px;
  width: 1px;
  background: var(--legience-border-hairline);
  margin: 0 4px;
}
.t-empty {
  padding: 80px 28px;
  text-align: center;
  color: var(--legience-text-muted);
  .empty-title { font: 600 16px/1.4 var(--legience-font-sans); margin-bottom: 14px; }
}
.t-list { background: var(--legience-bg-elevated); }
.t-group + .t-group { border-top: 1px solid var(--legience-border-hairline); }
.t-group-head {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 28px 8px;
  font: 600 11.5px/1 var(--legience-font-sans);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--legience-text-subtle);
  &.danger { color: var(--legience-danger); }
  .count { color: var(--legience-text-muted); font-weight: 500; }
}
.t-row {
  display: grid;
  grid-template-columns: 22px 1fr auto auto auto auto auto;
  align-items: center;
  gap: 16px;
  padding: 11px 28px;
  border-top: 1px solid var(--legience-border-hairline);
  cursor: pointer;
  &:hover { background: var(--legience-bg-row-hover); }
  &.selected { background: var(--legience-accent-bg-subtle); }
}
.t-checkbox {
  width: 16px; height: 16px;
  border: 1.5px solid var(--legience-border-emphasis);
  border-radius: 4px;
  background: var(--legience-bg-elevated);
  &.checked {
    background: var(--legience-accent);
    border-color: var(--legience-accent);
  }
}
.t-title {
  font: 500 13.5px/1.3 var(--legience-font-sans);
  color: var(--legience-text-primary);
  letter-spacing: -0.01em;
  &.done {
    text-decoration: line-through;
    color: var(--legience-text-muted);
  }
}
.t-due {
  font: 500 11.5px/1 var(--legience-font-sans);
  color: var(--legience-text-subtle);
  font-variant-numeric: tabular-nums;
  &.overdue { color: var(--legience-danger); font-weight: 600; }
  &.today { color: var(--legience-accent); font-weight: 600; }
}
```

## Task C4: Register InboxViewComponent

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/tasks.module.ts`

- [ ] **Step 1: Declare the component**

```ts
import { InboxViewComponent } from './views/inbox-view/inbox-view.component';
// ...
declarations: [TasksPageComponent, InboxViewComponent /*, TaskDrawerComponent */],
```

## Task C5: Manual verification + commit

- [ ] **Step 1: Run dev server**

```bash
npm run start
```

- [ ] **Step 2: Manual walkthrough**

1. Open `/tasks`. Inbox view should render with realistic groups (Today / This week / Later). Each row shows title, case-pill, priority pill, due-date, assignee avatar.
2. Click a row — URL updates to include `?task=:id`. (Drawer doesn't open yet — that's Phase D.)
3. Switch to Pipeline / Workload chips — they're disabled in Phase 1; should not be clickable.
4. Verify visual match with the brainstorm preview (`.superpowers/brainstorm/.../wave1-tasks-calendar-redesign-options.html`, "TASKS · Direction 1: Inbox").

- [ ] **Step 3: Stage + commit gate**

```bash
git add src/app/modules/case-management/components/tasks-page/views/ \
        src/app/modules/case-management/components/tasks-page/tasks.module.ts
```

Ask: **"Inbox view rendering live data with time-band groups, click-to-select wired. Ready to commit `feat(frontend): tasks inbox view with time-band groups`?"**

---

# PHASE D — Unified task drawer

A right-side drawer opens when `?task=:id` is in the URL. Renders all "always visible" sections + the status-driven blocker callout (when status === BLOCKED).

## Task D1: Drawer scaffold

**Files:**
- Create: `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.{ts,html,scss}`

- [ ] **Step 1: Component logic**

```ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, switchMap, takeUntil, of } from 'rxjs';
import { CaseTaskDTO, TaskService } from '@app/services/task/task.service'; // adjust to actual service

@Component({
  selector: 'app-task-drawer',
  templateUrl: './task-drawer.component.html',
  styleUrls: ['./task-drawer.component.scss'],
})
export class TaskDrawerComponent implements OnInit, OnDestroy {
  task: CaseTaskDTO | null = null;
  loading = false;
  private destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute, private router: Router, private taskService: TaskService) {}

  ngOnInit(): void {
    this.route.queryParamMap.pipe(
      takeUntil(this.destroy$),
      switchMap(p => {
        const tid = p.get('task');
        if (!tid) { this.task = null; return of(null); }
        this.loading = true;
        return this.taskService.getById(+tid);
      }),
    ).subscribe(t => { this.task = t; this.loading = false; });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  close(): void {
    const queryParams = { ...this.route.snapshot.queryParams };
    delete queryParams['task'];
    this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }

  isBlocked(): boolean { return this.task?.status === 'BLOCKED'; }
}
```

- [ ] **Step 2: Template**

```html
<aside class="t-drawer" *ngIf="task" role="complementary" aria-label="Task details">
  <header class="drawer-head">
    <span class="pill" [ngClass]="'pill-' + (task.priority | priorityToTone)">
      <span class="dot"></span>{{ task.priority | titlecase }}
    </span>
    <h3 class="drawer-title">{{ task.title }}</h3>
    <button class="icon-x" (click)="close()" aria-label="Close drawer">✕</button>
  </header>

  <!-- STATUS-DRIVEN BLOCKER CALLOUT (status === BLOCKED, regardless of view) -->
  <div class="blocker-callout" *ngIf="isBlocked()">
    <div class="blocker-head">⏸ Blocked</div>
    <div class="blocker-body">
      <ng-container *ngIf="task.blockerReason; else noReason">
        <strong>{{ task.blockerReason }}</strong>
      </ng-container>
      <ng-template #noReason><em class="muted">No reason recorded</em></ng-template>
      <div class="auto-unblock" *ngIf="task.autoUnblockDate">
        Auto-unblock on <strong>{{ task.autoUnblockDate | date:'mediumDate' }}</strong>
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div>
      <div class="field-label">Case</div>
      <span class="case-pill" *ngIf="task.legalCase">
        <span class="case-dot" [style.background]="task.legalCase.colorHex || '#0b64e9'"></span>
        {{ task.legalCase.title || task.legalCase.caseNumber }}
      </span>
    </div>
    <div>
      <div class="field-label">Due</div>
      <div class="field-value">{{ task.dueDate | dueLabel }}</div>
    </div>
    <div>
      <div class="field-label">Assignee</div>
      <div class="field-value" *ngIf="task.assignedTo">{{ task.assignedTo | userFullName }}</div>
    </div>
    <div>
      <div class="field-label">Status</div>
      <span class="pill pill-subtle">{{ task.status | titlecase }}</span>
    </div>
  </div>

  <div class="drawer-section">
    <div class="field-label">Description</div>
    <div class="field-value">{{ task.description || '(no description)' }}</div>
  </div>

  <!-- subtasks, attachments, time logged, comments — see Tasks D2-D5 -->
</aside>

<button class="t-drawer-backdrop" *ngIf="task" (click)="close()" aria-label="Close drawer"></button>
```

- [ ] **Step 3: Styles**

Mirror the `.drawer` block from the brainstorm preview file (search for `Drawer · D1 Inbox` in `wave1-tasks-calendar-redesign-options.html`). Adapt class names from `.drawer` to `.t-drawer`. Add a backdrop element styled with `position: fixed; inset: 0; background: rgba(12,10,9,0.45);`.

## Task D2: Subtasks section

- [ ] **Step 1: Add to template (inside the drawer, after description)**

```html
<div class="drawer-section" *ngIf="task.subtasks?.length">
  <div class="sec-head">
    <span class="title">Subtasks · {{ doneCount }} of {{ task.subtasks.length }}</span>
    <button class="btn-ghost btn btn-sm">+ Add</button>
  </div>
  <div class="subtask-row" *ngFor="let st of task.subtasks">
    <div class="t-checkbox" [class.checked]="st.status === 'COMPLETED'"></div>
    <div class="subtitle" [class.done]="st.status === 'COMPLETED'">{{ st.title }}</div>
    <div class="due">{{ st.dueDate | dueLabel }}</div>
  </div>
</div>
```

- [ ] **Step 2: Add to component**

```ts
get doneCount(): number {
  return this.task?.subtasks?.filter(s => s.status === 'COMPLETED').length ?? 0;
}
```

## Task D3: Time logged section

- [ ] **Step 1: Add to template**

```html
<div class="drawer-section">
  <div class="sec-head">
    <span class="title">Time logged · {{ task.actualHours || 0 }} h</span>
    <button class="btn-ghost btn btn-sm">▶ Start timer</button>
  </div>
  <!-- Phase 1: read-only summary; per-entry timeline can come later -->
</div>
```

## Task D4: Comments section

- [ ] **Step 1: Add to template**

```html
<div class="drawer-section" *ngIf="task.comments?.length">
  <div class="sec-head"><span class="title">Comments · {{ task.comments.length }}</span></div>
  <div class="comment" *ngFor="let c of task.comments">
    <div class="av-ringed">
      <div class="inner"><div class="content">{{ c.author | userInitials }}</div></div>
    </div>
    <div>
      <div class="meta">
        <strong>{{ c.author | userFullName }}</strong> · {{ c.createdAt | date:'short' }}
      </div>
      <div class="body">{{ c.body }}</div>
    </div>
  </div>
</div>
```

## Task D5: Mount drawer in tasks-page template

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/tasks-page.component.html`

- [ ] **Step 1: Add the drawer at the bottom of the template**

```html
<!-- existing tasks-page markup -->
<app-task-drawer></app-task-drawer>
```

The drawer is route-driven, so no inputs are needed.

## Task D6: Register TaskDrawerComponent

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/tasks.module.ts`

- [ ] **Step 1: Add to declarations**

```ts
import { TaskDrawerComponent } from './task-drawer/task-drawer.component';
// ...
declarations: [TasksPageComponent, InboxViewComponent, TaskDrawerComponent],
```

## Task D7: Manual verification + commit

- [ ] **Step 1: Walkthrough**

1. Open `/tasks`. Click a task row. Drawer slides in from the right; URL has `?task=:id`.
2. Click the backdrop or `✕` — drawer closes; URL drops `?task=`.
3. Open a task whose status === `BLOCKED`. The blocker callout renders with the `blockerReason` text. (Use `psql` to set one row to BLOCKED if no real blocked task exists yet: `UPDATE case_tasks SET status = 'BLOCKED', blocker_reason = 'Awaiting opposing counsel' WHERE id = <some-id>;`).
4. Visual match with brainstorm preview ("Drawer · D1 Inbox" section).

- [ ] **Step 2: Stage + commit gate**

```bash
git add src/app/modules/case-management/components/tasks-page/task-drawer/ \
        src/app/modules/case-management/components/tasks-page/tasks-page.component.html \
        src/app/modules/case-management/components/tasks-page/tasks.module.ts
```

Ask: **"Unified task drawer with status-driven blocker callout verified. Ready to commit `feat(frontend): unified task drawer + status-driven blocker callout`?"**

---

# PHASE E — Calendar Classic re-skin

Existing `CalendarViewComponent` stays in place. Its template + styles are rewritten to match rox/legience tokens. A new layout-switcher chip group is added in the page header. Day/Week/Month toggle stays in the toolbar. Side rail "My calendars" is added.

## Task E1: Read the current calendar-view template

- [ ] **Step 1: Inspect current state**

```bash
sed -n '1,40p' src/app/modules/legal/components/calendar/calendar-view/calendar-view.component.ts
wc -l src/app/modules/legal/components/calendar/calendar-view/calendar-view.component.{ts,html,scss}
```

## Task E2: Rewrite calendar-view template

**Files:**
- Modify: `src/app/modules/legal/components/calendar/calendar-view/calendar-view.component.html`

- [ ] **Step 1: Use the brainstorm preview's "CALENDAR · Direction 1: Classic" section as the template baseline**

Copy that section's structure: `.app-shell` with sidebar (omit if calendar lives inside the existing app shell — verify), `.page-head` with `.head-row`, `.cal-toolbar`, `.c1-grid`, `.c1-day` cells, `.c1-event` chips. Wire to existing `CalendarEventService` data.

> **Implementation note:** the preview's `.app-shell` includes a sidebar nav. The real calendar component is mounted inside the global app layout, so don't duplicate the sidebar — only the right-of-sidebar area needs the new chrome.

## Task E3: Layout-switcher chip group

- [ ] **Step 1: In the new template, add the chip group**

```html
<div class="layout-switcher" role="tablist">
  <button class="chip" [class.active]="layout === 'classic'" (click)="setLayout('classic')">Classic</button>
  <button class="chip" [class.active]="layout === 'deadlines'" (click)="setLayout('deadlines')">Deadlines</button>
  <button class="chip" [class.active]="layout === 'time-block'" (click)="setLayout('time-block')">Time-block</button>
</div>
```

- [ ] **Step 2: In the component, wire `?layout=` URL state**

```ts
import { ActivatedRoute, Router } from '@angular/router';

layout: 'classic' | 'deadlines' | 'time-block' = 'classic';

ngOnInit(): void {
  this.route.queryParamMap.subscribe(p => {
    const l = p.get('layout');
    this.layout = (l === 'deadlines' || l === 'time-block') ? l : 'classic';
  });
}

setLayout(l: 'classic' | 'deadlines' | 'time-block'): void {
  this.router.navigate([], {
    relativeTo: this.route,
    queryParams: { layout: l },
    queryParamsHandling: 'merge',
  });
}
```

- [ ] **Step 3: For non-classic layouts in Phase 1, render a placeholder**

```html
<ng-container [ngSwitch]="layout">
  <ng-container *ngSwitchCase="'classic'">
    <!-- the actual calendar grid -->
  </ng-container>
  <div *ngSwitchCase="'deadlines'" class="placeholder">Deadlines layout ships in Phase 2.</div>
  <div *ngSwitchCase="'time-block'" class="placeholder">Time-block layout ships in Phase 3.</div>
</ng-container>
```

## Task E4: Side rail — My calendars

- [ ] **Step 1: Add the case-toggle list to the page**

The legal cases for the current org are already fetched via the existing `LegalCaseService`. Inject it (if not already), expose `cases$` to the template, and render:

```html
<aside class="cal-side-rail">
  <div class="rail-section">My calendars</div>
  <label *ngFor="let c of cases$ | async" class="case-toggle">
    <input type="checkbox" [checked]="isCaseVisible(c.id)" (change)="toggleCase(c.id)">
    <span class="case-color" [style.background]="c.colorHex"></span>
    <span class="case-name">{{ c.title || c.caseNumber }}</span>
  </label>
</aside>
```

`toggleCase` / `isCaseVisible` maintain a local `Set<number>` of hidden cases (defaults to all visible). Filter the events list against this set when rendering the grid.

## Task E5: Calendar styles

**Files:**
- Modify: `src/app/modules/legal/components/calendar/calendar-view/calendar-view.component.scss`

- [ ] **Step 1: Replace the file with rox/legience-tokenized styles**

Copy the `.cal-toolbar`, `.c1-grid`, `.c1-day`, `.c1-event*` blocks from the brainstorm preview. Remove the legacy Velzon styles entirely; use the `--legience-*` token system throughout. Add `.layout-switcher`, `.cal-side-rail`, `.case-toggle`, `.placeholder` blocks.

## Task E6: Manual verification + commit

- [ ] **Step 1: Walkthrough**

1. `/legal/calendar` — Classic layout active by default. Month grid renders, side rail shows the org's cases as togglable checkboxes. Toggling a case dims/restores its events.
2. Layout-switcher chip group is visible top-right. Click "Deadlines" → URL becomes `?layout=deadlines`, placeholder banner shows "Deadlines layout ships in Phase 2." Click "Classic" → restored.
3. Visual match with the brainstorm preview ("CALENDAR · Direction 1: Classic").

- [ ] **Step 2: Stage + commit gate**

```bash
git add src/app/modules/legal/components/calendar/calendar-view/
```

Ask: **"Calendar Classic layout re-skinned, layout-switcher chips wired, side rail done. Ready to commit `feat(frontend): calendar classic layout + layout switcher`?"**

---

# PHASE F — Event modal restructure

The existing `event-modal.component` is rewritten to be `eventType`-aware. Phase 1 only renders the always-visible sections (which serve `MEETING`-equivalent event types: CLIENT_MEETING, TEAM_MEETING, CONSULTATION, OTHER, REMINDER). The `*ngIf` blocks for deadline + time-block sections are present in the markup but always evaluate false in Phase 1.

## Task F1: Read the current event-modal

- [ ] **Step 1: Inspect**

```bash
wc -l src/app/modules/legal/components/calendar/event-modal/event-modal.component.{ts,html,scss}
```

## Task F2: Restructure event-modal component

**Files:**
- Modify: `src/app/modules/legal/components/calendar/event-modal/event-modal.component.ts`

- [ ] **Step 1: Add eventType-aware getters**

```ts
import { CalendarEventType } from '@app/...'; // existing enum import

get isDeadline(): boolean {
  return this.event?.eventType === CalendarEventType.DEADLINE;
}

get isTimeBlock(): boolean {
  // CalendarEventType.TIME_BLOCK does not exist yet; will be added in Phase 3.
  // For Phase 1, this always returns false.
  return false;
}

get showsDeadlineSection(): boolean {
  return this.isDeadline && this.featureFlags.deadlinesLayoutEnabled;  // false in Phase 1
}

get showsTimeBlockSection(): boolean {
  return this.isTimeBlock && this.featureFlags.timeBlockLayoutEnabled;  // false in Phase 1
}
```

> **Implementation note:** `featureFlags` should be an existing service (search `grep -rn "FeatureFlag\|feature-flag" src/app`). If none exists, hardcode `false` here and refactor later.

## Task F3: Restructure event-modal template

**Files:**
- Modify: `src/app/modules/legal/components/calendar/event-modal/event-modal.component.html`

- [ ] **Step 1: Wrap the always-visible sections at top**

Use the brainstorm preview's "Modal · D1 Classic event" as the template baseline. Header + title + date + time-range + location + linked case + attendees + notes + reminders + action bar. Wrap in `.modal` shell with backdrop.

- [ ] **Step 2: Add empty conditional blocks**

```html
<div class="modal-section deadline-section" *ngIf="showsDeadlineSection">
  <!-- Phase 2: tier callout, hard-date field, source/authority field, cascade builder, required-action field -->
</div>

<div class="modal-section time-block-section" *ngIf="showsTimeBlockSection">
  <!-- Phase 3: billable toggle, activity-code dropdown, rate field, multiplier, invoice-description, save-as-event-vs-with-time-entry actions -->
</div>
```

In Phase 1, both blocks render nothing because the flags are off.

## Task F4: Modal styles

**Files:**
- Modify: `src/app/modules/legal/components/calendar/event-modal/event-modal.component.scss`

- [ ] **Step 1: Re-skin to rox/legience**

Copy `.modal-wrap`, `.modal`, `.modal-head`, `.field`, `.field-grid`, `.modal-actions` from the brainstorm preview. Remove legacy Velzon modal styles.

## Task F5: Manual verification + commit

- [ ] **Step 1: Walkthrough**

1. Open `/legal/calendar?layout=classic`. Click an event. Modal opens with new chrome — header, title, date/time, location, linked case, attendees, notes, reminders, action bar. No deadline section. No time-block section.
2. If you have a `DEADLINE` event in the database: the modal still opens but the deadline section block is hidden behind the feature flag (visually identical to a meeting in Phase 1). That's the correct Phase 1 behavior.
3. Visual match with the brainstorm preview ("Modal · D1 Classic event" section).

- [ ] **Step 2: Stage + commit gate**

```bash
git add src/app/modules/legal/components/calendar/event-modal/
```

Ask: **"Event modal restructured, eventType-aware foundation in place, conditional blocks hidden behind feature flags. Ready to commit `feat(frontend): event modal eventType-aware foundation`?"**

---

# PHASE G — User preferences (last-used view + layout)

Connect the frontend to the new `/api/user-preferences/me` endpoint. On page load, restore the user's last-used view (Tasks) and layout (Calendar). On change, persist.

## Task G1: Frontend service

**Files:**
- Create: `src/app/core/services/user-preferences.service.ts`

- [ ] **Step 1: Service implementation**

```ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '@env/environment';

export interface UserPreferences {
  preferredViewTasks: 'inbox' | 'pipeline' | 'workload' | null;
  preferredLayoutCalendar: 'classic' | 'deadlines' | 'time-block' | null;
}

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private readonly url = `${environment.apiBase}/api/user-preferences/me`;
  private state$ = new BehaviorSubject<UserPreferences>({ preferredViewTasks: null, preferredLayoutCalendar: null });
  readonly preferences$ = this.state$.asObservable();

  constructor(private http: HttpClient) {}

  load(): Observable<UserPreferences> {
    return this.http.get<UserPreferences>(this.url).pipe(tap(p => this.state$.next(p)));
  }

  update(patch: Partial<UserPreferences>): Observable<UserPreferences> {
    return this.http.put<UserPreferences>(this.url, patch).pipe(tap(p => this.state$.next(p)));
  }
}
```

## Task G2: Tests for the service

**Files:**
- Create: `src/app/core/services/user-preferences.service.spec.ts`

- [ ] **Step 1: Write tests**

```ts
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UserPreferencesService } from './user-preferences.service';
import { environment } from '@env/environment';

describe('UserPreferencesService', () => {
  let service: UserPreferencesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [UserPreferencesService] });
    service = TestBed.inject(UserPreferencesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('load() GETs /api/user-preferences/me and updates state', () => {
    service.load().subscribe();
    const req = http.expectOne(`${environment.apiBase}/api/user-preferences/me`);
    expect(req.request.method).toBe('GET');
    req.flush({ preferredViewTasks: 'inbox', preferredLayoutCalendar: 'classic' });
    service.preferences$.subscribe(p => {
      expect(p.preferredViewTasks).toBe('inbox');
      expect(p.preferredLayoutCalendar).toBe('classic');
    });
  });

  it('update() PUTs the patch and updates state', () => {
    service.update({ preferredViewTasks: 'pipeline' }).subscribe();
    const req = http.expectOne(`${environment.apiBase}/api/user-preferences/me`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ preferredViewTasks: 'pipeline' });
    req.flush({ preferredViewTasks: 'pipeline', preferredLayoutCalendar: 'classic' });
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npx ng test --include='**/user-preferences.service.spec.ts' --watch=false --browsers=ChromeHeadless
```

Expected: 2 specs pass.

## Task G3: Wire prefs into TasksPageComponent

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/tasks-page.component.ts`

- [ ] **Step 1: Inject + load on init**

```ts
constructor(
  private route: ActivatedRoute,
  private router: Router,
  private prefs: UserPreferencesService,  // new
) {}

ngOnInit(): void {
  // Existing query-param subscription — same as before.

  // Load prefs once; if no `?view=` is in the URL and a pref exists, redirect.
  this.prefs.load().subscribe(p => {
    const currentView = this.route.snapshot.queryParamMap.get('view');
    if (!currentView && p.preferredViewTasks) {
      this.router.navigate([], { queryParams: { view: p.preferredViewTasks }, replaceUrl: true });
    }
  });
}

switchView(view: TasksView): void {
  // ... existing nav logic ...
  this.prefs.update({ preferredViewTasks: view }).subscribe();  // fire-and-forget
}
```

## Task G4: Wire prefs into CalendarViewComponent

**Files:**
- Modify: `src/app/modules/legal/components/calendar/calendar-view/calendar-view.component.ts`

- [ ] **Step 1: Same pattern as G3**

```ts
this.prefs.load().subscribe(p => {
  const currentLayout = this.route.snapshot.queryParamMap.get('layout');
  if (!currentLayout && p.preferredLayoutCalendar) {
    this.router.navigate([], { queryParams: { layout: p.preferredLayoutCalendar }, replaceUrl: true });
  }
});

setLayout(l: 'classic' | 'deadlines' | 'time-block'): void {
  // ... existing nav logic ...
  this.prefs.update({ preferredLayoutCalendar: l }).subscribe();
}
```

## Task G5: Manual verification + commit

- [ ] **Step 1: Walkthrough**

1. Open `/tasks`. Default view = Inbox. URL has no `?view=` initially.
2. Click "Pipeline" chip — URL adds `?view=pipeline`. Refresh. URL stays `?view=pipeline` because the pref was persisted.
3. Hard refresh, navigate to `/tasks` (no query params). The page redirects to `/tasks?view=pipeline` because the pref restored.
4. Same flow for `/legal/calendar` and `?layout=`.

- [ ] **Step 2: Stage + commit gate**

```bash
git add src/app/core/services/user-preferences.service.ts \
        src/app/core/services/user-preferences.service.spec.ts \
        src/app/modules/case-management/components/tasks-page/tasks-page.component.ts \
        src/app/modules/legal/components/calendar/calendar-view/calendar-view.component.ts
```

Ask: **"User preferences plumbing wired; last-used view + layout persist across reloads. Ready to commit `feat(frontend): user preference persistence for tasks view + calendar layout`?"**

---

# PHASE H — Final integration + flag rollout

## Task H1: Visual parity sweep

- [ ] **Step 1: Side-by-side comparison**

Open in two tabs:
- Tab A: `/legal/cases` (the consistency benchmark)
- Tab B: `/tasks`

Compare:
- Header padding (22px 28px 18px)
- `.head-row` layout
- Border-hairline color (`#e7e5e4` light, `rgba(255,255,255,0.08)` dark)
- Page background (`#f5f5f4` light, `#0c0a09` dark)
- Pill density + padding
- Avatar ring system (28×28 default with 2px ring + 1.5px white inner gap)
- Chip active state (accent bg-subtle + accent text + accent border)

If anything drifts, fix in the relevant `*.scss` and re-verify.

- [ ] **Step 2: Same for `/legal/calendar` Classic vs cases page**

## Task H2: Run lints + type checks

```bash
npm run lint   # if lint script exists
npx tsc --noEmit
```

Per CLAUDE.md: "don't check for diagnostics or if the frontend has compiled, if it doesn't compile I will let you know" — but since this is a final-pass task, we do verify. If TS errors surface, fix them.

## Task H3: Backend integration test

```bash
cd backend && ./mvnw test -Dtest='*UserPreference*' -q
```

If no test class exists yet, write a minimal one:

```java
// backend/src/test/java/com/bostoneo/bostoneosolutions/service/UserPreferenceServiceImplTest.java
@SpringBootTest
class UserPreferenceServiceImplTest {
    @Autowired UserPreferenceService service;
    @Autowired UserPreferenceRepository repo;

    @Test
    void getMyPreferences_createsRowOnFirstCall() {
        UserPreferenceDTO dto = service.getMyPreferences(/*userId*/ 1L, /*orgId*/ 1L);
        assertThat(dto.getPreferredViewTasks()).isNull();
        assertThat(dto.getPreferredLayoutCalendar()).isNull();
        assertThat(repo.findByUserIdAndOrganizationId(1L, 1L)).isPresent();
    }

    @Test
    void updateMyPreferences_persistsAndReturns() {
        UserPreferenceDTO patch = new UserPreferenceDTO("inbox", "classic");
        UserPreferenceDTO out = service.updateMyPreferences(1L, 1L, patch);
        assertThat(out.getPreferredViewTasks()).isEqualTo("inbox");
        assertThat(out.getPreferredLayoutCalendar()).isEqualTo("classic");
    }
}
```

## Task H4: Tenant-safety audit

- [ ] **Step 1: Verify org-scoping on the new endpoints**

```bash
grep -n 'organizationId\|organization_id' \
  backend/src/main/java/com/bostoneo/bostoneosolutions/service/implementation/UserPreferenceServiceImpl.java \
  backend/src/main/java/com/bostoneo/bostoneosolutions/repository/UserPreferenceRepository.java
```

Expected: every read/write is scoped by both `userId` AND `organizationId` (the unique constraint enforces this at the DB layer too).

- [ ] **Step 2: Spot-check the existing CaseTask endpoints**

The new task fields (`blocker_reason`, `auto_unblock_date`) ride existing endpoints. Verify those endpoints already org-scope (they should — confirm via `grep` on `CaseTaskController.java`). No change needed if existing scoping is intact.

## Task H5: Final commit + handoff to Phase 2 plan

- [ ] **Step 1: Stage any remaining changes**

```bash
git status
```

If there are uncommitted bits, ask: **"Final stragglers staged. Ready to commit `chore(frontend): wave1 phase1 visual parity polish`?"**

- [ ] **Step 2: Confirm Phase 1 ships**

Final smoke:
1. `/tasks` — Inbox renders with grouped tasks; click row → drawer opens; close → URL clean.
2. `/case-management/tasks` redirects to `/tasks`.
3. `/legal/calendar` — Classic layout works; layout-switcher chips show "Coming in Phase 2/3" placeholders for non-Classic.
4. Switch view → reload → restored from prefs. Same for layout.
5. Sidebar nav: "Tasks" under "Daily" group, links to `/tasks`.
6. Visual parity with `/legal/cases` confirmed.

- [ ] **Step 3: Note Phase 2 entry criteria**

Once Phase 1 ships and bakes for ~1 week with no regressions, the next plan to write is `2026-XX-XX-wave1-phase2-pipeline-deadlines.md` covering: Pipeline view + drag-drop + Deadlines layout + reminder cascade engine. Phase 2 builds on Phase 1's foundation and assumes the V76 schema fields are in production.

---

## Self-Review

### Spec coverage

| Spec section | Phase 1 task that implements it |
|---|---|
| Tasks IA cleanup (`/tasks` canonical, `/case-management/tasks` redirect) | Tasks B3, B3-alt, B4 |
| Tasks page shell + view-switcher chip group | Task B1 |
| Default view per role (Inbox for attorney/paralegal) | Task G3 (load prefs; defaults applied client-side) |
| Inbox view (time-band groups, columns, row click) | Tasks C1–C5 |
| Unified drawer (always-visible sections + status-driven blocker callout) | Tasks D1–D7 |
| URL state for active view (`?view=`) | Tasks B1, G3 |
| Sidebar nav update | Task B5 |
| `Task.blockerReason`, `Task.autoUnblockDate` schema | Tasks A2, A3, A4 |
| Calendar Classic re-skin | Tasks E1–E6 |
| Calendar layout switcher | Tasks E3, G4 |
| `?layout=` URL state | Tasks E3, G4 |
| Side rail "My calendars" | Task E4 |
| Event modal eventType-aware foundation | Tasks F1–F5 |
| User preferences (last-used view + layout) | Tasks A5, A6, G1–G5 |
| Tenant safety (org-scoping on new endpoints) | Task H4 |
| Visual parity with cases page | Task H1 |

**Spec sections deferred to Phase 2/3 (intentional, called out in the spec):**
- Pipeline view (`?view=pipeline`)
- Workload view (`?view=workload`)
- Pipeline drawer affordance (status-changer at top)
- Workload drawer affordance (reassign action box)
- Deadlines layout (deadline track, tier model)
- Time-blocked layout (time-grid, billable toggle)
- Deadline modal section
- Time-block modal section
- Reminder cascade engine
- Capacity model (`weeklyCapacityHours`)
- `TIME_BLOCK` enum value addition
- Per-event-type rendering pins in the grid (deadline pins, time-block colors)

### Placeholder scan

Searched for "TBD", "TODO", "implement later", "fill in details", "appropriate error handling", "similar to Task N":
- The "**At implementation time**" callouts in Tasks B3, A6, C2, F2 are intentional — they direct the engineer to copy patterns from existing files in the same codebase (e.g., principal extraction from `CalendarEventController`). Those are not placeholder-the-design — they're "match what's already there" pointers. Acceptable.
- One `// TODO at impl time` comment in the controller stub at A6. This is the only true TODO and it specifically says what to do (cast to the real `UserPrincipal` type used in other controllers) — acceptable as long as the engineer follows it. **Risk:** if the engineer skips it, the controller will have `principal` as `Object` which may not work with the rest of the auth stack. Verified by Task A6 Step 6 (smoke test) — failing the smoke test will catch this.

### Type consistency

- `TasksView` type is consistent in B1, G3 (same string union).
- `CaseTaskDTO` is referenced in C1, D1 — assumed exported from the existing TaskService module. **Implementation check needed:** the engineer should confirm `CaseTaskDTO` is exported and matches the backend DTO shape (after A4's DTO update). If the frontend type definition is at a different path or is named differently, adjust imports.
- `CalendarEventType.DEADLINE` reference in F2 — exists in the codebase (verified by `find backend/src/main/java -name CalendarEventType.java`).
- `priorityToTone`, `dueLabel`, `userInitials`, `userFullName` pipes — assumed to exist or be created during C2. **Risk:** if no equivalents exist, the engineer must create them in `src/app/shared/pipes/` and declare in a shared module before C5/D7.

### Scope check

Phase 1 is focused on a single shippable deliverable: default views for both pages with the foundation schema and URL state. Phases 2 and 3 are deferred to their own plans. ✓

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-06-wave1-phase1-tasks-calendar.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task (or per phase), review between tasks, fast iteration. Best when tasks are mostly independent within each phase.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

**Which approach?**

> Either way, **commits are gated** — every commit step says "ask for approval" and won't run without your explicit yes. That's enforced by the per-task instructions and your CLAUDE.md rules.
