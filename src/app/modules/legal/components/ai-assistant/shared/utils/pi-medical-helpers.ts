/**
 * Pure helpers for PI medical-summary presentation logic.
 *
 * Extracted from `personal-injury.component.ts` (Tier 5c, Tier 5d) so the new
 * pi-case-detail shell and the legacy AI-assistant view share one source of
 * truth. Both components import these functions; neither re-implements the
 * mapping locally.
 */

import { DiagnosisItem } from '../models/pi-medical-summary.model';

/**
 * Tier 5c — human-readable label for an OpenItem type.
 *
 * Raw enum values like "MISSING_IMAGING" are not attorney-friendly; this
 * returns the demand-letter-ready phrasing used in the UI ("Imaging report
 * missing"). Falls back to a sentence-case version of any unknown type.
 */
export function formatOpenItemType(type: string | undefined | null): string {
  switch (type) {
    case 'MISSING_IMAGING':         return 'Imaging report missing';
    case 'MISSING_CONSULT':         return 'Specialist consult missing';
    case 'MISSING_PROCEDURE_NOTE':  return 'Procedure note missing';
    case 'MISSING_DISCHARGE':       return 'Discharge summary missing';
    case 'MISSING_LAB':             return 'Lab/diagnostic result missing';
    case 'MISSING_CLINICAL_NOTE':   return 'Clinical note missing';
    // P15.c.B + C — rule-based items appended by the summary service.
    case 'TREATMENT_GAP':           return 'Treatment gap detected';
    case 'PLATEAU_DETECTED':        return 'Treatment plateau detected';
    case 'OTHER':                   return 'Other follow-up';
    default:                         return type ? type.replace(/_/g, ' ').toLowerCase() : 'Other follow-up';
  }
}

/**
 * Tier 5d — group a diagnosisList by anatomical region for the
 * Diagnostic Findings card.
 *
 * Region detection is description-based with ICD-10 prefix as a secondary
 * signal — robust against different AI phrasings. Returns regions in a stable
 * head-to-toe order, with "Other" appended at the end if any unmatched
 * diagnoses remain.
 */
export function getDiagnosesByRegion(
  list: DiagnosisItem[] | undefined | null
): Array<{ region: string; items: DiagnosisItem[] }> {
  if (!list || list.length === 0) return [];

  const regions: Array<{ name: string; pattern: RegExp; icd?: RegExp }> = [
    { name: 'Cervical',      pattern: /\b(cervical|neck)\b|\bc[1-7]\b/i,                        icd: /^(M50|S13|M54\.2)/ },
    { name: 'Thoracic',      pattern: /\bthoracic\b|\bt(1[0-2]|[1-9])\b/i,                       icd: /^(M51\.[01]|S23|M54\.6)/ },
    { name: 'Lumbar',        pattern: /\b(lumbar|low.?back|lumbosacral|sacrum|sacral)\b|\bl[1-5]\b/i, icd: /^(M51|S33|M54\.5|M54\.4)/ },
    { name: 'Shoulder',      pattern: /\b(shoulder|rotator|acromion|scapul)/i,                   icd: /^(S43|S46|M75)/ },
    { name: 'Knee',          pattern: /\b(knee|patella|meniscus|acl|mcl)\b/i,                    icd: /^(S83|M23|M17)/ },
    { name: 'Hip / Pelvis',  pattern: /\b(hip|pelvis|pelvic|sacroiliac)\b/i,                     icd: /^(S73|M16|M25\.5)/ },
    { name: 'Head / Brain',  pattern: /\b(head|brain|concussion|tbi|cervicocrani)/i,             icd: /^S0[0-9]/ },
  ];

  const groups = new Map<string, DiagnosisItem[]>();
  for (const diag of list) {
    const desc = (diag.description || '').toLowerCase();
    const code = (diag.icd_code || '').toUpperCase();
    let assigned = 'Other';
    for (const r of regions) {
      if (r.pattern.test(desc) || (r.icd && r.icd.test(code))) {
        assigned = r.name;
        break;
      }
    }
    if (!groups.has(assigned)) groups.set(assigned, []);
    groups.get(assigned)!.push(diag);
  }

  const ordered = regions.map(r => r.name).filter(n => groups.has(n));
  if (groups.has('Other')) ordered.push('Other');
  return ordered.map(name => ({ region: name, items: groups.get(name)! }));
}

/**
 * Returns the first 1-2 sentences of a causation summary for use in
 * sidebar / snapshot panels. Long quotes get truncated to a hard char cap.
 */
export function getCausationExcerpt(
  causationSummary: string | undefined | null,
  opts: { sentences?: number; maxChars?: number } = {}
): string {
  if (!causationSummary) return '';
  const sentences = opts.sentences ?? 2;
  const maxChars = opts.maxChars ?? 280;

  // Pull the first N sentence-like chunks. Keep simple — punctuation followed
  // by space-or-EOS. Robust enough for AI-generated prose.
  const parts = causationSummary.split(/(?<=[.!?])\s+/).slice(0, sentences);
  const joined = parts.join(' ').trim();
  if (joined.length <= maxChars) return joined;
  return joined.substring(0, maxChars).replace(/\s+\S*$/, '') + '…';
}

/**
 * Velzon badge class for an adjuster attack-vector severity.
 */
export function getAdjusterSeverityClass(severity: string | undefined | null): string {
  switch ((severity || '').toUpperCase()) {
    case 'HIGH':   return 'bg-danger-subtle text-danger';
    case 'MEDIUM': return 'bg-warning-subtle text-warning';
    case 'LOW':    return 'bg-info-subtle text-info';
    default:        return 'bg-secondary-subtle text-secondary';
  }
}

/**
 * Remix Icon class for an adjuster attack-vector type.
 */
export function getAdjusterTypeIcon(type: string | undefined | null): string {
  switch (type) {
    case 'TREATMENT_GAP':         return 'ri-timer-flash-line';
    case 'PRE_EXISTING':          return 'ri-heart-pulse-line';
    case 'EXCESSIVE_TREATMENT':   return 'ri-scales-3-line';
    case 'CAUSATION':             return 'ri-link-unlink-m';
    case 'MISSING_DOCUMENTATION': return 'ri-file-unknow-line';
    case 'BILLING_CONCERNS':      return 'ri-money-dollar-circle-line';
    default:                       return 'ri-error-warning-line';
  }
}

/**
 * Velzon class for OpenItem priority badges. Mirrors the screenshot's HIGH/MED/LOW pills.
 */
export function getOpenItemPriorityClass(priority: string | undefined | null): string {
  switch ((priority || '').toUpperCase()) {
    case 'HIGH':   return 'bg-danger-subtle text-danger';
    case 'MEDIUM': return 'bg-warning-subtle text-warning';
    case 'LOW':    return 'bg-info-subtle text-info';
    default:        return 'bg-secondary-subtle text-secondary';
  }
}
