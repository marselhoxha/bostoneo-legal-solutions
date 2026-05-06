import { Type } from '@angular/core';

/**
 * Lazy-loader registry mapping PracticeArea enum values to a function that
 * imports the corresponding practice-area Angular module. Each lazy-loaded
 * module must expose its top-level layer component as a static
 * `entryComponent: Type<any>` property so the outlet can instantiate it.
 *
 * Phase 5 will add the PERSONAL_INJURY entry once that module exists. For
 * Phase 4 this map starts empty — the outlet falls through to
 * <practice-area-coming-soon> for any practice area not yet registered.
 */
export const PRACTICE_AREA_MODULES: Partial<Record<string, () => Promise<Type<any>>>> = {
  // Populated in Phase 5:
  // PERSONAL_INJURY: () => import('./practice-areas/personal-injury/personal-injury-dashboard.module')
  //   .then(m => m.PersonalInjuryDashboardModule.entryComponent),
};
