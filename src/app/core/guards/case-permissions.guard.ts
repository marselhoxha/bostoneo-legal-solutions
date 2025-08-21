import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of, combineLatest, Subject } from 'rxjs';
import { map, catchError, switchMap, tap, takeUntil } from 'rxjs/operators';
import { CaseContextService } from '../services/case-context.service';
import { RbacService } from '../services/rbac.service';
import { NotificationService } from '../../service/notification.service';

export interface CasePermissionConfig {
  resource: string;
  action: string;
  redirectTo?: string;
  requireCaseContext?: boolean;
  fallbackPermissions?: { resource: string; action: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class CasePermissionsGuard implements CanActivate {

  constructor(
    private caseContextService: CaseContextService,
    private rbacService: RbacService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    
    console.log('🛡️ CasePermissionsGuard - Checking permissions for:', state.url);

    // Get permission configuration from route data
    const permissionConfig = route.data['permissions'] as CasePermissionConfig;
    
    if (!permissionConfig) {
      console.log('✅ CasePermissionsGuard - No permission config, allowing access');
      return true;
    }

    const caseId = this.extractCaseId(route);
    
    // If case context is required but not available
    if (permissionConfig.requireCaseContext && !caseId) {
      console.log('❌ CasePermissionsGuard - Case context required but not available');
      this.handleAccessDenied('Case context required', permissionConfig.redirectTo);
      return false;
    }

    return this.checkPermissions(permissionConfig, caseId, state.url);
  }

  private checkPermissions(
    config: CasePermissionConfig, 
    caseId: number | null, 
    url: string
  ): Observable<boolean> {
    
    // For case-specific permissions
    if (caseId) {
      return this.checkCasePermission(config, caseId, url);
    }
    
    // For general permissions
    return this.checkGeneralPermission(config, url);
  }

  private checkCasePermission(
    config: CasePermissionConfig,
    caseId: number,
    url: string
  ): Observable<boolean> {
    
    console.log('🔍 CasePermissionsGuard - Checking case permission:', {
      caseId,
      resource: config.resource,
      action: config.action
    });

    return this.rbacService.hasCasePermission(caseId, config.resource, config.action).pipe(
      switchMap(hasPermission => {
        if (hasPermission) {
          return of(true);
        }

        // Try fallback permissions if provided
        if (config.fallbackPermissions && config.fallbackPermissions.length > 0) {
          return this.checkFallbackPermissions(config.fallbackPermissions, caseId);
        }

        return of(false);
      }),
      tap(hasAccess => {
        if (!hasAccess) {
          console.log('❌ CasePermissionsGuard - Access denied for case permission');
          this.handleAccessDenied(
            `Access denied: Missing ${config.resource}:${config.action} permission for case`,
            config.redirectTo
          );
        } else {
          console.log('✅ CasePermissionsGuard - Case permission granted');
        }
      }),
      catchError(error => {
        console.error('❌ CasePermissionsGuard - Error checking case permission:', error);
        this.handleAccessDenied('Permission check failed', config.redirectTo);
        return of(false);
      })
    );
  }

  private checkGeneralPermission(
    config: CasePermissionConfig,
    url: string
  ): Observable<boolean> {
    
    console.log('🔍 CasePermissionsGuard - Checking general permission:', {
      resource: config.resource,
      action: config.action
    });

    return this.rbacService.hasPermission(config.resource, config.action).pipe(
      tap(hasAccess => {
        if (!hasAccess) {
          console.log('❌ CasePermissionsGuard - Access denied for general permission');
          this.handleAccessDenied(
            `Access denied: Missing ${config.resource}:${config.action} permission`,
            config.redirectTo
          );
        } else {
          console.log('✅ CasePermissionsGuard - General permission granted');
        }
      }),
      catchError(error => {
        console.error('❌ CasePermissionsGuard - Error checking general permission:', error);
        this.handleAccessDenied('Permission check failed', config.redirectTo);
        return of(false);
      })
    );
  }

  private checkFallbackPermissions(
    fallbackPermissions: { resource: string; action: string }[],
    caseId: number
  ): Observable<boolean> {
    
    console.log('🔄 CasePermissionsGuard - Checking fallback permissions');

    const permissionChecks = fallbackPermissions.map(perm =>
      this.rbacService.hasCasePermission(caseId, perm.resource, perm.action)
    );

    return combineLatest(permissionChecks).pipe(
      map(results => results.some(result => result === true))
    );
  }

  private extractCaseId(route: ActivatedRouteSnapshot): number | null {
    // Check for caseId in route parameters
    if (route.params['caseId']) {
      return Number(route.params['caseId']);
    }
    
    // Check for id parameter (for case details route)
    if (route.params['id'] && route.url.some(segment => segment.path === 'cases')) {
      return Number(route.params['id']);
    }
    
    // Check for caseId in query parameters
    if (route.queryParams['caseId']) {
      return Number(route.queryParams['caseId']);
    }
    
    // Check parent routes for case ID
    let parentRoute = route.parent;
    while (parentRoute) {
      if (parentRoute.params['caseId']) {
        return Number(parentRoute.params['caseId']);
      }
      if (parentRoute.params['id'] && route.url.some(segment => segment.path === 'cases')) {
        return Number(parentRoute.params['id']);
      }
      parentRoute = parentRoute.parent;
    }
    
    return null;
  }

  private handleAccessDenied(message: string, redirectTo?: string): void {
    this.notificationService.onError(message);
    
    if (redirectTo) {
      this.router.navigate([redirectTo]);
    } else {
      // Default redirect based on user role
      this.rbacService.getCurrentUserPermissions().subscribe(permissions => {
        if (permissions?.roles?.some(role => role.name.includes('ATTORNEY'))) {
          this.router.navigate(['/legal/cases']);
        } else {
          this.router.navigate(['/case-management/dashboard']);
        }
      });
    }
  }
}

/**
 * Permission directive for template-level permission checking
 */
import { Directive, Input, TemplateRef, ViewContainerRef, OnDestroy, OnInit } from '@angular/core';

@Directive({
  selector: '[appCasePermission]'
})
export class CasePermissionDirective implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private currentCaseId: number | null = null;

  @Input('appCasePermission') permission!: string;
  @Input('appCasePermissionResource') resource!: string;
  @Input('appCasePermissionAction') action!: string;
  @Input('appCasePermissionFallback') fallback?: string;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private caseContextService: CaseContextService,
    private rbacService: RbacService
  ) {}

  ngOnInit(): void {
    // Subscribe to case changes
    this.caseContextService.getCurrentCase()
      .pipe(takeUntil(this.destroy$))
      .subscribe(caseData => {
        this.currentCaseId = caseData?.id || null;
        this.updateView();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateView(): void {
    if (!this.resource || !this.action) {
      console.warn('CasePermissionDirective: resource and action are required');
      this.viewContainer.clear();
      return;
    }

    if (this.currentCaseId) {
      this.rbacService.hasCasePermission(this.currentCaseId, this.resource, this.action)
        .pipe(takeUntil(this.destroy$))
        .subscribe(hasPermission => {
          if (hasPermission) {
            this.viewContainer.createEmbeddedView(this.templateRef);
          } else {
            this.viewContainer.clear();
          }
        });
    } else {
      // Fallback to general permission check
      this.rbacService.hasPermission(this.resource, this.action)
        .pipe(takeUntil(this.destroy$))
        .subscribe(hasPermission => {
          if (hasPermission) {
            this.viewContainer.createEmbeddedView(this.templateRef);
          } else {
            this.viewContainer.clear();
          }
        });
    }
  }
}