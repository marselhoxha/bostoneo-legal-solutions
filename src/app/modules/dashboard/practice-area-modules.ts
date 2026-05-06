import { Type } from '@angular/core';

/**
 * Lazy-loader registry mapping PracticeArea enum values to a function that
 * imports the corresponding practice-area Angular module. Each lazy-loaded
 * module must expose its top-level layer component as a static
 * `entryComponent: Type<any>` property so the outlet can instantiate it.
 *
 * Practice areas not registered here fall through to
 * <practice-area-coming-soon>.
 */
export const PRACTICE_AREA_MODULES: Partial<Record<string, () => Promise<Type<any>>>> = {
  PERSONAL_INJURY: () =>
    import('./practice-areas/personal-injury/personal-injury-dashboard.module')
      .then(m => m.PersonalInjuryDashboardModule.entryComponent),
};
