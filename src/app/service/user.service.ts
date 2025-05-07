import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, catchError, Observable, tap, throwError } from 'rxjs';
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

  constructor(private http: HttpClient, private httpCache: HttpCacheService,
     private router: Router, private preloaderService: PreloaderService) { }

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

  logOut() {
    this.httpCache.evictAll();
    this.clearUserCache();
    localStorage.removeItem(Key.TOKEN);
    localStorage.removeItem(Key.REFRESH_TOKEN);
    this.preloaderService.hide();
    this.router.navigate(['/login']);
  }

  isAuthenticated = (): boolean => {
    const token = localStorage.getItem(Key.TOKEN);
    return token ? (this.jwtHelper.decodeToken<string>(token) && !this.jwtHelper.isTokenExpired(token)) : false;
    try {
      const token = localStorage.getItem(Key.TOKEN);
      if (!token) return false;
      
      // Check if token has valid JWT format (should have 3 parts separated by dots)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) return false;
      
      return !this.jwtHelper.isTokenExpired(token);
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
    }
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

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  preloadUserData(): void {
    if (this.isAuthenticated() && !this.currentUser) {
      this.profile$().subscribe();
    }
  }
}
