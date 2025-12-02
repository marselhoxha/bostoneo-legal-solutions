import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { RbacService } from '../core/services/rbac.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class PermissionGuard implements CanActivate {
  constructor(
    private rbacService: RbacService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    // Allow all admin users to bypass permission checks
    if (this.rbacService.isAdmin()) {
      return true;
    }
    
    // Check for required permission in route data
    const requiredPermission = route.data['permission'] as { resource: string, action: string };
    
    if (!requiredPermission) {
      // No permission required for this route
      console.log('✅ No permission required for route:', state.url);
      return true;
    }

    // Log current permissions for debugging
    console.log('🔍 Checking permission for route:', state.url);
    console.log('🔍 Required permission:', requiredPermission);
    
    // Check for general permission using synchronous method
    const hasPermission = this.rbacService.hasPermissionSync(
      requiredPermission.resource,
      requiredPermission.action
    );
    
    console.log('🔍 Permission check result:', hasPermission, 'for', `${requiredPermission.resource}:${requiredPermission.action}`);
    
    if (!hasPermission) {
      // For now, allow access if user has basic legal roles for legal resources
      if (this.isLegalResource(requiredPermission.resource) && this.hasLegalRole()) {
        console.log('✅ Allowing access due to legal role for resource:', requiredPermission.resource);
        return true;
      }
      
      this.handleUnauthorized(requiredPermission);
      return false;
    }
    
    return true;
  }

  private isLegalResource(resource: string): boolean {
    return ['CASE', 'DOCUMENT', 'CALENDAR', 'CLIENT'].includes(resource);
  }

  private hasLegalRole(): boolean {
    // Simplified roles: ROLE_ATTORNEY and PARALEGAL are legal roles
    const legalRoles = [
      'ROLE_ADMIN', 'ROLE_ATTORNEY', 'PARALEGAL', 'ROLE_SECRETARY', 'ROLE_FINANCE'
    ];

    return legalRoles.some(role => this.rbacService.hasRole(role));
  }
  
  private handleUnauthorized(permission: { resource: string, action: string }): void {
    const message = `You don't have the required permission: ${permission.resource}:${permission.action}`;
    console.error(message);
    
    this.snackBar.open(message, 'Close', { 
      duration: 5000,
      panelClass: ['bg-danger', 'text-white']
    });
    
    this.router.navigate(['/home']);
  }
} 