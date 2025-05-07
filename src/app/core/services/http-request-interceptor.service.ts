import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class HttpRequestInterceptorService implements HttpInterceptor {
  constructor() {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Log all requests
    console.log(`%c[HTTP ${request.method}] ${request.url}`, 'color: blue; font-weight: bold;');
    console.log('Request Headers:', request.headers);
    if (request.body) {
      console.log('Request Body:', request.body);
    }

    // Special log for DELETE requests
    if (request.method === 'DELETE') {
      console.log('%c[DELETE REQUEST DETECTED] Attempting to delete resource', 'color: red; font-weight: bold; font-size: 14px;');
      console.log('Delete URL:', request.url);
      console.log('Delete Headers:', request.headers.keys().map(key => ({key, value: request.headers.get(key)})));
    }

    return next.handle(request).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          console.log(`%c[HTTP Response ${request.method}] ${request.url}`, 'color: green; font-weight: bold;');
          console.log('Response Status:', event.status);
          console.log('Response Body:', event.body);
          
          if (request.method === 'DELETE') {
            console.log('%c[DELETE RESPONSE] Delete operation completed', 'color: green; font-weight: bold;');
            console.log('Delete response:', event);
          }
        }
      }),
      catchError((error: HttpErrorResponse) => {
        console.log(`%c[HTTP ERROR ${request.method}] ${request.url}`, 'color: red; font-weight: bold;');
        console.log('Error Status:', error.status);
        console.log('Error Message:', error.message);
        console.error('Full Error:', error);
        
        if (request.method === 'DELETE') {
          console.log('%c[DELETE ERROR] Delete operation failed', 'color: red; font-weight: bold; font-size: 14px;');
          console.error('Delete error details:', {
            url: request.url,
            status: error.status,
            message: error.message,
            error: error.error
          });
        }
        
        return throwError(() => error);
      })
    );
  }
} 