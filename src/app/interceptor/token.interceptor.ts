import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpResponse,
  HttpErrorResponse
} from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, throwError } from 'rxjs';
import { Key } from '../enum/key.enum';
import { catchError, switchMap } from 'rxjs/operators';
import { UserService } from '../service/user.service';
import { CustomHttpResponse, Profile } from '../interface/appstates';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  private isTokenRefreshing: boolean = false;
  private refreshTokenSubject: BehaviorSubject<CustomHttpResponse<Profile>> = new BehaviorSubject(null);

  constructor(private userService: UserService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Skip token injection for public endpoints
    if (this.isPublicEndpoint(request.url)) {
      return next.handle(request);
    }

    const token = localStorage.getItem(Key.TOKEN);
    
    // If no token exists, don't add Authorization header (let the request fail naturally)
    if (!token || token.trim() === '') {
      return next.handle(request);
    }

    const modifiedRequest = this.addAuthorizationTokenHeader(request, token);
    
    return next.handle(modifiedRequest)
      .pipe(
        catchError((err) => {
          if (err instanceof HttpErrorResponse) {
            if (err.status === 401 || err.status === 403) {
              return this.handleRefreshToken(request, next);
            } else {
              return throwError(() => err);
            }
          }
          return throwError(() => err);
        })
      );
  }

  private handleRefreshToken(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if(!this.isTokenRefreshing) {
      this.isTokenRefreshing = true;
      this.refreshTokenSubject.next(null);
      return this.userService.refreshToken$().pipe(
        switchMap((response) => {
          this.isTokenRefreshing = false;

          // Check if refresh was successful
          if (!response || !response.data || !response.data.access_token) {
            console.warn('Token refresh failed - session expired');
            this.refreshTokenSubject.next(null);
            // Show notification and redirect to login
            this.userService.handleSessionExpired();
            return throwError(() => new Error('Session expired'));
          }

          this.refreshTokenSubject.next(response);
          return next.handle(this.addAuthorizationTokenHeader(request, response.data.access_token))
        }),
        catchError((error) => {
          console.warn('Token refresh failed - session expired');
          this.isTokenRefreshing = false;
          this.refreshTokenSubject.next(null);
          // Show notification and redirect to login
          this.userService.handleSessionExpired();
          return throwError(() => new Error('Session expired'));
        })
      );
    } else {
      return this.refreshTokenSubject.pipe(
        switchMap((response) => {
          // Check if we have a valid response
          if (!response || !response.data || !response.data.access_token) {
            console.warn('No valid refresh token - session expired');
            return throwError(() => new Error('Session expired'));
          }
          return next.handle(this.addAuthorizationTokenHeader(request, response.data.access_token))
        })
      );
    }
  }

  private addAuthorizationTokenHeader(request: HttpRequest<unknown>, token: string): HttpRequest<any> {
    // Validate token format before adding to header
    if (!token || token.trim() === '') {
      return request;
    }
    
    // Remove any potential whitespace
    token = token.trim();
    
    // Check if token has basic JWT format (3 parts separated by dots)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.error('Invalid JWT token format - expected 3 parts, got:', tokenParts.length);
      return request;
    }
    
    return request.clone({ setHeaders: { Authorization: `Bearer ${token}` }});
  }

  private isPublicEndpoint(url: string): boolean {
    // Note: refresh/token endpoint needs authentication, so don't treat it as public
    return url.includes('verify') || url.includes('login') || url.includes('register') 
            || url.includes('resetpassword');
  }
}
