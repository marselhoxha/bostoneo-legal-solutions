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
            || request.url.includes('refresh') || request.url.includes('resetpassword') 
            || request.url.includes('verify') || request.url.includes('new/password')) {
          return next.handle(request);
      }

      if(request.method !== 'GET' || request.url.includes('download')) {
          this.httpCache.evictAll();
          return next.handle(request);
      }

      // Skip caching for pagination requests (invoices, clients, etc.)
      if(request.url.includes('/api/invoices') && (request.url.includes('page=') || request.urlWithParams.includes('page='))) {
        return next.handle(request);
      }

      // Skip caching for client pagination requests
      if(request.url.includes('/client') && (request.url.includes('page=') || request.urlWithParams.includes('page='))) {
        return next.handle(request);
      }

      // Skip caching for ANY request with pagination parameters
      if(request.urlWithParams.includes('page=')) {
        return next.handle(request);
      }

      // Use urlWithParams for cache key to include query parameters
      const cacheKey = request.urlWithParams;
      
      const cachedResponse: HttpResponse<any> = this.httpCache.get(cacheKey);
      if(cachedResponse) {
          return of(cachedResponse);
      }
      
      return this.handleRequestCache(request, next);
    
  }

  private handleRequestCache(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      tap(response => {
        if(response instanceof HttpResponse && request.method !== 'DELETE') {
          const cacheKey = request.urlWithParams;
          this.httpCache.put(cacheKey, response);
        }
      })
    );
  }

  
}
