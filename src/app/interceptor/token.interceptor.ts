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

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> | Observable<HttpResponse<unknown>>{
    if(request.url.includes('verify') || request.url.includes('login') || request.url.includes('register') 
            || request.url.includes('refresh') || request.url.includes('resetpassword')) {
          return next.handle(request);
      }
    return next.handle(this.addAuthorizationTokenHeader(request, localStorage.getItem(Key.TOKEN)))
      .pipe(
        catchError((error: HttpErrorResponse) => {
          if(error instanceof HttpErrorResponse && error.status === 401 && error.error.reason.includes('expired')) {
            return this.handleRefreshToken(request, next);
          } else {
            return throwError(error);
          }
        })
      );
  }

  private handleRefreshToken(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if(!this.isTokenRefreshing) {
      console.log('Refreshing Token...');
      this.isTokenRefreshing = true;
      this.refreshTokenSubject.next(null);
      return this.userService.refreshToken$().pipe(
        switchMap((response) => {
          console.log('Token Refresh Response:', response);
          this.isTokenRefreshing = false;
          this.refreshTokenSubject.next(response);
          console.log('New Token:', response.data.access_token);
          console.log('Sending original request:', request);
          return next.handle(this.addAuthorizationTokenHeader(request, response.data.access_token))
        })
      );
    } else {
      return this.refreshTokenSubject.pipe(
        switchMap((response) => {
          return next.handle(this.addAuthorizationTokenHeader(request, response.data.access_token))
        })
      );
    }
  }

  private addAuthorizationTokenHeader(request: HttpRequest<unknown>, token: string): HttpRequest<any> {
    return request.clone({ setHeaders: { Authorization: `Bearer ${token}` }});
  }
}
