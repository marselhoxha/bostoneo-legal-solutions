import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin, of, timer, Subject, combineLatest } from 'rxjs';
import { map, tap, switchMap, catchError, filter, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { WebSocketService, WebSocketMessage } from './websocket.service';
import { RbacService, CaseRole } from './rbac.service';
import { CaseTask as ImportedCaseTask } from '../../interface/case-task';

// Interfaces
interface LegalCase {
  id: number;
  caseNumber: string;
  title: string;
  clientName: string;
  status: string;
  priority: string;
  type: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CaseAssignment {
  id: number;
  caseId: number;
  userId: number;
  userName: string;
  userEmail: string;
  roleType: CaseRoleType;
  assignmentType: string;
  active: boolean;
  workloadWeight: number;
}

type CaseTask = ImportedCaseTask;

enum CaseRoleType {
  LEAD_ATTORNEY = 'LEAD_ATTORNEY',
  SUPPORTING_ATTORNEY = 'SUPPORTING_ATTORNEY',
  CO_COUNSEL = 'CO_COUNSEL',
  ASSOCIATE = 'ASSOCIATE',
  PARALEGAL = 'PARALEGAL',
  LEGAL_ASSISTANT = 'LEGAL_ASSISTANT',
  SECRETARY = 'SECRETARY',
  CONSULTANT = 'CONSULTANT',
  CASE_MANAGER = 'CASE_MANAGER'
}

interface NavigationContext {
  previousView: string | null;
  currentView: string | null;
  filters: { [key: string]: any };
  sortOrder: { [key: string]: string };
  pageState: { [key: string]: any };
  timestamp: number;
}

interface ComponentNotification {
  type: 'CASE_UPDATED' | 'TEAM_UPDATED' | 'TASKS_UPDATED' | 'TASK_ASSIGNED' | 'TASK_REASSIGNED' | 'MEMBER_ADDED' | 'MEMBER_REMOVED' | 'ASSIGNMENT_CREATED' | 'ASSIGNMENT_UPDATED' | 'ASSIGNMENT_REMOVED';
  payload: any;
  timestamp: number;
  sourceComponent?: string;
}

interface TaskSummary {
  total: number;
  byStatus: { [key: string]: number };
  byPriority: { [key: string]: number };
  overdue: number;
  dueToday: number;
  dueSoon: number;
}

interface TeamSummary {
  total: number;
  byRole: { [key: string]: number };
  workloadStats: {
    overloaded: number;
    optimal: number;
    underutilized: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CaseContextService {
  private readonly apiUrl = 'http://localhost:8085/api/v1';
  
  // Core state subjects
  private currentCase$ = new BehaviorSubject<LegalCase | null>(null);
  private caseTeam$ = new BehaviorSubject<CaseAssignment[]>([]);
  private caseTasks$ = new BehaviorSubject<CaseTask[]>([]);
  private userCaseRole$ = new BehaviorSubject<CaseRoleType | null>(null);
  private navigationContext$ = new BehaviorSubject<NavigationContext>({
    previousView: null,
    currentView: null,
    filters: {},
    sortOrder: {},
    pageState: {},
    timestamp: Date.now()
  });
  
  // Computed observables
  private taskSummary$ = new BehaviorSubject<TaskSummary | null>(null);
  private teamSummary$ = new BehaviorSubject<TeamSummary | null>(null);
  
  // Component notification system
  private componentNotifications$ = new BehaviorSubject<ComponentNotification | null>(null);
  
  // Loading states
  private loadingStates$ = new BehaviorSubject<{ [key: string]: boolean }>({});
  
  // Error states
  private errorStates$ = new BehaviorSubject<{ [key: string]: string | null }>({});
  
  private destroy$ = new Subject<void>();
  private realTimeEnabled = true;
  
  constructor(
    private http: HttpClient,
    private webSocketService: WebSocketService,
    private rbacService: RbacService
  ) {
    this.initializeComputedObservables();
    this.initializeWebSocketIntegration();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // ==================== WebSocket Integration ====================
  
  /**
   * Initialize WebSocket integration for real-time updates
   */
  private initializeWebSocketIntegration(): void {
    if (!this.realTimeEnabled) return;
    
    console.log('🔌 CaseContextService - Initializing WebSocket integration');
    
    // Subscribe to case-related messages
    this.webSocketService.getCaseMessages()
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => {
        this.handleCaseMessage(message);
      });
    
    // Subscribe to task-related messages
    this.webSocketService.getTaskMessages()
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => {
        this.handleTaskMessage(message);
      });
    
    // Subscribe to assignment-related messages
    this.webSocketService.getAssignmentMessages()
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => {
        this.handleAssignmentMessage(message);
      });
  }
  
  /**
   * Handle case-related WebSocket messages
   */
  private handleCaseMessage(message: WebSocketMessage): void {
    const currentCase = this.currentCase$.value;
    
    // Only process messages for the current case
    if (!currentCase || message.caseId !== currentCase.id) {
      return;
    }
    
    console.log('📨 CaseContextService - Processing case message:', message);
    
    switch (message.type) {
      case 'CASE_UPDATED':
        this.refreshCurrentCase();
        break;
      case 'CASE_STATUS_CHANGED':
        if (message.data?.status) {
          this.updateCaseStatus(message.data.status);
        }
        break;
      case 'CASE_ASSIGNED':
        this.refreshCaseTeam();
        break;
    }
  }
  
  /**
   * Handle task-related WebSocket messages
   */
  private handleTaskMessage(message: WebSocketMessage): void {
    const currentCase = this.currentCase$.value;
    
    // Only process messages for the current case
    if (!currentCase || message.caseId !== currentCase.id) {
      return;
    }
    
    console.log('📨 CaseContextService - Processing task message:', message);
    
    switch (message.type) {
      case 'TASK_CREATED':
        if (message.data) {
          this.addTask(message.data, false); // false = don't trigger WebSocket broadcast
        }
        break;
      case 'TASK_UPDATED':
        if (message.data) {
          this.updateTask(message.data, false); // false = don't trigger WebSocket broadcast
        }
        break;
      case 'TASK_DELETED':
        if (message.data?.id) {
          this.removeTask(message.data.id, false); // false = don't trigger WebSocket broadcast
        }
        break;
      case 'TASK_ASSIGNED':
      case 'TASK_STATUS_CHANGED':
        if (message.data) {
          this.updateTask(message.data, false);
        }
        break;
    }
  }
  
  /**
   * Handle assignment-related WebSocket messages
   */
  private handleAssignmentMessage(message: WebSocketMessage): void {
    const currentCase = this.currentCase$.value;
    
    // Only process messages for the current case
    if (!currentCase || message.caseId !== currentCase.id) {
      return;
    }
    
    console.log('📨 CaseContextService - Processing assignment message:', message);
    
    switch (message.type) {
      case 'ASSIGNMENT_CREATED':
      case 'ASSIGNMENT_UPDATED':
      case 'ASSIGNMENT_REMOVED':
      case 'MEMBER_ADDED':
      case 'MEMBER_REMOVED':
        this.refreshCaseTeam();
        this.notifyComponents(message.type, {
          caseId: message.caseId,
          data: message.data
        });
        break;
    }
  }
  
  /**
   * Enable or disable real-time updates
   */
  setRealTimeEnabled(enabled: boolean): void {
    this.realTimeEnabled = enabled;
    console.log('🔄 CaseContextService - Real-time updates:', enabled ? 'enabled' : 'disabled');
  }
  
  /**
   * Check if real-time updates are enabled
   */
  isRealTimeEnabled(): boolean {
    return this.realTimeEnabled;
  }
  
  /**
   * Refresh current case data from backend
   */
  private refreshCurrentCase(): void {
    const currentCase = this.currentCase$.value;
    if (currentCase) {
      this.http.get<any>(`${this.apiUrl}/cases/${currentCase.id}`)
        .pipe(
          catchError(error => {
            console.error('❌ Failed to refresh case data:', error);
            return of(null);
          })
        )
        .subscribe(response => {
          if (response?.data) {
            this.currentCase$.next(response.data);
          }
        });
    }
  }
  
  /**
   * Refresh case team data from backend
   */
  private refreshCaseTeam(): void {
    const currentCase = this.currentCase$.value;
    if (currentCase) {
      this.http.get<any>(`${this.apiUrl}/case-assignments/case/${currentCase.id}`)
        .pipe(
          catchError(error => {
            console.error('❌ Failed to refresh case team:', error);
            return of({ data: [] });
          })
        )
        .subscribe(response => {
          const teamData = response.data?.content || response.data || [];
          this.caseTeam$.next(teamData);
        });
    }
  }
  
  /**
   * Update case status locally
   */
  private updateCaseStatus(status: string): void {
    const currentCase = this.currentCase$.value;
    if (currentCase) {
      const updatedCase = { ...currentCase, status };
      this.currentCase$.next(updatedCase);
    }
  }
  
  // ==================== Public API ====================
  
  /**
   * Get current case observable
   */
  getCurrentCase(): Observable<LegalCase | null> {
    return this.currentCase$.asObservable().pipe(distinctUntilChanged());
  }
  
  /**
   * Get current case snapshot
   */
  getCurrentCaseSnapshot(): LegalCase | null {
    return this.currentCase$.value;
  }
  
  /**
   * Set current case and load related data
   */
  setCurrentCase(caseData: LegalCase, loadRelatedData: boolean = true): Observable<void> {
    console.log('🎯 CaseContextService - Setting current case:', caseData);
    
    this.setLoading('case', true);
    this.currentCase$.next(caseData);
    
    // Subscribe to WebSocket updates for this case
    if (this.realTimeEnabled) {
      this.webSocketService.subscribeToCaseUpdates(caseData.id);
    }
    
    if (loadRelatedData) {
      return this.loadCaseRelatedData(caseData.id).pipe(
        tap(() => {
          this.setLoading('case', false);
          this.notifyComponents('CASE_UPDATED', caseData);
        }),
        catchError(error => {
          this.setError('case', error.message);
          this.setLoading('case', false);
          return of(void 0);
        })
      );
    }
    
    this.setLoading('case', false);
    this.notifyComponents('CASE_UPDATED', caseData);
    return of(void 0);
  }
  
  /**
   * Get case team observable
   */
  getCaseTeam(): Observable<CaseAssignment[]> {
    return this.caseTeam$.asObservable().pipe(distinctUntilChanged());
  }
  
  /**
   * Get case team snapshot
   */
  getCaseTeamSnapshot(): CaseAssignment[] {
    return this.caseTeam$.value;
  }
  
  /**
   * Update case team
   */
  updateCaseTeam(team: CaseAssignment[]): void {
    console.log('👥 CaseContextService - Updating case team:', team);
    this.caseTeam$.next(team);
    this.notifyComponents('TEAM_UPDATED', team);
    this.recalculateTeamSummary();
  }
  
  /**
   * Add team member
   */
  addTeamMember(member: CaseAssignment): void {
    const currentTeam = this.caseTeam$.value;
    const updatedTeam = [...currentTeam, member];
    this.updateCaseTeam(updatedTeam);
    this.notifyComponents('MEMBER_ADDED', member);
  }
  
  /**
   * Remove team member
   */
  removeTeamMember(memberId: number): void {
    const currentTeam = this.caseTeam$.value;
    const updatedTeam = currentTeam.filter(member => member.id !== memberId);
    this.updateCaseTeam(updatedTeam);
    this.notifyComponents('MEMBER_REMOVED', { memberId });
  }
  
  /**
   * Get case tasks observable
   */
  getCaseTasks(): Observable<CaseTask[]> {
    return this.caseTasks$.asObservable().pipe(distinctUntilChanged());
  }
  
  /**
   * Get case tasks snapshot
   */
  getCaseTasksSnapshot(): CaseTask[] {
    return this.caseTasks$.value;
  }
  
  /**
   * Update case tasks
   */
  updateTasks(tasks: CaseTask[]): void {
    console.log('📋 CaseContextService - Updating case tasks:', tasks);
    this.caseTasks$.next(tasks);
    this.notifyComponents('TASKS_UPDATED', tasks);
    this.recalculateTaskSummary();
  }
  
  /**
   * Add single task
   */
  addTask(task: CaseTask, broadcastWebSocket: boolean = true): void {
    const currentTasks = this.caseTasks$.value;
    const updatedTasks = [...currentTasks, task];
    this.updateTasks(updatedTasks);
    
    // Broadcast via WebSocket if enabled
    if (broadcastWebSocket && this.realTimeEnabled) {
      this.webSocketService.sendMessage({
        type: 'TASK_CREATED',
        data: task,
        caseId: task.caseId,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Update single task
   */
  updateTask(updatedTask: CaseTask, broadcastWebSocket: boolean = true): void {
    const currentTasks = this.caseTasks$.value;
    const taskIndex = currentTasks.findIndex(task => task.id === updatedTask.id);
    
    if (taskIndex !== -1) {
      const updatedTasks = [...currentTasks];
      updatedTasks[taskIndex] = updatedTask;
      this.updateTasks(updatedTasks);
      
      // Broadcast via WebSocket if enabled
      if (broadcastWebSocket && this.realTimeEnabled) {
        this.webSocketService.sendMessage({
          type: 'TASK_UPDATED',
          data: updatedTask,
          caseId: updatedTask.caseId,
          timestamp: Date.now()
        });
      }
    }
  }
  
  /**
   * Remove task
   */
  removeTask(taskId: number, broadcastWebSocket: boolean = true): void {
    const currentTasks = this.caseTasks$.value;
    const taskToRemove = currentTasks.find(task => task.id === taskId);
    const updatedTasks = currentTasks.filter(task => task.id !== taskId);
    this.updateTasks(updatedTasks);
    
    // Broadcast via WebSocket if enabled
    if (broadcastWebSocket && this.realTimeEnabled && taskToRemove) {
      this.webSocketService.sendMessage({
        type: 'TASK_DELETED',
        data: { id: taskId },
        caseId: taskToRemove.caseId,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Assign task to user
   */
  assignTask(taskId: number, userId: number): Observable<void> {
    return this.http.put<any>(`${this.apiUrl}/tasks/${taskId}/assign/${userId}`, {}).pipe(
      tap(() => {
        // Update local state optimistically
        const currentTasks = this.caseTasks$.value;
        const taskIndex = currentTasks.findIndex(task => task.id === taskId);
        
        if (taskIndex !== -1) {
          const teamMember = this.caseTeam$.value.find(member => member.userId === userId);
          const updatedTasks = [...currentTasks];
          updatedTasks[taskIndex] = {
            ...updatedTasks[taskIndex],
            assignedToId: userId,
            assignedToName: teamMember?.userName || 'Unknown'
          };
          this.updateTasks(updatedTasks);
          this.notifyComponents('TASK_ASSIGNED', { taskId, userId });
        }
      }),
      map(() => void 0)
    );
  }
  
  /**
   * Reassign task
   */
  reassignTask(taskId: number, newUserId: number): Observable<void> {
    return this.assignTask(taskId, newUserId).pipe(
      tap(() => this.notifyComponents('TASK_REASSIGNED', { taskId, newUserId }))
    );
  }
  
  /**
   * Get user's role in current case
   */
  getUserCaseRole(): Observable<CaseRoleType | null> {
    return this.userCaseRole$.asObservable().pipe(distinctUntilChanged());
  }
  
  /**
   * Set user's role in current case
   */
  setUserCaseRole(role: CaseRoleType | null): void {
    this.userCaseRole$.next(role);
  }
  
  /**
   * Load user's role in specific case
   */
  private loadUserCaseRole(caseId: number): void {
    this.http.get<any>(`${this.apiUrl}/case-assignments/user-role/${caseId}`)
      .pipe(
        catchError(error => {
          console.error('❌ Failed to load user case role:', error);
          return of({ data: null });
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(response => {
        if (response.data?.roleType) {
          this.setUserCaseRole(response.data.roleType);
        }
      });
  }
  
  /**
   * Get navigation context
   */
  getNavigationContext(): Observable<NavigationContext> {
    return this.navigationContext$.asObservable();
  }
  
  /**
   * Update navigation context
   */
  updateNavigationContext(context: Partial<NavigationContext>): void {
    const current = this.navigationContext$.value;
    const updated: NavigationContext = {
      ...current,
      ...context,
      timestamp: Date.now()
    };
    this.navigationContext$.next(updated);
  }
  
  /**
   * Get task summary
   */
  getTaskSummary(): Observable<TaskSummary | null> {
    return this.taskSummary$.asObservable();
  }
  
  /**
   * Get team summary
   */
  getTeamSummary(): Observable<TeamSummary | null> {
    return this.teamSummary$.asObservable();
  }
  
  /**
   * Get component notifications
   */
  getComponentNotifications(): Observable<ComponentNotification | null> {
    return this.componentNotifications$.asObservable().pipe(
      filter(notification => notification !== null)
    );
  }
  
  /**
   * Get loading states
   */
  getLoadingStates(): Observable<{ [key: string]: boolean }> {
    return this.loadingStates$.asObservable();
  }
  
  /**
   * Check if specific loading state is active
   */
  isLoading(key: string): Observable<boolean> {
    return this.loadingStates$.pipe(
      map(states => states[key] || false),
      distinctUntilChanged()
    );
  }
  
  /**
   * Get error states
   */
  getErrorStates(): Observable<{ [key: string]: string | null }> {
    return this.errorStates$.asObservable();
  }
  
  /**
   * Check if case context exists
   */
  hasCase(caseId?: number): boolean {
    const currentCase = this.currentCase$.value;
    if (!currentCase) return false;
    if (caseId) return currentCase.id === caseId;
    return true;
  }
  
  /**
   * Clear all context data
   */
  clearContext(): void {
    console.log('🧹 CaseContextService - Clearing context');
    this.currentCase$.next(null);
    this.caseTeam$.next([]);
    this.caseTasks$.next([]);
    this.userCaseRole$.next(null);
    this.taskSummary$.next(null);
    this.teamSummary$.next(null);
    this.clearAllErrors();
    this.clearAllLoading();
  }
  
  /**
   * Sync with backend data
   */
  syncWithBackend(caseId: number): Observable<void> {
    console.log('🔄 CaseContextService - Syncing with backend for case:', caseId);
    
    this.setLoading('sync', true);
    
    return forkJoin({
      case: this.http.get<any>(`${this.apiUrl}/cases/${caseId}`),
      team: this.http.get<any>(`${this.apiUrl}/case-assignments/case/${caseId}`),
      tasks: this.http.get<any>(`${this.apiUrl}/tasks/case/${caseId}`)
    }).pipe(
      tap(({ case: caseData, team, tasks }) => {
        this.currentCase$.next(caseData.data);
        this.updateCaseTeam(team.data?.content || team.data || []);
        this.updateTasks(tasks.data?.tasks?.content || tasks.data?.content || []);
        this.setLoading('sync', false);
      }),
      catchError(error => {
        this.setError('sync', error.message);
        this.setLoading('sync', false);
        return of(void 0);
      }),
      map(() => void 0)
    );
  }
  
  // ==================== Private Methods ====================
  
  private loadCaseRelatedData(caseId: number): Observable<void> {
    return forkJoin({
      team: this.http.get<any>(`${this.apiUrl}/case-assignments/case/${caseId}`),
      tasks: this.http.get<any>(`${this.apiUrl}/tasks/case/${caseId}`)
    }).pipe(
      tap(({ team, tasks }) => {
        this.updateCaseTeam(team.data?.content || team.data || []);
        this.updateTasks(tasks.data?.tasks?.content || tasks.data?.content || []);
      }),
      map(() => void 0)
    );
  }
  
  private initializeComputedObservables(): void {
    // Recalculate task summary when tasks change
    this.caseTasks$.subscribe(() => {
      this.recalculateTaskSummary();
    });
    
    // Recalculate team summary when team changes
    this.caseTeam$.subscribe(() => {
      this.recalculateTeamSummary();
    });
  }
  
  private recalculateTaskSummary(): void {
    const tasks = this.caseTasks$.value;
    
    const summary: TaskSummary = {
      total: tasks.length,
      byStatus: {},
      byPriority: {},
      overdue: 0,
      dueToday: 0,
      dueSoon: 0
    };
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    tasks.forEach(task => {
      // Count by status
      summary.byStatus[task.status] = (summary.byStatus[task.status] || 0) + 1;
      
      // Count by priority
      summary.byPriority[task.priority] = (summary.byPriority[task.priority] || 0) + 1;
      
      // Count by due date
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        if (dueDate < today) {
          summary.overdue++;
        } else if (dueDate >= today && dueDate < tomorrow) {
          summary.dueToday++;
        } else if (dueDate >= tomorrow && dueDate < nextWeek) {
          summary.dueSoon++;
        }
      }
    });
    
    this.taskSummary$.next(summary);
  }
  
  private recalculateTeamSummary(): void {
    const team = this.caseTeam$.value;
    
    const summary: TeamSummary = {
      total: team.length,
      byRole: {},
      workloadStats: {
        overloaded: 0,
        optimal: 0,
        underutilized: 0
      }
    };
    
    team.forEach(member => {
      // Count by role
      summary.byRole[member.roleType] = (summary.byRole[member.roleType] || 0) + 1;
      
      // Categorize workload (simplified for now)
      const workload = member.workloadWeight || 0;
      if (workload > 80) {
        summary.workloadStats.overloaded++;
      } else if (workload > 40) {
        summary.workloadStats.optimal++;
      } else {
        summary.workloadStats.underutilized++;
      }
    });
    
    this.teamSummary$.next(summary);
  }
  
  private notifyComponents(type: ComponentNotification['type'], payload: any): void {
    const notification: ComponentNotification = {
      type,
      payload,
      timestamp: Date.now()
    };
    
    console.log('📢 CaseContextService - Notifying components:', notification);
    this.componentNotifications$.next(notification);
    
    // Clear notification after a short delay to allow components to react
    timer(100).subscribe(() => {
      this.componentNotifications$.next(null);
    });
  }
  
  private setLoading(key: string, loading: boolean): void {
    const current = this.loadingStates$.value;
    this.loadingStates$.next({ ...current, [key]: loading });
  }
  
  private setError(key: string, error: string | null): void {
    const current = this.errorStates$.value;
    this.errorStates$.next({ ...current, [key]: error });
  }
  
  private clearAllLoading(): void {
    this.loadingStates$.next({});
  }
  
  private clearAllErrors(): void {
    this.errorStates$.next({});
  }
}