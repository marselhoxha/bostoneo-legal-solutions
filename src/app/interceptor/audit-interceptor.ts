import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditLogService } from '../core/services/audit-log.service';

@Injectable()
export class AuditInterceptor implements HttpInterceptor {
  
  // Define sensitive API endpoints that should be audited
  private readonly SENSITIVE_ENDPOINTS = [
    '/api/cases',
    '/api/documents', 
    '/api/users',
    '/api/roles',
    '/api/permissions',
    '/api/invoices',
    '/api/clients',
    '/api/legal/cases',
    '/api/legal/documents',
    '/api/legal/calendar',
    '/api/admin',
    '/api/timers',
    '/api/time-entries'
  ];

  // Define actions that should be audited based on HTTP method
  private readonly HTTP_METHOD_ACTIONS: { [key: string]: string } = {
    'POST': 'CREATE',
    'PUT': 'UPDATE', 
    'PATCH': 'UPDATE',
    'DELETE': 'DELETE',
    'GET': 'VIEW'
  };

  constructor(private auditLogService: AuditLogService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Check if this request should be audited
    if (!this.shouldAuditRequest(req)) {
      return next.handle(req);
    }

    const startTime = Date.now();
    const action = this.getActionFromRequest(req);
    const resource = this.getResourceFromUrl(req.url);
    const resourceId = this.extractResourceId(req.url);

    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          // Log successful action
          const duration = Date.now() - startTime;
          this.auditLogService.logAction(
            action,
            resource,
            resourceId,
            {
              method: req.method,
              url: req.url,
              statusCode: event.status,
              duration: `${duration}ms`,
              requestBody: this.sanitizeRequestBody(req.body)
            },
            true
          ).subscribe({
            error: (error) => console.error('Failed to log audit event:', error)
          });
        }
      }),
      catchError((error: HttpErrorResponse) => {
        // Log failed action
        const duration = Date.now() - startTime;
        this.auditLogService.logAction(
          action,
          resource,
          resourceId,
          {
            method: req.method,
            url: req.url,
            statusCode: error.status,
            duration: `${duration}ms`,
            requestBody: this.sanitizeRequestBody(req.body)
          },
          false,
          error.message
        ).subscribe({
          error: (auditError) => console.error('Failed to log audit event:', auditError)
        });

        throw error;
      })
    );
  }

  /**
   * Check if the request should be audited
   */
  private shouldAuditRequest(req: HttpRequest<any>): boolean {
    // Skip audit log endpoints to prevent infinite loops
    if (req.url.includes('/api/audit-logs')) {
      return false;
    }

    // Skip authentication endpoints (handled separately)
    if (req.url.includes('/auth/')) {
      return false;
    }

    // Check if URL matches sensitive endpoints
    return this.SENSITIVE_ENDPOINTS.some(endpoint => req.url.includes(endpoint));
  }

  /**
   * Get the action based on HTTP method and URL
   */
  private getActionFromRequest(req: HttpRequest<any>): string {
    const method = req.method.toUpperCase();
    const baseAction = this.HTTP_METHOD_ACTIONS[method] || 'UNKNOWN';
    
    // Add more specific actions based on URL patterns
    if (req.url.includes('/download')) {
      return 'DOCUMENT_DOWNLOAD';
    }
    
    if (req.url.includes('/export')) {
      return 'DATA_EXPORT';
    }
    
    if (req.url.includes('/roles') && method === 'POST') {
      return 'ROLE_ASSIGN';
    }
    
    if (req.url.includes('/roles') && method === 'DELETE') {
      return 'ROLE_REMOVE';
    }

    // Construct action with resource prefix
    const resource = this.getResourceFromUrl(req.url);
    return `${resource}_${baseAction}`;
  }

  /**
   * Extract resource type from URL
   */
  private getResourceFromUrl(url: string): string {
    if (url.includes('/cases')) return 'CASE';
    if (url.includes('/documents')) return 'DOCUMENT';
    if (url.includes('/users')) return 'USER';
    if (url.includes('/roles')) return 'ROLE';
    if (url.includes('/permissions')) return 'PERMISSION';
    if (url.includes('/invoices')) return 'INVOICE';
    if (url.includes('/clients')) return 'CLIENT';
    if (url.includes('/calendar')) return 'CALENDAR';
    if (url.includes('/admin')) return 'ADMINISTRATIVE';
    if (url.includes('/timers') || url.includes('/time-entries')) return 'TIME_TRACKING';
    
    return 'UNKNOWN';
  }

  /**
   * Extract resource ID from URL if present
   */
  private extractResourceId(url: string): string | undefined {
    // Match common ID patterns: /resource/123 or /resource/123/action
    const idMatch = url.match(/\/([a-zA-Z-]+)\/(\d+)(?:\/|$)/);
    return idMatch ? idMatch[2] : undefined;
  }

  /**
   * Sanitize request body for logging (remove sensitive data)
   */
  private sanitizeRequestBody(body: any): any {
    if (!body) return null;

    // Create a copy to avoid modifying original
    const sanitized = JSON.parse(JSON.stringify(body));

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'creditCard', 'ssn'];
    
    this.removeSensitiveFields(sanitized, sensitiveFields);
    
    return sanitized;
  }

  /**
   * Recursively remove sensitive fields from object
   */
  private removeSensitiveFields(obj: any, sensitiveFields: string[]): void {
    if (typeof obj !== 'object' || obj === null) return;

    for (const key in obj) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        this.removeSensitiveFields(obj[key], sensitiveFields);
      }
    }
  }
} 