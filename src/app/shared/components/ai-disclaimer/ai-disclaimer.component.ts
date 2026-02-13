import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ai-disclaimer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ai-disclaimer-banner" [class.compact]="compact">
      <div class="alert alert-warning alert-dismissible fade show mb-0 d-flex align-items-center" role="alert">
        <i class="ri-error-warning-line me-2 fs-16 flex-shrink-0"></i>
        <div class="flex-grow-1">
          <strong>AI-Generated Content</strong> —
          This analysis was produced by AI. Always verify accuracy against primary sources
          and apply independent professional judgment before relying on this content.
          <em>This is not legal advice.</em>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    </div>
  `,
  styles: [`
    .ai-disclaimer-banner .alert {
      border-radius: 0.25rem;
      font-size: 0.8125rem;
      line-height: 1.5;
      padding: 0.5rem 0.75rem;
      border-left: 3px solid #f7b84b;
      background-color: rgba(247, 184, 75, 0.1);
    }
    .ai-disclaimer-banner.compact .alert {
      font-size: 0.75rem;
      padding: 0.35rem 0.6rem;
    }
    .ai-disclaimer-banner.compact strong {
      font-size: 0.75rem;
    }
  `]
})
export class AiDisclaimerComponent {
  @Input() compact = false;
}
