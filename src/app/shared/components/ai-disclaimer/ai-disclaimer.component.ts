import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ai-disclaimer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Expanded banner -->
    <div class="ai-disclaimer-banner" *ngIf="expanded">
      <div class="alert alert-warning mb-0 d-flex align-items-center" role="alert">
        <i class="ri-error-warning-line me-2 fs-16 flex-shrink-0"></i>
        <div class="flex-grow-1">
          <strong>AI-Generated Content</strong> —
          Always verify accuracy against primary sources and apply independent professional judgment.
          <em>This is not legal advice.</em>
        </div>
        <button type="button" class="btn-close-disclaimer" (click)="collapse()" aria-label="Dismiss">
          <i class="ri-close-line"></i>
        </button>
      </div>
    </div>

    <!-- Collapsed chip (always visible, never fully dismissed) -->
    <div class="ai-disclaimer-chip" *ngIf="!expanded" (click)="expand()" title="AI-Generated Content — Not legal advice. Click to expand.">
      <i class="ri-error-warning-line"></i>
      <span>AI Content</span>
    </div>
  `,
  styles: [`
    .ai-disclaimer-banner .alert {
      border-radius: 0.25rem;
      font-size: 0.8125rem;
      line-height: 1.5;
      padding: 0.5rem 0.875rem;
      border-left: 3px solid #f7b84b;
      background-color: rgba(247, 184, 75, 0.1);
    }
    .btn-close-disclaimer {
      background: none;
      border: none;
      padding: 0 0 0 0.5rem;
      cursor: pointer;
      color: #856404;
      opacity: 0.6;
      font-size: 1rem;
      line-height: 1;
      flex-shrink: 0;
      &:hover { opacity: 1; }
    }
    .ai-disclaimer-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      margin: 0.375rem 1rem;
      background: rgba(247, 184, 75, 0.15);
      border: 1px solid rgba(247, 184, 75, 0.5);
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      color: #856404;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s ease;
      &:hover { background: rgba(247, 184, 75, 0.25); }
      i { font-size: 13px; }
    }
  `]
})
export class AiDisclaimerComponent implements OnInit, OnDestroy {
  @Input() compact = false;
  expanded = true;
  private collapseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.collapseTimer = setTimeout(() => {
      this.expanded = false;
      this.cdr.markForCheck();
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.collapseTimer) clearTimeout(this.collapseTimer);
  }

  collapse(): void {
    if (this.collapseTimer) {
      clearTimeout(this.collapseTimer);
      this.collapseTimer = null;
    }
    this.expanded = false;
    this.cdr.markForCheck();
  }

  expand(): void {
    this.expanded = true;
    this.cdr.markForCheck();
    this.collapseTimer = setTimeout(() => {
      this.expanded = false;
      this.cdr.markForCheck();
    }, 5000);
  }
}
