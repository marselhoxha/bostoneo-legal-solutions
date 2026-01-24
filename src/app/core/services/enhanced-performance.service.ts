import { Injectable } from '@angular/core';
import { Router, NavigationEnd, PreloadingStrategy, Route } from '@angular/router';
import { BehaviorSubject, Observable, of, timer } from 'rxjs';
import { filter, map, switchMap, tap, shareReplay, catchError } from 'rxjs/operators';
import { HttpClient, HttpRequest, HttpResponse } from '@angular/common/http';

interface CacheEntry {
  data: any;
  timestamp: number;
  expiresIn: number;
}

interface PerformanceMetrics {
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
}

@Injectable({
  providedIn: 'root'
})
export class EnhancedPerformanceService implements PreloadingStrategy {
  private cache = new Map<string, CacheEntry>();
  private preloadedModules = new Set<string>();
  private performanceMetrics$ = new BehaviorSubject<PerformanceMetrics | null>(null);
  private intersectionObserver: IntersectionObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  
  // Virtual scrolling configuration
  private virtualScrollConfig = {
    itemHeight: 80,
    bufferSize: 5,
    trackByField: 'id'
  };

  constructor(
    private router: Router,
    private http: HttpClient
  ) {
    this.initializePerformanceOptimizations();
  }

  private initializePerformanceOptimizations(): void {
    this.setupSmartPreloading();
    this.enablePerformanceMonitoring();
    this.setupImageLazyLoading();
    this.setupIntersectionObserver();
    this.setupMutationObserver();
    this.initializeWebWorker();
    this.setupMemoryManagement();
  }

  // ==================== Smart Module Preloading ====================
  
  preload(route: Route, fn: () => Observable<any>): Observable<any> {
    // Custom preloading strategy based on user patterns
    const shouldPreload = this.shouldPreloadModule(route);
    
    if (shouldPreload) {
      return timer(50).pipe(
        switchMap(() => fn()),
        catchError(() => of(null))
      );
    }
    
    return of(null);
  }

  private shouldPreloadModule(route: Route): boolean {
    // Preload based on priority and user patterns
    const highPriorityModules = ['legal', 'case-management', 'clients'];
    const path = route.path || '';
    
    // Always preload high priority modules
    if (highPriorityModules.includes(path)) {
      return true;
    }
    
    // Preload if module is likely to be accessed based on current route
    const currentUrl = this.router.url;
    const preloadMap: { [key: string]: string[] } = {
      '/home': ['legal', 'clients', 'case-management'],
      '/legal': ['case-management', 'documents'],
      '/clients': ['invoices', 'case-management'],
      '/admin': ['users', 'roles', 'settings']
    };
    
    const recommendedModules = preloadMap[currentUrl] || [];
    return recommendedModules.includes(path);
  }

  private setupSmartPreloading(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.predictAndPreloadModules(event.url);
        this.cleanupUnusedModules();
      });
  }

  private predictAndPreloadModules(currentUrl: string): void {
    // ML-like prediction based on navigation patterns
    const navigationPatterns: { [key: string]: string[] } = {
      '/home': ['legal/cases', 'clients/list'],
      '/legal/cases': ['legal/case-detail', 'documents'],
      '/clients': ['invoices', 'client-detail'],
      '/case-management': ['tasks', 'assignments']
    };

    const predictedRoutes = navigationPatterns[currentUrl] || [];
    predictedRoutes.forEach(route => this.preloadRoute(route));
  }

  private preloadRoute(routePath: string): void {
    if (this.preloadedModules.has(routePath)) {
      return;
    }

    // Dynamic imports with error handling
    const moduleMap: { [key: string]: () => Promise<any> } = {
      'legal/cases': () => import('../../modules/legal/legal.module'),
      'case-management': () => import('../../modules/case-management/case-management.module'),
      'clients/list': () => import('../../component/client/client.module')
    };

    const loadModule = moduleMap[routePath];
    if (loadModule) {
      loadModule()
        .then(() => {
          this.preloadedModules.add(routePath);
        })
        .catch(error => console.error(`Failed to preload ${routePath}:`, error));
    }
  }

  // ==================== Request Caching & Debouncing ====================
  
  cacheRequest<T>(
    key: string,
    request: Observable<T>,
    expiresIn: number = 300000 // 5 minutes default
  ): Observable<T> {
    const cached = this.getFromCache<T>(key);

    if (cached) {
      return of(cached);
    }
    
    return request.pipe(
      tap(data => this.setCache(key, data, expiresIn)),
      shareReplay(1)
    );
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    if (now - entry.timestamp > entry.expiresIn) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  private setCache(key: string, data: any, expiresIn: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn
    });
  }

  clearCache(pattern?: string): void {
    if (pattern) {
      Array.from(this.cache.keys())
        .filter(key => key.includes(pattern))
        .forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  // ==================== Virtual Scrolling Support ====================
  
  createVirtualScrollDatasource<T>(
    items: T[],
    viewportHeight: number,
    itemHeight: number = this.virtualScrollConfig.itemHeight
  ): Observable<T[]> {
    const visibleCount = Math.ceil(viewportHeight / itemHeight);
    const bufferCount = this.virtualScrollConfig.bufferSize;
    
    return new BehaviorSubject(items).pipe(
      map(allItems => {
        const startIndex = 0; // This would be dynamic based on scroll position
        const endIndex = Math.min(startIndex + visibleCount + bufferCount, allItems.length);
        return allItems.slice(startIndex, endIndex);
      })
    );
  }

  // ==================== Performance Monitoring ====================
  
  private enablePerformanceMonitoring(): void {
    if ('PerformanceObserver' in window) {
      // Monitor Core Web Vitals
      this.monitorCoreWebVitals();
      
      // Monitor long tasks
      this.monitorLongTasks();
      
      // Monitor resource timing
      this.monitorResourceTiming();
    }
  }

  private monitorCoreWebVitals(): void {
    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      this.updateMetrics({ largestContentfulPaint: lastEntry.renderTime || lastEntry.loadTime });
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const fidEntry = entry as any;
        this.updateMetrics({ firstInputDelay: fidEntry.processingStart - fidEntry.startTime });
      }
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const clsEntry = entry as any;
        if (!clsEntry.hadRecentInput) {
          clsValue += clsEntry.value;
          this.updateMetrics({ cumulativeLayoutShift: clsValue });
        }
      }
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  }

  private monitorLongTasks(): void {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.warn('Long task detected:', {
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name
          });
          
          // Report to analytics or monitoring service
          this.reportPerformanceIssue('long-task', {
            duration: entry.duration,
            timestamp: Date.now()
          });
        }
      }
    });
    
    try {
      observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // Long task monitoring not supported
    }
  }

  private monitorResourceTiming(): void {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resourceEntry = entry as PerformanceResourceTiming;
        if (resourceEntry.duration > 1000) {
          console.warn('Slow resource:', {
            name: resourceEntry.name,
            duration: resourceEntry.duration,
            type: resourceEntry.initiatorType
          });
        }
      }
    });
    observer.observe({ entryTypes: ['resource'] });
  }

  private updateMetrics(metrics: Partial<PerformanceMetrics>): void {
    const current = this.performanceMetrics$.value || {} as PerformanceMetrics;
    this.performanceMetrics$.next({ ...current, ...metrics });
  }

  getPerformanceMetrics(): Observable<PerformanceMetrics | null> {
    return this.performanceMetrics$.asObservable();
  }

  // ==================== Image Lazy Loading ====================
  
  private setupImageLazyLoading(): void {
    if ('IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => this.handleImageIntersection(entries),
        {
          rootMargin: '50px',
          threshold: 0.01
        }
      );
      
      // Initial setup for existing images
      this.observeImages();
      
      // Setup mutation observer to handle dynamically added images
      this.setupMutationObserver();
    }
  }

  private handleImageIntersection(entries: IntersectionObserverEntry[]): void {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        
        if (img.dataset.src) {
          // Preload image
          const tempImg = new Image();
          tempImg.onload = () => {
            img.src = img.dataset.src!;
            img.classList.add('loaded');
            img.removeAttribute('data-src');
          };
          tempImg.src = img.dataset.src;
          
          this.intersectionObserver?.unobserve(img);
        }
      }
    });
  }

  private observeImages(): void {
    document.querySelectorAll('img[data-src]').forEach(img => {
      this.intersectionObserver?.observe(img);
    });
  }

  // ==================== Intersection Observer for Components ====================
  
  private setupIntersectionObserver(): void {
    if ('IntersectionObserver' in window) {
      // Can be used for component-level lazy loading
      const componentObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const element = entry.target as HTMLElement;
              if (element.dataset.component) {
                this.loadComponent(element.dataset.component);
              }
            }
          });
        },
        { rootMargin: '100px' }
      );
      
      // Store for later use
      (window as any).componentObserver = componentObserver;
    }
  }

  private loadComponent(componentName: string): void {
    // Component-specific loading logic
  }

  // ==================== Mutation Observer for Dynamic Content ====================
  
  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              
              // Check for images
              if (element.tagName === 'IMG' && element.dataset.src) {
                this.intersectionObserver?.observe(element);
              }
              
              // Check for images in descendants
              element.querySelectorAll('img[data-src]').forEach(img => {
                this.intersectionObserver?.observe(img);
              });
            }
          });
        }
      });
    });
    
    // Observe the entire document body
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ==================== Web Worker Support ====================
  
  private initializeWebWorker(): void {
    if (typeof Worker !== 'undefined') {
      // Create a simple inline worker for heavy computations
      const workerCode = `
        self.addEventListener('message', function(e) {
          const { type, data } = e.data;
          
          switch(type) {
            case 'HEAVY_COMPUTATION':
              // Perform heavy computation
              const result = performHeavyComputation(data);
              self.postMessage({ type: 'COMPUTATION_RESULT', data: result });
              break;
              
            case 'DATA_PROCESSING':
              // Process large datasets
              const processed = processData(data);
              self.postMessage({ type: 'PROCESSING_RESULT', data: processed });
              break;
          }
        });
        
        function performHeavyComputation(data) {
          // Placeholder for heavy computation
          return data;
        }
        
        function processData(data) {
          // Placeholder for data processing
          return data;
        }
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      (window as any).performanceWorker = new Worker(workerUrl);
    }
  }

  // ==================== Memory Management ====================
  
  private setupMemoryManagement(): void {
    // Periodic memory cleanup
    setInterval(() => {
      this.performMemoryCleanup();
    }, 60000); // Every minute
    
    // Monitor memory usage
    if ((performance as any).memory) {
      setInterval(() => {
        const memory = (performance as any).memory;
        const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        
        if (usageRatio > 0.9) {
          console.warn('High memory usage detected:', {
            used: this.formatBytes(memory.usedJSHeapSize),
            total: this.formatBytes(memory.totalJSHeapSize),
            limit: this.formatBytes(memory.jsHeapSizeLimit),
            ratio: (usageRatio * 100).toFixed(2) + '%'
          });
          
          this.performAggressiveCleanup();
        }
      }, 30000); // Every 30 seconds
    }
  }

  private performMemoryCleanup(): void {
    // Clear expired cache entries
    const now = Date.now();
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.expiresIn) {
        this.cache.delete(key);
      }
    });
    
    // Clear old preloaded modules if not used recently
    if (this.preloadedModules.size > 10) {
      const toRemove = Array.from(this.preloadedModules).slice(0, 5);
      toRemove.forEach(module => this.preloadedModules.delete(module));
    }
  }

  private performAggressiveCleanup(): void {
    // Clear all cache
    this.cache.clear();
    
    // Clear preloaded modules
    this.preloadedModules.clear();
    
    // Trigger garbage collection if available
    if ((window as any).gc) {
      (window as any).gc();
    }
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // ==================== Reporting ====================
  
  private reportPerformanceIssue(type: string, data: any): void {
    // Send to analytics or monitoring service
    // Could integrate with services like Sentry, LogRocket, etc.
  }

  // ==================== Public API ====================
  
  optimizeChangeDetection(): void {
    // This would be called from components to optimize change detection
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackById(index: number, item: any): any {
    return item.id || index;
  }

  // Cleanup on service destroy
  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.cache.clear();
    this.preloadedModules.clear();
  }
}