import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'w-app-window',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-app-window" [class.small]="small">
      <div class="window-bar">
        <span class="window-dot r"></span>
        <span class="window-dot y"></span>
        <span class="window-dot g"></span>
        <span class="window-title" *ngIf="title">{{ title }}</span>
      </div>
      <div class="window-content">
        <img *ngIf="imageSrc" [src]="imageSrc" [alt]="imageAlt" loading="lazy">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styleUrls: ['./app-window.component.scss']
})
export class AppWindowComponent {
  @Input() title = '';
  @Input() imageSrc = '';
  @Input() imageAlt = '';
  @Input() small = false;
}
