/**
 * TypeScript mirrors of backend DTOs in
 * `com.bostoneo.bostoneosolutions.dto.ai.PracticeAreaCatalogResponse`.
 *
 * Sprint 5 — drives Step 2 of the draft wizard: only doc types with real PA-specific
 * template coverage (via the 4-way registry cascade) are surfaced to the user.
 */

export interface CatalogEntry {
  /** Canonical slug sent to generation (e.g. "lor", "divorce_petition"). */
  documentType: string;
  /** UI-catalog id used for icon + description lookup (e.g. "letter-of-representation"). */
  documentTypeUiId: string;
  /** Display name shown on the Step-2 card (e.g. "Letter of Representation"). */
  displayName: string;
  /** Category bucket — "letter" | "pleading" | "contract" | "discovery" | "motion". */
  category: string;
  /** One-line tagline for the doctype card. */
  description: string;
  /** true → PA-specific template exists; false → generic fallback (Civil Lit only). */
  hasSpecificTemplate: boolean;
}

export interface CatalogTier {
  /** "Essential" / "Common" / "Occasional". */
  tierName: string;
  /** 1 / 2 / 3. */
  tierRank: number;
  types: CatalogEntry[];
}

export interface PracticeAreaCatalogResponse {
  practiceAreaSlug: string;
  practiceAreaName: string;
  /** ISO-2 code ("ma", "federal") or null. */
  jurisdiction: string | null;
  /** false → render empty state; no entries. */
  hasCoverage: boolean;
  /** T1/T2/T3; empty array when hasCoverage=false. */
  tiers: CatalogTier[];
  /** Populated when hasCoverage=false. */
  emptyStateMessage: string | null;
}
