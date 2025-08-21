import { Injectable } from '@angular/core';
import { Subject, Observable, timer } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, shareReplay, throttleTime } from 'rxjs/operators';

export interface DebounceConfig {
  delay?: number;
  distinct?: boolean;
  throttle?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DebounceService {
  private subjects = new Map<string, Subject<any>>();
  private observables = new Map<string, Observable<any>>();

  /**
   * Create a debounced observable for a specific key
   */
  createDebounced<T>(
    key: string,
    source: (value: T) => Observable<any>,
    config: DebounceConfig = {}
  ): { trigger: (value: T) => void; observable: Observable<any> } {
    
    const { delay = 300, distinct = true, throttle = false } = config;
    
    // Create or get existing subject
    if (!this.subjects.has(key)) {
      this.subjects.set(key, new Subject<T>());
    }
    
    const subject = this.subjects.get(key) as Subject<T>;
    
    // Create observable if it doesn't exist
    if (!this.observables.has(key)) {
      let obs = subject.asObservable();
      
      // Apply operators based on config
      if (throttle) {
        obs = obs.pipe(throttleTime(delay, undefined, { leading: true, trailing: true }));
      } else {
        obs = obs.pipe(debounceTime(delay));
      }
      
      if (distinct) {
        obs = obs.pipe(distinctUntilChanged());
      }
      
      // Switch to the source observable
      obs = obs.pipe(
        switchMap(value => source(value)),
        shareReplay(1)
      );
      
      this.observables.set(key, obs);
    }
    
    return {
      trigger: (value: T) => subject.next(value),
      observable: this.observables.get(key)!
    };
  }

  /**
   * Create a simple debounced subject
   */
  createDebouncedSubject<T>(key: string, delay: number = 300): {
    subject: Subject<T>;
    debounced: Observable<T>;
  } {
    if (!this.subjects.has(key)) {
      this.subjects.set(key, new Subject<T>());
    }
    
    const subject = this.subjects.get(key) as Subject<T>;
    const debounced = subject.pipe(
      debounceTime(delay),
      distinctUntilChanged(),
      shareReplay(1)
    );
    
    return { subject, debounced };
  }

  /**
   * Debounce a function call
   */
  debounceFunction<T extends (...args: any[]) => any>(
    fn: T,
    delay: number = 300
  ): (...args: Parameters<T>) => void {
    let timeoutId: any;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fn(...args);
      }, delay);
    };
  }

  /**
   * Throttle a function call
   */
  throttleFunction<T extends (...args: any[]) => any>(
    fn: T,
    delay: number = 300
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeoutId: any;
    
    return (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;
      
      if (timeSinceLastCall >= delay) {
        lastCall = now;
        fn(...args);
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          lastCall = Date.now();
          fn(...args);
        }, delay - timeSinceLastCall);
      }
    };
  }

  /**
   * Clean up resources for a specific key
   */
  cleanup(key: string): void {
    const subject = this.subjects.get(key);
    if (subject) {
      subject.complete();
      this.subjects.delete(key);
    }
    this.observables.delete(key);
  }

  /**
   * Clean up all resources
   */
  cleanupAll(): void {
    this.subjects.forEach(subject => subject.complete());
    this.subjects.clear();
    this.observables.clear();
  }
}