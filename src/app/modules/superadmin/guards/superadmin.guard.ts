import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of, timeout, catchError } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { RbacService } from '../../../core/services/rbac.service';
import { Key } from '../../../enum/key.enum';

@Injectable({
  providedIn: 'root'
})
export class SuperAdminGuard implements CanActivate {

  constructor(
    private rbacService: RbacService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    // 1. Sync check via rbacService
    if (this.rbacService.hasRole('ROLE_SUPERADMIN')) {
      return true;
    }

    // 2. Quick check: JWT token role (avoids async hang when permissions aren't loaded yet)
    if (this.checkJwtForSuperAdmin()) {
      return true;
    }

    // 3. Async fallback with timeout (don't hang forever)
    return this.rbacService.getCurrentUserPermissions().pipe(
      take(1),
      timeout(5000),
      map(permissions => {
        if (!permissions) {
          return this.router.createUrlTree(['/login']);
        }
        const isSuperAdmin = permissions.roles.some(role => role.name === 'ROLE_SUPERADMIN');
        return isSuperAdmin ? true : this.router.createUrlTree(['/home']);
      }),
      catchError(() => {
        // Timeout or error — check JWT one more time
        if (this.checkJwtForSuperAdmin()) {
          return of(true as boolean | UrlTree);
        }
        return of(this.router.createUrlTree(['/login']));
      })
    );
  }

  private checkJwtForSuperAdmin(): boolean {
    try {
      const token = localStorage.getItem(Key.TOKEN);
      if (!token) return false;
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Check roles array (primary), plus single role fields as fallback
      const roles: string[] = payload.roles || [];
      const singleRole = payload.role || payload.roleName || '';
      return roles.includes('ROLE_SUPERADMIN') || singleRole === 'ROLE_SUPERADMIN' || singleRole === 'SUPERADMIN';
    } catch {
      return false;
    }
  }
}
