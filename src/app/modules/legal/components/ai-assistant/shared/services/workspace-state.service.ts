import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ToolDefinition, ToolHistoryItem, HistoryGroup } from '../models/tool-history.model';
import { PracticeAreaToolHistoryService } from './practice-area-tool-history.service';

/**
 * State management service for Practice Area Workspaces
 * Manages active tool selection, history state, and UI interactions
 */
@Injectable({
  providedIn: 'root'
})
export class WorkspaceStateService {
  // Active tool state
  private activeToolSubject = new BehaviorSubject<string>('');
  activeTool$ = this.activeToolSubject.asObservable();

  // Selected history item state
  private selectedHistoryItemSubject = new BehaviorSubject<ToolHistoryItem | null>(null);
  selectedHistoryItem$ = this.selectedHistoryItemSubject.asObservable();

  // History groups state (organized by date)
  private historyGroupsSubject = new BehaviorSubject<HistoryGroup[]>([]);
  historyGroups$ = this.historyGroupsSubject.asObservable();

  // Loading state
  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();

  // Current practice area
  private currentPracticeArea: string = '';

  // Linked case ID (optional)
  private linkedCaseIdSubject = new BehaviorSubject<number | null>(null);
  linkedCaseId$ = this.linkedCaseIdSubject.asObservable();

  constructor(private historyService: PracticeAreaToolHistoryService) {}

  /**
   * Initialize the workspace state for a practice area
   */
  initialize(practiceArea: string, defaultTool: string): void {
    this.currentPracticeArea = practiceArea;
    this.activeToolSubject.next(defaultTool);
    this.loadHistory();
  }

  /**
   * Get the current active tool
   */
  getActiveTool(): string {
    return this.activeToolSubject.value;
  }

  /**
   * Set the active tool
   */
  setActiveTool(toolId: string): void {
    this.activeToolSubject.next(toolId);
    this.selectedHistoryItemSubject.next(null);
  }

  /**
   * Load history for the current practice area
   */
  loadHistory(toolType?: string): void {
    if (!this.currentPracticeArea) return;

    this.loadingSubject.next(true);
    this.historyService.getHistory(this.currentPracticeArea, toolType).subscribe({
      next: (items) => {
        const groups = this.historyService.groupHistoryByDate(items);
        this.historyGroupsSubject.next(groups);
        this.loadingSubject.next(false);
      },
      error: (error) => {
        console.error('Error loading history:', error);
        this.loadingSubject.next(false);
      }
    });
  }

  /**
   * Select a history item to load its data
   */
  selectHistoryItem(item: ToolHistoryItem): void {
    this.selectedHistoryItemSubject.next(item);
    // Switch to the tool type of the selected item
    this.activeToolSubject.next(item.toolType);
  }

  /**
   * Get the currently selected history item
   */
  getSelectedHistoryItem(): ToolHistoryItem | null {
    return this.selectedHistoryItemSubject.value;
  }

  /**
   * Clear the selected history item
   */
  clearSelectedHistoryItem(): void {
    this.selectedHistoryItemSubject.next(null);
  }

  /**
   * Save a new history entry
   */
  saveToHistory(toolType: string, inputData: Record<string, any>, outputData?: Record<string, any>, aiAnalysis?: string, title?: string): Observable<ToolHistoryItem> {
    const request = {
      toolType,
      title,
      inputData,
      outputData,
      aiAnalysis,
      caseId: this.linkedCaseIdSubject.value ?? undefined
    };

    return this.historyService.createHistory(this.currentPracticeArea, request);
  }

  /**
   * Delete a history item
   */
  deleteHistoryItem(id: number): void {
    this.historyService.deleteHistory(this.currentPracticeArea, id).subscribe({
      next: () => {
        // Reload history to update the groups
        this.loadHistory();
        // Clear selection if the deleted item was selected
        if (this.selectedHistoryItemSubject.value?.id === id) {
          this.selectedHistoryItemSubject.next(null);
        }
      },
      error: (error) => {
        console.error('Error deleting history item:', error);
      }
    });
  }

  /**
   * Toggle a history group's expanded state
   */
  toggleHistoryGroup(label: string): void {
    const groups = this.historyGroupsSubject.value;
    const updatedGroups = groups.map(group => {
      if (group.label === label) {
        return { ...group, isExpanded: !group.isExpanded };
      }
      return group;
    });
    this.historyGroupsSubject.next(updatedGroups);
  }

  /**
   * Set a linked case ID
   */
  setLinkedCase(caseId: number | null): void {
    this.linkedCaseIdSubject.next(caseId);
  }

  /**
   * Get the linked case ID
   */
  getLinkedCaseId(): number | null {
    return this.linkedCaseIdSubject.value;
  }

  /**
   * Reset workspace state
   */
  reset(): void {
    this.activeToolSubject.next('');
    this.selectedHistoryItemSubject.next(null);
    this.historyGroupsSubject.next([]);
    this.linkedCaseIdSubject.next(null);
    this.currentPracticeArea = '';
  }
}
