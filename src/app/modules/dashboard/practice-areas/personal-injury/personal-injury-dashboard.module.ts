import { NgModule, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

import { PersonalInjuryDashboardComponent } from './personal-injury-dashboard.component';
import { PiAiInsightsComponent } from './components/pi-ai-insights/pi-ai-insights.component';
import { PiRiskAlertsComponent } from './components/pi-risk-alerts/pi-risk-alerts.component';
import { PiCrossMatterIntelComponent } from './components/pi-cross-matter-intel/pi-cross-matter-intel.component';

/**
 * Lazy-loaded module for the Personal Injury practice-area layer. Imported
 * dynamically by `PracticeAreaOutletComponent` via the loader in
 * `practice-area-modules.ts`. The outlet reads `entryComponent` to instantiate
 * the top-level layer; all child components are declared here so they're
 * available when the parent renders them.
 *
 * `HttpClientModule` is imported defensively — `HttpClient` is provided at
 * the application root (see `app.module.ts`), but importing here keeps the
 * lazy module self-sufficient if it's ever consumed in isolation (e.g.
 * standalone-style routing in the future).
 */
@NgModule({
  declarations: [
    PersonalInjuryDashboardComponent,
    PiAiInsightsComponent,
    PiRiskAlertsComponent,
    PiCrossMatterIntelComponent,
  ],
  imports: [
    CommonModule,
    HttpClientModule,
  ],
})
export class PersonalInjuryDashboardModule {
  /**
   * Read by `PracticeAreaOutletComponent.loadActiveModule()`. The outlet
   * resolves the loader, awaits the import, and calls
   * `viewContainer.createComponent(entryComponent)` to mount this layer.
   */
  static entryComponent: Type<any> = PersonalInjuryDashboardComponent;
}
