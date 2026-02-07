import { Injectable } from '@angular/core';
import { UserService } from '../../service/user.service';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, forkJoin } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { CustomHttpResponse } from '../models/custom-http-response';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Key } from '../../enum/key.enum';
import { environment } from '../../../environments/environment';

export interface Permission {
  id: number;
  name: string;
  resourceType: string;
  actionType: string;
  description?: string;
  isContextual?: boolean;
  permissionCategory: 'BASIC' | 'ADMINISTRATIVE' | 'FINANCIAL' | 'CONFIDENTIAL' | 'SYSTEM';
}

export interface Role {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  hierarchyLevel: number;
  isSystemRole?: boolean;
  isActive?: boolean;
  roleCategory: 'LEGAL' | 'ADMINISTRATIVE' | 'FINANCIAL' | 'TECHNICAL' | 'SUPPORT';
  maxBillingRate?: number;
  permissions: Permission[];
}

export interface UserPermissions {
  userId: number;
  roles: Role[];
  effectivePermissions: Permission[];
  hierarchyLevel: number;
  hasFinancialAccess: boolean;
  hasAdministrativeAccess: boolean;
  contextualPermissions?: { [context: string]: Permission[] };
}

export interface UserRole {
  id: number;
  userId: number;
  roleId: number;
  role: Role;
  isPrimary: boolean;
  assignedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface CaseRole {
  id: number;
  caseId: number;
  userId: number;
  roleId: number;
  user: any;
  role: Role;
  assignedAt: Date;
  isActive: boolean;
}

/**
 * Enhanced RBAC Service for Angular Frontend
 * Supports hierarchical permissions, context-aware access control,
 * and modern law firm role management
 */
@Injectable({
  providedIn: 'root'
})
export class RbacService {
  private readonly baseUrl = `${environment.apiUrl}/api`;
  
  private currentUserPermissions$ = new BehaviorSubject<UserPermissions | null>(null);
  private permissionsCache = new Map<string, boolean>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Observable streams for reactive UI
  private _roles$ = new BehaviorSubject<Role[]>([]);
  private _permissions$ = new BehaviorSubject<Permission[]>([]);
  private _caseRoles$ = new BehaviorSubject<CaseRole[]>([]);

  // Simplified role definitions (6 core roles)
  // ROLE_ADMIN (100), ROLE_ATTORNEY (70), ROLE_FINANCE (65), PARALEGAL (40), ROLE_SECRETARY (20), ROLE_USER (10)
  private static readonly ADMIN_ROLES = [
    'ROLE_ADMIN', 'ADMINISTRATOR'
  ];

  private static readonly MANAGEMENT_ROLES = [
    'ROLE_ADMIN', 'ROLE_ATTORNEY', 'ROLE_FINANCE'
  ];

  private static readonly ATTORNEY_ROLES = [
    'ROLE_ATTORNEY', 'ROLE_ADMIN'
  ];

  private static readonly LEGAL_SUPPORT_ROLES = [
    'PARALEGAL', 'ROLE_SECRETARY'
  ];

  private static readonly FINANCE_ROLES = [
    'ROLE_FINANCE', 'ROLE_ADMIN'
  ];

  constructor(
    private http: HttpClient,
    private userService: UserService,
    private jwtHelper: JwtHelperService
  ) {
    // Use fallback permissions immediately from JWT/localStorage (no HTTP call)
    const userId = this.getCurrentUserId();
    if (userId) {
      this.createFallbackPermissions(userId).subscribe(p => {
        if (p) this.currentUserPermissions$.next(p);
      });
    }
    // Load full permissions from API after 5 seconds to avoid blocking login
    setTimeout(() => this.loadCurrentUserPermissions(), 5000);
  }

  // Observable getters
  get roles$(): Observable<Role[]> {
    return this._roles$.asObservable();
  }

  get permissions$(): Observable<Permission[]> {
    return this._permissions$.asObservable();
  }

  get caseRoles$(): Observable<CaseRole[]> {
    return this._caseRoles$.asObservable();
  }

  /**
   * Load current user's permissions and roles
   */
  private loadCurrentUserPermissions(): void {
    const userId = this.getCurrentUserId();
    if (!userId) {
      console.warn('🔍 RBAC: No user ID available, skipping permission load');
      return;
    }

    // Try API first, fallback to user object permissions
    this.http.get<UserPermissions>(`${this.baseUrl}/rbac/user/${userId}/permissions`)
      .pipe(
        catchError(error => {
          console.warn('🔍 RBAC API failed, using fallback permissions from user object:', error);
          return this.createFallbackPermissions(userId);
        })
      )
      .subscribe(permissions => {
        this.currentUserPermissions$.next(permissions);
        this.clearCache(); // Clear cache when permissions are refreshed
      });
  }

  /**
   * Create fallback permissions from user object when API is unavailable
   */
  private createFallbackPermissions(userId: number): Observable<UserPermissions | null> {
    try {
      const currentUser = this.getCurrentUserFromStorage();

      if (!currentUser) {
        return of(null);
      }
      
      // Extract permissions from different possible locations
      let permissionString = currentUser.permissions ||
                           currentUser.effectivePermissions ||
                           currentUser.permissionString ||
                           currentUser.user?.permissions ||
                           '';

      // Extract roles from different possible locations
      const userRoles = currentUser.roles ||
                       currentUser.user?.roles ||
                       [currentUser.roleName, currentUser.primaryRoleName].filter(Boolean) ||
                       [];

      // Parse permissions with improved error handling
      const effectivePermissions = this.parsePermissionsString(permissionString);

      // If no permissions parsed, create some basic ones based on roles
      if (effectivePermissions.length === 0 && userRoles.length > 0) {
        
        // Add basic permissions for all users
        const basicPermissions = [
          'USER:VIEW_OWN', 'USER:EDIT_OWN',
          'CASE:VIEW', 'DOCUMENT:VIEW', 'CALENDAR:VIEW',
          'TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:CREATE'
        ];
        
        // Add admin permissions for admin roles (simplified: ROLE_ADMIN, ROLE_ATTORNEY)
        if (userRoles.some((role: any) =>
          typeof role === 'string' &&
          ['ROLE_ADMIN', 'ROLE_ATTORNEY', 'ADMINISTRATOR'].includes(role)
        )) {
          basicPermissions.push(
            // System and Admin permissions
            'SYSTEM:ADMIN', 'SYSTEM:VIEW', 'SYSTEM:CREATE', 'SYSTEM:EDIT', 'SYSTEM:DELETE',
            'ROLE:ADMIN', 'ROLE:VIEW', 'ROLE:CREATE', 'ROLE:EDIT', 'ROLE:DELETE',
            'USER:ADMIN', 'USER:VIEW', 'USER:CREATE', 'USER:EDIT', 'USER:DELETE',
            
            // Case Management permissions
            'CASE:ADMIN', 'CASE:VIEW', 'CASE:CREATE', 'CASE:EDIT', 'CASE:DELETE', 'CASE:ASSIGN',
            'CASE:VIEW_ALL', 'CASE:VIEW_TEAM', 'CASE:APPROVE',
            
            // Document Management permissions
            'DOCUMENT:ADMIN', 'DOCUMENT:VIEW', 'DOCUMENT:CREATE', 'DOCUMENT:EDIT', 'DOCUMENT:DELETE',
            'DOCUMENT:VIEW_ALL', 'DOCUMENT:VIEW_TEAM', 'DOCUMENT:APPROVE',
            
            // Time Tracking permissions
            'TIME_TRACKING:ADMIN', 'TIME_TRACKING:VIEW', 'TIME_TRACKING:CREATE', 'TIME_TRACKING:EDIT', 'TIME_TRACKING:DELETE',
            'TIME_TRACKING:VIEW_OWN', 'TIME_TRACKING:VIEW_TEAM', 'TIME_TRACKING:VIEW_ALL', 'TIME_TRACKING:APPROVE',
            
            // Billing and Financial permissions
            'BILLING:ADMIN', 'BILLING:VIEW', 'BILLING:CREATE', 'BILLING:EDIT', 'BILLING:DELETE',
            'FINANCIAL:ADMIN', 'FINANCIAL:VIEW', 'FINANCIAL:CREATE', 'FINANCIAL:EDIT', 'FINANCIAL:DELETE',
            
            // Calendar permissions
            'CALENDAR:ADMIN', 'CALENDAR:VIEW', 'CALENDAR:CREATE', 'CALENDAR:EDIT', 'CALENDAR:DELETE',
            
            // Client Management permissions
            'CLIENT:ADMIN', 'CLIENT:VIEW', 'CLIENT:CREATE', 'CLIENT:EDIT', 'CLIENT:DELETE',

            // Report permissions
            'REPORT:ADMIN', 'REPORT:VIEW', 'REPORT:VIEW_OWN', 'REPORT:VIEW_TEAM', 'REPORT:VIEW_ALL',

            // Activity permissions
            'ACTIVITY:ADMIN', 'ACTIVITY:VIEW', 'ACTIVITY:CREATE', 'ACTIVITY:EDIT', 'ACTIVITY:DELETE',

            // Organization Management permissions
            'ORGANIZATION:ADMIN', 'ORGANIZATION:VIEW', 'ORGANIZATION:CREATE', 'ORGANIZATION:EDIT', 'ORGANIZATION:DELETE',

            // Invitation permissions
            'INVITATION:ADMIN', 'INVITATION:VIEW', 'INVITATION:CREATE', 'INVITATION:DELETE'
          );
        }
        
        effectivePermissions.push(...this.parsePermissionsString(basicPermissions.join(',')));
      }
      
      // Create roles array
      const roles: Role[] = userRoles.map((roleName: string | any) => {
        const roleNameStr = typeof roleName === 'string' ? roleName : (roleName.name || String(roleName));
        return {
          id: this.getRoleIdFromName(roleNameStr),
          name: roleNameStr,
          displayName: roleNameStr.replace(/_/g, ' '),
          description: `${roleNameStr} role`,
          hierarchyLevel: this.getHierarchyLevelFromRole(roleNameStr),
          isSystemRole: false,
          isActive: true,
          roleCategory: this.getRoleCategoryFromName(roleNameStr),
          permissions: effectivePermissions.filter(p => this.roleHasPermission(roleNameStr, p.name))
        };
      });

      // Create UserPermissions object
      const userPermissions: UserPermissions = {
        userId: userId,
        roles: roles,
        effectivePermissions: effectivePermissions,
        hierarchyLevel: Math.max(...roles.map(r => r.hierarchyLevel), 0),
        hasFinancialAccess: this.hasFinancialPermissions(effectivePermissions),
        hasAdministrativeAccess: this.hasAdministrativePermissions(effectivePermissions)
      };

      return of(userPermissions);
    } catch (error) {
      console.error('RBAC: Error creating fallback permissions:', error);
      return of(null);
    }
  }

  /**
   * Get current user from localStorage
   */
  private getCurrentUserFromStorage(): any {
    try {
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        return JSON.parse(userStr);
      }
      
      // Fallback: try to get from token payload
      const token = localStorage.getItem(Key.TOKEN);
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.user || payload;
      }
      
      return null;
    } catch (error) {
      console.error('🔍 RBAC: Error getting user from storage:', error);
      return null;
    }
  }

  /**
   * Parse permissions string into Permission objects
   */
  private parsePermissionsString(permissionString: string | string[] | any): Permission[] {
    if (!permissionString) return [];
    
    const permissions: Permission[] = [];
    let permissionPairs: string[] = [];
    
    try {
      // Handle different permission data formats
      if (typeof permissionString === 'string') {
        permissionPairs = permissionString.split(',');
      } else if (Array.isArray(permissionString)) {
        permissionPairs = permissionString;
      } else if (typeof permissionString === 'object') {
        // If it's an object, try to extract permission strings
        const permissionValues = Object.values(permissionString);
        permissionPairs = permissionValues.filter(p => typeof p === 'string') as string[];
      } else {
        console.warn('🔍 RBAC: Unexpected permission data type:', typeof permissionString, permissionString);
        return [];
      }
      
      permissionPairs.forEach(pair => {
        const trimmed = String(pair).trim();
        if (trimmed && trimmed.includes(':')) {
          const [resourceType, actionType] = trimmed.split(':');
          permissions.push({
            id: this.generatePermissionId(trimmed),
            name: trimmed,
            resourceType: resourceType,
            actionType: actionType,
            description: `${actionType} access to ${resourceType}`,
            isContextual: false,
            permissionCategory: this.getPermissionCategory(resourceType)
          });
        }
      });
    } catch (error) {
      console.error('🔍 RBAC: Error parsing permissions:', error, permissionString);
      return [];
    }
    
    return permissions;
  }

  /**
   * Helper methods for fallback permission creation
   * Updated for simplified 6-role structure
   */
  private getRoleIdFromName(roleName: string): number {
    const roleMap: { [key: string]: number } = {
      'ROLE_ADMIN': 20,
      'ROLE_ATTORNEY': 22,
      'ROLE_FINANCE': 107,
      'PARALEGAL': 11,
      'ROLE_SECRETARY': 13,
      'ROLE_USER': 21
    };
    return roleMap[roleName] || 21; // Default to USER
  }

  private getHierarchyLevelFromRole(roleName: string): number {
    const hierarchyMap: { [key: string]: number } = {
      'ROLE_ADMIN': 100,
      'ROLE_ATTORNEY': 70,
      'ROLE_FINANCE': 65,
      'PARALEGAL': 40,
      'ROLE_SECRETARY': 20,
      'ROLE_USER': 10
    };
    return hierarchyMap[roleName] || 10;
  }

  private getRoleCategoryFromName(roleName: string): any {
    if (roleName === 'ROLE_ATTORNEY') {
      return 'LEGAL';
    }
    if (roleName === 'ROLE_ADMIN') {
      return 'TECHNICAL';
    }
    if (roleName === 'ROLE_FINANCE') {
      return 'FINANCIAL';
    }
    return 'SUPPORT';
  }

  private getPermissionCategory(resourceType: string): any {
    const categories: { [key: string]: any } = {
      'SYSTEM': 'SYSTEM',
      'ROLE': 'ADMINISTRATIVE',
      'USER': 'ADMINISTRATIVE',
      'BILLING': 'FINANCIAL',
      'FINANCIAL': 'FINANCIAL',
      'CASE': 'BASIC',
      'DOCUMENT': 'BASIC',
      'TIME_TRACKING': 'BASIC',
      'CLIENT': 'BASIC',
      'CALENDAR': 'BASIC'
    };
    return categories[resourceType] || 'BASIC';
  }

  private generatePermissionId(permissionName: string): number {
    // Simple hash function to generate consistent IDs
    let hash = 0;
    for (let i = 0; i < permissionName.length; i++) {
      const char = permissionName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private roleHasPermission(roleName: string, permissionName: string): boolean {
    // For now, assume all permissions belong to all roles (will be filtered by actual permissions)
    return true;
  }

  private hasFinancialPermissions(permissions: Permission[]): boolean {
    return permissions.some(p => 
      p.permissionCategory === 'FINANCIAL' || 
      p.resourceType === 'BILLING' || 
      p.resourceType === 'FINANCIAL'
    );
  }

  private hasAdministrativePermissions(permissions: Permission[]): boolean {
    return permissions.some(p => 
      p.permissionCategory === 'ADMINISTRATIVE' || 
      p.permissionCategory === 'SYSTEM' ||
      p.resourceType === 'SYSTEM' ||
      p.resourceType === 'ROLE' ||
      p.resourceType === 'USER'
    );
  }

  /**
   * Load all roles
   */
  private loadRoles(): void {
    this.getAllRoles().subscribe({
      next: (roles) => {
        this._roles$.next(roles);
      },
      error: (error) => {
        console.warn('RBAC roles endpoint not available, using empty array');
        this._roles$.next([]);
      }
    });
  }

  /**
   * Load all permissions
   */
  private loadPermissions(): void {
    this.getAllPermissions().subscribe(permissions => {
      this._permissions$.next(permissions);
    });
  }

  /**
   * Get current user permissions as observable
   */
  getCurrentUserPermissions(): Observable<UserPermissions | null> {
    return this.currentUserPermissions$.asObservable();
  }

  /**
   * Check if current user has a specific permission
   */
  hasPermission(resource: string, action: string): Observable<boolean> {
    const cacheKey = `${resource}:${action}`;
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      return of(this.permissionsCache.get(cacheKey) || false);
    }

    const currentPermissions = this.currentUserPermissions$.value;
    if (!currentPermissions) {
      return of(false);
    }

    const hasPermission = this.checkPermission(currentPermissions, resource, action);
    
    // Cache the result
    this.permissionsCache.set(cacheKey, hasPermission);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);
    
    return of(hasPermission);
  }

  /**
   * Check permission synchronously (use carefully, prefer hasPermission)
   */
  hasPermissionSync(resource: string, action: string): boolean {
    const currentPermissions = this.currentUserPermissions$.value;
    
    // Get current user for fallback admin check
    const currentUser = this.getCurrentUserFromStorage();
    
    // ADMIN BYPASS: Check if user has admin roles - always return true
    if (currentUser) {
      const userRoles = currentUser.roles || 
                       currentUser.user?.roles || 
                       [currentUser.roleName, currentUser.primaryRoleName].filter(Boolean) ||
                       [];
      
      // Simplified admin roles (ROLE_ADMIN and ROLE_ATTORNEY have full access)
      const adminRoles = ['ROLE_ADMIN', 'ROLE_ATTORNEY', 'ADMINISTRATOR'];
      const hasAdminRole = userRoles.some((role: any) =>
        typeof role === 'string' && adminRoles.includes(role)
      );
      
      if (hasAdminRole) {
        return true;
      }
    }
    
    if (!currentPermissions) {
      // Fallback: check from current user permissions string
      if (currentUser && currentUser.permissions) {
        const permissionKey = `${resource}:${action}`;
        const adminPermission = `${resource}:ADMIN`;
        return currentUser.permissions.includes(permissionKey) || 
               currentUser.permissions.includes(adminPermission) ||
               currentUser.permissions.includes('SYSTEM:ADMIN');
      }
      return false;
    }
    
    return this.checkPermission(currentPermissions, resource, action);
  }

  /**
   * Check if user has context-specific permission (case-specific)
   */
  hasContextPermission(resource: string, action: string, contextType: string, contextId: number): Observable<boolean> {
    const userId = this.getCurrentUserId();
    if (!userId) return of(false);

    const cacheKey = `${resource}:${action}:${contextType}:${contextId}`;
    
    if (this.isCacheValid(cacheKey)) {
      return of(this.permissionsCache.get(cacheKey) || false);
    }

    return this.http.post<boolean>(`${this.baseUrl}/rbac/check-context-permission`, {
      userId,
      resource,
      action,
      contextType,
      contextId
    }).pipe(
      tap(result => {
        this.permissionsCache.set(cacheKey, result);
        this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);
      }),
      catchError(() => of(false))
    );
  }

  /**
   * Check case-specific permission
   */
  hasCasePermission(caseId: number, resource: string, action: string): Observable<boolean> {
    return this.hasContextPermission(resource, action, 'CASE', caseId);
  }

  /**
   * Check if user has specific role
   */
  hasRole(roleName: string): boolean {
    const currentPermissions = this.currentUserPermissions$.value;
    if (!currentPermissions) {
      // Fallback: check from current user in localStorage
      const currentUser = this.getCurrentUserFromStorage();
      if (currentUser && currentUser.roles) {
        return currentUser.roles.includes(roleName) || 
               currentUser.roleName === roleName ||
               currentUser.primaryRoleName === roleName;
      }
      return false;
    }
    
    return currentPermissions.roles.some(role => 
      role.name === roleName && role.isActive !== false
    );
  }

  /**
   * Check if user has minimum hierarchy level
   */
  hasMinimumHierarchyLevel(level: number): boolean {
    const currentPermissions = this.currentUserPermissions$.value;
    return currentPermissions ? currentPermissions.hierarchyLevel >= level : false;
  }

  /**
   * Check if user has administrative access
   */
  hasAdministrativeAccess(): boolean {
    const currentPermissions = this.currentUserPermissions$.value;
    return currentPermissions ? currentPermissions.hasAdministrativeAccess : false;
  }

  /**
   * Check if user has financial access
   */
  hasFinancialAccess(): boolean {
    const currentPermissions = this.currentUserPermissions$.value;
    return currentPermissions ? currentPermissions.hasFinancialAccess : false;
  }

  /**
   * Get user's effective billing rate
   */
  getMaxBillingRate(): number {
    const currentPermissions = this.currentUserPermissions$.value;
    if (!currentPermissions) return 0;
    
    return Math.max(...currentPermissions.roles
      .filter(role => role.maxBillingRate)
      .map(role => role.maxBillingRate || 0)
    );
  }

  /**
   * Check if user can edit resource (ownership-based)
   */
  canEditResource(resourceType: string, resourceOwnerId: number): Observable<boolean> {
    const userId = this.getCurrentUserId();
    if (!userId) return of(false);

    // Users can edit their own resources
    if (userId === resourceOwnerId) {
      return this.hasPermission(resourceType, 'EDIT_OWN');
    }

    // Check team/admin edit permissions
    return this.hasPermission(resourceType, 'EDIT').pipe(
      map(canEdit => canEdit || this.hasAdministrativeAccess())
    );
  }

  /**
   * Check if user can approve resources
   */
  canApprove(resourceType: string): Observable<boolean> {
    return this.hasPermission(resourceType, 'APPROVE').pipe(
      map(canApprove => canApprove || this.hasAdministrativeAccess())
    );
  }

  // Role Management Methods

  /**
   * Get all roles
   */
  getAllRoles(): Observable<Role[]> {
    return this.http.get<any>(`${this.baseUrl}/rbac/roles`).pipe(
      map(response => {
        // Handle wrapped response from backend
        if (response && Array.isArray(response)) {
          return response;
        }
        // Handle HttpResponse wrapper
        if (response && response.data && response.data.roles) {
          return response.data.roles;
        }
        return [];
      }),
      catchError(error => {
        console.error('Failed to load roles:', error);
        return of([]);
      })
    );
  }

  /**
   * Get all roles (alias for components expecting getRoles)
   */
  getRoles(): Observable<Role[]> {
    return this.getAllRoles();
  }

  /**
   * Get role by ID
   */
  getRoleById(roleId: number): Observable<Role | null> {
    return this.http.get<any>(`${this.baseUrl}/rbac/roles/${roleId}`).pipe(
      map(response => {
        // Handle wrapped response from backend
        if (response && response.data && response.data.role) {
          return response.data.role;
        }
        // Handle direct response
        if (response && response.id) {
          return response;
        }
        return null;
      }),
      catchError(error => {
        console.error('Failed to load role:', error);
        return of(null);
      })
    );
  }

  /**
   * Create new role
   */
  createRole(roleData: Partial<Role>): Observable<Role> {
    return this.http.post<any>(`${this.baseUrl}/rbac/roles`, roleData).pipe(
      map(response => {
        // Handle wrapped response from backend
        if (response && response.data && response.data.role) {
          return response.data.role;
        }
        // Handle direct response
        if (response && response.id) {
          return response;
        }
        return response;
      }),
      tap(() => this.loadRoles()),
      catchError(error => {
        console.error('Failed to create role:', error);
        throw error;
      })
    );
  }

  /**
   * Update existing role
   */
  updateRole(roleId: number, roleData: Partial<Role>): Observable<Role> {
    return this.http.put<any>(`${this.baseUrl}/rbac/roles/${roleId}`, roleData).pipe(
      map(response => {
        // Handle wrapped response from backend
        if (response && response.data && response.data.role) {
          return response.data.role;
        }
        // Handle direct response
        if (response && response.id) {
          return response;
        }
        return response;
      }),
      tap(() => this.loadRoles()),
      catchError(error => {
        console.error('Failed to update role:', error);
        throw error;
      })
    );
  }

  /**
   * Delete role
   */
  deleteRole(roleId: number): Observable<boolean> {
    return this.http.delete<any>(`${this.baseUrl}/rbac/roles/${roleId}`).pipe(
      map(response => {
        // Handle wrapped response from backend
        if (response && typeof response === 'boolean') {
          return response;
        }
        if (response && response.message) {
          return true; // Success if there's a message
        }
        return false;
      }),
      tap(() => this.loadRoles()),
      catchError(error => {
        console.error('Failed to delete role:', error);
        return of(false);
      })
    );
  }

  // Permission Management Methods

  /**
   * Get all available permissions
   */
  getAllPermissions(): Observable<Permission[]> {
    return this.http.get<any>(`${this.baseUrl}/rbac/permissions`).pipe(
      map(response => {
        // Handle wrapped response from backend
        if (response && response.data && response.data.permissions) {
          return response.data.permissions;
        }
        // Handle direct array response
        if (Array.isArray(response)) {
          return response;
        }
        return [];
      }),
      catchError(error => {
        console.error('Failed to load permissions:', error);
        return of([]);
      })
    );
  }

  /**
   * Get all permissions (alias for components expecting getPermissions)
   */
  getPermissions(): Observable<Permission[]> {
    return this.getAllPermissions();
  }

  /**
   * Assign permissions to role
   */
  assignPermissionsToRole(roleId: number, permissionIds: number[]): Observable<boolean> {
    // Backend expects { permissionIds: [...] } not just the array
    const payload = { permissionIds: permissionIds };
    
    return this.http.post<any>(`${this.baseUrl}/rbac/roles/${roleId}/permissions`, payload).pipe(
      map(response => {
        // Handle wrapped response from backend
        if (response && typeof response === 'boolean') {
          return response;
        }
        if (response && response.message) {
          return true; // Success if there's a message
        }
        return false;
      }),
      tap(() => this.loadRoles()),
      catchError(error => {
        console.error('Failed to assign permissions:', error);
        return of(false);
      })
    );
  }

  // User Management Methods

  /**
   * Get all users
   */
  getAllUsers(): Observable<any[]> {
    return this.http.get<any>(`${this.baseUrl}/users`).pipe(
      map(response => {
        // Handle wrapped response from backend
        if (response && response.data && response.data.users) {
          return response.data.users;
        }
        // Handle direct array response
        if (Array.isArray(response)) {
          return response;
        }
        return [];
      }),
      catchError(error => {
        console.error('Failed to load users:', error);
        return of([]);
      })
    );
  }

  /**
   * Get user roles
   */
  getUserRoles(userId: number): Observable<UserRole[]> {
    return this.http.get<UserRole[]>(`${this.baseUrl}/rbac/users/${userId}/roles`).pipe(
      catchError(error => {
        console.error('Failed to load user roles:', error);
        return of([]);
      })
    );
  }

  /**
   * Get user case roles
   */
  getUserCaseRoles(userId: number): Observable<CaseRole[]> {
    return this.http.get<CaseRole[]>(`${this.baseUrl}/rbac/users/${userId}/case-roles`).pipe(
      tap(caseRoles => this._caseRoles$.next(caseRoles)),
      catchError(error => {
        console.error('Failed to load user case roles:', error);
        return of([]);
      })
    );
  }

  /**
   * Assign role to user
   */
  assignRoleToUser(userId: number, roleId: number, expiresAt?: Date): Observable<boolean> {
    return this.http.post<boolean>(`${this.baseUrl}/rbac/assign-role`, {
      userId,
      roleId,
      expiresAt
    }).pipe(
      tap(() => this.refreshUserPermissions()),
      catchError(error => {
        console.error('Failed to assign role:', error);
        return of(false);
      })
    );
  }

  /**
   * Assign role to user (alias for compatibility)
   */
  assignRole(userId: number, roleId: number): Observable<boolean> {
    return this.assignRoleToUser(userId, roleId);
  }

  /**
   * Remove role from user
   */
  removeRoleFromUser(userId: number, roleId: number): Observable<boolean> {
    return this.http.delete<boolean>(`${this.baseUrl}/rbac/remove-role/${userId}/${roleId}`).pipe(
      tap(() => this.refreshUserPermissions()),
      catchError(error => {
        console.error('Failed to remove role:', error);
        return of(false);
      })
    );
  }

  /**
   * Remove role from user (alias for compatibility)
   */
  removeRole(userId: number, roleId: number): Observable<boolean> {
    return this.removeRoleFromUser(userId, roleId);
  }

  /**
   * Set primary role for user
   */
  setPrimaryRole(userId: number, roleId: number): Observable<boolean> {
    return this.http.post<boolean>(`${this.baseUrl}/rbac/set-primary-role`, {
      userId,
      roleId
    }).pipe(
      tap(() => this.refreshUserPermissions()),
      catchError(error => {
        console.error('Failed to set primary role:', error);
        return of(false);
      })
    );
  }

  // Case Role Management

  /**
   * Assign case role to user
   */
  assignCaseRole(caseId: number, userId: number, roleId: number): Observable<boolean> {
    return this.http.post<boolean>(`${this.baseUrl}/rbac/assign-case-role`, {
      caseId,
      userId,
      roleId
    }).pipe(
      tap(() => this.refreshUserPermissions()),
      catchError(error => {
        console.error('Failed to assign case role:', error);
        return of(false);
      })
    );
  }

  /**
   * Remove case role assignment
   */
  removeCaseRole(assignmentId: number): Observable<boolean> {
    return this.http.delete<boolean>(`${this.baseUrl}/rbac/case-roles/${assignmentId}`).pipe(
      tap(() => this.refreshUserPermissions()),
      catchError(error => {
        console.error('Failed to remove case role:', error);
        return of(false);
      })
    );
  }

  /**
   * Initialize RBAC service when user logs in
   */
  initialize(): void {
    this.loadCurrentUserPermissions();
  }

  /**
   * Refresh user permissions from server
   */
  refreshUserPermissions(): void {
    this.loadCurrentUserPermissions();
  }

  /**
   * Clear permissions cache
   */
  private clearCache(): void {
    this.permissionsCache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    return expiry ? Date.now() < expiry : false;
  }

  /**
   * Core permission checking logic
   */
  private checkPermission(userPermissions: UserPermissions, resource: string, action: string): boolean {
    const permissionName = `${resource}:${action}`;
    
    return userPermissions.effectivePermissions.some(permission => 
      permission.name === permissionName
    );
  }

  /**
   * Get current user ID from JWT token or local storage
   */
  private getCurrentUserId(): number | null {
    try {
      // Import Key enum for correct token key
      const token = localStorage.getItem(Key.TOKEN);
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = Number(payload.sub || payload.userId || payload.id);
        return userId;
      }
      return null;
    } catch (error) {
      console.error('Failed to get current user ID:', error);
      return null;
    }
  }

  // Convenience methods for common permission checks

  /**
   * Time tracking permission helpers
   */
  canViewOwnTimeEntries(): boolean {
    return this.hasPermissionSync('TIME_TRACKING', 'VIEW_OWN');
  }

  canViewTeamTimeEntries(): boolean {
    return this.hasPermissionSync('TIME_TRACKING', 'VIEW_TEAM');
  }

  canViewAllTimeEntries(): boolean {
    return this.hasPermissionSync('TIME_TRACKING', 'VIEW_ALL');
  }

  canApproveTimeEntries(): boolean {
    return this.hasPermissionSync('TIME_TRACKING', 'APPROVE');
  }

  /**
   * Case management permission helpers
   */
  canViewCases(): boolean {
    return this.hasPermissionSync('CASE', 'VIEW');
  }

  canCreateCases(): boolean {
    return this.hasPermissionSync('CASE', 'CREATE');
  }

  canAssignCases(): boolean {
    return this.hasPermissionSync('CASE', 'ASSIGN');
  }

  /**
   * User management permission helpers
   */
  canManageUsers(): boolean {
    return this.hasPermissionSync('USER', 'ADMIN');
  }

  canManageRoles(): boolean {
    return this.hasPermissionSync('ROLE', 'ADMIN');
  }

  /**
   * Billing permission helpers
   */
  canViewBilling(): boolean {
    return this.hasPermissionSync('BILLING', 'VIEW');
  }

  canCreateInvoices(): boolean {
    return this.hasPermissionSync('BILLING', 'CREATE');
  }

  /**
   * Check if user has any admin role
   */
  isAdmin(): boolean {
    const currentUser = this.getCurrentUserFromStorage();
    if (!currentUser) {
      return false;
    }

    // Get roles from various possible sources
    let userRoles = currentUser.roles ||
                   currentUser.user?.roles ||
                   [];

    // If roles is empty, try roleName and primaryRoleName
    if (!userRoles.length) {
      userRoles = [currentUser.roleName, currentUser.primaryRoleName].filter(Boolean);
    }

    // Handle both string arrays and object arrays
    const normalizedRoles = userRoles.map((role: any) => {
      if (typeof role === 'string') return role.toUpperCase();
      if (role && role.name) return role.name.toUpperCase();
      return '';
    }).filter(Boolean);

    const isAdminUser = RbacService.ADMIN_ROLES.some(role =>
      normalizedRoles.includes(role.toUpperCase())
    );

    return isAdminUser;
  }
  
  /**
   * Check if user has attorney-level permissions
   */
  isAttorneyLevel(): boolean {
    const currentUser = this.getCurrentUserFromStorage();
    if (!currentUser) return false;
    
    const userRoles = currentUser.roles || 
                     currentUser.user?.roles || 
                     [currentUser.roleName, currentUser.primaryRoleName].filter(Boolean) ||
                     [];
    
    return RbacService.ATTORNEY_ROLES.some(role => userRoles.includes(role));
  }
  
  /**
   * Check if user has management-level permissions
   */
  isManager(): boolean {
    const currentUser = this.getCurrentUserFromStorage();
    if (!currentUser) return false;
    
    const userRoles = currentUser.roles || 
                     currentUser.user?.roles || 
                     [currentUser.roleName, currentUser.primaryRoleName].filter(Boolean) ||
                     [];
    
    return this.isAdmin() || RbacService.MANAGEMENT_ROLES.some(role => userRoles.includes(role));
  }
} 