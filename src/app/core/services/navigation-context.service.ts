import { Injectable } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

interface BreadcrumbItem {
  label: string;
  url?: string;
  params?: { [key: string]: any };
  queryParams?: { [key: string]: any };
  active?: boolean;
  icon?: string;
}

interface NavigationState {
  currentRoute: string;
  previousRoute: string | null;
  breadcrumbs: BreadcrumbItem[];
  contextParams: { [key: string]: any };
  preservedFilters: { [key: string]: any };
  preservedSorts: { [key: string]: any };
  timestamp: number;
}

interface RouteConfig {
  path: string;
  breadcrumbLabel: string;
  icon?: string;
  preserveContext?: boolean;
  parentRoute?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NavigationContextService {
  private navigationState$ = new BehaviorSubject<NavigationState>({
    currentRoute: '',
    previousRoute: null,
    breadcrumbs: [],
    contextParams: {},
    preservedFilters: {},
    preservedSorts: {},
    timestamp: Date.now()
  });

  // Route configuration for breadcrumb generation
  private routeConfig: RouteConfig[] = [
    { path: '', breadcrumbLabel: 'Home', icon: 'ri-home-line' },
    { path: 'legal', breadcrumbLabel: 'Legal', icon: 'ri-scales-line' },
    { path: 'legal/cases', breadcrumbLabel: 'Cases', icon: 'ri-briefcase-line', parentRoute: 'legal' },
    { path: 'legal/cases/:id', breadcrumbLabel: 'Case Details', icon: 'ri-file-text-line', parentRoute: 'legal/cases', preserveContext: true },
    { path: 'case-management', breadcrumbLabel: 'Case Management', icon: 'ri-organization-chart' },
    { path: 'case-management/dashboard', breadcrumbLabel: 'Dashboard', icon: 'ri-dashboard-line', parentRoute: 'case-management' },
    { path: 'case-management/tasks', breadcrumbLabel: 'All Tasks', icon: 'ri-task-line', parentRoute: 'case-management', preserveContext: true },
    { path: 'case-management/tasks/:caseId', breadcrumbLabel: 'Case Tasks', icon: 'ri-task-line', parentRoute: 'case-management', preserveContext: true },
    { path: 'case-management/assignments', breadcrumbLabel: 'Assignments', icon: 'ri-user-add-line', parentRoute: 'case-management', preserveContext: true }
  ];

  constructor(private router: Router) {
    this.initializeNavigationTracking();
  }

  /**
   * Get current navigation state
   */
  getNavigationState(): Observable<NavigationState> {
    return this.navigationState$.asObservable();
  }

  /**
   * Get current breadcrumbs
   */
  getBreadcrumbs(): Observable<BreadcrumbItem[]> {
    return this.navigationState$.pipe(
      map(state => state.breadcrumbs)
    );
  }

  /**
   * Navigate with context preservation
   */
  navigateWithContext(
    commands: any[], 
    options?: {
      preserveFilters?: boolean;
      preserveSort?: boolean;
      additionalParams?: { [key: string]: any };
      replaceUrl?: boolean;
    }
  ): Promise<boolean> {
    const currentState = this.navigationState$.value;
    const navigationExtras: any = {};

    // Preserve query parameters if requested
    if (options?.preserveFilters && Object.keys(currentState.preservedFilters).length > 0) {
      navigationExtras.queryParams = {
        ...navigationExtras.queryParams,
        ...currentState.preservedFilters
      };
    }

    // Add additional parameters
    if (options?.additionalParams) {
      navigationExtras.queryParams = {
        ...navigationExtras.queryParams,
        ...options.additionalParams
      };
    }

    // Preserve sort parameters
    if (options?.preserveSort && Object.keys(currentState.preservedSorts).length > 0) {
      navigationExtras.queryParams = {
        ...navigationExtras.queryParams,
        ...currentState.preservedSorts
      };
    }

    if (options?.replaceUrl) {
      navigationExtras.replaceUrl = true;
    }

    console.log('🧭 NavigationContextService - Navigating with context:', { commands, navigationExtras });

    return this.router.navigate(commands, navigationExtras);
  }

  /**
   * Set context parameters (like current case ID)
   */
  setContextParams(params: { [key: string]: any }): void {
    const currentState = this.navigationState$.value;
    this.updateNavigationState({
      contextParams: { ...currentState.contextParams, ...params }
    });
  }

  /**
   * Preserve current filters for navigation
   */
  preserveFilters(filters: { [key: string]: any }): void {
    this.updateNavigationState({
      preservedFilters: filters
    });
  }

  /**
   * Preserve current sort settings for navigation
   */
  preserveSort(sortConfig: { [key: string]: any }): void {
    this.updateNavigationState({
      preservedSorts: sortConfig
    });
  }

  /**
   * Get preserved filters
   */
  getPreservedFilters(): { [key: string]: any } {
    return this.navigationState$.value.preservedFilters;
  }

  /**
   * Get preserved sort configuration
   */
  getPreservedSort(): { [key: string]: any } {
    return this.navigationState$.value.preservedSorts;
  }

  /**
   * Clear preserved context
   */
  clearPreservedContext(): void {
    this.updateNavigationState({
      preservedFilters: {},
      preservedSorts: {},
      contextParams: {}
    });
  }

  /**
   * Generate breadcrumbs from current route
   */
  generateBreadcrumbs(route: string, routeParams?: { [key: string]: any }): BreadcrumbItem[] {
    const breadcrumbs: BreadcrumbItem[] = [];
    const pathSegments = route.split('/').filter(segment => segment.length > 0);
    
    // Always start with home
    breadcrumbs.push({
      label: 'Home',
      url: '/',
      icon: 'ri-home-line'
    });

    // Build breadcrumbs from path segments
    let currentPath = '';
    
    for (let i = 0; i < pathSegments.length; i++) {
      currentPath += '/' + pathSegments[i];
      
      // Find matching route config
      const routeConfigItem = this.findRouteConfig(currentPath, routeParams);
      
      if (routeConfigItem) {
        const isLast = i === pathSegments.length - 1;
        
        breadcrumbs.push({
          label: this.resolveBreadcrumbLabel(routeConfigItem.breadcrumbLabel, routeParams),
          url: isLast ? undefined : currentPath,
          icon: routeConfigItem.icon,
          active: isLast,
          params: routeParams
        });
      }
    }

    return breadcrumbs;
  }

  /**
   * Navigate back to previous route
   */
  navigateBack(): Promise<boolean> {
    const currentState = this.navigationState$.value;
    
    if (currentState.previousRoute) {
      return this.router.navigate([currentState.previousRoute]);
    }
    
    // Fallback to breadcrumb navigation
    const breadcrumbs = currentState.breadcrumbs;
    if (breadcrumbs.length > 1) {
      const previousBreadcrumb = breadcrumbs[breadcrumbs.length - 2];
      if (previousBreadcrumb.url) {
        return this.router.navigate([previousBreadcrumb.url]);
      }
    }
    
    // Final fallback to home
    return this.router.navigate(['/']);
  }

  /**
   * Check if current route preserves context
   */
  shouldPreserveContext(): boolean {
    const currentRoute = this.navigationState$.value.currentRoute;
    const routeConfig = this.findRouteConfig(currentRoute);
    return routeConfig?.preserveContext || false;
  }

  /**
   * Get route title for page title
   */
  getRouteTitle(route: string, routeParams?: { [key: string]: any }): string {
    const routeConfig = this.findRouteConfig(route, routeParams);
    if (routeConfig) {
      return this.resolveBreadcrumbLabel(routeConfig.breadcrumbLabel, routeParams);
    }
    return 'BostonEO Solutions';
  }

  // ==================== Private Methods ====================

  private initializeNavigationTracking(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.handleNavigationEnd(event);
      });
  }

  private handleNavigationEnd(event: NavigationEnd): void {
    const currentState = this.navigationState$.value;
    const newRoute = event.urlAfterRedirects || event.url;
    
    // Extract route parameters from URL
    const routeParams = this.extractRouteParams(newRoute);
    
    // Generate breadcrumbs
    const breadcrumbs = this.generateBreadcrumbs(newRoute, routeParams);
    
    this.updateNavigationState({
      currentRoute: newRoute,
      previousRoute: currentState.currentRoute || null,
      breadcrumbs,
      timestamp: Date.now()
    });

    console.log('🧭 NavigationContextService - Navigation updated:', {
      currentRoute: newRoute,
      previousRoute: currentState.currentRoute,
      breadcrumbs: breadcrumbs.length
    });
  }

  private findRouteConfig(route: string, routeParams?: { [key: string]: any }): RouteConfig | undefined {
    // First try exact match
    let config = this.routeConfig.find(config => config.path === route);
    
    if (!config) {
      // Try pattern matching for parameterized routes
      config = this.routeConfig.find(configItem => {
        const pattern = configItem.path.replace(/:\w+/g, '[^/]+');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(route);
      });
    }
    
    return config;
  }

  private extractRouteParams(url: string): { [key: string]: any } {
    const params: { [key: string]: any } = {};
    
    // Extract query parameters
    const urlParts = url.split('?');
    if (urlParts.length > 1) {
      const queryString = urlParts[1];
      const queryParams = new URLSearchParams(queryString);
      
      queryParams.forEach((value, key) => {
        params[key] = value;
      });
    }
    
    // Extract path parameters (simplified)
    const pathSegments = urlParts[0].split('/');
    pathSegments.forEach((segment, index) => {
      if (!isNaN(Number(segment)) && segment.length > 0) {
        // Assume numeric segments are IDs
        if (pathSegments[index - 1] === 'cases') {
          params['id'] = Number(segment);
        } else if (pathSegments[index - 1] === 'tasks') {
          params['caseId'] = Number(segment);
        }
      }
    });
    
    return params;
  }

  private resolveBreadcrumbLabel(label: string, routeParams?: { [key: string]: any }): string {
    if (!routeParams) return label;
    
    // Replace placeholders in label
    let resolvedLabel = label;
    
    // Handle common patterns
    if (label === 'Case Details' && routeParams['id']) {
      resolvedLabel = `Case #${routeParams['id']}`;
    } else if (label === 'Case Tasks' && routeParams['caseId']) {
      resolvedLabel = `Tasks (Case #${routeParams['caseId']})`;
    }
    
    return resolvedLabel;
  }

  private updateNavigationState(updates: Partial<NavigationState>): void {
    const currentState = this.navigationState$.value;
    const newState: NavigationState = {
      ...currentState,
      ...updates,
      timestamp: Date.now()
    };
    
    this.navigationState$.next(newState);
  }
}