import { Injectable } from '@angular/core';
import { HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of, Subject, timer } from 'rxjs';
import { filter, share, switchMap, takeUntil, tap } from 'rxjs/operators';

export interface CacheConfig {
  maxAge?: number;        // Max age in milliseconds
  maxSize?: number;       // Max number of cached entries
  excludePatterns?: RegExp[];  // URL patterns to exclude from caching
  includePatterns?: RegExp[];  // URL patterns to include in caching
  strategy?: 'LRU' | 'LFU' | 'FIFO';  // Cache eviction strategy
}

interface CacheEntry {
  url: string;
  response: HttpResponse<any>;
  timestamp: number;
  hits: number;
  size: number;
}

interface PendingRequest {
  request: HttpRequest<any>;
  subject: Subject<HttpResponse<any>>;
}

@Injectable({
  providedIn: 'root'
})
export class RequestCacheService {
  private cache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, PendingRequest>();
  private cacheConfig: CacheConfig = {
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxSize: 100,
    strategy: 'LRU',
    excludePatterns: [
      /\/api\/auth\//,
      /\/api\/upload\//,
      /\/api\/ws\//
    ],
    includePatterns: [
      /\/api\/tasks\//,
      /\/api\/cases\//,
      /\/api\/users\//,
      /\/api\/clients\//
    ]
  };

  constructor() {
    this.startCacheCleanup();
  }

  configure(config: Partial<CacheConfig>): void {
    this.cacheConfig = { ...this.cacheConfig, ...config };
  }

  get(req: HttpRequest<any>): HttpResponse<any> | null {
    const url = this.getCacheKey(req);
    
    if (!this.shouldCache(req)) {
      return null;
    }

    const entry = this.cache.get(url);
    
    if (!entry) {
      return null;
    }

    // Check if cache is expired
    const age = Date.now() - entry.timestamp;
    if (age > (this.cacheConfig.maxAge || 0)) {
      this.cache.delete(url);
      return null;
    }

    // Update hit count for LFU strategy
    entry.hits++;
    
    // Update timestamp for LRU strategy
    if (this.cacheConfig.strategy === 'LRU') {
      entry.timestamp = Date.now();
    }

    return entry.response;
  }

  put(req: HttpRequest<any>, response: HttpResponse<any>): void {
    if (!this.shouldCache(req)) {
      return;
    }

    const url = this.getCacheKey(req);
    
    // Check cache size limit
    if (this.cache.size >= (this.cacheConfig.maxSize || 100)) {
      this.evictEntry();
    }

    const entry: CacheEntry = {
      url,
      response,
      timestamp: Date.now(),
      hits: 1,
      size: this.estimateSize(response)
    };

    this.cache.set(url, entry);

    // Notify pending requests
    const pending = this.pendingRequests.get(url);
    if (pending) {
      pending.subject.next(response);
      pending.subject.complete();
      this.pendingRequests.delete(url);
    }
  }

  clear(pattern?: string | RegExp): void {
    if (pattern) {
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      Array.from(this.cache.keys())
        .filter(key => regex.test(key))
        .forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  // Check if there's a pending request for this URL
  getPendingRequest(req: HttpRequest<any>): Observable<HttpResponse<any>> | null {
    const url = this.getCacheKey(req);
    const pending = this.pendingRequests.get(url);

    if (pending) {
      return pending.subject.asObservable();
    }
    
    return null;
  }

  // Register a pending request
  setPendingRequest(req: HttpRequest<any>): Observable<HttpResponse<any>> {
    const url = this.getCacheKey(req);
    const subject = new Subject<HttpResponse<any>>();
    
    this.pendingRequests.set(url, { request: req, subject });
    
    // Auto-cleanup after timeout
    timer(30000).subscribe(() => {
      if (this.pendingRequests.has(url)) {
        this.pendingRequests.delete(url);
        subject.error(new Error('Request timeout'));
      }
    });
    
    return subject.asObservable();
  }

  // Remove pending request
  removePendingRequest(req: HttpRequest<any>): void {
    const url = this.getCacheKey(req);
    this.pendingRequests.delete(url);
  }

  private shouldCache(req: HttpRequest<any>): boolean {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return false;
    }

    const url = req.urlWithParams;

    // Check exclude patterns
    if (this.cacheConfig.excludePatterns) {
      for (const pattern of this.cacheConfig.excludePatterns) {
        if (pattern.test(url)) {
          return false;
        }
      }
    }

    // Check include patterns
    if (this.cacheConfig.includePatterns) {
      for (const pattern of this.cacheConfig.includePatterns) {
        if (pattern.test(url)) {
          return true;
        }
      }
      return false; // If include patterns are defined, only cache matching URLs
    }

    return true;
  }

  private getCacheKey(req: HttpRequest<any>): string {
    // Include relevant headers in cache key for user-specific data
    const authHeader = req.headers.get('Authorization') || '';
    const userHash = authHeader ? this.hashCode(authHeader).toString() : 'anonymous';
    return `${userHash}:${req.method}:${req.urlWithParams}`;
  }

  private evictEntry(): void {
    let entryToEvict: string | null = null;

    switch (this.cacheConfig.strategy) {
      case 'LRU':
        // Find least recently used
        let oldestTime = Date.now();
        this.cache.forEach((entry, key) => {
          if (entry.timestamp < oldestTime) {
            oldestTime = entry.timestamp;
            entryToEvict = key;
          }
        });
        break;

      case 'LFU':
        // Find least frequently used
        let minHits = Infinity;
        this.cache.forEach((entry, key) => {
          if (entry.hits < minHits) {
            minHits = entry.hits;
            entryToEvict = key;
          }
        });
        break;

      case 'FIFO':
      default:
        // Remove first entry
        entryToEvict = this.cache.keys().next().value;
        break;
    }

    if (entryToEvict) {
      this.cache.delete(entryToEvict);
    }
  }

  private startCacheCleanup(): void {
    // Run cleanup every minute
    setInterval(() => {
      const now = Date.now();
      const maxAge = this.cacheConfig.maxAge || 0;
      
      Array.from(this.cache.entries()).forEach(([key, entry]) => {
        if (now - entry.timestamp > maxAge) {
          this.cache.delete(key);
        }
      });
    }, 60000);
  }

  private estimateSize(response: HttpResponse<any>): number {
    // Rough estimation of response size
    try {
      const body = JSON.stringify(response.body);
      return body.length * 2; // 2 bytes per character (UTF-16)
    } catch {
      return 1024; // Default size
    }
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  // Get cache statistics
  getStats(): {
    size: number;
    entries: number;
    totalHits: number;
    totalSize: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    let totalHits = 0;
    let totalSize = 0;
    let oldestTime = Date.now();
    let newestTime = 0;

    this.cache.forEach(entry => {
      totalHits += entry.hits;
      totalSize += entry.size;
      if (entry.timestamp < oldestTime) oldestTime = entry.timestamp;
      if (entry.timestamp > newestTime) newestTime = entry.timestamp;
    });

    return {
      size: this.cache.size,
      entries: this.cache.size,
      totalHits,
      totalSize,
      oldestEntry: this.cache.size > 0 ? new Date(oldestTime) : null,
      newestEntry: this.cache.size > 0 ? new Date(newestTime) : null
    };
  }
}