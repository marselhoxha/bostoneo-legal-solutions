import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  isActive: boolean;
}

/**
 * Service for managing the current organization context.
 * Currently uses a default organization, but can be enhanced
 * for multi-tenant support in the future.
 */
@Injectable({
  providedIn: 'root'
})
export class OrganizationService {
  private readonly apiUrl = '/api/organizations';

  // Default organization ID - can be configured via environment or fetched from user profile
  private readonly DEFAULT_ORGANIZATION_ID = 1;

  private currentOrganizationSubject = new BehaviorSubject<Organization | null>(null);
  public currentOrganization$ = this.currentOrganizationSubject.asObservable();

  constructor(private http: HttpClient) {
    // Load organization on startup
    this.loadCurrentOrganization();
  }

  /**
   * Get the current organization ID synchronously
   */
  getCurrentOrganizationId(): number {
    const org = this.currentOrganizationSubject.value;
    return org?.id || this.DEFAULT_ORGANIZATION_ID;
  }

  /**
   * Get the current organization
   */
  getCurrentOrganization(): Organization | null {
    return this.currentOrganizationSubject.value;
  }

  /**
   * Load the current organization from the backend
   */
  loadCurrentOrganization(): void {
    this.http.get<any>(`${this.apiUrl}/${this.DEFAULT_ORGANIZATION_ID}`)
      .pipe(
        map(response => response.data?.organization),
        tap(org => {
          if (org) {
            this.currentOrganizationSubject.next(org);
          }
        }),
        catchError(err => {
          console.warn('Could not load organization, using default:', err);
          // Set a minimal default organization
          this.currentOrganizationSubject.next({
            id: this.DEFAULT_ORGANIZATION_ID,
            name: 'Default Organization',
            slug: 'default',
            isActive: true
          });
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Set the current organization (for future multi-tenant support)
   */
  setCurrentOrganization(org: Organization): void {
    this.currentOrganizationSubject.next(org);
  }

  /**
   * Get organization by ID
   */
  getOrganizationById(id: number): Observable<Organization | null> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(response => response.data?.organization || null),
      catchError(() => of(null))
    );
  }
}
