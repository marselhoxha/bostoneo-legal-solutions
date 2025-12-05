import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignatureStatus } from '../../../core/services/signature.service';

@Component({
  selector: 'app-signature-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [class]="getBadgeClass()" [title]="getTooltip()">
      <i [class]="getIcon() + ' me-1'" *ngIf="showIcon"></i>
      {{ getLabel() }}
    </span>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    .badge {
      font-size: 0.75rem;
      font-weight: 500;
      padding: 0.35em 0.65em;
    }
    .badge i {
      font-size: 0.7rem;
    }
  `]
})
export class SignatureStatusBadgeComponent {
  @Input() status!: SignatureStatus;
  @Input() showIcon: boolean = true;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() daysUntilExpiry?: number;

  getBadgeClass(): string {
    const sizeClass = this.size === 'sm' ? 'badge-sm' : this.size === 'lg' ? 'badge-lg' : '';

    switch (this.status) {
      case 'COMPLETED':
      case 'SIGNED':
        return `badge bg-success-subtle text-success ${sizeClass}`;
      case 'SENT':
        return `badge bg-info-subtle text-info ${sizeClass}`;
      case 'VIEWED':
        return `badge bg-primary-subtle text-primary ${sizeClass}`;
      case 'PARTIALLY_SIGNED':
        return `badge bg-warning-subtle text-warning ${sizeClass}`;
      case 'DRAFT':
        return `badge bg-secondary-subtle text-secondary ${sizeClass}`;
      case 'DECLINED':
        return `badge bg-danger-subtle text-danger ${sizeClass}`;
      case 'EXPIRED':
        return `badge bg-dark-subtle text-dark ${sizeClass}`;
      case 'VOIDED':
        return `badge bg-danger-subtle text-danger ${sizeClass}`;
      default:
        return `badge bg-secondary-subtle text-secondary ${sizeClass}`;
    }
  }

  getIcon(): string {
    switch (this.status) {
      case 'COMPLETED':
      case 'SIGNED':
        return 'ri-check-double-line';
      case 'SENT':
        return 'ri-send-plane-line';
      case 'VIEWED':
        return 'ri-eye-line';
      case 'PARTIALLY_SIGNED':
        return 'ri-edit-line';
      case 'DRAFT':
        return 'ri-draft-line';
      case 'DECLINED':
        return 'ri-close-circle-line';
      case 'EXPIRED':
        return 'ri-time-line';
      case 'VOIDED':
        return 'ri-forbid-line';
      default:
        return 'ri-file-line';
    }
  }

  getLabel(): string {
    switch (this.status) {
      case 'DRAFT': return 'Draft';
      case 'SENT': return 'Sent';
      case 'VIEWED': return 'Viewed';
      case 'PARTIALLY_SIGNED': return 'Partially Signed';
      case 'SIGNED': return 'Signed';
      case 'COMPLETED': return 'Completed';
      case 'DECLINED': return 'Declined';
      case 'EXPIRED': return 'Expired';
      case 'VOIDED': return 'Voided';
      default: return this.status;
    }
  }

  getTooltip(): string {
    if (this.daysUntilExpiry !== undefined && this.daysUntilExpiry >= 0) {
      if (this.daysUntilExpiry === 0) {
        return 'Expires today';
      } else if (this.daysUntilExpiry === 1) {
        return 'Expires tomorrow';
      } else {
        return `Expires in ${this.daysUntilExpiry} days`;
      }
    }
    return this.getLabel();
  }
}
