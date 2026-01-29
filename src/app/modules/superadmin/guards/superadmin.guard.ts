import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { RbacService } from '../../../core/services/rbac.service';

@Injectable({
  providedIn: 'root'
})
export class SuperAdminGuard implements CanActivate {

  constructor(
    private rbacService: RbacService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    // First try sync check
    const hasSuperAdminRole = this.rbacService.hasRole('ROLE_SUPERADMIN');
    console.log('🛡️ SuperAdminGuard - Sync hasRole check:', hasSuperAdminRole);

    if (hasSuperAdminRole) {
      return true;
    }

    // Fall back to async check via permissions
    return this.rbacService.getCurrentUserPermissions().pipe(
      take(1),
      map(permissions => {
        console.log('🛡️ SuperAdminGuard - Async permissions check:', permissions);

        if (!permissions) {
          console.log('🛡️ SuperAdminGuard - No permissions, redirecting to login');
          return this.router.createUrlTree(['/login']);
        }

        const isSuperAdmin = permissions.roles.some(role => role.name === 'ROLE_SUPERADMIN');
        console.log('🛡️ SuperAdminGuard - isSuperAdmin:', isSuperAdmin);

        if (isSuperAdmin) {
          return true;
        }

        // Redirect non-superadmin users to home
        console.log('🛡️ SuperAdminGuard - Not superadmin, redirecting to home');
        return this.router.createUrlTree(['/home']);
      })
    );
  }
}
