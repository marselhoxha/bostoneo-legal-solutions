import { Component, Input } from '@angular/core';
import { labelFor } from '@app/shared/constants/practice-area-options';

/**
 * Friendly empty state shown when the active practice area has no
 * registered module yet. The user can still use the rest of the dashboard;
 * only the practice-area-specific layer is missing.
 */
@Component({
  selector: 'app-practice-area-coming-soon',
  templateUrl: './practice-area-coming-soon.component.html',
  styleUrls: ['./practice-area-coming-soon.component.scss'],
})
export class PracticeAreaComingSoonComponent {
  @Input() practiceArea = '';
  labelFor = labelFor;
}
