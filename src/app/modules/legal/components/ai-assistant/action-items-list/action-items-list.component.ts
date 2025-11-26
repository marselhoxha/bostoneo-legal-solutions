import { Component, Input, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActionItem } from '../../../models/action-item.model';
import { ActionItemService } from '../../../services/action-item.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-action-items-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './action-items-list.component.html',
  styleUrls: ['./action-items-list.component.scss']
})
export class ActionItemsListComponent implements OnInit {
  @Input() analysisId!: number;

  private actionItemService = inject(ActionItemService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);

  actionItems: ActionItem[] = [];
  filter: 'all' | 'pending' | 'completed' = 'all';

  ngOnInit() {
    this.loadActionItems();
  }

  loadActionItems() {
    this.actionItemService.getActionItems(this.analysisId).subscribe(items => {
      this.actionItems = items;
      this.cdr.detectChanges();
    });
  }

  getFilteredItems(): ActionItem[] {
    switch (this.filter) {
      case 'pending':
        return this.actionItems.filter(i => i.status !== 'COMPLETED');
      case 'completed':
        return this.actionItems.filter(i => i.status === 'COMPLETED');
      default:
        return this.actionItems;
    }
  }

  toggleStatus(item: ActionItem) {
    const newStatus = item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    this.actionItemService.updateActionItem(item.id!, { status: newStatus }).subscribe({
      next: (updated) => {
        item.status = updated.status;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Failed to update status', 'Error');
      }
    });
  }

  markAllComplete() {
    const pendingItems = this.actionItems.filter(i => i.status !== 'COMPLETED');
    let completed = 0;

    pendingItems.forEach(item => {
      this.actionItemService.updateActionItem(item.id!, { status: 'COMPLETED' }).subscribe({
        next: (updated) => {
          item.status = updated.status;
          completed++;
          if (completed === pendingItems.length) {
            this.toastr.success(`${completed} items marked complete`, 'Success');
            this.cdr.detectChanges();
          }
        }
      });
    });
  }

  // ==================== Count Helpers ====================

  getPendingCount(): number {
    return this.actionItems.filter(i => i.status !== 'COMPLETED').length;
  }

  getCompletedCount(): number {
    return this.actionItems.filter(i => i.status === 'COMPLETED').length;
  }

  getOverdueCount(): number {
    return this.actionItems.filter(i =>
      i.status !== 'COMPLETED' && i.deadline && this.isOverdue(i.deadline)
    ).length;
  }

  // ==================== Date Helpers ====================

  isOverdue(deadline: string | undefined): boolean {
    if (!deadline) return false;
    const deadlineDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);
    return deadlineDate < today;
  }

  isDueSoon(deadline: string | undefined): boolean {
    if (!deadline) return false;
    const deadlineDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 3;
  }

  // ==================== Styling Helpers ====================

  getPriorityDotClass(priority: string): string {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL': return 'priority-critical';
      case 'HIGH': return 'priority-high';
      case 'MEDIUM': return 'priority-medium';
      case 'LOW': return 'priority-low';
      default: return 'priority-medium';
    }
  }

  getPriorityBadgeClass(priority: string): string {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL': return 'priority-critical';
      case 'HIGH': return 'priority-high';
      case 'MEDIUM': return 'priority-medium';
      case 'LOW': return 'priority-low';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }
}
