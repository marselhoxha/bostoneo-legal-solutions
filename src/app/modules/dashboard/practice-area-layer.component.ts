import { Component } from '@angular/core';

/**
 * Abstract base class for practice-area top-level components. Each lazy-loaded
 * practice-area module exposes a concrete subclass that provides the markup
 * for three named slots: ai-insights-slot, risk-alerts-slot, cross-matter-slot.
 * The shell projects these via <ng-content select="..."> inside the outlet.
 *
 * Phase 5 (PI module) implements this. Phase 4 just defines the contract.
 */
@Component({
  selector: 'app-practice-area-layer-base',
  template: '',
})
export abstract class PracticeAreaLayerComponent {
  abstract readonly practiceArea: string;
}
