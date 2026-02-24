import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'w-faq-accordion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-faq-list">
      <div class="w-faq-item" *ngFor="let item of items; let i = index">
        <button class="w-faq-question" (click)="toggle(i)" [attr.aria-expanded]="openIndex === i">
          {{ item.question }}
          <i class="ri-arrow-down-s-line" [class.open]="openIndex === i"></i>
        </button>
        <div class="w-faq-answer" [class.open]="openIndex === i">
          <div class="w-faq-answer-inner">{{ item.answer }}</div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./faq-accordion.component.scss']
})
export class FaqAccordionComponent {
  @Input() items: FaqItem[] = [];
  openIndex: number | null = null;

  toggle(index: number): void {
    this.openIndex = this.openIndex === index ? null : index;
  }
}
