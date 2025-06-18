import { Component, Input, Output, EventEmitter, TrackByFunction } from '@angular/core';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

@Component({
  selector: 'app-virtual-table',
  template: `
    <div class="virtual-table">
      <table class="table table-hover">
        <thead>
          <tr>
            <th *ngFor="let column of columns" 
                [style.width]="column.width"
                [style.text-align]="column.align || 'left'"
                (click)="column.sortable && onSort(column.key)"
                [class.sortable]="column.sortable">
              {{ column.label }}
              <i *ngIf="column.sortable && sortColumn === column.key" 
                 class="fas fa-sort-{{ sortDirection === 'asc' ? 'up' : 'down' }} ms-1"></i>
            </th>
            <th *ngIf="actions" style="width: 100px;">Actions</th>
          </tr>
        </thead>
      </table>
      
      <cdk-virtual-scroll-viewport 
        [itemSize]="rowHeight" 
        [style.height.px]="height"
        class="table-viewport">
        <table class="table table-hover mb-0">
          <tbody>
            <tr *cdkVirtualFor="let item of data; trackBy: trackByFn || defaultTrackBy; let i = index"
                (click)="onRowClick(item)"
                [class.selected]="isSelected(item)">
              <td *ngFor="let column of columns" 
                  [style.width]="column.width"
                  [style.text-align]="column.align || 'left'">
                {{ getColumnValue(item, column.key) }}
              </td>
              <td *ngIf="actions" style="width: 100px;">
                <div class="btn-group btn-group-sm">
                  <button class="btn btn-outline-primary" 
                          (click)="onEdit(item, $event)"
                          title="Edit">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-outline-danger" 
                          (click)="onDelete(item, $event)"
                          title="Delete">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </cdk-virtual-scroll-viewport>
      
      <div class="table-footer" *ngIf="showFooter">
        <div class="selected-info" *ngIf="selection.length > 0">
          {{ selection.length }} items selected
        </div>
        <div class="table-info">
          Showing {{ data?.length || 0 }} items
        </div>
      </div>
    </div>
  `,
  styles: [`
    .virtual-table {
      border: 1px solid #dee2e6;
      border-radius: 0.25rem;
      overflow: hidden;
    }
    
    .table {
      margin-bottom: 0;
    }
    
    thead th {
      position: sticky;
      top: 0;
      background-color: #f8f9fa;
      z-index: 10;
      border-bottom: 2px solid #dee2e6;
    }
    
    th.sortable {
      cursor: pointer;
      user-select: none;
    }
    
    th.sortable:hover {
      background-color: #e9ecef;
    }
    
    .table-viewport {
      overflow-y: auto;
    }
    
    .table-viewport table {
      table-layout: fixed;
    }
    
    tr.selected {
      background-color: #e3f2fd;
    }
    
    tr:hover {
      background-color: #f5f5f5;
    }
    
    .table-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 1rem;
      background-color: #f8f9fa;
      border-top: 1px solid #dee2e6;
    }
    
    .table-info, .selected-info {
      font-size: 0.875rem;
      color: #6c757d;
    }
  `]
})
export class VirtualTableComponent {
  @Input() data: any[] = [];
  @Input() columns: TableColumn[] = [];
  @Input() rowHeight = 40;
  @Input() height = 400;
  @Input() trackByFn?: TrackByFunction<any>;
  @Input() actions = true;
  @Input() showFooter = true;
  @Input() multiSelect = false;
  
  @Output() rowClick = new EventEmitter<any>();
  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();
  @Output() sort = new EventEmitter<{column: string, direction: 'asc' | 'desc'}>();
  @Output() selectionChange = new EventEmitter<any[]>();
  
  sortColumn = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  selection: any[] = [];
  
  defaultTrackBy(index: number): number {
    return index;
  }
  
  getColumnValue(item: any, key: string): any {
    return key.split('.').reduce((obj, prop) => obj?.[prop], item);
  }
  
  onSort(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sort.emit({ column, direction: this.sortDirection });
  }
  
  onRowClick(item: any) {
    if (this.multiSelect) {
      const index = this.selection.indexOf(item);
      if (index > -1) {
        this.selection.splice(index, 1);
      } else {
        this.selection.push(item);
      }
      this.selectionChange.emit(this.selection);
    }
    this.rowClick.emit(item);
  }
  
  isSelected(item: any): boolean {
    return this.selection.includes(item);
  }
  
  onEdit(item: any, event: Event) {
    event.stopPropagation();
    this.edit.emit(item);
  }
  
  onDelete(item: any, event: Event) {
    event.stopPropagation();
    this.delete.emit(item);
  }
}