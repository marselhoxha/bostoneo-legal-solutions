import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpResponse,
  HttpErrorResponse
} from '@angular/common/http';
import { BehaviorSubject, Observable, of, Subject, tap, throwError } from 'rxjs';
import { HttpCacheService } from '../service/http.cache.service';

@Injectable()
export class CacheInterceptor implements HttpInterceptor {
  

  constructor(private httpCache: HttpCacheService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> | Observable<HttpResponse<unknown>>{
    if(request.url.includes('verify') || request.url.includes('login') || request.url.includes('register') 
            || request.url.includes('refresh') || request.url.includes('resetpassword')) {
          return next.handle(request);
      }

      if(request.method !== 'GET' || request.url.includes('download')) {
          this.httpCache.evictAll();
          return next.handle(request);
      }

      const cachedResponse: HttpResponse<any> = this.httpCache.get(request.url);
      if(cachedResponse) {
          console.log('Found Response in Cache', cachedResponse);
          this.httpCache.logCache();
          return of(cachedResponse);
      }
      return this.handleRequestCache(request, next);
    
  }

  private handleRequestCache(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      tap(response => {
        if(response instanceof HttpResponse && request.method !== 'DELETE') {
          console.log('Caching Response', response);
          this.httpCache.put(request.url, response);
        }
      })
    );
  }

  
}
