import {
  Directive,
  ElementRef,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  Renderer2,
  NgZone
} from '@angular/core';
import { fromEvent, Subject, BehaviorSubject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface VirtualScrollConfig {
  itemHeight: number;
  bufferSize?: number;
  trackBy?: string;
  enableScrollbar?: boolean;
}

export interface VirtualScrollState {
  startIndex: number;
  endIndex: number;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

@Directive({
  selector: '[appVirtualScroll]',
  standalone: true
})
export class VirtualScrollDirective implements OnInit, OnDestroy {
  @Input() items: any[] = [];
  @Input() config: VirtualScrollConfig = { itemHeight: 50 };
  @Output() visibleItemsChange = new EventEmitter<any[]>();
  @Output() scrollStateChange = new EventEmitter<VirtualScrollState>();

  private destroy$ = new Subject<void>();
  private scrollState$ = new BehaviorSubject<VirtualScrollState>({
    startIndex: 0,
    endIndex: 0,
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0
  });

  private containerEl!: HTMLElement;
  private contentEl!: HTMLElement;
  private scrollbarEl?: HTMLElement;

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.setupVirtualScroll();
    this.initializeScrollListener();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupVirtualScroll(): void {
    this.containerEl = this.elementRef.nativeElement;
    
    // Setup container styles
    this.renderer.setStyle(this.containerEl, 'overflow-y', 'auto');
    this.renderer.setStyle(this.containerEl, 'position', 'relative');
    
    // Create content wrapper
    this.contentEl = this.renderer.createElement('div');
    this.renderer.setStyle(this.contentEl, 'position', 'relative');
    this.updateContentHeight();
    
    // Move existing content to wrapper
    const children = Array.from(this.containerEl.children);
    children.forEach(child => {
      this.renderer.appendChild(this.contentEl, child);
    });
    
    this.renderer.appendChild(this.containerEl, this.contentEl);
    
    // Create custom scrollbar if enabled
    if (this.config.enableScrollbar) {
      this.createCustomScrollbar();
    }
    
    // Initial render
    this.updateVisibleItems();
  }

  private initializeScrollListener(): void {
    // Run outside Angular zone for better performance
    this.ngZone.runOutsideAngular(() => {
      fromEvent(this.containerEl, 'scroll')
        .pipe(
          debounceTime(10),
          distinctUntilChanged(),
          takeUntil(this.destroy$)
        )
        .subscribe(() => {
          this.ngZone.run(() => {
            this.updateVisibleItems();
          });
        });
    });
  }

  private updateVisibleItems(): void {
    const scrollTop = this.containerEl.scrollTop;
    const clientHeight = this.containerEl.clientHeight;
    const itemHeight = this.config.itemHeight;
    const bufferSize = this.config.bufferSize || 5;
    
    // Calculate visible range
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
    const endIndex = Math.min(
      this.items.length,
      Math.ceil((scrollTop + clientHeight) / itemHeight) + bufferSize
    );
    
    // Update state
    const state: VirtualScrollState = {
      startIndex,
      endIndex,
      scrollTop,
      scrollHeight: this.items.length * itemHeight,
      clientHeight
    };
    
    this.scrollState$.next(state);
    this.scrollStateChange.emit(state);
    
    // Emit visible items
    const visibleItems = this.items.slice(startIndex, endIndex);
    this.visibleItemsChange.emit(visibleItems);
    
    // Update scrollbar if exists
    if (this.scrollbarEl) {
      this.updateScrollbar(state);
    }
  }

  private updateContentHeight(): void {
    const totalHeight = this.items.length * this.config.itemHeight;
    this.renderer.setStyle(this.contentEl, 'height', `${totalHeight}px`);
  }

  private createCustomScrollbar(): void {
    // Create scrollbar container
    const scrollbarContainer = this.renderer.createElement('div');
    this.renderer.setStyle(scrollbarContainer, 'position', 'absolute');
    this.renderer.setStyle(scrollbarContainer, 'right', '2px');
    this.renderer.setStyle(scrollbarContainer, 'top', '0');
    this.renderer.setStyle(scrollbarContainer, 'bottom', '0');
    this.renderer.setStyle(scrollbarContainer, 'width', '8px');
    this.renderer.setStyle(scrollbarContainer, 'background', 'rgba(0,0,0,0.1)');
    this.renderer.setStyle(scrollbarContainer, 'border-radius', '4px');
    
    // Create scrollbar thumb
    this.scrollbarEl = this.renderer.createElement('div');
    this.renderer.setStyle(this.scrollbarEl, 'position', 'absolute');
    this.renderer.setStyle(this.scrollbarEl, 'width', '100%');
    this.renderer.setStyle(this.scrollbarEl, 'background', 'rgba(0,0,0,0.3)');
    this.renderer.setStyle(this.scrollbarEl, 'border-radius', '4px');
    this.renderer.setStyle(this.scrollbarEl, 'cursor', 'pointer');
    this.renderer.setStyle(this.scrollbarEl, 'transition', 'background 0.2s');
    
    this.renderer.appendChild(scrollbarContainer, this.scrollbarEl);
    this.renderer.appendChild(this.containerEl, scrollbarContainer);
    
    // Add hover effect
    this.renderer.listen(this.scrollbarEl, 'mouseenter', () => {
      this.renderer.setStyle(this.scrollbarEl, 'background', 'rgba(0,0,0,0.5)');
    });
    
    this.renderer.listen(this.scrollbarEl, 'mouseleave', () => {
      this.renderer.setStyle(this.scrollbarEl, 'background', 'rgba(0,0,0,0.3)');
    });
    
    // Make scrollbar draggable
    this.makeScrollbarDraggable();
  }

  private makeScrollbarDraggable(): void {
    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;
    
    this.renderer.listen(this.scrollbarEl, 'mousedown', (e: MouseEvent) => {
      isDragging = true;
      startY = e.clientY;
      startScrollTop = this.containerEl.scrollTop;
      e.preventDefault();
    });
    
    this.renderer.listen('document', 'mousemove', (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaY = e.clientY - startY;
      const scrollRatio = this.containerEl.scrollHeight / this.containerEl.clientHeight;
      this.containerEl.scrollTop = startScrollTop + (deltaY * scrollRatio);
    });
    
    this.renderer.listen('document', 'mouseup', () => {
      isDragging = false;
    });
  }

  private updateScrollbar(state: VirtualScrollState): void {
    if (!this.scrollbarEl) return;
    
    const thumbHeight = Math.max(
      30,
      (state.clientHeight / state.scrollHeight) * state.clientHeight
    );
    const thumbTop = (state.scrollTop / state.scrollHeight) * state.clientHeight;
    
    this.renderer.setStyle(this.scrollbarEl, 'height', `${thumbHeight}px`);
    this.renderer.setStyle(this.scrollbarEl, 'top', `${thumbTop}px`);
  }

  // Public API for manual updates
  public refresh(): void {
    this.updateContentHeight();
    this.updateVisibleItems();
  }

  public scrollToIndex(index: number): void {
    const scrollTop = index * this.config.itemHeight;
    this.containerEl.scrollTop = scrollTop;
  }

  public scrollToTop(): void {
    this.containerEl.scrollTop = 0;
  }

  public scrollToBottom(): void {
    this.containerEl.scrollTop = this.containerEl.scrollHeight;
  }
}