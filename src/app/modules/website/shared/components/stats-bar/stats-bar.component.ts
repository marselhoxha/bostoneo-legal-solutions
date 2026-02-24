import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface StatItem {
  value: string;
  label: string;
  detail?: string;
}

@Component({
  selector: 'w-stats-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-stats-grid" [class.dark]="theme === 'dark'" [class.light]="theme === 'light'">
      <div class="w-stat-card" *ngFor="let stat of stats">
        <span class="stat-value">{{ stat.value }}</span>
        <span class="stat-label">{{ stat.label }}</span>
        <span class="stat-detail" *ngIf="stat.detail">{{ stat.detail }}</span>
      </div>
    </div>
  `,
  styleUrls: ['./stats-bar.component.scss']
})
export class StatsBarComponent {
  @Input() stats: StatItem[] = [];
  @Input() theme: 'dark' | 'light' = 'dark';
}
