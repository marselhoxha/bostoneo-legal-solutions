import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, catchError, Observable, tap, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { JwtHelperService } from '@auth0/angular-jwt';
import { AccountType, CustomHttpResponse, Profile } from '../interface/appstates';
import { User } from '../interface/user';
import { Key } from '../enum/key.enum';
import { HttpCacheService } from './http.cache.service';
import { Router } from '@angular/router';
import { PreloaderService } from './preloader.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly server: string = 'http://localhost:8085';
  private jwtHelper = new JwtHelperService();
  private userDataSubject = new BehaviorSubject<User | null>(null);
  userData$ = this.userDataSubject.asObservable();
  private currentUser: User | null = null;

  constructor(
    private http: HttpClient,
    private httpCache: HttpCacheService,
    private router: Router,
    private preloaderService: PreloaderService
  ) { }

  setUserData(user: User) {
    if (user) {
      this.currentUser = user;
      this.userDataSubject.next(user);
    }
  }

  getUserData(): Observable<User> {
    return this.userData$;
  }

  // Method to clear cached user data
  clearUserCache(): void {
    this.currentUser = null;
    this.userDataSubject.next(null);
  }

  /**
   * Get current user synchronously (for notification context)
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Get current user ID synchronously
   */
  getCurrentUserId(): number | null {
    return this.currentUser?.id || null;
  }

  /**
   * Get current user's full name
   */
  getCurrentUserName(): string | null {
    if (!this.currentUser) return null;
    return `${this.currentUser.firstName} ${this.currentUser.lastName}`;
  }

  /**
   * Check if current user has specific role
   */
  hasRole(role: string): boolean {
    if (!this.currentUser || !this.currentUser.roleName) return false;
    return this.currentUser.roleName.toUpperCase() === role.toUpperCase();
  }

  /**
   * Check if current user is admin
   */
  isAdmin(): boolean {
    return this.hasRole('ADMIN') || this.hasRole('SUPER_ADMIN');
  }

  login$ = (email: string, password: string) => <Observable<CustomHttpResponse<Profile>>>
    this.http.post<CustomHttpResponse<Profile>>(
      `${this.server}/user/login`,
      { email, password }
    )
      .pipe(
        tap(response => {
          if (response && response.data) {
            localStorage.setItem(Key.TOKEN, response.data.access_token);
            localStorage.setItem(Key.REFRESH_TOKEN, response.data.refresh_token);
            this.setUserData(response.data.user);
          }
        }),
        catchError(this.handleError)
      );

  save$ = (user: User) => <Observable<CustomHttpResponse<Profile>>>
    this.http.post<CustomHttpResponse<Profile>>
      (`${this.server}/user/register`, user)
      .pipe(
        tap(console.log),
        catchError(this.handleError)
      );

  requestPasswordReset$ = (email: string) => <Observable<CustomHttpResponse<Profile>>>
    this.http.get<CustomHttpResponse<Profile>>
      (`${this.server}/user/resetpassword/${email}`)
      .pipe(
        tap(console.log),
        catchError(this.handleError)
      );

  verifyCode$ = (email: string, code: string) => <Observable<CustomHttpResponse<Profile>>>
    this.http.get<CustomHttpResponse<Profile>>
      (`${this.server}/user/verify/code/${email}/${code}`)
      .pipe(
        tap(console.log),
        catchError(this.handleError)
      );

  verify$ = (key: string, type: AccountType) => <Observable<CustomHttpResponse<Profile>>>
    this.http.get<CustomHttpResponse<Profile>>
      (`${this.server}/user/verify/${type}/${key}`)
      .pipe(
        tap(console.log),
        catchError(this.handleError)
      );

  renewPassword$ = (form: { userId: number, password: string, confirmPassword: string }) => <Observable<CustomHttpResponse<Profile>>>
    this.http.put<CustomHttpResponse<Profile>>
      (`${this.server}/user/new/password`, form)
      .pipe(
        tap(console.log),
        catchError(this.handleError)
      );

  profile$ = () => <Observable<CustomHttpResponse<Profile>>>
    this.http.get<CustomHttpResponse<Profile>>
      (`${this.server}/user/profile`)
      .pipe(
        tap(response => {
          if (response && response.data && response.data.user) {
            this.setUserData(response.data.user);
          }
        }),
        catchError(this.handleError)
      );

  update$ = (user: User) => <Observable<CustomHttpResponse<Profile>>>
    this.http.patch<CustomHttpResponse<Profile>>
      (`${this.server}/user/update`, user)
      .pipe(
        tap(console.log),
        catchError(this.handleError)
      );

  refreshToken$ = () => <Observable<CustomHttpResponse<Profile>>>
    this.http.get<CustomHttpResponse<Profile>>
      (`${this.server}/user/refresh/token`, { headers: { Authorization: `Bearer ${localStorage.getItem(Key.REFRESH_TOKEN)}` } })
      .pipe(
        tap(response => {
          console.log(response);
          localStorage.removeItem(Key.TOKEN);
          localStorage.removeItem(Key.REFRESH_TOKEN);
          localStorage.setItem(Key.TOKEN, response.data.access_token);
          localStorage.setItem(Key.REFRESH_TOKEN, response.data.refresh_token);
        }),
        catchError(this.handleError)
      );

  updatePassword$ = (form: { currentPassword: string, newPassword: string, confirmNewPassword: string }) => <Observable<CustomHttpResponse<Profile>>>
    this.http.patch<CustomHttpResponse<Profile>>
      (`${this.server}/user/update/password`, form)
      .pipe(
        tap(console.log),
        catchError(this.handleError)
      );

  updateRoles$ = (roleName: string) => <Observable<CustomHttpResponse<Profile>>>
    this.http.patch<CustomHttpResponse<Profile>>(`${this.server}/user/update/role/${roleName}`, {})
      .pipe(
        tap(response => {
          console.log('Roles updated', response);

          // Force a token refresh after the role is updated
          this.refreshToken$().subscribe(() => {
            console.log('Token refreshed after role change');
          });
        }),
        catchError(this.handleError)
      );
    

  updateAccountSettings$ = (settings: { enabled: boolean, notLocked: boolean }) => <Observable<CustomHttpResponse<Profile>>>
    this.http.patch<CustomHttpResponse<Profile>>
      (`${this.server}/user/update/settings`, settings)
      .pipe(
        tap(console.log),
        catchError(this.handleError)
      );

  toggleMfa$ = () => <Observable<CustomHttpResponse<Profile>>>
    this.http.patch<CustomHttpResponse<Profile>>
      (`${this.server}/user/togglemfa`, {})
      .pipe(
        tap(console.log),
        catchError(this.handleError)
      );

  updateImage$ = (formData: FormData) => <Observable<CustomHttpResponse<Profile>>>
    this.http.patch<CustomHttpResponse<Profile>>
      (`${this.server}/user/update/image`, formData)
      .pipe(
        tap(response => {
          if (response && response.data && response.data.user) {
            this.setUserData(response.data.user);
          }
        }),
        catchError(this.handleError)
      );

  /**
   * Get all users
   */
  getUsers(): Observable<CustomHttpResponse<any>> {
    return this.http.get<CustomHttpResponse<any>>(`${this.server}/user/list`)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Get all attorneys/lawyers for CRM assignments
   */
  getAttorneys(): Observable<User[]> {
    return this.getUsers().pipe(
      map(response => {
        const users = response?.data?.users || [];
        // Filter for attorneys/lawyers - using roleName and roles array
        return users.filter((user: User) => {
          const primaryRole = user.roleName?.toLowerCase() || '';
          const allRoles = user.roles?.map(role => role.toLowerCase()) || [];
          
          return primaryRole.includes('attorney') || 
                 primaryRole.includes('lawyer') ||
                 primaryRole.includes('paralegal') ||
                 primaryRole === 'admin' ||  // Admins can also be assigned leads
                 allRoles.some(role => 
                   role.includes('attorney') || 
                   role.includes('lawyer') || 
                   role.includes('paralegal') ||
                   role === 'admin'
                 );
        }).map((user: User) => ({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roleName: user.roleName,
          roles: user.roles,
          imageUrl: user.imageUrl
        }));
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get user by ID
   */
  getUserById(userId: number): Observable<CustomHttpResponse<User>> {
    // For now, get user from the list since there's no specific getUserById endpoint
    // TODO: Create a specific backend endpoint for getting user by ID
    return this.getUsers().pipe(
      map(response => {
        const users = response?.data?.users || [];
        const user = users.find((u: User) => u.id === userId);
        if (user) {
          return {
            ...response,
            data: user
          };
        } else {
          throw new Error(`User with ID ${userId} not found`);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Delete user by ID
   */
  deleteUser(userId: number): Observable<CustomHttpResponse<any>> {
    return this.http.delete<CustomHttpResponse<any>>(`${this.server}/user/delete/${userId}`)
      .pipe(
        tap(response => {
          console.log('User deleted:', response);
        }),
        catchError(this.handleError)
      );
  }

  logOut() {
    this.httpCache.evictAll();
    this.clearUserCache();
    localStorage.removeItem(Key.TOKEN);
    localStorage.removeItem(Key.REFRESH_TOKEN);
    this.preloaderService.hide();
    this.router.navigate(['/login']);
  }

  /**
   * Handle session expiration - clears session and redirects to login with message
   * Called by TokenInterceptor when token refresh fails
   */
  handleSessionExpired(): void {
    this.httpCache.evictAll();
    this.clearUserCache();
    localStorage.removeItem(Key.TOKEN);
    localStorage.removeItem(Key.REFRESH_TOKEN);
    this.preloaderService.hide();
    // Redirect to login with session expired flag
    this.router.navigate(['/login'], { queryParams: { sessionExpired: 'true' } });
  }

  isAuthenticated = (): boolean => {
    try {
      const token = localStorage.getItem(Key.TOKEN);
      if (!token) return false;
      
      // Check if token has valid JWT format (should have 3 parts separated by dots)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        console.warn('Invalid JWT token format - expected 3 parts, got:', tokenParts.length);
        this.clearInvalidToken();
        return false;
      }
      
      // Check if token is expired using jwt-helper
      if (this.jwtHelper.isTokenExpired(token)) {
        console.warn('JWT token is expired');
        this.clearInvalidToken();
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error validating JWT token:', error);
      this.clearInvalidToken();
      return false;
    }
  }

  // Clear invalid or expired tokens
  private clearInvalidToken(): void {
    console.log('Clearing invalid JWT tokens from localStorage');
    localStorage.removeItem(Key.TOKEN);
    localStorage.removeItem(Key.REFRESH_TOKEN);
    this.clearUserCache();
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage: string;
    if (error.error instanceof ErrorEvent) {
      errorMessage = `A client error occurred - ${error.error.message}`;
    } else {
      if (error.error && error.error.reason) {
        errorMessage = error.error.reason;
      } else {
        errorMessage = `An error occurred - Error status ${error.status}`;
      }
    }
    return throwError(() => errorMessage);
  }

  // Add a method to force refresh user data
  refreshUserData() {
    if (this.isAuthenticated()) {
      // Clear the HTTP cache for profile endpoint
      this.httpCache.evict(`${this.server}/user/profile`);
      // Clear the current user data
      this.clearUserCache();
      // Fetch fresh data
      this.profile$().subscribe();
    }
  }

  // Update the router navigation to refresh user data
  navigateTo(route: string) {
    this.router.navigate([route]).then(() => {
      this.refreshUserData();
    });
  }

  preloadUserData(): void {
    if (this.isAuthenticated() && !this.currentUser) {
      this.profile$().subscribe();
    }
  }
}
