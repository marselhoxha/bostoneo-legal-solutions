import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { Key } from '../enum/key.enum';
import { catchError, filter, switchMap, take, timeout } from 'rxjs/operators';
import { UserService } from '../service/user.service';
import { CustomHttpResponse, Profile } from '../interface/appstates';
import { Router } from '@angular/router';

interface RefreshState {
  inProgress: boolean;
  token: string | null;
  failed: boolean;
}

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  private refreshState$ = new BehaviorSubject<RefreshState>({
    inProgress: false,
    token: null,
    failed: false
  });

  private readonly REFRESH_TIMEOUT = 10000;

  constructor(
    private userService: UserService,
    private router: Router
  ) {
    // Subscribe to login success events to reset state
    this.userService.loginSuccess$.subscribe(() => {
      this.resetState();
    });
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Skip token injection for public endpoints
    if (this.isPublicEndpoint(request.url)) {
      return next.handle(request);
    }

    // CRITICAL: Check for valid token FIRST before checking failed state
    // This handles the race condition where setUserData triggers requests
    // before loginSuccessSubject subscription resets the state
    const token = localStorage.getItem(Key.TOKEN);

    if (token && token.trim() !== '' && this.isValidTokenFormat(token)) {
      // We have a valid token - reset failed state if it was set and proceed
      const currentState = this.refreshState$.getValue();
      if (currentState.failed) {
        this.resetState();
      }

      // If refresh is in progress, wait for it (but we already have a valid token so this is rare)
      if (currentState.inProgress) {
        return this.waitForTokenRefresh(request, next);
      }

      // Proceed with the request using the valid token
      return next.handle(this.addAuthorizationHeader(request, token)).pipe(
        catchError((error) => {
          if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
            return this.handleAuthError(request, next);
          }
          return throwError(() => error);
        })
      );
    }

    // No valid token - now check states
    const currentState = this.refreshState$.getValue();

    if (currentState.failed) {
      if (!this.router.url.includes('/login')) {
        this.userService.handleSessionExpired();
      }
      return throwError(() => new Error('Session expired'));
    }

    if (currentState.inProgress) {
      return this.waitForTokenRefresh(request, next);
    }

    // No token and no refresh in progress - fail the request
    return throwError(() => new Error('Not authenticated'));
  }

  private waitForTokenRefresh(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return this.refreshState$.pipe(
      filter(state => !state.inProgress),
      take(1),
      timeout(this.REFRESH_TIMEOUT),
      switchMap((state) => {
        if (state.failed || !state.token) {
          // Try localStorage as fallback - token might have been saved
          const fallbackToken = localStorage.getItem(Key.TOKEN);
          if (fallbackToken && this.isValidTokenFormat(fallbackToken)) {
            return next.handle(this.addAuthorizationHeader(request, fallbackToken));
          }
          return throwError(() => new Error('Session expired'));
        }
        return next.handle(this.addAuthorizationHeader(request, state.token));
      }),
      catchError(() => {
        return throwError(() => new Error('Session expired'));
      })
    );
  }

  private handleAuthError(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const currentState = this.refreshState$.getValue();

    if (currentState.failed) {
      return throwError(() => new Error('Session expired'));
    }

    const refreshToken = localStorage.getItem(Key.REFRESH_TOKEN);
    if (!refreshToken) {
      this.refreshState$.next({ inProgress: false, token: null, failed: true });
      this.userService.handleSessionExpired();
      return throwError(() => new Error('No refresh token'));
    }

    if (!currentState.inProgress) {
      this.refreshState$.next({ inProgress: true, token: null, failed: false });

      return this.userService.refreshToken$().pipe(
        switchMap((response: CustomHttpResponse<Profile>) => {
          if (!response?.data?.access_token) {
            this.refreshState$.next({ inProgress: false, token: null, failed: true });
            this.userService.handleSessionExpired();
            return throwError(() => new Error('Session expired'));
          }

          const newToken = response.data.access_token;
          this.refreshState$.next({ inProgress: false, token: newToken, failed: false });
          return next.handle(this.addAuthorizationHeader(request, newToken));
        }),
        catchError(() => {
          this.refreshState$.next({ inProgress: false, token: null, failed: true });
          this.userService.handleSessionExpired();
          return throwError(() => new Error('Session expired'));
        })
      );
    } else {
      return this.waitForTokenRefresh(request, next);
    }
  }

  private addAuthorizationHeader(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
    return request.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  private isValidTokenFormat(token: string): boolean {
    if (!token || token.trim() === '') return false;
    const parts = token.trim().split('.');
    return parts.length === 3;
  }

  private isPublicEndpoint(url: string): boolean {
    return url.includes('verify') ||
           url.includes('login') ||
           url.includes('register') ||
           url.includes('resetpassword') ||
           url.includes('/webhook/') ||
           url.includes('refresh/token');
  }

  public resetState(): void {
    this.refreshState$.next({ inProgress: false, token: null, failed: false });
  }
}
