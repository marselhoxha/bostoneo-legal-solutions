/**
 * Single source of truth for legal-domain constants used across the legal module.
 *
 * Adding a new practice area, jurisdiction, or court level? Edit this file ONLY —
 * every component that imports from here picks up the change.
 *
 * The slugs here MUST match the Java `PracticeArea` enum in
 * `backend/src/main/java/com/bostoneo/bostoneosolutions/enumeration/PracticeArea.java`
 * because the 4-way template-resolution cascade uses them as filename segments
 * (e.g. `lor_pi_ma.json`, `divorce_petition_family_ca.json`).
 */

export interface PracticeAreaOption {
  readonly slug: string;
  readonly name: string;
  readonly icon: string; // Remix Icon class, e.g. 'ri-hospital-line'
}

export interface JurisdictionOption {
  readonly code: string; // ISO-2 lowercase ('ma', 'tx') or 'federal'
  readonly name: string; // Full name used by LegalCase.jurisdiction
}

export interface CourtLevelOption {
  readonly code: string;
  readonly name: string;
}

/** 15 practice areas. Slugs mirror PracticeArea.java. */
export const PRACTICE_AREAS: ReadonlyArray<PracticeAreaOption> = [
  { slug: 'pi',            name: 'Personal Injury',       icon: 'ri-hospital-line' },
  { slug: 'family',        name: 'Family Law',            icon: 'ri-home-heart-line' },
  { slug: 'criminal',      name: 'Criminal Defense',      icon: 'ri-scales-3-line' },
  { slug: 'immigration',   name: 'Immigration',           icon: 'ri-flag-2-line' },
  { slug: 'civil',         name: 'Civil Litigation',      icon: 'ri-auction-line' },
  { slug: 'contract',      name: 'Contract Law',          icon: 'ri-file-paper-2-line' },
  { slug: 'business',      name: 'Business Law',          icon: 'ri-building-line' },
  { slug: 'employment',    name: 'Employment Law',        icon: 'ri-user-star-line' },
  { slug: 'real_estate',   name: 'Real Estate',           icon: 'ri-home-4-line' },
  { slug: 'ip',            name: 'Intellectual Property', icon: 'ri-lightbulb-flash-line' },
  { slug: 'estate',        name: 'Estate Planning',       icon: 'ri-safe-2-line' },
  { slug: 'bankruptcy',    name: 'Bankruptcy',            icon: 'ri-bank-line' },
  { slug: 'tax',           name: 'Tax Law',               icon: 'ri-calculator-line' },
  { slug: 'environmental', name: 'Environmental Law',     icon: 'ri-leaf-line' },
  { slug: 'class_action',  name: 'Class Action',          icon: 'ri-group-2-line' }
];

/** All 50 US states + DC + federal + US territories (53 entries). */
export const JURISDICTIONS: ReadonlyArray<JurisdictionOption> = [
  { code: 'federal', name: 'Federal' },
  { code: 'al', name: 'Alabama' },
  { code: 'ak', name: 'Alaska' },
  { code: 'az', name: 'Arizona' },
  { code: 'ar', name: 'Arkansas' },
  { code: 'ca', name: 'California' },
  { code: 'co', name: 'Colorado' },
  { code: 'ct', name: 'Connecticut' },
  { code: 'de', name: 'Delaware' },
  { code: 'dc', name: 'District of Columbia' },
  { code: 'fl', name: 'Florida' },
  { code: 'ga', name: 'Georgia' },
  { code: 'hi', name: 'Hawaii' },
  { code: 'id', name: 'Idaho' },
  { code: 'il', name: 'Illinois' },
  { code: 'in', name: 'Indiana' },
  { code: 'ia', name: 'Iowa' },
  { code: 'ks', name: 'Kansas' },
  { code: 'ky', name: 'Kentucky' },
  { code: 'la', name: 'Louisiana' },
  { code: 'me', name: 'Maine' },
  { code: 'md', name: 'Maryland' },
  { code: 'ma', name: 'Massachusetts' },
  { code: 'mi', name: 'Michigan' },
  { code: 'mn', name: 'Minnesota' },
  { code: 'ms', name: 'Mississippi' },
  { code: 'mo', name: 'Missouri' },
  { code: 'mt', name: 'Montana' },
  { code: 'ne', name: 'Nebraska' },
  { code: 'nv', name: 'Nevada' },
  { code: 'nh', name: 'New Hampshire' },
  { code: 'nj', name: 'New Jersey' },
  { code: 'nm', name: 'New Mexico' },
  { code: 'ny', name: 'New York' },
  { code: 'nc', name: 'North Carolina' },
  { code: 'nd', name: 'North Dakota' },
  { code: 'oh', name: 'Ohio' },
  { code: 'ok', name: 'Oklahoma' },
  { code: 'or', name: 'Oregon' },
  { code: 'pa', name: 'Pennsylvania' },
  { code: 'ri', name: 'Rhode Island' },
  { code: 'sc', name: 'South Carolina' },
  { code: 'sd', name: 'South Dakota' },
  { code: 'tn', name: 'Tennessee' },
  { code: 'tx', name: 'Texas' },
  { code: 'ut', name: 'Utah' },
  { code: 'vt', name: 'Vermont' },
  { code: 'va', name: 'Virginia' },
  { code: 'wa', name: 'Washington' },
  { code: 'wv', name: 'West Virginia' },
  { code: 'wi', name: 'Wisconsin' },
  { code: 'wy', name: 'Wyoming' },
  { code: 'pr', name: 'Puerto Rico' },
  { code: 'vi', name: 'U.S. Virgin Islands' }
];

/** Court levels used in state-level filing forms. */
export const COURT_LEVELS: ReadonlyArray<CourtLevelOption> = [
  { code: 'DEFAULT', name: 'Default (auto-detect)' },
  { code: 'DISTRICT', name: 'District Court' },
  { code: 'SUPERIOR', name: 'Superior Court' },
  { code: 'FEDERAL', name: 'Federal Court' },
  { code: 'APPELLATE', name: 'Appellate Court' }
];

// Convenience helpers — lookups by slug/code/name without hand-rolling .find everywhere.

export function getPracticeArea(slug: string | null | undefined): PracticeAreaOption | undefined {
  if (!slug) return undefined;
  const lower = slug.toLowerCase();
  return PRACTICE_AREAS.find(p => p.slug === lower);
}

export function getPracticeAreaName(slug: string | null | undefined): string {
  return getPracticeArea(slug)?.name ?? '';
}

export function getJurisdictionByName(name: string | null | undefined): JurisdictionOption | undefined {
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase();
  return JURISDICTIONS.find(j => j.name.toLowerCase() === normalized || j.code === normalized);
}

export function getJurisdictionCode(name: string | null | undefined): string | undefined {
  return getJurisdictionByName(name)?.code;
}

export function getJurisdictionName(input: string | null | undefined): string {
  return getJurisdictionByName(input)?.name ?? '';
}
