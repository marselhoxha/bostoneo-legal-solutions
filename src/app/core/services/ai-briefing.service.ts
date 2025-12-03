import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface BriefingRequest {
  todayEventsCount: number;
  urgentItemsCount: number;
  activeCasesCount: number;
  nextEventTitle: string | null;
  nextEventTime: string | null;
  hasCourtAppearance: boolean;
  courtCaseName: string | null;
  courtTime: string | null;
  recentTeamActivity: string[];
}

export interface BriefingResponse {
  briefing: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiBriefingService {
  private readonly baseUrl = `${environment.apiUrl}/api/ai/briefing`;
  private readonly CACHE_KEY = 'ai_briefing_cache';
  private readonly CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

  private briefingSubject = new BehaviorSubject<string | null>(null);
  public briefing$ = this.briefingSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get personalized AI briefing.
   * Returns cached version if fresh, otherwise fetches from API.
   */
  getBriefing(request: BriefingRequest): Observable<string> {
    // Check sessionStorage cache first
    const cached = this.getCachedBriefing();
    if (cached) {
      this.briefingSubject.next(cached);
      return of(cached);
    }

    this.loadingSubject.next(true);

    return this.http.post<any>(this.baseUrl, request).pipe(
      map(response => response?.data?.briefing || 'Your schedule is ready for review.'),
      tap(briefing => {
        this.cacheBriefing(briefing);
        this.briefingSubject.next(briefing);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        console.error('Error fetching AI briefing:', error);
        this.loadingSubject.next(false);
        const fallback = this.generateFallbackBriefing(request);
        this.briefingSubject.next(fallback);
        return of(fallback);
      })
    );
  }

  /**
   * Invalidate the cached briefing.
   * Call this when significant changes occur.
   */
  invalidateCache(): Observable<any> {
    sessionStorage.removeItem(this.CACHE_KEY);
    this.briefingSubject.next(null);

    return this.http.post(`${this.baseUrl}/invalidate`, {}).pipe(
      catchError(error => {
        console.error('Error invalidating briefing cache:', error);
        return of(null);
      })
    );
  }

  /**
   * Get cached briefing if still fresh
   */
  private getCachedBriefing(): string | null {
    try {
      const cached = sessionStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      const { briefing, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age < this.CACHE_DURATION_MS) {
        return briefing;
      }

      // Cache expired
      sessionStorage.removeItem(this.CACHE_KEY);
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Cache briefing in sessionStorage
   */
  private cacheBriefing(briefing: string): void {
    try {
      sessionStorage.setItem(this.CACHE_KEY, JSON.stringify({
        briefing,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Could not cache briefing:', e);
    }
  }

  /**
   * Generate fallback briefing when API fails
   */
  private generateFallbackBriefing(request: BriefingRequest): string {
    if (request.hasCourtAppearance && request.courtTime) {
      return `You have a court appearance at ${request.courtTime} today. ${request.urgentItemsCount} urgent items require attention.`;
    }

    if (request.urgentItemsCount > 0) {
      return `You have ${request.todayEventsCount} events scheduled today with ${request.urgentItemsCount} urgent items requiring attention.`;
    }

    if (request.todayEventsCount > 0) {
      return `You have ${request.todayEventsCount} events on your calendar today. All urgent matters are addressed.`;
    }

    return `Your schedule is clear today. ${request.activeCasesCount} active cases await your attention.`;
  }
}
