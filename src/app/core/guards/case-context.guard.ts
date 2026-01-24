import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { CaseContextService } from '../services/case-context.service';
import { NavigationContextService } from '../services/navigation-context.service';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class CaseContextGuard implements CanActivate {
  private readonly apiUrl = 'http://localhost:8085/api/v1';

  constructor(
    private caseContextService: CaseContextService,
    private navigationContextService: NavigationContextService,
    private http: HttpClient,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    const caseId = this.extractCaseId(route);

    // If no case ID is required, allow access
    if (!caseId) {
      this.updateNavigationContext(route, state);
      return true;
    }

    // Check if we already have the case context
    const currentCase = this.caseContextService.getCurrentCaseSnapshot();

    if (currentCase && currentCase.id === caseId) {
      this.updateNavigationContext(route, state);
      return true;
    }

    // Load case context
    return this.loadCaseContext(caseId).pipe(
      tap(() => {
        this.updateNavigationContext(route, state);
      }),
      map(() => true),
      catchError(error => {
        console.error('❌ CaseContextGuard - Failed to load case context:', error);
        
        // Handle different error scenarios
        if (error.status === 404) {
          // Case not found, redirect to cases list
          this.router.navigate(['/legal/cases'], {
            queryParams: { error: 'case-not-found' }
          });
        } else if (error.status === 403) {
          // Access denied, redirect to dashboard
          this.router.navigate(['/case-management/dashboard'], {
            queryParams: { error: 'access-denied' }
          });
        } else {
          // General error, redirect to dashboard
          this.router.navigate(['/case-management/dashboard'], {
            queryParams: { error: 'load-failed' }
          });
        }
        
        return of(false);
      })
    );
  }

  private extractCaseId(route: ActivatedRouteSnapshot): number | null {
    // Check for caseId in route parameters
    if (route.params['caseId']) {
      return Number(route.params['caseId']);
    }
    
    // Check for id parameter (for case details route)
    if (route.params['id'] && route.url.some(segment => segment.path === 'cases')) {
      return Number(route.params['id']);
    }
    
    // Check for caseId in query parameters
    if (route.queryParams['caseId']) {
      return Number(route.queryParams['caseId']);
    }
    
    // Check parent routes for case ID
    let parentRoute = route.parent;
    while (parentRoute) {
      if (parentRoute.params['caseId']) {
        return Number(parentRoute.params['caseId']);
      }
      if (parentRoute.params['id'] && route.url.some(segment => segment.path === 'cases')) {
        return Number(parentRoute.params['id']);
      }
      parentRoute = parentRoute.parent;
    }
    
    return null;
  }

  private loadCaseContext(caseId: number): Observable<any> {
    return forkJoin({
      case: this.http.get<any>(`${this.apiUrl}/cases/${caseId}`),
      assignments: this.http.get<any>(`${this.apiUrl}/case-assignments/case/${caseId}`),
      userRole: this.http.get<any>(`${this.apiUrl}/case-assignments/user-role/${caseId}`)
    }).pipe(
      switchMap(({ case: caseData, assignments, userRole }) => {
        // Set case context
        const legalCase = caseData.data;
        
        return this.caseContextService.setCurrentCase(legalCase, false).pipe(
          tap(() => {
            // Update team assignments
            const teamData = assignments.data?.content || assignments.data || [];
            this.caseContextService.updateCaseTeam(teamData);
            
            // Set user's role in this case
            if (userRole.data) {
              this.caseContextService.setUserCaseRole(userRole.data.roleType);
            }
          })
        );
      })
    );
  }

  private updateNavigationContext(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): void {
    // Extract route parameters
    const routeParams: { [key: string]: any } = {
      ...route.params,
      ...route.queryParams
    };
    
    // Update navigation context
    this.navigationContextService.setContextParams(routeParams);
    
    // If this route preserves context, maintain current filters/sorts
    // Preserved filters/sorts are maintained automatically
  }
}

@Injectable({
  providedIn: 'root'
})
export class CaseContextResolver {
  constructor(
    private caseContextService: CaseContextService,
    private http: HttpClient
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<any> | null {
    const caseId = route.params['caseId'] || route.params['id'];
    
    if (!caseId) {
      return null;
    }
    
    // Check if context is already loaded
    const currentCase = this.caseContextService.getCurrentCaseSnapshot();
    if (currentCase && currentCase.id === Number(caseId)) {
      return of(currentCase);
    }
    
    // Load case data
    return this.http.get<any>(`${this.apiUrl}/cases/${caseId}`).pipe(
      tap(response => {
        this.caseContextService.setCurrentCase(response.data);
      }),
      map(response => response.data)
    );
  }

  private readonly apiUrl = 'http://localhost:8085/api/v1';
}