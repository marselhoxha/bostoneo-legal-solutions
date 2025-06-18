import { Component, Input, Output, EventEmitter, TemplateRef, TrackByFunction } from '@angular/core';

@Component({
  selector: 'app-virtual-list',
  template: `
    <div class="virtual-list-container">
      <cdk-virtual-scroll-viewport 
        [itemSize]="itemHeight" 
        [style.height.px]="height"
        class="virtual-scroll-viewport">
        <div *cdkVirtualFor="let item of items; trackBy: trackByFn || defaultTrackBy; let i = index" 
             class="list-item">
          <ng-container *ngTemplateOutlet="itemTemplate; context: { $implicit: item, index: i }">
          </ng-container>
        </div>
      </cdk-virtual-scroll-viewport>
      
      <div class="list-info" *ngIf="showInfo">
        Showing {{ getVisibleRange() }} of {{ items?.length || 0 }} items
      </div>
    </div>
  `,
  styles: [`
    .virtual-list-container {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    
    .virtual-scroll-viewport {
      flex: 1;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    
    .list-item {
      display: flex;
      align-items: center;
      padding: 8px 16px;
      border-bottom: 1px solid #eee;
    }
    
    .list-item:hover {
      background-color: #f5f5f5;
    }
    
    .list-info {
      padding: 8px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
  `]
})
export class VirtualListComponent {
  @Input() items: any[] = [];
  @Input() itemTemplate!: TemplateRef<any>;
  @Input() itemHeight = 50;
  @Input() height = 400;
  @Input() showInfo = true;
  @Input() trackByFn?: TrackByFunction<any>;
  
  @Output() scrolledIndexChange = new EventEmitter<number>();
  
  defaultTrackBy(index: number): number {
    return index;
  }
  
  getVisibleRange(): string {
    // This would need ViewChild to access viewport for accurate range
    return '1-20'; // Placeholder
  }
}