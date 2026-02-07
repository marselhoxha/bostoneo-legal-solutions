import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { UserService } from '../../../service/user.service';
import { User } from '../../../interface/user';

/**
 * Guard to protect client portal routes.
 * Only allows access to users with ROLE_USER (client portal users).
 */
@Injectable({
  providedIn: 'root'
})
export class ClientGuard implements CanActivate, CanActivateChild {

  constructor(
    private userService: UserService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.checkClientAccess(state);
  }

  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.checkClientAccess(state);
  }

  private checkClientAccess(state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    // Try cached user data first to avoid redundant API call
    const cachedUser = this.userService.getCurrentUser();
    if (cachedUser) {
      return of(this.evaluateAccess(cachedUser));
    }

    // Fallback to API call only when no cached data
    return this.userService.profile$().pipe(
      map(response => {
        const user: User | undefined = response?.data?.user;
        if (!user) {
          return this.router.createUrlTree(['/login']);
        }
        return this.evaluateAccess(user);
      }),
      catchError(error => {
        console.error('ClientGuard: Error checking access:', error);
        return of(this.router.createUrlTree(['/login']));
      })
    );
  }

  private evaluateAccess(user: User): boolean | UrlTree {
    const hasClientRole = user.roleName === 'ROLE_CLIENT' ||
                          user.roleName === 'ROLE_USER' ||
                          user.roles?.some((role: string) => role === 'ROLE_CLIENT' || role === 'ROLE_USER');

    if (hasClientRole) {
      return true;
    }

    // Redirect non-clients to their appropriate dashboard
    if (user.roleName === 'ROLE_ATTORNEY' || user.roles?.some((r: string) => r === 'ROLE_ATTORNEY')) {
      return this.router.createUrlTree(['/dashboard/attorney']);
    }
    return this.router.createUrlTree(['/home']);
  }
}
