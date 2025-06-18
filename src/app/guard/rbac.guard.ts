import { Injectable } from '@angular/core';
import { 
  CanActivate, 
  CanActivateChild, 
  Router, 
  ActivatedRouteSnapshot, 
  RouterStateSnapshot,
  UrlTree 
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { RbacService } from '../core/services/rbac.service';

export interface RoutePermission {
  resource: string;
  action: string;
  requireAll?: boolean; // If true, user must have ALL permissions
  contextType?: string; // For context-aware permissions
  contextParam?: string; // Route parameter name for context ID
  hierarchyLevel?: number; // Minimum hierarchy level required
  roles?: string[]; // Specific roles required
}

/**
 * Enhanced RBAC Guard for protecting routes with comprehensive permission checking
 * Supports hierarchical permissions, context-aware routing, and role-based access
 */
@Injectable({
  providedIn: 'root'
})
export class RbacGuard implements CanActivate, CanActivateChild {

  constructor(
    private rbacService: RbacService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.checkPermissions(route, state);
  }

  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.checkPermissions(childRoute, state);
  }

  private checkPermissions(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    
    // Get permission requirements from route data
    const requiredPermissions = this.extractPermissions(route);
    
    if (!requiredPermissions || requiredPermissions.length === 0) {
      // No specific permissions required, allow access
      return of(true);
    }

    // Check current user permissions
    return this.rbacService.getCurrentUserPermissions().pipe(
      map(currentPermissions => {
        if (!currentPermissions) {
          console.warn('🔍 RBAC Guard: No user permissions available, redirecting to login');
          return this.router.createUrlTree(['/auth/login']);
        }

        // ADMIN BYPASS: Check if user has admin roles - give full access
        const adminRoles = ['MANAGING_PARTNER', 'ROLE_ADMIN', 'SENIOR_PARTNER', 'ADMINISTRATOR', 'ROLE_SYSADMIN'];
        const hasAdminRole = currentPermissions.roles?.some(role => 
          adminRoles.some(adminRole => 
            role.name === adminRole || 
            role.name === `ROLE_${adminRole}` ||
            role.displayName?.includes('PARTNER') ||
            role.displayName?.includes('ADMIN')
          )
        ) || false;

        // HIERARCHY BYPASS: Check if user has high hierarchy level (80+)
        const hasHighHierarchy = currentPermissions.hierarchyLevel >= 80;

        // PERMISSION BYPASS: Check if user has system admin permissions
        const hasSystemAdmin = currentPermissions.effectivePermissions?.some(perm => 
          perm.name === 'SYSTEM:ADMIN' || 
          perm.resourceType === 'SYSTEM' ||
          perm.permissionCategory === 'SYSTEM'
        ) || false;

        if (hasAdminRole || hasHighHierarchy || hasSystemAdmin) {
          console.log('🔍 RBAC Guard: Admin user detected, granting full access to:', state.url);
          return true;
        }

        // Check all required permissions for non-admin users
        for (const permission of requiredPermissions) {
          if (!this.checkSinglePermissionSync(permission, route, currentPermissions)) {
            console.warn('🔍 RBAC Guard: Permission denied for:', permission);
            const redirectUrl = this.getRedirectUrl(requiredPermissions);
            return this.router.createUrlTree([redirectUrl]);
          }
        }

        console.log('🔍 RBAC Guard: Access granted to:', state.url);
        return true;
      }),
      catchError(error => {
        console.error('🔍 RBAC Guard: Error checking permissions:', error);
        return of(this.router.createUrlTree(['/home']));
      })
    );
  }

  private checkSinglePermissionSync(
    permission: RoutePermission,
    route: ActivatedRouteSnapshot,
    currentPermissions: any
  ): boolean {
    
    // Check hierarchy level requirement
    if (permission.hierarchyLevel !== undefined) {
      if (!currentPermissions.hierarchyLevel || currentPermissions.hierarchyLevel < permission.hierarchyLevel) {
        return false;
      }
    }

    // Check specific role requirements
    if (permission.roles && permission.roles.length > 0) {
      const hasRequiredRole = permission.roles.some(role => 
        currentPermissions.roles?.some((userRole: any) => userRole.name === role)
      );
      if (!hasRequiredRole) {
        return false;
      }
    }

    // Check basic resource:action permission
    const permissionName = `${permission.resource}:${permission.action}`;
    return currentPermissions.effectivePermissions?.some((perm: any) => 
      perm.name === permissionName
    ) || false;
  }

  private extractPermissions(route: ActivatedRouteSnapshot): RoutePermission[] {
    const permissions: RoutePermission[] = [];

    // Check current route data
    if (route.data['permission']) {
      permissions.push(route.data['permission']);
    }

    if (route.data['permissions']) {
      permissions.push(...route.data['permissions']);
    }

    // Check parent routes for inherited permissions
    let currentRoute = route.parent;
    while (currentRoute) {
      if (currentRoute.data['inheritedPermission']) {
        permissions.push(currentRoute.data['inheritedPermission']);
      }
      currentRoute = currentRoute.parent;
    }

    return permissions;
  }

  private getRedirectUrl(permissions: RoutePermission[]): string {
    // Determine appropriate redirect based on permission types
    const hasAdminPermission = permissions.some(p => 
      p.resource === 'SYSTEM' || p.action === 'ADMIN'
    );

    const hasFinancialPermission = permissions.some(p => 
      p.resource === 'BILLING' || p.resource === 'FINANCIAL'
    );

    if (hasAdminPermission) {
      return '/errors/403-admin';
    } else if (hasFinancialPermission) {
      return '/errors/403-financial';
    } else {
      return '/errors/403';
    }
  }
}

/**
 * Helper function to create route permission configurations
 */
export function createRoutePermission(
  resource: string,
  action: string,
  options?: {
    hierarchyLevel?: number;
    roles?: string[];
    contextType?: string;
    contextParam?: string;
  }
): RoutePermission {
  return {
    resource,
    action,
    ...options
  };
}

/**
 * Common permission configurations for reuse
 */
export class RoutePermissions {
  
  // Time Tracking Permissions
  static readonly VIEW_OWN_TIME = createRoutePermission('TIME_TRACKING', 'VIEW_OWN');
  static readonly VIEW_TEAM_TIME = createRoutePermission('TIME_TRACKING', 'VIEW_TEAM', { hierarchyLevel: 25 });
  static readonly VIEW_ALL_TIME = createRoutePermission('TIME_TRACKING', 'VIEW_ALL', { hierarchyLevel: 70 });
  static readonly APPROVE_TIME = createRoutePermission('TIME_TRACKING', 'APPROVE', { hierarchyLevel: 30 });

  // Case Management Permissions
  static readonly VIEW_CASES = createRoutePermission('CASE', 'VIEW');
  static readonly CREATE_CASES = createRoutePermission('CASE', 'CREATE', { hierarchyLevel: 25 });
  static readonly EDIT_CASE = createRoutePermission('CASE', 'EDIT', { 
    contextType: 'CASE', 
    contextParam: 'caseId' 
  });
  static readonly ASSIGN_CASES = createRoutePermission('CASE', 'ASSIGN', { hierarchyLevel: 50 });

  // Client Management Permissions
  static readonly VIEW_CLIENTS = createRoutePermission('CLIENT', 'VIEW');
  static readonly CREATE_CLIENTS = createRoutePermission('CLIENT', 'CREATE', { hierarchyLevel: 25 });
  static readonly EDIT_CLIENT = createRoutePermission('CLIENT', 'EDIT', {
    contextType: 'CLIENT',
    contextParam: 'clientId'
  });

  // Document Management Permissions
  static readonly VIEW_DOCUMENTS = createRoutePermission('DOCUMENT', 'VIEW');
  static readonly CREATE_DOCUMENTS = createRoutePermission('DOCUMENT', 'CREATE');
  static readonly EDIT_DOCUMENT = createRoutePermission('DOCUMENT', 'EDIT', {
    contextType: 'DOCUMENT',
    contextParam: 'documentId'
  });

  // Administrative Permissions
  static readonly ADMIN_USERS = createRoutePermission('USER', 'ADMIN', { hierarchyLevel: 80 });
  static readonly ADMIN_ROLES = createRoutePermission('ROLE', 'ADMIN', { hierarchyLevel: 90 });
  static readonly ADMIN_SYSTEM = createRoutePermission('SYSTEM', 'ADMIN', { 
    hierarchyLevel: 100,
    roles: ['MANAGING_PARTNER', 'ROLE_ADMIN']
  });

  // Financial Permissions
  static readonly VIEW_BILLING = createRoutePermission('BILLING', 'VIEW', { hierarchyLevel: 30 });
  static readonly CREATE_INVOICES = createRoutePermission('BILLING', 'CREATE', { hierarchyLevel: 50 });
  static readonly FINANCIAL_ADMIN = createRoutePermission('FINANCIAL', 'ADMIN', { 
    hierarchyLevel: 65,
    roles: ['CFO', 'FINANCE_MANAGER', 'MANAGING_PARTNER']
  });

  // Calendar Permissions
  static readonly VIEW_CALENDAR = createRoutePermission('CALENDAR', 'VIEW');
  static readonly CREATE_EVENTS = createRoutePermission('CALENDAR', 'CREATE');
  static readonly ADMIN_CALENDAR = createRoutePermission('CALENDAR', 'ADMIN', { hierarchyLevel: 50 });
} 