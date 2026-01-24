import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpEvent } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { TimeEntry } from './time-tracking.service';

export interface Invoice {
  id?: number;
  invoiceNumber?: string;
  clientId: number;
  clientName?: string;
  legalCaseId?: number;
  caseName?: string;
  issueDate: string;
  dueDate: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  timeEntryIds: number[];
  timeEntries?: TimeEntry[];
  createdBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InvoiceFilter {
  clientId?: number;
  legalCaseId?: number;
  status?: string[];
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private readonly baseUrl = `${environment.apiUrl}/api/invoices`;
  private invoicesSubject = new BehaviorSubject<Invoice[]>([]);
  public invoices$ = this.invoicesSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Create a new invoice
  createInvoice(invoice: Invoice): Observable<Invoice> {
    return this.http.post<any>(`${this.baseUrl}`, invoice).pipe(
      map(response => response.data),
      tap(data => {
        const currentInvoices = this.invoicesSubject.value;
        this.invoicesSubject.next([...currentInvoices, data]);
      }),
      catchError(this.handleError)
    );
  }

  // Create invoice from time entries - NEW METHOD
  createInvoiceFromTimeEntries(invoice: any, timeEntryIds: number[]): Observable<Invoice> {
    const requestBody = {
      invoice: {
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        legalCaseId: invoice.legalCaseId,
        caseName: invoice.caseName,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        taxRate: invoice.taxRate,
        notes: invoice.notes
      },
      timeEntryIds: timeEntryIds
    };

    return this.http.post<any>(`${this.baseUrl}/from-time-entries`, requestBody).pipe(
      map(response => response.data),
      tap(data => {
        const currentInvoices = this.invoicesSubject.value;
        this.invoicesSubject.next([...currentInvoices, data]);
      }),
      catchError(error => {
        console.error('Error creating invoice from time entries:', error);
        return this.handleError(error);
      })
    );
  }

  // Get all invoices with pagination and filtering
  getInvoices(filter: InvoiceFilter = {}): Observable<any> {
    let params = new HttpParams();
    
    if (filter.clientId) params = params.set('clientId', filter.clientId.toString());
    if (filter.legalCaseId) params = params.set('legalCaseId', filter.legalCaseId.toString());
    if (filter.startDate) params = params.set('startDate', filter.startDate);
    if (filter.endDate) params = params.set('endDate', filter.endDate);
    if (filter.minAmount) params = params.set('minAmount', filter.minAmount.toString());
    if (filter.maxAmount) params = params.set('maxAmount', filter.maxAmount.toString());
    if (filter.page !== undefined) params = params.set('page', filter.page.toString());
    if (filter.size !== undefined) params = params.set('size', filter.size.toString());
    if (filter.sortBy) params = params.set('sortBy', filter.sortBy);
    if (filter.sortDirection) params = params.set('sortDirection', filter.sortDirection);
    
    if (filter.status && filter.status.length > 0) {
      filter.status.forEach(status => {
        params = params.append('status', status);
      });
    }

    return this.http.get<any>(`${this.baseUrl}`, { params }).pipe(
      map(response => response.data),
      tap(data => {
        if (data.content) {
          this.invoicesSubject.next(data.content);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Get invoice by ID
  getInvoiceById(id: number): Observable<Invoice> {
    return this.http.get<any>(`${this.baseUrl}/${id}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Update invoice
  updateInvoice(id: number, invoice: Invoice): Observable<Invoice> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, invoice).pipe(
      map(response => response.data),
      tap(updatedInvoice => {
        const currentInvoices = this.invoicesSubject.value;
        const index = currentInvoices.findIndex(i => i.id === id);
        if (index !== -1) {
          const updatedInvoices = [...currentInvoices];
          updatedInvoices[index] = updatedInvoice;
          this.invoicesSubject.next(updatedInvoices);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Delete invoice
  deleteInvoice(id: number): Observable<void> {
    return this.http.delete<any>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        const currentInvoices = this.invoicesSubject.value;
        this.invoicesSubject.next(currentInvoices.filter(invoice => invoice.id !== id));
      }),
      catchError(this.handleError)
    );
  }

  // Change invoice status
  changeInvoiceStatus(id: number, status: string): Observable<Invoice> {
    return this.http.patch<any>(`${this.baseUrl}/${id}/status`, { status }).pipe(
      map(response => response.data),
      tap(updatedInvoice => {
        const currentInvoices = this.invoicesSubject.value;
        const index = currentInvoices.findIndex(i => i.id === id);
        if (index !== -1) {
          const updatedInvoices = [...currentInvoices];
          updatedInvoices[index] = { ...updatedInvoices[index], status: status as any };
          this.invoicesSubject.next(updatedInvoices);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Get unbilled time entries for a client
  getUnbilledTimeEntries(clientId: number, legalCaseId?: number): Observable<TimeEntry[]> {
    let params = new HttpParams().set('clientId', clientId.toString());
    if (legalCaseId) params = params.set('legalCaseId', legalCaseId.toString());

    // Try the unbilled entries endpoint first
    return this.http.get<any>(`${this.baseUrl}/unbilled-entries`, {
      params: new HttpParams()
        .set('clientId', clientId.toString())
        .set(legalCaseId ? 'legalCaseId' : 'dummy', legalCaseId ? legalCaseId.toString() : '')
    }).pipe(
      map(response => {
        if (response && response.data) {
          return response.data;
        } else {
          throw new Error('Invalid response format from unbilled entries API');
        }
      }),
      catchError(error => {
        console.error('Error fetching from unbilled-entries endpoint:', error);

        // Fall back to time entries endpoint with filters
        return this.http.get<any>(`${environment.apiUrl}/api/time-entries`, {
          params: params
            .append('status', 'APPROVED')
            .append('billable', 'true')
            .append('size', '100')
        }).pipe(
          map(response => {
            if (response && response.data && response.data.content) {
              return response.data.content;
            } else {
              throw new Error('Invalid response format from time entries API');
            }
          }),
          catchError(innerError => {
            console.error('Error fetching from time-entries endpoint:', innerError);

            // Try another endpoint variation as last resort
            const queryParams = `?clientId=${clientId}${legalCaseId ? `&legalCaseId=${legalCaseId}` : ''}&status=APPROVED&billable=true`;
            return this.http.get<any>(`${environment.apiUrl}/api/time-entries/unbilled${queryParams}`).pipe(
              map(lastResponse => {
                if (lastResponse && lastResponse.data) {
                  return lastResponse.data;
                } else {
                  throw new Error('Could not retrieve unbilled time entries from any endpoint');
                }
              }),
              catchError(finalError => {
                console.error('All endpoints failed for unbilled entries:', finalError);
                return throwError(() => new Error('Failed to load unbilled time entries after trying all available endpoints'));
              })
            );
          })
        );
      })
    );
  }

  // Generate invoice PDF
  generateInvoicePdf(id: number): Observable<HttpEvent<Blob>> {
    return this.http.get(`${this.baseUrl}/${id}/pdf`, {
      responseType: 'blob',
      observe: 'events',
      reportProgress: true
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Send invoice by email
  sendInvoiceByEmail(id: number, emailData: { to: string, subject?: string, message?: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${id}/send`, emailData).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Get invoice statistics
  getInvoiceStatistics(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/statistics`).pipe(
      map(response => response.data),
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