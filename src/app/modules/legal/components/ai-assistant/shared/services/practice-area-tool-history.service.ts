import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment';
import {
  ToolHistoryItem,
  CreateToolHistoryRequest,
  HistoryGroup
} from '../models/tool-history.model';

interface HttpResponse<T> {
  data: T;
  message: string;
  status: string;
  statusCode: number;
}

@Injectable({
  providedIn: 'root'
})
export class PracticeAreaToolHistoryService {
  private apiUrl = `${environment.apiUrl}/api/practice-areas`;

  // Cache for history items by practice area
  private historyCache = new Map<string, BehaviorSubject<ToolHistoryItem[]>>();

  constructor(private http: HttpClient) {}

  /**
   * Get the history cache observable for a practice area
   */
  getHistoryObservable(practiceArea: string): Observable<ToolHistoryItem[]> {
    if (!this.historyCache.has(practiceArea)) {
      this.historyCache.set(practiceArea, new BehaviorSubject<ToolHistoryItem[]>([]));
    }
    return this.historyCache.get(practiceArea)!.asObservable();
  }

  /**
   * Get all history items for a practice area
   */
  getHistory(practiceArea: string, toolType?: string): Observable<ToolHistoryItem[]> {
    let url = `${this.apiUrl}/${practiceArea}/history`;
    if (toolType) {
      url += `?toolType=${toolType}`;
    }

    return this.http.get<HttpResponse<{ history: ToolHistoryItem[] }>>(url).pipe(
      map(response => response.data.history),
      tap(items => {
        // Update cache
        if (!this.historyCache.has(practiceArea)) {
          this.historyCache.set(practiceArea, new BehaviorSubject<ToolHistoryItem[]>(items));
        } else {
          this.historyCache.get(practiceArea)!.next(items);
        }
      })
    );
  }

  /**
   * Get a specific history item by ID
   */
  getHistoryById(practiceArea: string, id: number): Observable<ToolHistoryItem> {
    return this.http
      .get<HttpResponse<{ item: ToolHistoryItem }>>(`${this.apiUrl}/${practiceArea}/history/${id}`)
      .pipe(map(response => response.data.item));
  }

  /**
   * Create a new history entry
   */
  createHistory(practiceArea: string, request: CreateToolHistoryRequest): Observable<ToolHistoryItem> {
    return this.http
      .post<HttpResponse<{ item: ToolHistoryItem }>>(`${this.apiUrl}/${practiceArea}/history`, request)
      .pipe(
        map(response => response.data.item),
        tap(newItem => {
          // Update cache with new item
          if (this.historyCache.has(practiceArea)) {
            const current = this.historyCache.get(practiceArea)!.value;
            this.historyCache.get(practiceArea)!.next([newItem, ...current]);
          }
        })
      );
  }

  /**
   * Delete a history item
   */
  deleteHistory(practiceArea: string, id: number): Observable<void> {
    return this.http.delete<HttpResponse<void>>(`${this.apiUrl}/${practiceArea}/history/${id}`).pipe(
      map(() => undefined),
      tap(() => {
        // Update cache by removing item
        if (this.historyCache.has(practiceArea)) {
          const current = this.historyCache.get(practiceArea)!.value;
          this.historyCache.get(practiceArea)!.next(current.filter(item => item.id !== id));
        }
      })
    );
  }

  /**
   * Get history items linked to a specific case
   */
  getHistoryByCase(practiceArea: string, caseId: number): Observable<ToolHistoryItem[]> {
    return this.http
      .get<HttpResponse<{ history: ToolHistoryItem[] }>>(`${this.apiUrl}/${practiceArea}/history/case/${caseId}`)
      .pipe(map(response => response.data.history));
  }

  /**
   * Group history items by date for display
   */
  groupHistoryByDate(items: ToolHistoryItem[]): HistoryGroup[] {
    const groups: Map<string, ToolHistoryItem[]> = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    items.forEach(item => {
      const itemDate = new Date(item.createdAt);
      itemDate.setHours(0, 0, 0, 0);

      let groupKey: string;
      if (itemDate.getTime() === today.getTime()) {
        groupKey = 'Today';
      } else if (itemDate.getTime() === yesterday.getTime()) {
        groupKey = 'Yesterday';
      } else {
        groupKey = itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    });

    // Convert to array and sort by date (most recent first)
    return Array.from(groups.entries()).map(([label, items]) => ({
      date: items[0].createdAt,
      label,
      items,
      isExpanded: label === 'Today'
    }));
  }

  /**
   * Clear the cache for a practice area
   */
  clearCache(practiceArea?: string): void {
    if (practiceArea) {
      this.historyCache.delete(practiceArea);
    } else {
      this.historyCache.clear();
    }
  }
}
