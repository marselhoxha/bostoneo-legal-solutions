# Tasks List View + Modal Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the locked redesign of `/tasks` — D2 two-line row, V1 segmented-pills status stepper in the modal, per-case `billingType` driving conditional time-log UI, practice-area-driven defaults, add-only comments, activity log accordion, and a conditional Estimated Hours field on the +New task form.

**Architecture:** Single coherent change set across backend + frontend. Backend introduces `BillingType` enum + Flyway migration + denormalizes `caseBillingType` onto the task DTO so the frontend never makes a second fetch to know how to render. Frontend rewrites the row template (D2), adds the V1 stepper to the modal, gates time-log sections on `caseBillingType !== 'CONTINGENCY'`, and adds an add-only comments form + collapsed activity log. All UI state changes flow through the existing `TasksStateService` and use `Location.replaceState` for URL — no new routing primitives.

**Tech Stack:** Angular 18 (`@angular/common` `Location`, `@angular/router`, `@angular/forms`), `lucide-angular@0.453.0`, Java 17 / Spring Boot, PostgreSQL via Flyway, RxJS BehaviorSubjects.

**Spec reference:** [docs/superpowers/specs/2026-05-06-tasks-list-view-flow-design.md](../specs/2026-05-06-tasks-list-view-flow-design.md)

**Predecessors (must be in working tree before starting):**
1. Phase D follow-up — modal/cache/filters/workflows/preloader fix (uncommitted Set A bundle)
2. Preloader fix — `Location.replaceState` instead of `Router.navigate` (uncommitted)

**Phases (in order):**
- **A** — Backend data model (`BillingType` enum + Flyway migration + `LegalCase.billingType`)
- **B** — Backend DTO + service updates (`CaseTaskDTO.caseBillingType`, practice-area-driven default in case-create)
- **C** — Frontend interfaces (`BillingType` enum + `caseBillingType` on `CaseTask`)
- **D** — D2 row redesign (task-view template + SCSS)
- **E** — Row 3-dot menu: drop "Edit", add "Set due date" inline picker
- **F** — V1 segmented-pills status stepper in the modal
- **G** — Modal metadata grid swap (Status field becomes Estimated/Logged hours)
- **H** — Conditional time-log section on `caseBillingType`
- **I** — Add-only comments form + Activity log collapsed accordion
- **J** — +New task form: conditional Estimated Hours field
- **K** — Manual test pass + bundled commit gate

---

## File Structure

### Backend — Created

| Path | Responsibility |
|---|---|
| `backend/src/main/resources/db/migration/V<N>__add_billing_type_to_legal_cases.sql` | Add `billing_type VARCHAR(20)` column to `legal_cases`, backfill PI cases to CONTINGENCY, default others to HOURLY. Idempotent. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/enumeration/BillingType.java` | Enum with 4 values: `CONTINGENCY`, `HOURLY`, `FLAT_FEE`, `PRO_BONO`. |

### Backend — Modified

| Path | Change |
|---|---|
| `backend/src/main/java/com/bostoneo/bostoneosolutions/model/LegalCase.java` | Add `billingType: BillingType` field with `@Enumerated(EnumType.STRING)`. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/LegalCaseDTO.java` | Add `billingType` field. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/CaseTaskDTO.java` | Add `caseBillingType: BillingType` field (denormalized from joined case). |
| Mapper for `LegalCase` ↔ `LegalCaseDTO` (find via grep — likely `dtomapper/`) | Map `billingType` both ways. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/service/implementation/LegalCaseServiceImpl.java` | In `createCase()`, when request `billingType` is null, default by practice area: `PERSONAL_INJURY` → `CONTINGENCY`, else `HOURLY`. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/service/implementation/TaskManagementServiceImpl.java` | In `convertToDTO()`, populate `caseBillingType` from `task.getLegalCase().getBillingType()`. |

### Backend — Verify exists, add if missing

| Path | Check |
|---|---|
| Comment POST endpoint at `POST /api/case-tasks/{id}/comments` | Grep controllers for the route. If missing, add a small controller method (org-scoped, sets userId from auth principal). |

### Frontend — Modified

| Path | Change |
|---|---|
| `src/app/interface/case-task.ts` | Add `BillingType` enum export + `caseBillingType?: BillingType` field on `CaseTask`. |
| `src/app/interface/legal-case.ts` (or wherever LegalCase frontend interface lives) | Add `billingType?: BillingType`. |
| `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.html` | Rewrite row template to D2 two-line stack. Drop "Edit" from 3-dot menu. Add "Set due date" item with inline date picker. |
| `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.scss` | Replace row CSS with D2 grid + metadata strip + mini progress bar styles. |
| `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.ts` | Drop `editTask()` method. Add `setDueDate(task, ev)` method, `dueDateInput` state for the inline picker, `saveDueDate(task, dateStr)`. |
| `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.html` | Replace dropdown-style status pill with V1 segmented-pills stepper at top of body. Replace 4th metadata-grid cell (was Status) with Estimated/Logged hours summary. Wire conditional time-log section on `task.caseBillingType !== 'CONTINGENCY'`. Replace read-only comments display with add-only form. Wrap activity log in collapsed accordion (visible by default if implementation has activity log; placeholder if not). |
| `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.scss` | Add `.s1-stepper` + `.s1-step.{past,active,future}` + `.s1-offtrack` styles. Add `.activity-toggle` collapsed/expanded styles. Add `.comment-input-wrap` form styles. |
| `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.ts` | Add `submitComment(text)`, `cancelTask()`, `activityLogOpen: boolean`, `toggleActivityLog()`. Update existing `changeStatus()` to be called by stepper segments. |
| `src/app/modules/case-management/components/tasks-page/new-task-modal/new-task-modal.component.html` | Add Estimated Hours field with `*ngIf="showEstimatedHours"`. |
| `src/app/modules/case-management/components/tasks-page/new-task-modal/new-task-modal.component.ts` | Add `estimatedHours: number | null`, `showEstimatedHours` getter (reads picked case's `billingType`), include in payload on save. |
| `src/app/service/case-task.service.ts` | Add `addComment(taskId, comment): Observable<ApiResponse<TaskComment>>` that POSTs to `/api/case-tasks/{taskId}/comments`. |

### Frontend — NOT modified

- `src/app/app.component.ts` (preloader logic stays — preloader fix in predecessor handles the modal-open case).
- `src/app/component/preloader/*`.
- `TasksStateService` (no API change — `selectedId$`, `newTaskOpen$`, cache all unchanged).
- Tasks routing module.
- Pipes (`priorityToTone`, `dueLabel`, `userInitials`, `statusToTone`).
- The legacy `TaskManagementComponent`.

---

# PHASE A — Backend data model

Additive only. Deployable on its own with no frontend changes; existing frontend keeps working.

## Task A1: Verify migration version on origin/develop

**Files:**
- Read: `backend/src/main/resources/db/migration/`

- [ ] **Step 1: Check origin/develop migration head**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1
git fetch origin develop
git ls-tree -r origin/develop -- backend/src/main/resources/db/migration/ \
  | grep -oE 'V[0-9]+__' | sort -u | sort -t_ -k1.2 -n | tail -3
```

Expected: highest version visible. Note the next number (e.g., if highest is V72 on origin and V76 locally, next is V77).

- [ ] **Step 2: Check local working tree migration head**

```bash
ls backend/src/main/resources/db/migration/ \
  | grep -E '^V[0-9]+_' | sort -t_ -k1.2 -n | tail -3
```

Note this number too. **The next migration uses `max(localHead, originHead) + 1`.** Locally we may already have V76 (from the wave1 phase A commit); origin probably is at V72-V75. So next is V77.

- [ ] **Step 3: Set the version constant for the rest of this plan**

Throughout subsequent tasks, replace `V<N>` with the actual chosen number. The plan's text uses `V<N>` as a placeholder — the engineer substitutes a real value when creating the file.

## Task A2: Write `BillingType.java` enum

**Files:**
- Create: `backend/src/main/java/com/bostoneo/bostoneosolutions/enumeration/BillingType.java`

- [ ] **Step 1: Write the enum**

```java
package com.bostoneo.bostoneosolutions.enumeration;

/**
 * Billing arrangement for a legal case. Drives whether time-tracking UI
 * is surfaced on tasks linked to the case.
 *
 * - CONTINGENCY: % of recovery; common for PI. Time-log UI hidden.
 * - HOURLY: billed by the hour. Time-log UI shown.
 * - FLAT_FEE: fixed total fee. Time-log shown for internal cost tracking.
 * - PRO_BONO: no fee; time-log shown for value-given reporting.
 */
public enum BillingType {
    CONTINGENCY,
    HOURLY,
    FLAT_FEE,
    PRO_BONO
}
```

- [ ] **Step 2: Verify compile**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/backend && ./mvnw compile -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 3: DO NOT COMMIT**

Bundled commit happens at end of Phase K.

## Task A3: Write the migration file

**Files:**
- Create: `backend/src/main/resources/db/migration/V<N>__add_billing_type_to_legal_cases.sql`

- [ ] **Step 1: Inspect `legal_cases` schema first to confirm field names**

```bash
PGPASSWORD=legience_dev psql -h localhost -U legience_admin -d legience -c "\d legal_cases" | head -50
```

Note: confirm the existing column for practice area (likely `practice_area`) and confirm how PI cases identify themselves (the value will be `'PERSONAL_INJURY'` per the existing TaskType enum convention but verify by checking distinct values: `SELECT DISTINCT practice_area FROM legal_cases LIMIT 20;`).

- [ ] **Step 2: Check for `is_pro_bono` flag existence**

```bash
PGPASSWORD=legience_dev psql -h localhost -U legience_admin -d legience -c "\d legal_cases" \
  | grep -i 'pro_bono\|probono\|bono'
```

If a pro-bono flag column exists, the migration's pro-bono backfill clause uses it. If not, skip the pro-bono backfill (cases can be set to PRO_BONO manually post-migration).

- [ ] **Step 3: Write the migration SQL**

```sql
-- V<N>: Add billing_type to legal_cases, backfill defaults by practice area.
-- Spec: docs/superpowers/specs/2026-05-06-tasks-list-view-flow-design.md

-- 1. Add the column with HOURLY default (safe baseline; explicit overrides below).
ALTER TABLE legal_cases
  ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) NOT NULL DEFAULT 'HOURLY';

-- 2. Backfill PI cases to CONTINGENCY (per practice-area convention).
UPDATE legal_cases
   SET billing_type = 'CONTINGENCY'
 WHERE practice_area = 'PERSONAL_INJURY'
   AND billing_type = 'HOURLY';

-- 3. (Conditional — only if is_pro_bono column exists) Backfill pro-bono cases.
-- If is_pro_bono does not exist in this schema, REMOVE this block.
UPDATE legal_cases
   SET billing_type = 'PRO_BONO'
 WHERE is_pro_bono = TRUE
   AND billing_type = 'HOURLY';

COMMENT ON COLUMN legal_cases.billing_type IS
  'BillingType enum: CONTINGENCY | HOURLY | FLAT_FEE | PRO_BONO. Drives time-log UI visibility on tasks linked to the case.';
```

> **If `is_pro_bono` column does not exist** (Step 2 returned empty), delete the third UPDATE block before saving.

- [ ] **Step 4: Run migration locally**

```bash
PGPASSWORD=legience_dev psql -h localhost -U legience_admin -d legience \
  -f backend/src/main/resources/db/migration/V<N>__add_billing_type_to_legal_cases.sql
```

Expected: `ALTER TABLE` succeeds (or "already exists" notice). `UPDATE` reports `UPDATE N` for both backfills. `COMMENT ON` succeeds. No errors.

- [ ] **Step 5: Verify**

```bash
PGPASSWORD=legience_dev psql -h localhost -U legience_admin -d legience -c \
  "SELECT billing_type, COUNT(*) FROM legal_cases GROUP BY billing_type ORDER BY billing_type;"
```

Expected: rows for each distinct billing_type. PI cases should be CONTINGENCY, others mostly HOURLY (or PRO_BONO if `is_pro_bono` was set on any).

- [ ] **Step 6: Re-run for idempotence**

```bash
PGPASSWORD=legience_dev psql -h localhost -U legience_admin -d legience \
  -f backend/src/main/resources/db/migration/V<N>__add_billing_type_to_legal_cases.sql
```

Expected: zero errors. NOTICE "column already exists, skipping" for ALTER. UPDATEs report 0 rows changed.

- [ ] **Step 7: DO NOT COMMIT**

## Task A4: Add `billingType` to `LegalCase.java`

**Files:**
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/model/LegalCase.java`

- [ ] **Step 1: Read the current entity**

```bash
sed -n '1,50p' backend/src/main/java/com/bostoneo/bostoneosolutions/model/LegalCase.java
```

Note the existing pattern for `@Enumerated` fields (look at how `practiceArea` or any other enum is declared).

- [ ] **Step 2: Add the import + field**

In `LegalCase.java`, ensure imports include:

```java
import com.bostoneo.bostoneosolutions.enumeration.BillingType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
```

(They likely exist already — verify before adding.)

Add the field next to other enum-mapped fields (e.g., next to `practiceArea`):

```java
@Enumerated(EnumType.STRING)
@Column(name = "billing_type", nullable = false)
private BillingType billingType = BillingType.HOURLY;
```

- [ ] **Step 3: Verify compile**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/backend && ./mvnw compile -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 4: DO NOT COMMIT**

---

# PHASE B — Backend DTO + service updates

## Task B1: Add `billingType` to `LegalCaseDTO.java`

**Files:**
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/LegalCaseDTO.java`

- [ ] **Step 1: Add field**

Open `LegalCaseDTO.java`. Add `private BillingType billingType;` near the other enum fields. Add import `import com.bostoneo.bostoneosolutions.enumeration.BillingType;` if missing.

- [ ] **Step 2: Verify compile**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/backend && ./mvnw compile -q
```

## Task B2: Update LegalCase ↔ LegalCaseDTO mapper

**Files:**
- Modify: the mapper file (find via `find backend/src/main/java -name "*LegalCaseDTOMapper*" -o -name "*CaseDTOMapper*"` 2>/dev/null` — also check inline mapping in service files)

- [ ] **Step 1: Locate the mapper**

```bash
find backend/src/main/java -name "*LegalCase*Mapper*" 2>/dev/null
grep -rn "new LegalCaseDTO\|LegalCaseDTO\." backend/src/main/java | grep -v 'DTOMapper\|DTO.java' | head -10
```

If a dedicated mapper exists in `dtomapper/`, use it. Otherwise the mapping likely lives inline in `LegalCaseServiceImpl` (similar to how `TaskManagementServiceImpl.convertToDTO` works for tasks).

- [ ] **Step 2: Add `billingType` to the read path (entity → DTO)**

In the mapper or service, find the `convertToDTO` (or similar) method. Add:

```java
dto.setBillingType(legalCase.getBillingType());
```

Place it next to other field assignments.

- [ ] **Step 3: Add `billingType` to the write path (request → entity)**

If a `convertToEntity` or `applyRequest` method exists, add:

```java
if (request.getBillingType() != null) {
    legalCase.setBillingType(request.getBillingType());
}
```

- [ ] **Step 4: Verify compile**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/backend && ./mvnw compile -q
```

## Task B3: Add `billingType` to `CreateLegalCaseRequest`

**Files:**
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/CreateLegalCaseRequest.java` (or whatever the request DTO is — verify name)

- [ ] **Step 1: Locate the request DTO**

```bash
find backend/src/main/java -name "*LegalCase*Request*" -o -name "*CreateCase*"
```

- [ ] **Step 2: Add optional `billingType` field**

```java
import com.bostoneo.bostoneosolutions.enumeration.BillingType;

// Add as optional field — practice-area-driven default applied by service if null
private BillingType billingType;
```

Lombok's `@Data` (if used) handles the getter/setter. Otherwise add manual accessors.

- [ ] **Step 3: Verify compile**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/backend && ./mvnw compile -q
```

## Task B4: Practice-area-driven default in `LegalCaseServiceImpl.createCase`

**Files:**
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/service/implementation/LegalCaseServiceImpl.java`

- [ ] **Step 1: Locate `createCase` method**

```bash
grep -n "createCase\|public LegalCase create\|public LegalCaseDTO create" \
  backend/src/main/java/com/bostoneo/bostoneosolutions/service/implementation/LegalCaseServiceImpl.java
```

- [ ] **Step 2: Add the default-resolution helper**

In the same file, add a private helper method:

```java
import com.bostoneo.bostoneosolutions.enumeration.BillingType;
import com.bostoneo.bostoneosolutions.enumeration.PracticeArea;

private static BillingType defaultBillingTypeFor(PracticeArea practiceArea) {
    if (practiceArea == PracticeArea.PERSONAL_INJURY) {
        return BillingType.CONTINGENCY;
    }
    return BillingType.HOURLY;
}
```

(Adjust to actual enum names. If practice area is a String, adapt the comparison.)

- [ ] **Step 3: Apply the default in `createCase`**

In the create method, after the request is unwrapped but before the entity is saved, add:

```java
if (legalCase.getBillingType() == null) {
    legalCase.setBillingType(defaultBillingTypeFor(legalCase.getPracticeArea()));
}
```

- [ ] **Step 4: Verify compile**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/backend && ./mvnw compile -q
```

## Task B5: Add `caseBillingType` to `CaseTaskDTO`

**Files:**
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/CaseTaskDTO.java`

- [ ] **Step 1: Add field**

```java
import com.bostoneo.bostoneosolutions.enumeration.BillingType;

// Denormalized from the joined case for fast frontend rendering.
private BillingType caseBillingType;
```

- [ ] **Step 2: Verify compile**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/backend && ./mvnw compile -q
```

## Task B6: Populate `caseBillingType` in `TaskManagementServiceImpl.convertToDTO`

**Files:**
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/service/implementation/TaskManagementServiceImpl.java`

- [ ] **Step 1: Locate `convertToDTO`**

```bash
grep -n "convertToDTO\|CaseTaskDTO.builder" \
  backend/src/main/java/com/bostoneo/bostoneosolutions/service/implementation/TaskManagementServiceImpl.java
```

The method is around line 961 (per prior session notes, but verify).

- [ ] **Step 2: Add the field assignment**

In `convertToDTO`, after the `legalCase` field is set (or wherever the joined case info is read), add:

```java
.caseBillingType(task.getLegalCase() != null ? task.getLegalCase().getBillingType() : null)
```

If the builder pattern isn't used and it's manual setters:

```java
if (task.getLegalCase() != null) {
    dto.setCaseBillingType(task.getLegalCase().getBillingType());
}
```

- [ ] **Step 3: Verify compile + smoke test**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/backend && ./mvnw compile -q
```

If the dev backend is running, hit a task endpoint:

```bash
curl -s -H "Authorization: Bearer <token>" http://localhost:8080/api/case-tasks/<taskId> | jq '.data.task.caseBillingType'
```

Expected: a string like `"CONTINGENCY"` or `"HOURLY"`.

> **If you don't have a token handy**, skip the curl test for now — the manual test pass in Phase K covers it.

## Task B7: Verify comment POST endpoint exists

**Files:**
- Read: backend controllers

- [ ] **Step 1: Search for the route**

```bash
grep -rn 'comments\|Comment' backend/src/main/java/com/bostoneo/bostoneosolutions/controller/ \
  | grep -i 'PostMapping\|@RequestMapping'
```

- [ ] **Step 2: Verify behavior**

If a `POST /api/case-tasks/{id}/comments` endpoint exists, verify:
- It validates user is in the case's organization (tenant scoping).
- It sets `userId` from auth principal.
- It persists `comment` text from request body.

If verified working, proceed.

If MISSING, add a small task before continuing — see Task B7-alt below.

### Task B7-alt: Add comment POST endpoint (only if Step 1 found nothing)

**Files:**
- Create or modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/controller/CaseTaskCommentController.java` (new) OR add to existing `CaseTaskController.java`

- [ ] **Write the controller method**

```java
@PostMapping("/api/case-tasks/{taskId}/comments")
public ResponseEntity<ApiResponse<TaskComment>> addComment(
        @PathVariable Long taskId,
        @AuthenticationPrincipal UserDTO user,
        @RequestBody Map<String, String> body) {

    Long orgId = TenantContext.getCurrentTenant();
    if (user == null || orgId == null) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

    String comment = body.get("comment");
    if (comment == null || comment.isBlank()) {
        return ResponseEntity.badRequest().build();
    }

    TaskComment saved = taskCommentService.addComment(taskId, user.getId(), orgId, comment.trim());
    return ResponseEntity.ok(ApiResponse.<TaskComment>builder().data(saved).build());
}
```

(Adjust to your `ApiResponse` shape and the existing `TaskCommentService` if any. If no service exists, create a small one that validates `task.organizationId == currentOrg` before persisting.)

- [ ] **Verify compile + idempotency**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1/backend && ./mvnw compile -q
```

---

# PHASE C — Frontend interfaces

## Task C1: Add `BillingType` enum + `caseBillingType` to CaseTask interface

**Files:**
- Modify: `src/app/interface/case-task.ts`

- [ ] **Step 1: Add the enum at the top of the file (after existing enum exports)**

```ts
export enum BillingType {
  CONTINGENCY = 'CONTINGENCY',
  HOURLY      = 'HOURLY',
  FLAT_FEE    = 'FLAT_FEE',
  PRO_BONO    = 'PRO_BONO',
}
```

- [ ] **Step 2: Add `caseBillingType` to `CaseTask` interface**

Find the `CaseTask` interface declaration. Add:

```ts
caseBillingType?: BillingType;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

Expected: zero new errors.

## Task C2: Add `billingType` to LegalCase frontend interface

**Files:**
- Modify: `src/app/interface/legal-case.ts` (or whichever file holds the `LegalCase` frontend type — find via `find src/app -name "legal-case*.ts"`)

- [ ] **Step 1: Find the file**

```bash
find src/app -name "legal-case*.ts" 2>/dev/null | head
grep -rn "interface LegalCase\b\|export interface Case\b" src/app | head
```

- [ ] **Step 2: Import `BillingType` and add the field**

```ts
import { BillingType } from '@app/interface/case-task';

// inside LegalCase interface:
billingType?: BillingType;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

---

# PHASE D — D2 row redesign (task-view template + SCSS)

## Task D1: Rewrite `task-view.component.html` row template

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.html`

- [ ] **Step 1: Locate the existing `t-row` template**

```bash
grep -n "t-row\|class=\"t-row" src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.html
```

Find the `*ngFor="let task of group.tasks"` block.

- [ ] **Step 2: Replace the row markup with the D2 two-line stack**

Replace the existing `<div class="t-row">` block (and its children) with:

```html
<div
  class="t-row"
  *ngFor="let task of group.tasks; trackBy: trackById"
  [class.selected]="task.id === selectedTaskId"
  (click)="selectTask(task)"
>
  <div class="t-checkbox" [class.checked]="task.status === 'COMPLETED'"></div>

  <div class="t-main">
    <div class="t-title" [class.done]="task.status === 'COMPLETED' || task.status === 'CANCELLED'">
      {{ task.title }}
    </div>
    <div class="t-meta">
      <span class="case-pill" *ngIf="task.caseTitle || task.caseNumber">
        <span class="case-dot" [style.background]="caseDotColor(task)"></span>
        {{ task.caseTitle || task.caseNumber }}
      </span>

      <span class="meta-item subtasks" *ngIf="task.subtasks?.length; else noSubtasks">
        <i-lucide name="check-square" [size]="12"></i-lucide>
        {{ doneSubtaskCount(task) }}/{{ task.subtasks?.length }}
        <span class="mini-bar">
          <span class="fill" [class.complete]="doneSubtaskCount(task) === task.subtasks?.length"
                [style.width.%]="task.subtasks?.length ? (doneSubtaskCount(task) / task.subtasks!.length) * 100 : 0"></span>
        </span>
      </span>
      <ng-template #noSubtasks>
        <span class="meta-item muted">no subtasks</span>
      </ng-template>

      <span class="meta-item time-logged" *ngIf="task.caseBillingType !== 'CONTINGENCY' && task.actualHours != null">
        <i-lucide name="clock" [size]="12"></i-lucide>
        {{ task.actualHours }}h<ng-container *ngIf="task.estimatedHours"> / {{ task.estimatedHours }}h est</ng-container>
      </span>

      <span class="meta-item due"
            [class.overdue]="group.key === 'overdue'"
            [class.today]="group.key === 'today'">
        {{ task.dueDate | dueLabel }}
      </span>
    </div>
  </div>

  <span class="pill" [ngClass]="'pill-' + (task.priority | priorityToTone)">
    <span class="dot"></span>{{ task.priority | titlecase }}
  </span>

  <div
    class="av-ringed"
    *ngIf="task.assignedToName as name"
    [style.--ring]="avatarColor(task.assignedToId ?? name)"
    [style.--bg]="avatarColor(task.assignedToId ?? name)"
  >
    <div class="inner"><div class="content">{{ name | userInitials }}</div></div>
  </div>

  <div class="row-action-wrap" (click)="swallow($event)">
    <button
      type="button"
      class="btn btn-ghost btn-icon"
      (click)="toggleRowMenu(task.id, $event)"
      aria-label="Task actions"
    >
      <i-lucide name="more-horizontal" [size]="14"></i-lucide>
    </button>
    <!-- 3-dot menu items wired in Phase E -->
  </div>
</div>
```

- [ ] **Step 3: Add the `doneSubtaskCount(task)` helper method to component .ts**

Open `task-view.component.ts`. Add this method (next to other helpers like `caseDotColor`):

```ts
doneSubtaskCount(task: CaseTask): number {
  return task.subtasks?.filter(s => (s.status as unknown as string) === 'COMPLETED').length ?? 0;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

Expected: zero new errors. (The existing 3-dot menu items remain — they're updated in Phase E.)

## Task D2: Replace `task-view.component.scss` row styles with D2 layout

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.scss`

- [ ] **Step 1: Find the existing `.t-row` block**

```bash
grep -n "\.t-row\|\.t-title\|\.case-pill" src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.scss | head
```

- [ ] **Step 2: Replace the row styles**

Find the existing `.t-row { ... }` block and replace it with:

```scss
.t-row {
  display: grid;
  grid-template-columns: 22px 1fr auto auto auto;
  align-items: center;
  gap: 14px;
  padding: 14px 28px;
  border-top: 1px solid var(--legience-border-hairline);
  cursor: pointer;
  transition: background 100ms ease;

  &:hover { background: var(--legience-bg-row-hover); }
  &.selected { background: var(--legience-accent-bg-subtle); }
}

.t-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.t-title {
  font: 500 14px/1.3 var(--legience-font-sans);
  color: var(--legience-text-primary);
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.done {
    text-decoration: line-through;
    color: var(--legience-text-muted);
  }
}

.t-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  font: 500 11.5px/1 var(--legience-font-sans);
  color: var(--legience-text-muted);
}

.t-meta .meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.t-meta .meta-item.muted {
  color: var(--legience-text-muted);
  font-style: italic;
}

.t-meta .meta-item.due.overdue {
  color: var(--legience-danger);
  font-weight: 600;
}

.t-meta .meta-item.due.today {
  color: var(--legience-accent);
  font-weight: 600;
}

.t-meta .subtasks .mini-bar {
  display: inline-block;
  width: 60px;
  height: 4px;
  background: var(--legience-bg-subtle);
  border-radius: 99px;
  overflow: hidden;
  margin-left: 4px;
}

.t-meta .subtasks .mini-bar .fill {
  display: block;
  height: 100%;
  background: var(--legience-accent);
  border-radius: 99px;
  transition: width 200ms ease;
}

.t-meta .subtasks .mini-bar .fill.complete {
  background: var(--legience-success);
}
```

- [ ] **Step 3: Confirm no `*` selectors remain in template comments** (Angular gotcha)

```bash
grep -nF '/*' src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.html
```

Expected: empty (no `/* */` inside Angular bindings).

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

## Task D3: Register Lucide icons used in the new row

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/tasks.module.ts`

- [ ] **Step 1: Add `CheckSquare` and `Clock` to the LucideAngularModule.pick block**

Find the existing `LucideAngularModule.pick({ ... })` import in `tasks.module.ts`. Add `CheckSquare, Clock` to the icon list (and to the `import` line at the top):

```ts
import {
  LucideAngularModule,
  Search, Filter, Plus, MoreHorizontal, Check, Pencil, Trash2,
  UserPlus, X, ChevronDown, Play, LayoutList, AlertCircle, Calendar,
  CheckSquare, Clock,    // ← NEW
} from 'lucide-angular';
```

And in the `imports: [LucideAngularModule.pick({ ... })]`:

```ts
LucideAngularModule.pick({
  Search, Filter, Plus, MoreHorizontal, Check, Pencil, Trash2,
  UserPlus, X, ChevronDown, Play, LayoutList, AlertCircle, Calendar,
  CheckSquare, Clock,
}),
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

---

# PHASE E — Row 3-dot menu: drop "Edit", add "Set due date" inline picker

## Task E1: Update template — drop Edit, add Set Due Date item

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.html`

- [ ] **Step 1: Find the row-menu dropdown markup**

```bash
grep -n "row-menu\|markComplete\|editTask\|reassignFromRow" src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.html
```

- [ ] **Step 2: Replace the menu items**

Inside the `<div class="dropdown-menu row-menu" *ngIf="openRowMenuId === task.id">` block, replace the existing items with:

```html
<div class="dd-item" (click)="markComplete(task, $event)">
  <i-lucide name="check" [size]="14"></i-lucide>
  <span class="dd-label">Mark complete</span>
</div>

<div class="dd-item" (click)="openSetDueDate(task, $event)">
  <i-lucide name="calendar" [size]="14"></i-lucide>
  <span class="dd-label">Set due date</span>
</div>

<div class="dd-item" (click)="reassignFromRow(task, $event)">
  <i-lucide name="user-plus" [size]="14"></i-lucide>
  <span class="dd-label">Reassign…</span>
</div>

<div class="dd-sep"></div>

<div class="dd-item danger" (click)="deleteTask(task, $event)">
  <i-lucide name="trash-2" [size]="14"></i-lucide>
  <span class="dd-label">Delete</span>
</div>

<!-- Inline date picker (anchored under "Set due date" when openSetDueDateId === task.id) -->
<div class="set-due-popover" *ngIf="openSetDueDateId === task.id" (click)="swallow($event)">
  <input
    type="date"
    class="set-due-input"
    [value]="setDueDateValue"
    (change)="saveDueDate(task, $any($event.target).value)"
    autofocus
  />
</div>
```

The existing "Edit" item is removed.

## Task E2: Update component — add Set Due Date logic

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.ts`

- [ ] **Step 1: Drop `editTask()` method**

Find and delete the `editTask(task, ev)` method.

- [ ] **Step 2: Add Set Due Date state + methods**

Add to the component class (next to `openRowMenuId`):

```ts
openSetDueDateId: number | null = null;
setDueDateValue: string = '';

openSetDueDate(task: CaseTask, ev: Event): void {
  ev.stopPropagation();
  this.openSetDueDateId = task.id;
  // Initialize the input with the current due date in YYYY-MM-DD format
  if (task.dueDate) {
    const d = new Date(task.dueDate as any);
    this.setDueDateValue = d.toISOString().substring(0, 10);
  } else {
    this.setDueDateValue = '';
  }
}

saveDueDate(task: CaseTask, dateStr: string): void {
  if (!task.id || !dateStr) return;

  // PATCH the task with the new due date
  this.taskService
    .updateTask(task.id, { dueDate: new Date(dateStr) } as any)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response: any) => {
        const updated = response?.data?.task ?? response?.data;
        if (updated) {
          // Update local state
          this.allTasks = this.allTasks.map(t => t.id === task.id ? { ...t, dueDate: new Date(dateStr) } : t);
          this.state.upsert({ ...task, dueDate: new Date(dateStr) } as any);
          this.applyFilters();
        }
        this.openSetDueDateId = null;
        this.openRowMenuId = null;
      },
      error: (err: any) => {
        console.error('Failed to set due date', err);
        this.openSetDueDateId = null;
      },
    });
}
```

> **Verify**: the `CaseTaskService` has an `updateTask(id, partialUpdate)` method. If not, use the existing service method that does this (`grep -n "updateTask\b" src/app/service/case-task.service.ts`).

- [ ] **Step 3: Update document-click handler to also close Set Due Date popover**

Find the existing `@HostListener('document:click', ['$event'])` method. Add `this.openSetDueDateId = null;` to its body.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

## Task E3: Add Set Due Date popover styles

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/views/task-view/task-view.component.scss`

- [ ] **Step 1: Add popover styles**

Append to the file:

```scss
.set-due-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 60;
  background: var(--legience-bg-elevated);
  border: 1px solid var(--legience-border-hairline);
  border-radius: 8px;
  box-shadow: 0 12px 32px -8px rgba(0,0,0,0.18), 0 4px 12px -4px rgba(0,0,0,0.10);
  padding: 8px;
}

.set-due-input {
  background: var(--legience-bg-elevated);
  border: 1px solid var(--legience-border-hairline);
  border-radius: 6px;
  padding: 6px 10px;
  font: 400 13px/1.4 var(--legience-font-sans);
  color: var(--legience-text-primary);
}
```

---

# PHASE F — V1 segmented-pills status stepper in the modal

## Task F1: Add stepper template

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.html`

- [ ] **Step 1: Locate the modal `<aside class="t-drawer">` opening + header**

```bash
grep -n "t-drawer\|drawer-head\|status-trigger" src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.html | head -10
```

- [ ] **Step 2: Insert the stepper between the header and the row-stack**

After the `<header class="drawer-head">` closing `</header>`, BEFORE the existing row-stack `.row-stack` div, insert:

```html
<!-- Status stepper (V1 Segmented Pills) — sits between header and metadata -->
<div class="s1-wrap">
  <div class="s1-stepper">
    <button type="button"
            class="s1-step"
            [class.past]="isStepPast('TODO')"
            [class.active]="task.status === 'TODO'"
            [class.future]="isStepFuture('TODO')"
            (click)="changeStatus(TaskStatusEnum.TODO, $event)">
      <span class="step-tick"><i-lucide *ngIf="isStepPast('TODO')" name="check" [size]="9"></i-lucide></span>
      Todo
    </button>
    <button type="button"
            class="s1-step"
            [class.past]="isStepPast('IN_PROGRESS')"
            [class.active]="task.status === 'IN_PROGRESS'"
            [class.future]="isStepFuture('IN_PROGRESS')"
            (click)="changeStatus(TaskStatusEnum.IN_PROGRESS, $event)">
      <span class="step-tick"><i-lucide *ngIf="isStepPast('IN_PROGRESS')" name="check" [size]="9"></i-lucide></span>
      In progress
    </button>
    <button type="button"
            class="s1-step"
            [class.past]="isStepPast('REVIEW')"
            [class.active]="task.status === 'REVIEW'"
            [class.future]="isStepFuture('REVIEW')"
            (click)="changeStatus(TaskStatusEnum.REVIEW, $event)">
      <span class="step-tick"><i-lucide *ngIf="isStepPast('REVIEW')" name="check" [size]="9"></i-lucide></span>
      Review
    </button>
    <button type="button"
            class="s1-step"
            [class.past]="isStepPast('COMPLETED')"
            [class.active]="task.status === 'COMPLETED'"
            [class.future]="isStepFuture('COMPLETED')"
            (click)="changeStatus(TaskStatusEnum.COMPLETED, $event)">
      <span class="step-tick"><i-lucide *ngIf="isStepPast('COMPLETED')" name="check" [size]="9"></i-lucide></span>
      Completed
    </button>
  </div>
  <div class="s1-offtrack">
    <a href="javascript:void(0)" class="danger" (click)="openBlockerPrompt()">
      <i-lucide name="alert-circle" [size]="11"></i-lucide> Mark blocked
    </a>
    <a href="javascript:void(0)" (click)="cancelTask($event)">Cancel</a>
  </div>
</div>
```

## Task F2: Add stepper helper methods + cancelTask

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.ts`

- [ ] **Step 1: Add `TaskStatusEnum` reference + step ordering**

Near the top of the component class:

```ts
// Expose enum to the template
readonly TaskStatusEnum = TaskStatus;

// Forward lifecycle order — used by stepper to compute past/active/future
private readonly forwardOrder: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.REVIEW,
  TaskStatus.COMPLETED,
];
```

- [ ] **Step 2: Add `isStepPast` / `isStepFuture` helpers**

```ts
isStepPast(stepStatus: string): boolean {
  if (!this.task) return false;
  const currentIdx = this.forwardOrder.indexOf(this.task.status as TaskStatus);
  const stepIdx = this.forwardOrder.indexOf(stepStatus as TaskStatus);
  // Off-track statuses (BLOCKED, CANCELLED) → no step is "past"
  if (currentIdx < 0) return false;
  return stepIdx < currentIdx;
}

isStepFuture(stepStatus: string): boolean {
  if (!this.task) return false;
  const currentIdx = this.forwardOrder.indexOf(this.task.status as TaskStatus);
  const stepIdx = this.forwardOrder.indexOf(stepStatus as TaskStatus);
  // Off-track statuses → all forward steps are future
  if (currentIdx < 0) return true;
  return stepIdx > currentIdx;
}
```

- [ ] **Step 3: Add `cancelTask` method**

```ts
cancelTask(ev: Event): void {
  ev.stopPropagation();
  if (!this.task) return;
  if (!confirm(`Cancel task "${this.task.title}"? This will mark it as CANCELLED.`)) return;
  this.persistStatus(TaskStatus.CANCELLED);
}
```

- [ ] **Step 4: Confirm `openBlockerPrompt` already exists**

Open the file, search for `openBlockerPrompt`. It should already exist from the predecessor's Phase D follow-up implementation. If somehow missing, add a stub that opens the existing blocker prompt modal (look for `blockerPromptOpen` boolean).

- [ ] **Step 5: Remove the OLD status-trigger dropdown markup**

Open `task-drawer.component.html`. Find the `<div class="status-wrap">` block inside the metadata grid (around line 108). It contains the OLD status pill + dropdown menu. **Delete the entire `<div class="status-wrap">...</div>` block.** The status field is now represented by the stepper (Phase F1) and the metadata grid loses its 4th cell — Phase G replaces it with the Estimated/Logged hours summary.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

## Task F3: Add stepper SCSS

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.scss`

- [ ] **Step 1: Append the stepper styles**

```scss
// ── Status stepper (V1 Segmented Pills) ─────────────────────
.s1-wrap {
  padding: 14px 24px;
  background: var(--legience-bg-card-hover);
  border-bottom: 1px solid var(--legience-border-hairline);
  margin: -22px -24px 18px;   // pull to modal edges; offset modal-body padding
}

.s1-stepper {
  display: flex; gap: 4px;
  background: var(--legience-bg-elevated);
  border: 1px solid var(--legience-border-hairline);
  border-radius: var(--legience-radius-buttons, 8px);
  padding: 3px;
}

.s1-step {
  flex: 1;
  padding: 7px 10px;
  border: none;
  background: transparent;
  border-radius: var(--legience-radius, 6px);
  font: 500 12px/1 var(--legience-font-sans);
  display: flex; align-items: center; justify-content: center; gap: 5px;
  cursor: pointer;
  color: var(--legience-text-muted);

  .step-tick {
    width: 14px; height: 14px;
    border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 9px;
    border: 1.5px solid var(--legience-border-emphasis);
    background: transparent;
  }
}

.s1-step.past {
  color: var(--legience-success);
  background: var(--legience-success-bg-subtle);

  .step-tick { background: var(--legience-success); border-color: var(--legience-success); color: #fff; }
}

.s1-step.active {
  color: var(--legience-accent);
  font-weight: 600;
  background: var(--legience-accent-bg-subtle);
  border: 1px solid rgba(var(--legience-accent-rgb), 0.30);
  padding: 6px 9px;   // compensate for border so height matches future steps

  .step-tick { background: var(--legience-accent); border-color: var(--legience-accent); color: #fff; }
}

.s1-offtrack {
  display: flex; align-items: center; gap: 14px;
  margin-top: 10px;
  font: 500 11.5px/1 var(--legience-font-sans);

  a {
    color: var(--legience-text-subtle);
    text-decoration: none;
    cursor: pointer;
    display: inline-flex; align-items: center; gap: 4px;
  }
  a:hover { color: var(--legience-text-primary); text-decoration: underline; }
  a.danger { color: var(--legience-danger); }
  a.danger:hover { color: var(--legience-danger); }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

---

# PHASE G — Modal metadata grid swap (Status cell → Estimated/Logged hours)

## Task G1: Update metadata grid

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.html`

- [ ] **Step 1: Locate the existing 2x2 metadata grid**

```bash
grep -n "grid-2\|field-label" src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.html | head
```

- [ ] **Step 2: Replace the 4th cell content (the Status one — already deleted in Phase F2 Step 5; replace with hours summary)**

After the Assignee cell, add:

```html
<!-- 4th cell: Estimated / Logged hours (when billable) OR Created date (when contingency) -->
<div *ngIf="task.caseBillingType !== 'CONTINGENCY'; else createdCell">
  <div class="field-label">
    Estimated <ng-container *ngIf="task.estimatedHours">· {{ task.estimatedHours }}h</ng-container>
  </div>
  <div class="field-value">
    <ng-container *ngIf="task.actualHours; else noActual">
      {{ task.actualHours }}h logged<ng-container *ngIf="task.estimatedHours">
        · {{ (task.estimatedHours - (task.actualHours || 0)) | number:'1.0-1' }}h remaining
      </ng-container>
    </ng-container>
    <ng-template #noActual>
      <span class="muted">No time logged yet</span>
    </ng-template>
  </div>
</div>
<ng-template #createdCell>
  <div>
    <div class="field-label">Created</div>
    <div class="field-value">{{ task.createdAt | date:'mediumDate' }}</div>
  </div>
</ng-template>
```

---

# PHASE H — Conditional time-log section + add-only comments + activity log

## Task H1: Wire conditional time-log section

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.html`

- [ ] **Step 1: Locate existing time-logged section**

```bash
grep -n "Time logged\|time-row" src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.html | head
```

- [ ] **Step 2: Add `*ngIf` to the section**

Wrap the entire `<div class="drawer-section">` block that contains "Time logged" with:

```html
<div class="drawer-section" *ngIf="task.caseBillingType !== 'CONTINGENCY'">
  <!-- existing time-logged contents -->
</div>
```

(Replace the existing `<div class="drawer-section">` opening tag.)

## Task H2: Wire add-only comments form

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.html`
- Modify: `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.ts`
- Modify: `src/app/service/case-task.service.ts`

- [ ] **Step 1: Add `addComment` method to `CaseTaskService`**

Open `src/app/service/case-task.service.ts`. Add the method (next to other CRUD methods):

```ts
addComment(taskId: number, comment: string): Observable<ApiResponse<TaskComment>> {
  return this.http.post<ApiResponse<TaskComment>>(
    `${this.baseUrl}/${taskId}/comments`,
    { comment }
  );
}
```

(Adjust `baseUrl` and types to match the service's existing pattern.)

- [ ] **Step 2: Add textarea + submit button to comments section template**

In `task-drawer.component.html`, find the comments section. After the `*ngFor="let c of task.comments"` loop, add:

```html
<div class="comment-input-wrap">
  <textarea
    class="comment-input"
    [(ngModel)]="newCommentText"
    placeholder="Add a comment…"
    rows="2"
    (keydown.enter)="onCommentEnter($event)"
  ></textarea>
  <button
    type="button"
    class="btn btn-primary btn-sm"
    [disabled]="!newCommentText.trim() || commentSubmitting"
    (click)="submitComment()"
  >
    {{ commentSubmitting ? 'Submitting…' : 'Submit' }}
  </button>
</div>
```

Also update the section's outer `*ngIf` to ALWAYS show the section (was conditional on comments existing):

```html
<div class="drawer-section">
  <div class="sec-head"><span class="title">Comments<span *ngIf="task.comments?.length"> · {{ task.comments?.length }}</span></span></div>
  <!-- existing comment loop -->
  <!-- new textarea + submit -->
</div>
```

- [ ] **Step 3: Add `submitComment` method to drawer component**

Open `task-drawer.component.ts`. Add:

```ts
newCommentText = '';
commentSubmitting = false;

submitComment(): void {
  const text = this.newCommentText.trim();
  if (!text || this.commentSubmitting || !this.task?.id) return;

  this.commentSubmitting = true;
  this.taskService.addComment(this.task.id, text)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response: any) => {
        const newComment = response?.data?.comment ?? response?.data ?? null;
        if (newComment && this.task) {
          this.task.comments = [...(this.task.comments || []), newComment];
          this.state.upsert(this.task);
        }
        this.newCommentText = '';
        this.commentSubmitting = false;
      },
      error: (err: any) => {
        console.error('Failed to add comment', err);
        this.commentSubmitting = false;
      },
    });
}

onCommentEnter(ev: KeyboardEvent): void {
  // Ctrl/Cmd+Enter submits; plain Enter inserts newline (default behavior)
  if (ev.ctrlKey || ev.metaKey) {
    ev.preventDefault();
    this.submitComment();
  }
}
```

- [ ] **Step 4: Add SCSS for the comment input**

In `task-drawer.component.scss`:

```scss
.comment-input-wrap {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--legience-border-hairline);
}

.comment-input {
  flex: 1;
  border: 1px solid var(--legience-border-hairline);
  border-radius: var(--legience-radius, 6px);
  background: var(--legience-bg-elevated);
  padding: 8px 12px;
  font: 400 13px/1.4 var(--legience-font-sans);
  color: var(--legience-text-primary);
  resize: vertical;
  min-height: 56px;

  &:focus {
    outline: 2px solid rgba(var(--legience-accent-rgb), 0.30);
    outline-offset: -1px;
    border-color: var(--legience-accent);
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

## Task H3: Add Activity log accordion

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.html`
- Modify: `src/app/modules/case-management/components/tasks-page/task-drawer/task-drawer.component.ts`

- [ ] **Step 1: Add toggle state + method**

In `task-drawer.component.ts`:

```ts
activityLogOpen = false;

toggleActivityLog(): void {
  this.activityLogOpen = !this.activityLogOpen;
}
```

- [ ] **Step 2: Append accordion to modal body (before closing `</aside>`)**

In `task-drawer.component.html`, after the comments `<div class="drawer-section">`, add:

```html
<button type="button" class="activity-toggle" (click)="toggleActivityLog()">
  <span>Activity history<span *ngIf="task.activityLog?.length"> · {{ task.activityLog?.length }} events</span></span>
  <i-lucide [name]="activityLogOpen ? 'chevron-up' : 'chevron-down'" [size]="14"></i-lucide>
</button>

<div class="activity-list" *ngIf="activityLogOpen">
  <div class="activity-empty" *ngIf="!task.activityLog?.length">
    Activity log not yet enabled.
  </div>
  <div class="activity-row" *ngFor="let event of task.activityLog">
    <div class="activity-meta">
      <strong>{{ event.author }}</strong> {{ event.action }} · {{ event.timestamp | date:'short' }}
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add SCSS**

```scss
.activity-toggle {
  display: flex; align-items: center; justify-content: space-between;
  background: transparent; border: none;
  width: 100%; padding: 12px 0;
  margin-top: 4px; border-top: 1px solid var(--legience-border-hairline);
  font: 600 12px/1 var(--legience-font-sans);
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--legience-text-subtle); cursor: pointer;

  &:hover { color: var(--legience-text-primary); }
}

.activity-list {
  padding: 8px 0 14px;
  font: 400 12.5px/1.6 var(--legience-font-sans);
  color: var(--legience-text-secondary);
}

.activity-row + .activity-row { margin-top: 6px; }

.activity-empty {
  font-style: italic;
  color: var(--legience-text-muted);
}
```

- [ ] **Step 4: Add `chevron-up` to Lucide pick (if not already)**

In `tasks.module.ts`, add `ChevronUp` to the icon import + pick:

```ts
import {
  // … existing icons
  ChevronUp,
} from 'lucide-angular';

// in pick({}):
ChevronUp,
```

- [ ] **Step 5: Add optional `activityLog?: ActivityEvent[]` to `CaseTask` interface**

In `src/app/interface/case-task.ts`:

```ts
export interface ActivityEvent {
  author?: string;
  action?: string;
  timestamp?: Date | string;
}

// in CaseTask:
activityLog?: ActivityEvent[];
```

(Frontend type only — for now, Phase 1 ships with the activity log usually empty since the audit-log infrastructure may not exist. Open Question #1 in the spec.)

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

---

# PHASE J — +New task form: conditional Estimated Hours

## Task J1: Add Estimated Hours field

**Files:**
- Modify: `src/app/modules/case-management/components/tasks-page/new-task-modal/new-task-modal.component.html`
- Modify: `src/app/modules/case-management/components/tasks-page/new-task-modal/new-task-modal.component.ts`

- [ ] **Step 1: Add state in component**

In `new-task-modal.component.ts`, add to component class:

```ts
estimatedHours: number | null = null;

get pickedCase(): { id: number; billingType?: BillingType } | undefined {
  return this.cases.find(c => c.id === this.caseId) as any;
}

get showEstimatedHours(): boolean {
  return this.pickedCase?.billingType !== 'CONTINGENCY';
}
```

Add `BillingType` import: `import { BillingType } from '@app/interface/case-task';`

- [ ] **Step 2: Add the field to template**

In `new-task-modal.component.html`, add after the Due Date field:

```html
<div class="field" *ngIf="showEstimatedHours">
  <label for="estimatedHours">Estimated hours</label>
  <input
    type="number"
    id="estimatedHours"
    class="form-input"
    [(ngModel)]="estimatedHours"
    name="estimatedHours"
    min="0"
    step="0.25"
    placeholder="0.0"
  />
</div>
```

- [ ] **Step 3: Include in payload on save**

Find the `save()` method's payload construction. Add:

```ts
...(this.estimatedHours != null && this.estimatedHours > 0 ? { estimatedHours: this.estimatedHours } : {}),
```

- [ ] **Step 4: Reset on resetForm**

In `resetForm()`, add: `this.estimatedHours = null;`

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
```

---

# PHASE K — Manual test pass + bundled commit gate

This is the gate. The user runs each test in their browser. Only when all 21 from the spec pass do we commit.

## Task K1: Restart dev server (if needed)

- [ ] **Step 1: Confirm dev server is running**

If `ng serve` is running, the hot-reload should pick up the changes automatically. If the user is seeing stale behavior, hard-refresh the browser tab.

## Task K2: User runs the 21-step test plan from the spec

- [ ] **Step 1: User confirms each test passes**

Tests are in `docs/superpowers/specs/2026-05-06-tasks-list-view-flow-design.md` under "Verification / test plan". Numbered 1-21 (15 frontend, 6 backend).

If any fails: investigate, fix, re-test. Do not commit until all 21 pass.

## Task K3: Propose bundled commit

- [ ] **Step 1: Show user the file list**

```bash
git -C /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 status --short
```

Bundle should include:
- All Phase D follow-up files (predecessor — already in tree)
- All preloader fix files (predecessor — already in tree)
- All Phase A–J files from this plan
- Spec + plan files

- [ ] **Step 2: Propose commit message**

```
feat: tasks list view + modal flow — D2 row, V1 stepper, billingType, comments

Bundles three coherent changes that ship together:

1. Phase D follow-up (modal + cache + filters + workflows + Lucide + buttons +
   inbox-view→task-view rename)
2. Preloader fix — modal opens via Location.replaceState so global preloader
   doesn't fire on row clicks
3. Tasks list view + modal flow — D2 two-line row, V1 segmented-pills status
   stepper, per-case billingType driving conditional time-log UI, practice-
   area-driven defaults, +New task estimated hours conditional, add-only
   comments, activity log accordion

Backend additions: BillingType enum, V<N> migration with practice-area-driven
backfill, LegalCase.billingType, CaseTaskDTO.caseBillingType, +New comment
POST endpoint (verified existing or added).

Pipeline view, Workload view, Start Timer end-to-end wiring deferred to
separate brainstorm cycles.

Specs: docs/superpowers/specs/2026-05-06-tasks-list-view-flow-design.md
       docs/superpowers/specs/2026-05-06-tasks-modal-no-preloader-design.md
Plans: docs/superpowers/plans/2026-05-06-tasks-list-view-flow.md
       docs/superpowers/plans/2026-05-06-tasks-modal-no-preloader.md
```

- [ ] **Step 3: Wait for user "commit" approval per CLAUDE.md, then run**

```bash
git -C /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 add \
  <list of paths>
git -C /Users/marsel/dev/bostoneo-legal-solutions/bostoneosolutionsapp1 commit -m "<message above via heredoc>"
```

---

## Self-Review

### Spec coverage

| Spec section | Plan task |
|---|---|
| `LegalCase.billingType` enum + migration | Tasks A1–A4 |
| Practice-area-driven default in case-create | Task B4 |
| `CaseTaskDTO.caseBillingType` denormalized | Tasks B5–B6 |
| Comment POST endpoint verified/added | Task B7 (or B7-alt) |
| Frontend interfaces (`BillingType`, `caseBillingType`) | Tasks C1–C2 |
| D2 row template + SCSS | Tasks D1–D3 |
| Row 3-dot drop "Edit", add "Set due date" inline picker | Tasks E1–E3 |
| V1 segmented-pills stepper | Tasks F1–F3 |
| Modal metadata grid swap (Status → Estimated/Logged) | Task G1 |
| Conditional time-log section | Task H1 |
| Add-only comments form | Task H2 |
| Activity log collapsed accordion | Task H3 |
| +New task conditional Estimated Hours | Task J1 |
| BLOCKED required prompt | Inherited from predecessor (already implemented) |
| 21-step test plan | Task K2 |

### Placeholder scan

- All "TBD" instances are explicit "open question" callouts deferred to plan-writing decisions (e.g., migration version number, audit log data source). Not red-flag placeholders.
- "verify exists" / "find via grep" instructions are correct codebase-pattern-matching guidance.
- Code blocks have actual code, not pseudocode.

### Type consistency

- `BillingType` enum uniformly named across backend (`BillingType.java`) and frontend (`BillingType` enum in `case-task.ts`). Values match (`CONTINGENCY` / `HOURLY` / `FLAT_FEE` / `PRO_BONO`).
- `caseBillingType` field name consistent in `CaseTaskDTO.java` (backend), `CaseTask` interface (frontend), and template usage.
- `TaskStatus` enum values used consistently in stepper (`TODO` / `IN_PROGRESS` / `REVIEW` / `BLOCKED` / `COMPLETED` / `CANCELLED`).
- `Location.replaceState` usage NOT introduced here (predecessor's preloader fix already established the pattern).

### Scope check

Single coherent unit. Backend + frontend changes interlock around `case.billingType`. Pipeline + Workload views explicitly deferred to separate plans. Test plan (21 numbered tests in spec) verifies the unit end-to-end.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-06-tasks-list-view-flow.md`. Two execution options:**

**1. Subagent-Driven** — I dispatch fresh subagents per task or per phase, with reviews between. Best for backend/frontend boundaries where context resets help.

**2. Inline Execution (recommend for this plan)** — I execute tasks in this session via `superpowers:executing-plans`, batched by phase with type-check + your sign-off at each phase boundary. Best for highly mechanical changes where I can keep context across files.

**Which approach?**

> Either way, the **commit gate is yours** — I will not run `git commit` until you confirm the 21-step manual test plan all pass.
