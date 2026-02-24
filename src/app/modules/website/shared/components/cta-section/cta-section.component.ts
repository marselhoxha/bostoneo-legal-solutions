import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';

@Component({
  selector: 'w-cta-section',
  standalone: true,
  imports: [CommonModule, RouterModule, ScrollAnimateDirective],
  template: `
    <section class="w-cta-section">
      <div class="w-container" wScrollAnimate>
        <h2>{{ heading }}</h2>
        <p *ngIf="subtext">{{ subtext }}</p>
        <div class="cta-buttons">
          <a routerLink="/website/demo" class="w-btn-primary">
            <i class="ri-calendar-check-line"></i> Book a Demo
          </a>
          <a routerLink="/website/features" class="w-btn-secondary" *ngIf="showFeatures">
            See Features <i class="ri-arrow-right-line"></i>
          </a>
        </div>
        <p class="cta-detail">14-day free trial &bull; No credit card required &bull; 30-day money-back guarantee</p>
      </div>
    </section>
  `,
  styleUrls: ['./cta-section.component.scss']
})
export class CtaSectionComponent {
  @Input() heading = 'Ready to Transform Your Practice?';
  @Input() subtext = 'Schedule a 30-minute demo and we\'ll walk you through Legience using your actual workflow.';
  @Input() showFeatures = true;
}
