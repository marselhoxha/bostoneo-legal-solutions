import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActionItem } from '../../../models/action-item.model';
import { ActionItemService } from '../../../services/action-item.service';

@Component({
  selector: 'app-action-items-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="action-items-container">
      <h5 class="mb-3"><i class="bi bi-check2-square me-2"></i>Action Items</h5>

      @if (actionItems.length === 0) {
        <p class="text-muted">No action items extracted</p>
      }

      @for (item of actionItems; track item.id) {
        <div class="card mb-2" [class.item-completed]="item.status === 'COMPLETED'">
          <div class="card-body p-3">
            <div class="d-flex align-items-start">
              <input
                type="checkbox"
                class="form-check-input me-3 mt-1"
                [checked]="item.status === 'COMPLETED'"
                (change)="toggleStatus(item)">

              <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-start mb-1">
                  <p class="mb-1" [class.text-decoration-line-through]="item.status === 'COMPLETED'">
                    {{item.description}}
                  </p>
                  <span class="badge ms-2" [class]="getPriorityClass(item.priority)">
                    {{item.priority}}
                  </span>
                </div>

                @if (item.deadline) {
                  <small class="text-muted" [class.text-danger]="isOverdue(item.deadline)">
                    <i class="bi bi-calendar3 me-1"></i>
                    {{item.deadline | date: 'MMM d, yyyy'}}
                    @if (isOverdue(item.deadline)) {
                      <span class="badge bg-danger ms-1">OVERDUE</span>
                    }
                  </small>
                }

                @if (item.relatedSection) {
                  <small class="d-block text-muted mt-1">
                    <i class="bi bi-link-45deg me-1"></i>{{item.relatedSection}}
                  </small>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .action-items-container {
      margin-bottom: 1.5rem;
    }

    .item-completed {
      opacity: 0.7;
    }

    .form-check-input {
      width: 1.2em;
      height: 1.2em;
      cursor: pointer;
    }

    .badge.bg-success { background-color: #28a745 !important; }
    .badge.bg-danger { background-color: #dc3545 !important; }
    .badge.bg-warning { background-color: #ffc107 !important; color: #000; }
    .badge.bg-info { background-color: #17a2b8 !important; }
  `]
})
export class ActionItemsListComponent implements OnInit {
  @Input() analysisId!: number;

  private actionItemService = inject(ActionItemService);

  actionItems: ActionItem[] = [];

  ngOnInit() {
    this.loadActionItems();
  }

  loadActionItems() {
    this.actionItemService.getActionItems(this.analysisId).subscribe(items => {
      this.actionItems = items;
    });
  }

  toggleStatus(item: ActionItem) {
    const newStatus = item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    this.actionItemService.updateActionItem(item.id!, { status: newStatus }).subscribe(updated => {
      item.status = updated.status;
    });
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'CRITICAL': return 'bg-danger';
      case 'HIGH': return 'bg-warning';
      case 'MEDIUM': return 'bg-info';
      case 'LOW': return 'bg-success';
      default: return 'bg-secondary';
    }
  }

  isOverdue(deadline: string): boolean {
    return new Date(deadline) < new Date();
  }
}
