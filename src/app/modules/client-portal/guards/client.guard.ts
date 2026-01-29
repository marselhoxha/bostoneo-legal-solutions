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
    return this.userService.profile$().pipe(
      map(response => {
        const user: User | undefined = response?.data?.user;

        if (!user) {
          console.warn('ClientGuard: No user logged in, redirecting to login');
          return this.router.createUrlTree(['/login']);
        }

        // Check if user has ROLE_USER (client portal users)
        const hasClientRole = user.roleName === 'ROLE_USER' ||
                              user.roles?.some((role: string) => role === 'ROLE_USER');

        if (hasClientRole) {
          return true;
        }

        console.warn('ClientGuard: User does not have ROLE_USER, redirecting');
        // Redirect non-clients to their appropriate dashboard
        if (user.roleName === 'ROLE_ATTORNEY' || user.roles?.some((r: string) => r === 'ROLE_ATTORNEY')) {
          return this.router.createUrlTree(['/dashboard/attorney']);
        }
        return this.router.createUrlTree(['/home']);
      }),
      catchError(error => {
        console.error('ClientGuard: Error checking access:', error);
        return of(this.router.createUrlTree(['/login']));
      })
    );
  }
}
