import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpResponse,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { tap, catchError, switchMap, share } from 'rxjs/operators';
import { RequestCacheService } from '../services/request-cache.service';

@Injectable()
export class CacheInterceptor implements HttpInterceptor {
  constructor(private cache: RequestCacheService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next.handle(req);
    }

    // Check for cached response
    const cachedResponse = this.cache.get(req);
    if (cachedResponse) {
      console.log(`Returning cached response for: ${req.urlWithParams}`);
      return of(cachedResponse);
    }

    // Check if request is already pending
    const pendingRequest = this.cache.getPendingRequest(req);
    if (pendingRequest) {
      console.log(`Returning pending request for: ${req.urlWithParams}`);
      return pendingRequest;
    }

    // Create a shareable observable for this request
    const sharedRequest = this.cache.setPendingRequest(req);
    
    // Make the actual request
    return next.handle(req).pipe(
      tap(event => {
        // Cache successful responses
        if (event instanceof HttpResponse) {
          this.cache.put(req, event);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        // Remove from pending requests on error
        this.cache.removePendingRequest(req);
        
        // Don't cache error responses
        console.error(`Request failed for: ${req.urlWithParams}`, error);
        return throwError(() => error);
      }),
      share() // Share the observable among multiple subscribers
    );
  }
}