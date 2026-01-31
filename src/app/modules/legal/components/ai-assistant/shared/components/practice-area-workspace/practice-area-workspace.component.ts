import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ToolDefinition, ToolHistoryItem, HistoryGroup } from '../../models/tool-history.model';
import { WorkspaceStateService } from '../../services/workspace-state.service';

@Component({
  selector: 'app-practice-area-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './practice-area-workspace.component.html',
  styleUrls: ['./practice-area-workspace.component.scss']
})
export class PracticeAreaWorkspaceComponent implements OnInit, OnDestroy {
  @Input() practiceArea: string = '';
  @Input() practiceAreaTitle: string = '';
  @Input() tools: ToolDefinition[] = [];
  @Input() defaultTool: string = '';

  @Output() toolSelected = new EventEmitter<string>();
  @Output() historyItemSelected = new EventEmitter<ToolHistoryItem>();

  activeTool: string = '';
  historyGroups: HistoryGroup[] = [];
  filteredHistoryGroups: HistoryGroup[] = [];
  selectedHistoryItem: ToolHistoryItem | null = null;
  isLoading: boolean = false;
  isHistoryPanelOpen: boolean = false;
  activeHistoryFilter: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(private stateService: WorkspaceStateService) {}

  ngOnInit(): void {
    // Initialize workspace state
    this.stateService.initialize(this.practiceArea, this.defaultTool || this.tools[0]?.id || '');

    // Subscribe to state changes
    this.stateService.activeTool$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tool => {
        this.activeTool = tool;
      });

    this.stateService.historyGroups$
      .pipe(takeUntil(this.destroy$))
      .subscribe(groups => {
        this.historyGroups = groups;
        this.applyHistoryFilter();
      });

    this.stateService.selectedHistoryItem$
      .pipe(takeUntil(this.destroy$))
      .subscribe(item => {
        this.selectedHistoryItem = item;
      });

    this.stateService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onToolClick(toolId: string): void {
    this.stateService.setActiveTool(toolId);
    this.toolSelected.emit(toolId);
  }

  onHistoryItemClick(item: ToolHistoryItem): void {
    this.stateService.selectHistoryItem(item);
    this.historyItemSelected.emit(item);
    // Close panel on mobile after selection
    if (window.innerWidth < 768) {
      this.isHistoryPanelOpen = false;
    }
  }

  onDeleteHistoryItem(event: Event, item: ToolHistoryItem): void {
    event.stopPropagation();
    if (confirm('Delete this history item?')) {
      this.stateService.deleteHistoryItem(item.id);
    }
  }

  toggleHistoryPanel(): void {
    this.isHistoryPanelOpen = !this.isHistoryPanelOpen;
  }

  setHistoryFilter(toolType: string | null): void {
    this.activeHistoryFilter = toolType;
    this.applyHistoryFilter();
  }

  applyHistoryFilter(): void {
    if (!this.activeHistoryFilter) {
      this.filteredHistoryGroups = this.historyGroups;
    } else {
      this.filteredHistoryGroups = this.historyGroups
        .map(group => ({
          ...group,
          items: group.items.filter(item => item.toolType === this.activeHistoryFilter)
        }))
        .filter(group => group.items.length > 0);
    }
  }

  isToolActive(toolId: string): boolean {
    return this.activeTool === toolId;
  }

  isHistoryItemSelected(item: ToolHistoryItem): boolean {
    return this.selectedHistoryItem?.id === item.id;
  }

  getToolIcon(toolId: string): string {
    const tool = this.tools.find(t => t.id === toolId);
    return tool?.icon || 'ri-tools-line';
  }

  getToolName(toolId: string): string {
    const tool = this.tools.find(t => t.id === toolId);
    return tool?.name || toolId;
  }

  getTotalHistoryCount(): number {
    return this.historyGroups.reduce((sum, group) => sum + group.items.length, 0);
  }

  getToolHistoryCount(toolId: string): number {
    return this.historyGroups.reduce((sum, group) =>
      sum + group.items.filter(item => item.toolType === toolId).length, 0
    );
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
}
