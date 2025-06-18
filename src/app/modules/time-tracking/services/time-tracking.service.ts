import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, forkJoin } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface TimeEntry {
  id?: number;
  legalCaseId: number;
  userId: number;
  date: string;
  hours: number;
  rate: number;
  description: string;
  status: 'APPROVED' | 'SUBMITTED' | 'DRAFT' | 'REJECTED' | 'BILLED';
  billable: boolean;
  userName?: string;
  caseName?: string;
  caseNumber?: string;
  userEmail?: string;
  clientId?: number;
  clientName?: string;
  createdAt?: Date;
  updatedAt?: Date;
  startTime?: string;
  endTime?: string;
  invoiceId?: number;
  billedAmount?: number;
  totalAmount?: number;
}

export interface TimeEntryFilter {
  userId?: number;
  legalCaseId?: number;
  clientId?: number;
  startDate?: string;
  endDate?: string;
  status?: string[];
  statuses?: string[];
  billable?: boolean;
  description?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: string;
}

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TimeTrackingService {
  private readonly baseUrl = `${environment.apiUrl}/api/time-entries`;
  private timeEntriesSubject = new BehaviorSubject<TimeEntry[]>([]);
  public timeEntries$ = this.timeEntriesSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Create a new time entry
  createTimeEntry(timeEntry: TimeEntry): Observable<TimeEntry> {
    return this.http.post<any>(`${this.baseUrl}`, timeEntry).pipe(
      map(response => response.data),
      tap(data => {
        const currentEntries = this.timeEntriesSubject.value;
        this.timeEntriesSubject.next([...currentEntries, data]);
      }),
      catchError(this.handleError)
    );
  }

  // Get all time entries with pagination and filtering
  getTimeEntries(filter: TimeEntryFilter = {}): Observable<any> {
    let params = new HttpParams();
    
    if (filter.userId) params = params.set('userId', filter.userId.toString());
    if (filter.legalCaseId) params = params.set('legalCaseId', filter.legalCaseId.toString());
    if (filter.clientId) params = params.set('clientId', filter.clientId.toString());
    if (filter.startDate) params = params.set('startDate', filter.startDate);
    if (filter.endDate) params = params.set('endDate', filter.endDate);
    if (filter.billable !== undefined) params = params.set('billable', filter.billable.toString());
    if (filter.page !== undefined) params = params.set('page', filter.page.toString());
    if (filter.size !== undefined) params = params.set('size', filter.size.toString());
    if (filter.sortBy) params = params.set('sortBy', filter.sortBy);
    if (filter.sortDirection) params = params.set('sortDirection', filter.sortDirection);
    
    if (filter.status && filter.status.length > 0) {
      filter.status.forEach(status => {
        params = params.append('status', status);
      });
    }

    if (filter.statuses && filter.statuses.length > 0) {
      filter.statuses.forEach(status => {
        params = params.append('statuses', status);
      });
    }

    return this.http.get<any>(`${this.baseUrl}`, { params }).pipe(
      map(response => response.data),
      tap(data => {
        if (data.content) {
          this.timeEntriesSubject.next(data.content);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Get time entry by ID
  getTimeEntryById(id: number): Observable<TimeEntry> {
    return this.http.get<any>(`${this.baseUrl}/${id}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Alias for getTimeEntryById for backward compatibility
  getTimeEntry(id: number): Observable<TimeEntry> {
    return this.getTimeEntryById(id);
  }

  // Update time entry
  updateTimeEntry(id: number, timeEntry: TimeEntry): Observable<TimeEntry> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, timeEntry).pipe(
      map(response => response.data),
      tap(updatedEntry => {
        const currentEntries = this.timeEntriesSubject.value;
        const index = currentEntries.findIndex(e => e.id === id);
        if (index !== -1) {
          const updatedEntries = [...currentEntries];
          updatedEntries[index] = updatedEntry;
          this.timeEntriesSubject.next(updatedEntries);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Delete time entry
  deleteTimeEntry(id: number): Observable<void> {
    return this.http.delete<any>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        const currentEntries = this.timeEntriesSubject.value;
        this.timeEntriesSubject.next(currentEntries.filter(entry => entry.id !== id));
      }),
      catchError(this.handleError)
    );
  }

  // Change time entry status
  changeTimeEntryStatus(id: number, status: string): Observable<TimeEntry> {
    return this.http.patch<any>(`${this.baseUrl}/${id}/status`, { status }).pipe(
      map(response => response.data),
      tap(updatedEntry => {
        const currentEntries = this.timeEntriesSubject.value;
        const index = currentEntries.findIndex(e => e.id === id);
        if (index !== -1) {
          const updatedEntries = [...currentEntries];
          updatedEntries[index] = { ...updatedEntries[index], status: status as any };
          this.timeEntriesSubject.next(updatedEntries);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Alias for changeTimeEntryStatus for backward compatibility
  updateTimeEntryStatus(id: number, status: string): Observable<TimeEntry> {
    return this.changeTimeEntryStatus(id, status);
  }

  // Get time entries with filters (for time approval)
  getTimeEntriesWithFilters(filters: TimeEntryFilter): Observable<PagedResponse<TimeEntry>> {
    return this.http.post<any>(`${this.baseUrl}/search`, filters).pipe(
      map(response => ({
        content: response.data.timeEntries || [],
        totalElements: response.data.totalElements || 0,
        totalPages: response.data.totalPages || 1,
        size: response.data.pageSize || filters.size || 10,
        number: response.data.currentPage || 0,
        first: (response.data.currentPage || 0) === 0,
        last: (response.data.currentPage || 0) === (response.data.totalPages || 1) - 1
      })),
      catchError(this.handleError)
    );
  }

  // Get time entries by user
  getTimeEntriesByUser(userId: number, page: number = 0, size: number = 10): Observable<PagedResponse<TimeEntry>> {
    // Use the search endpoint with filters
    const filters: TimeEntryFilter = {
      userId: userId,
      page: page,
      size: size,
      sortBy: 'date',
      sortDirection: 'desc'
    };
    
    return this.getTimeEntriesWithFilters(filters);
  }

  // Get time entries by date range
  getTimeEntriesByDateRange(userId: number, startDate: string, endDate: string): Observable<TimeEntry[]> {
    const filters: TimeEntryFilter = {
      userId: userId,
      startDate: startDate,
      endDate: endDate,
      page: 0,
      size: 1000 // Get all entries for the date range
    };
    
    return this.getTimeEntriesWithFilters(filters).pipe(
      map(response => response.content)
    );
  }

  // Approve time entry
  approveTimeEntry(id: number): Observable<TimeEntry> {
    return this.http.post<any>(`${this.baseUrl}/${id}/approve`, {}).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Reject time entry
  rejectTimeEntry(id: number, reason: string): Observable<TimeEntry> {
    return this.http.post<any>(`${this.baseUrl}/${id}/reject`, { reason }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Get all clients
  getClients(): Observable<any[]> {
    const url = `${environment.apiUrl}/client`;
    return this.http.get<any>(url, { params: { page: 0, size: 1000 } }).pipe(
      map(res => res?.data?.page?.content ?? []),
      catchError(this.handleError)
    );
  }

  // Get unbilled time entries for a client and case
  getUnbilledTimeEntries(clientId: number, caseId: number): Observable<TimeEntry[]> {
    return this.http.get<TimeEntry[]>(`/time-entries/unbilled?clientId=${clientId}&caseId=${caseId}`);
  }

  // Get cases for client
  getCasesForClient(clientId: number): Observable<any[]> {
    const url = `${environment.apiUrl}/legal-case/list`;
    return this.http.get<any>(url, { params: { page: 0, size: 1000 } }).pipe(
      map(res => (res?.data?.page?.content ?? []).filter((c: any) => c.clientId === clientId)),
      catchError(this.handleError)
    );
  }

  // Get legal cases by client
  getLegalCasesByClient(clientId: number): Observable<any[]> {
    return this.http.get<any>(`${environment.apiUrl}/api/legal/cases/client/${clientId}`).pipe(
      map(response => response.data || []),
      catchError(error => {
        console.error('Error fetching cases for client:', error);
        // Try alternative endpoint
        return this.http.get<any>(`${environment.apiUrl}/api/legal/cases`).pipe(
          map(response => {
            const allCases = response.data || [];
            return allCases.filter((c: any) => c.clientId === clientId);
          }),
          catchError(innerError => {
            console.error('Error fetching cases from alternative endpoint:', innerError);
            return throwError(() => new Error('Failed to load legal cases'));
          })
        );
      })
    );
  }

  // Get time entries statistics
  getTimeEntriesStatistics(userId?: number): Observable<any> {
    let params = new HttpParams();
    if (userId) params = params.set('userId', userId.toString());
    
    return this.http.get<any>(`${this.baseUrl}/statistics`, { params }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Get time entries by case
  getTimeEntriesByCase(caseId: number, page: number = 0, size: number = 10): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/case/${caseId}`, {
      params: new HttpParams()
        .set('page', page.toString())
        .set('size', size.toString())
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Get case time summary
  getCaseTimeSummary(caseId: number): Observable<any> {
    const hoursObs = this.http.get<any>(`${this.baseUrl}/analytics/case/${caseId}/hours`);
    const amountObs = this.http.get<any>(`${this.baseUrl}/analytics/case/${caseId}/amount`);
    
    return forkJoin({
      hours: hoursObs,
      amount: amountObs
    }).pipe(
      map(results => ({
        data: {
          totalHours: results.hours.data?.totalHours || 0,
          totalAmount: results.amount.data?.totalAmount || 0
        }
      })),
      catchError(this.handleError)
    );
  }

  // Handle API errors
  private handleError(error: any): Observable<never> {
    console.error('API error:', error);
    let errorMessage = 'An unknown error occurred';
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return throwError(() => errorMessage);
  }
} 
 