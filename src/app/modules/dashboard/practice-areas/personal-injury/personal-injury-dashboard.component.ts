import { Component } from '@angular/core';
import { PracticeAreaLayerComponent } from '../../practice-area-layer.component';

/**
 * Top-level layer component for the Personal Injury practice area. Sits inside
 * the `<app-practice-area-outlet>` when the active practice area is
 * PERSONAL_INJURY. Renders the three PI-flavored sections stacked vertically
 * — children load their own data from `PiDashboardService`.
 */
@Component({
  selector: 'app-personal-injury-dashboard',
  templateUrl: './personal-injury-dashboard.component.html',
  styleUrls: ['./personal-injury-dashboard.component.scss'],
})
export class PersonalInjuryDashboardComponent extends PracticeAreaLayerComponent {
  override readonly practiceArea = 'PERSONAL_INJURY';
}
