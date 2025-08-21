import { Injectable, OnDestroy } from '@angular/core';
import { Observable, combineLatest, Subject, BehaviorSubject, of } from 'rxjs';
import { map, switchMap, catchError, takeUntil, distinctUntilChanged, tap } from 'rxjs/operators';
import { CaseContextService } from './case-context.service';
import { RbacService, Role, Permission } from './rbac.service';

export interface CasePermissionSummary {
  canViewCase: boolean;
  canEditCase: boolean;
  canDeleteCase: boolean;
  canCreateTasks: boolean;
  canEditTasks: boolean;
  canAssignTasks: boolean;
  canDeleteTasks: boolean;
  canManageAssignments: boolean;
  canViewFinancials: boolean;
  canEditFinancials: boolean;
  canAccessDocuments: boolean;
  canManageDocuments: boolean;
  canAccessCommunications: boolean;
  canBulkEdit: boolean;
  isLeadAttorney: boolean;
  isCaseManager: boolean;
  userRole: string | null;
  hierarchyLevel: number;
}

export interface TaskPermissionContext {
  taskId: number;
  assignedToId?: number;
  status: string;
  canEdit: boolean;
  canDelete: boolean;
  canAssign: boolean;
  canUpdateStatus: boolean;
  canViewDetails: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CasePermissionsService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private permissionCache = new Map<string, { value: boolean; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // Current permission summary
  private currentPermissions$ = new BehaviorSubject<CasePermissionSummary | null>(null);

  constructor(
    private caseContextService: CaseContextService,
    private rbacService: RbacService
  ) {
    this.initializePermissionTracking();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== Permission Summary ====================

  /**
   * Get current case permissions summary
   */
  getCurrentPermissions(): Observable<CasePermissionSummary | null> {
    return this.currentPermissions$.asObservable();
  }

  /**
   * Refresh permissions for current case
   */
  refreshPermissions(): void {
    this.calculatePermissions();
  }

  // ==================== Specific Permission Checks ====================

  /**
   * Check if user can perform specific action on current case
   */
  canPerformAction(resource: string, action: string): Observable<boolean> {
    return this.caseContextService.getCurrentCase().pipe(
      switchMap(caseData => {
        if (!caseData) {
          return this.rbacService.hasPermission(resource, action);
        }
        return this.getCachedPermission(`${caseData.id}_${resource}_${action}`, () =>
          this.rbacService.hasCasePermission(caseData.id, resource, action)
        );
      })
    );
  }

  /**
   * Quick permission checks
   */
  canCreateTasks(): Observable<boolean> {
    return this.getCurrentPermissions().pipe(
      map(permissions => permissions?.canCreateTasks || false)
    );
  }

  canAssignTasks(): Observable<boolean> {
    return this.getCurrentPermissions().pipe(
      map(permissions => permissions?.canAssignTasks || false)
    );
  }

  canManageTasks(): Observable<boolean> {
    return this.getCurrentPermissions().pipe(
      map(permissions => permissions?.canEditTasks || false)
    );
  }

  canManageAssignments(): Observable<boolean> {
    return this.getCurrentPermissions().pipe(
      map(permissions => permissions?.canManageAssignments || false)
    );
  }

  /**
   * Check task-specific permissions
   */
  getTaskPermissions(taskId: number, assignedToId?: number, status?: string): Observable<TaskPermissionContext> {
    return combineLatest([
      this.getCurrentPermissions(),
      this.rbacService.getCurrentUserPermissions(),
      this.caseContextService.getCurrentCase()
    ]).pipe(
      map(([permissions, userPermissions, caseData]) => {
        if (!permissions || !userPermissions || !caseData) {
          return {
            taskId,
            assignedToId,
            status: status || 'UNKNOWN',
            canEdit: false,
            canDelete: false,
            canAssign: false,
            canUpdateStatus: false,
            canViewDetails: false
          };
        }

        const isTaskOwner = assignedToId === userPermissions.userId;
        const isLeadAttorney = permissions.isLeadAttorney;
        const canManageTasks = permissions.canEditTasks;

        return {
          taskId,
          assignedToId,
          status: status || 'UNKNOWN',
          canEdit: canManageTasks || (isTaskOwner && permissions.canEditTasks),
          canDelete: permissions.canDeleteTasks || (isLeadAttorney && isTaskOwner),
          canAssign: permissions.canAssignTasks,
          canUpdateStatus: canManageTasks || (isTaskOwner && status !== 'COMPLETED'),
          canViewDetails: true // Basic viewing is usually allowed for case team members
        };
      })
    );
  }

  /**
   * Get available actions for current user on specific task
   */
  getAvailableTaskActions(taskId: number, assignedToId?: number, status?: string): Observable<string[]> {
    return this.getTaskPermissions(taskId, assignedToId, status).pipe(
      map(permissions => {
        const actions: string[] = [];
        
        if (permissions.canViewDetails) actions.push('VIEW');
        if (permissions.canEdit) actions.push('EDIT');
        if (permissions.canUpdateStatus) actions.push('UPDATE_STATUS');
        if (permissions.canAssign) actions.push('ASSIGN', 'REASSIGN');
        if (permissions.canDelete) actions.push('DELETE');
        
        return actions;
      })
    );
  }

  /**
   * Check if user can access specific case section
   */
  canAccessCaseSection(section: 'OVERVIEW' | 'TASKS' | 'DOCUMENTS' | 'FINANCIALS' | 'COMMUNICATIONS' | 'ASSIGNMENTS' | 'TIMELINE'): Observable<boolean> {
    return this.getCurrentPermissions().pipe(
      map(permissions => {
        if (!permissions) return false;

        switch (section) {
          case 'OVERVIEW':
            return permissions.canViewCase;
          case 'TASKS':
            return permissions.canCreateTasks || permissions.canEditTasks || permissions.canViewCase;
          case 'DOCUMENTS':
            return permissions.canAccessDocuments;
          case 'FINANCIALS':
            return permissions.canViewFinancials;
          case 'COMMUNICATIONS':
            return permissions.canAccessCommunications;
          case 'ASSIGNMENTS':
            return permissions.canManageAssignments || permissions.isLeadAttorney;
          case 'TIMELINE':
            return permissions.canViewCase;
          default:
            return false;
        }
      })
    );
  }

  /**
   * Get user's effective role in current case
   */
  getUserEffectiveRole(): Observable<string | null> {
    return this.getCurrentPermissions().pipe(
      map(permissions => permissions?.userRole || null)
    );
  }

  /**
   * Check if user is case team member
   */
  isCaseTeamMember(): Observable<boolean> {
    return combineLatest([
      this.caseContextService.getCaseTeam(),
      this.rbacService.getCurrentUserPermissions()
    ]).pipe(
      map(([team, userPermissions]) => {
        if (!userPermissions || !team) return false;
        return team.some(member => member.userId === userPermissions.userId);
      })
    );
  }

  /**
   * Get permission level (numeric representation for easy comparison)
   */
  getPermissionLevel(): Observable<number> {
    return this.getCurrentPermissions().pipe(
      map(permissions => {
        if (!permissions) return 0;
        
        if (permissions.isLeadAttorney) return 100;
        if (permissions.isCaseManager) return 80;
        if (permissions.canManageAssignments) return 60;
        if (permissions.canEditTasks) return 40;
        if (permissions.canCreateTasks) return 20;
        if (permissions.canViewCase) return 10;
        
        return 0;
      })
    );
  }

  // ==================== Bulk Operations ====================

  /**
   * Check permissions for multiple tasks at once
   */
  getBulkTaskPermissions(tasks: { id: number; assignedToId?: number; status: string }[]): Observable<{ [taskId: number]: TaskPermissionContext }> {
    const taskPermissions$ = tasks.map(task => 
      this.getTaskPermissions(task.id, task.assignedToId, task.status).pipe(
        map(permissions => ({ [task.id]: permissions }))
      )
    );

    return combineLatest(taskPermissions$).pipe(
      map(permissions => permissions.reduce((acc, perm) => ({ ...acc, ...perm }), {}))
    );
  }

  /**
   * Check if user can perform bulk operations
   */
  canPerformBulkOperations(): Observable<boolean> {
    return this.getCurrentPermissions().pipe(
      map(permissions => permissions?.canBulkEdit || false)
    );
  }

  // ==================== Private Methods ====================

  private initializePermissionTracking(): void {
    // Recalculate permissions when case or user changes
    combineLatest([
      this.caseContextService.getCurrentCase(),
      this.rbacService.getCurrentUserPermissions()
    ]).pipe(
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.calculatePermissions();
    });
  }

  private calculatePermissions(): void {
    combineLatest([
      this.caseContextService.getCurrentCase(),
      this.caseContextService.getUserCaseRole(),
      this.rbacService.getCurrentUserPermissions()
    ]).pipe(
      switchMap(([caseData, userRole, userPermissions]) => {
        if (!caseData || !userPermissions) {
          this.currentPermissions$.next(null);
          return of(null);
        }

        // Calculate all permissions in parallel
        return combineLatest([
          this.rbacService.hasCasePermission(caseData.id, 'CASE', 'VIEW'),
          this.rbacService.hasCasePermission(caseData.id, 'CASE', 'EDIT'),
          this.rbacService.hasCasePermission(caseData.id, 'CASE', 'DELETE'),
          this.rbacService.hasCasePermission(caseData.id, 'TASK', 'CREATE'),
          this.rbacService.hasCasePermission(caseData.id, 'TASK', 'EDIT'),
          this.rbacService.hasCasePermission(caseData.id, 'TASK', 'ASSIGN'),
          this.rbacService.hasCasePermission(caseData.id, 'TASK', 'DELETE'),
          this.rbacService.hasCasePermission(caseData.id, 'ASSIGNMENT', 'MANAGE'),
          this.rbacService.hasCasePermission(caseData.id, 'FINANCIAL', 'VIEW'),
          this.rbacService.hasCasePermission(caseData.id, 'FINANCIAL', 'EDIT'),
          this.rbacService.hasCasePermission(caseData.id, 'DOCUMENT', 'VIEW'),
          this.rbacService.hasCasePermission(caseData.id, 'DOCUMENT', 'MANAGE'),
          this.rbacService.hasCasePermission(caseData.id, 'COMMUNICATION', 'VIEW'),
          this.rbacService.hasCasePermission(caseData.id, 'TASK', 'BULK_EDIT')
        ]).pipe(
          map(([
            canViewCase, canEditCase, canDeleteCase, canCreateTasks,
            canEditTasks, canAssignTasks, canDeleteTasks, canManageAssignments,
            canViewFinancials, canEditFinancials, canAccessDocuments, canManageDocuments,
            canAccessCommunications, canBulkEdit
          ]) => ({
            canViewCase,
            canEditCase,
            canDeleteCase,
            canCreateTasks,
            canEditTasks,
            canAssignTasks,
            canDeleteTasks,
            canManageAssignments,
            canViewFinancials,
            canEditFinancials,
            canAccessDocuments,
            canManageDocuments,
            canAccessCommunications,
            canBulkEdit,
            isLeadAttorney: userRole === 'LEAD_ATTORNEY',
            isCaseManager: userRole === 'CASE_MANAGER',
            userRole: userRole,
            hierarchyLevel: userPermissions.hierarchyLevel
          }))
        );
      }),
      catchError(error => {
        console.error('❌ CasePermissionsService - Error calculating permissions:', error);
        return of(null);
      })
    ).subscribe(permissions => {
      this.currentPermissions$.next(permissions);
    });
  }

  private getCachedPermission(key: string, permissionCheck: () => Observable<boolean>): Observable<boolean> {
    const cached = this.permissionCache.get(key);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < this.cacheTimeout) {
      return of(cached.value);
    }

    return permissionCheck().pipe(
      tap(result => {
        this.permissionCache.set(key, { value: result, timestamp: now });
      })
    );
  }

  /**
   * Clear permission cache
   */
  clearCache(): void {
    this.permissionCache.clear();
  }
}