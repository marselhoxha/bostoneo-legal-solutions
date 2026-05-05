# Phase 2 page priority list

> **Source:** `2026-05-04-hex-audit.csv` (3,739 hex occurrences across 163 files).
> **Status:** Draft — refined after Phase 1 baseline screenshots are reviewed.
>
> **Hex count** = total hex literals in the component SCSS.
> **Mapped** = how many of those map cleanly to an existing Tier 2 token (the rest need design judgment per occurrence).
> A high mapped/total ratio means a faster, lower-risk migration.

## Mandatory (Phase 2)

Order is by impact: files-on-critical-paths first, then by hex count. Each row is its own commit per the per-component workflow.

| # | Component file | Hex / Mapped | Likely route(s) | Rationale |
|---|---|---|---|---|
| 1 | `src/app/component/messages/messages.component.scss` | 49 / 30 (61%) | `/messages` (and embedded message panes) | Highest mapped ratio in the codebase — fastest, safest first commit. Builds confidence in the migration loop. |
| 2 | `src/app/modules/public/components/intake-form/intake-form.component.scss` | 52 / 14 | `/public/intake/:slug` | Public-facing — first impression for prospective clients. Must look right under Rox. |
| 3 | `src/app/modules/public/components/ai-consent/ai-consent.component.scss` | 39 / 8 | `/public/ai-consent` | Public-facing companion to intake. Same trust argument. |
| 4 | `src/app/modules/legal/components/document/document-list/document-list.component.scss` | 52 / 11 | `/legal/cases/:id/documents`, `/file-manager` adjacent | Heavy attorney workflow surface. |
| 5 | `src/app/modules/file-manager/components/file-manager/file-manager.component.scss` | 78 / 7 | `/file-manager` | Core attorney UX, used on nearly every case. |
| 6 | `src/app/modules/legal/components/case/case-detail/case-detail.component.scss` | 58 / 11 | `/legal/cases/:id` (non-PI variants) | Generic case detail — PI variant is excluded, this one is not. |
| 7 | `src/app/modules/legal/components/case/case-time-entries/case-time-entries.component.scss` | 43 / 6 | `/legal/cases/:id/time-entries` | Common drilldown from case detail. |
| 8 | `src/app/modules/legal/components/case/case-research/case-research.component.scss` | 42 / 5 | `/legal/cases/:id/research` | Same. |
| 9 | `src/app/modules/legal/components/document-analyzer/document-analyzer.component.scss` | 45 / 2 | `/legal/document-analyzer` | Premium feature, customer-visible. Low mapped ratio = expect more design decisions. |
| 10 | `src/app/modules/legal/components/ai-assistant/legal-research/legal-research.component.scss` | 62 / 11 | `/legal/ai-assistant/legal-research` | AI surface, attorney-facing. |
| 11 | `src/app/modules/legal/components/ai-assistant/templates/template-library.component.scss` | 128 / 12 | `/legal/ai-assistant/templates` | Heavy AI surface. |
| 12 | `src/app/modules/legal/components/ai-assistant/ai-workspace/draft-dashboard/draft-dashboard.component.scss` | 110 / 16 | `/legal/ai-assistant/legispace` (sub-view) | AI workspace child component. |
| 13 | `src/app/modules/legal/components/ai-assistant/ai-workspace/draft-wizard/draft-wizard.component.scss` | 219 / 20 | `/legal/ai-assistant/legispace` (wizard flow) | AI workspace child component. |
| 14 | `src/app/modules/legal/components/ai-assistant/practice-areas/personal-injury/personal-injury.component.scss` | 227 / 40 | `/legal/ai-assistant/legipi` | AI PI surface. Decent mapped ratio. |
| 15 | `src/app/modules/legal/components/ai-assistant/ai-workspace/ai-workspace.component.scss` | **1053 / 102** | `/legal/ai-assistant/legispace` | The elephant — 28% of all hex in the codebase. Migrate LAST in Phase 2 (split into multiple commits if needed). |

**Total mandatory:** 15 components, ~2,257 hex occurrences (~60% of all hex in scope).

### Order rationale

- Items 1–3 first: small, public-facing or high-mapped-ratio. Each gives a feedback loop on the workflow before tackling bigger files.
- Items 4–8 next: case-management surfaces, attorneys spend most of their time here.
- Items 9–11 mid: smaller AI surfaces.
- Items 12–15 last: AI workspace cluster — migrating these together avoids visual seams between sibling components, but they're large enough to risk a single big commit. Plan splits item 15 into ≥3 commits by section if needed.

## Optional (Phase 3)

Low-impact or 0-mapped files where ROI is questionable. Tackle only if Phase 2 stays under budget.

| Component file | Hex / Mapped | Notes |
|---|---|---|
| `src/app/modules/time-tracking/components/time-approval/time-approval.component.scss` | 55 / 0 | Zero mapped — every hex is a custom decision. |
| `src/app/modules/time-tracking/components/timesheet-view/timesheet-view.component.scss` | 49 / 0 | Zero mapped. Internal-only surface. |
| `src/app/modules/file-manager/components/permission-inheritance/permission-inheritance.component.scss` | 52 / 0 | Zero mapped. Settings-deep, low traffic. |
| `src/app/modules/legal/components/ai-assistant/shared/components/bulk-request-wizard/bulk-request-wizard.component.scss` | 66 / 7 | Modal — visible only during bulk ops. |
| `src/app/modules/legal/components/ai-assistant/ai-workspace/background-tasks-indicator/background-tasks-indicator.component.scss` | 61 / 6 | Status indicator, secondary surface. |
| `src/app/modules/legal/components/ai-assistant/ai-workspace/case-context-panel/case-context-panel.component.scss` | 44 / 2 | Side panel inside ai-workspace — may inherit from item 15 above. |
| `src/app/modules/legal/components/pdf-forms/pdf-forms.component.scss` | 39 / 1 | Specialized tooling. |
| `src/app/modules/legal/components/ai-assistant/shared/components/ai-response-modal/ai-response-modal.component.scss` | 38 / 0 | Modal, low surface area. |
| `src/app/modules/client-portal/components/profile/client-profile.component.scss` | 34 / 7 | Client-side portal — separate audience. |
| `src/app/modules/crm/components/conflict-checks-list/conflict-checks-list.component.scss` | 33 / 1 | Secondary CRM surface. |
| Long tail (~138 files, < 30 hex each, ~640 occurrences total) | varies | Low individual impact. |

## Forbidden / preserved

These components are explicitly excluded from migration. The hex audit script skips them, and the priority list does not target them.

- `src/app/modules/legal/components/case/pi-case-detail/` — PI case detail, the design reference. **Pinned.**
- `src/app/component/dashboards/attorney/` — attorney dashboard, already themed in prior work. **Pinned.**
- `src/app/component/layouts/topbar/` — main topbar, intentionally hardcoded `#ffffff` per Phase 0 decision. **Pinned.**
- `src/app/component/layouts/horizontal-topbar/` — Velzon's horizontal topbar (cascade source for topbar).
- `src/app/component/layouts/ai-quick-drawer/` — drawer surface, hardcoded `#ffffff`.

## Open questions for review

1. **Item 15 (ai-workspace, 1053 hex):** keep as a single mandatory item or split now? Suggest splitting into 3–4 sub-commits during Phase 2 execution rather than pre-splitting now.
2. **Item 9 (document-analyzer, 45 / 2):** very low mapped ratio. Is this surface customer-critical, or can it slip to optional?
3. **Are any "optional" items actually mandatory** because they appear on routes the team uses daily? Answer comes from the baseline review.

## What changes after baseline screenshots

This list is a quantitative draft. The baseline review (Phase 1.5) will surface visual breakage that the hex count can't predict — e.g., a file with 12 hex codes might be visually fine, while a file with 30 hex codes might be the only place an unstyled `#fff` text-on-white renders illegibly. Expect the mandatory list to gain or lose 2–4 entries after that pass.
