import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

import { PracticeAreaTabsComponent } from './components/practice-area-tabs/practice-area-tabs.component';
import { PracticeAreaOutletComponent } from './components/practice-area-outlet/practice-area-outlet.component';
import { PracticeAreaComingSoonComponent } from './components/practice-area-coming-soon/practice-area-coming-soon.component';

/**
 * Practice-area-aware attorney dashboard module.
 *
 * Hosts the shell components that wrap the existing attorney dashboard with
 * a per-practice-area layer system. Phase 4 ships the skeleton — the
 * components are AVAILABLE but not yet wired into the existing dashboard.
 *
 * Phase 5 will add lazy-loaded practice-area modules to PRACTICE_AREA_MODULES.
 * Phase 6 will reference <app-practice-area-tabs> and <app-practice-area-outlet>
 * from the existing attorney-dashboard.component template.
 *
 * Note: Lucide icons used by these components (currently `sparkles`) must be
 * registered in the root LucideAngularModule.pick({...}) block (see app.module.ts).
 * `sparkles` is already registered.
 */
@NgModule({
  declarations: [
    PracticeAreaTabsComponent,
    PracticeAreaOutletComponent,
    PracticeAreaComingSoonComponent,
  ],
  imports: [
    CommonModule,
    LucideAngularModule,
  ],
  exports: [
    PracticeAreaTabsComponent,
    PracticeAreaOutletComponent,
    PracticeAreaComingSoonComponent,
  ],
})
export class AttorneyDashboardModule {}
