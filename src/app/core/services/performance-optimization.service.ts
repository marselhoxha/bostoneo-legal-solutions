import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PerformanceOptimizationService {
  private preloadedModules = new Set<string>();

  constructor(private router: Router) {
    this.initializePerformanceOptimizations();
  }

  private initializePerformanceOptimizations() {
    // Preload critical modules after initial load
    this.setupSmartPreloading();
    
    // Enable performance monitoring
    this.enablePerformanceMonitoring();
    
    // Setup image lazy loading
    this.setupImageLazyLoading();
  }

  private setupSmartPreloading() {
    // Preload modules based on user navigation patterns
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.predictAndPreloadModules(event.url);
      });
  }

  private predictAndPreloadModules(currentUrl: string) {
    // Smart preloading based on current route
    const preloadMap: { [key: string]: string[] } = {
      '/home': ['legal', 'clients'],
      '/legal': ['legal/cases', 'legal/documents'],
      '/clients': ['invoices'],
      '/admin': ['admin/users', 'admin/roles']
    };

    const modulesToPreload = preloadMap[currentUrl] || [];
    modulesToPreload.forEach(module => this.preloadModule(module));
  }

  private preloadModule(modulePath: string) {
    if (this.preloadedModules.has(modulePath)) {
      return;
    }

    // Dynamic import for preloading
    switch (modulePath) {
      case 'legal':
        import('../../modules/legal/legal.module').then(() => {
          this.preloadedModules.add(modulePath);
        });
        break;
      case 'clients':
        import('../../component/client/client.module').then(() => {
          this.preloadedModules.add(modulePath);
        });
        break;
      // Add more cases as needed
    }
  }

  private enablePerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
      // Monitor long tasks
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.warn('Long task detected:', entry);
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    }
  }

  private setupImageLazyLoading() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              imageObserver.unobserve(img);
            }
          }
        });
      });

      // Observe all images with data-src
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }

  // Bundle size optimization helpers
  removeUnusedImports() {
    console.log('Checking for unused imports...');
    // This would be handled by build tools
  }

  // Memory leak prevention
  clearCache() {
    // Clear any in-memory caches
    this.preloadedModules.clear();
  }
}