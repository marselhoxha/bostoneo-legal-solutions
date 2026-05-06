export interface PracticeAreaOption {
  value: string;   // PracticeArea enum value, e.g., 'PERSONAL_INJURY'
  label: string;   // human-readable, e.g., 'Personal Injury'
}

export const PRACTICE_AREA_OPTIONS: ReadonlyArray<PracticeAreaOption> = [
  { value: 'PERSONAL_INJURY',       label: 'Personal Injury' },
  { value: 'FAMILY_LAW',            label: 'Family Law' },
  { value: 'CRIMINAL_DEFENSE',      label: 'Criminal Defense' },
  { value: 'IMMIGRATION',           label: 'Immigration' },
  { value: 'CIVIL_LITIGATION',      label: 'Civil Litigation' },
  { value: 'CONTRACT_LAW',          label: 'Contract Law' },
  { value: 'BUSINESS_LAW',          label: 'Business Law' },
  { value: 'EMPLOYMENT_LAW',        label: 'Employment Law' },
  { value: 'REAL_ESTATE',           label: 'Real Estate' },
  { value: 'INTELLECTUAL_PROPERTY', label: 'Intellectual Property' },
  { value: 'ESTATE_PLANNING',       label: 'Estate Planning' },
  { value: 'BANKRUPTCY',            label: 'Bankruptcy' },
  { value: 'TAX_LAW',               label: 'Tax Law' },
  { value: 'ENVIRONMENTAL_LAW',     label: 'Environmental Law' },
  { value: 'CLASS_ACTION',          label: 'Class Action' },
  { value: 'OTHER',                 label: 'Other' },
];

export function labelFor(enumValue: string): string {
  return PRACTICE_AREA_OPTIONS.find(o => o.value === enumValue)?.label ?? enumValue;
}
