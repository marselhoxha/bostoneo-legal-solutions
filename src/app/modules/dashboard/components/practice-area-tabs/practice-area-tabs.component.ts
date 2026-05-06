import { Component, EventEmitter, Input, Output } from '@angular/core';
import { labelFor } from '@app/shared/constants/practice-area-options';

/**
 * Pill-style tab strip for switching between an attorney's practice areas.
 *
 * Visible only when `tabs.length >= 2`. Single-practice attorneys see no
 * tab strip — their dashboard is the single practice area's layer directly.
 */
@Component({
  selector: 'app-practice-area-tabs',
  templateUrl: './practice-area-tabs.component.html',
  styleUrls: ['./practice-area-tabs.component.scss'],
})
export class PracticeAreaTabsComponent {
  @Input() tabs: string[] = [];
  @Input() active: string | null = null;
  @Output() tabChange = new EventEmitter<string>();

  labelFor = labelFor;

  onTabClick(tab: string): void {
    if (tab !== this.active) {
      this.tabChange.emit(tab);
    }
  }
}
