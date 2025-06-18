import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Invoice } from '../interface/invoice';
import { InvoiceResponse, InvoicePageResponse, InvoiceStatisticsResponse, InvoiceActionResponse } from '../interface/invoice-response';
import { ApiResponseUtil } from '../core/utils/api-response.util';
import { Page } from '../interface/appstates';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private readonly baseUrl = `${environment.apiUrl}/api/invoices`;

  constructor(private http: HttpClient) {}

  // Create invoice
  createInvoice(invoice: Invoice): Observable<InvoiceResponse> {
    return this.http.post<InvoiceResponse>(this.baseUrl, invoice)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Get all invoices with pagination
  getInvoices(page = 0, size = 10, sortBy = 'id', sortDirection = 'asc'): Observable<InvoicePageResponse> {
    const timestamp = new Date().getTime();
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortDirection', sortDirection)
      .set('_t', timestamp.toString()); // Cache busting parameter
    
    const url = `${this.baseUrl}?${params.toString()}`;
    console.log('🌐 Invoice Service - Making API call to:', url);
    console.log('🌐 Invoice Service - Parameters:', { page, size, sortBy, sortDirection, timestamp });
    
    return this.http.get<InvoicePageResponse>(this.baseUrl, { params })
      .pipe(
        map(response => {
          console.log('🌐 Invoice Service - Raw API response:', response);
          console.log('🌐 Invoice Service - Response data page info:', {
            currentPage: response.data?.number,
            totalPages: response.data?.totalPages,
            totalElements: response.data?.totalElements,
            contentLength: response.data?.content?.length,
            firstInvoiceId: response.data?.content?.[0]?.id,
            lastInvoiceId: response.data?.content?.[response.data?.content?.length - 1]?.id
          });
          
          // Ensure data is properly structured
          if (!response.data || !('content' in response.data)) {
            console.warn('🌐 Invoice Service - Unexpected response structure, attempting to fix...');
            const pageData = ApiResponseUtil.extractPageData<Invoice>(response);
            if (pageData) {
              response.data = pageData;
            }
          }
          return response;
        }),
        catchError(this.handleError)
      );
  }

  // Get invoice by ID
  getInvoiceById(id: number): Observable<InvoiceResponse> {
    return this.http.get<InvoiceResponse>(`${this.baseUrl}/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Get invoice by number
  getInvoiceByNumber(invoiceNumber: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/number/${invoiceNumber}`);
  }

  // Get invoices by client
  getInvoicesByClient(clientId: number, page = 0, size = 10): Observable<InvoicePageResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    return this.http.get<InvoicePageResponse>(`${this.baseUrl}/client/${clientId}`, { params })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Get invoices by case
  getInvoicesByCase(caseId: number, page = 0, size = 10): Observable<any> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    return this.http.get<any>(`${this.baseUrl}/case/${caseId}`, { params });
  }

  // Update invoice
  updateInvoice(id: number, invoice: Invoice): Observable<InvoiceResponse> {
    return this.http.put<InvoiceResponse>(`${this.baseUrl}/${id}`, invoice)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Change invoice status
  changeInvoiceStatus(id: number, status: string): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/${id}/status`, { status });
  }

  // Delete invoice
  deleteInvoice(id: number): Observable<InvoiceActionResponse> {
    return this.http.delete<InvoiceActionResponse>(`${this.baseUrl}/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Get unbilled time entries
  getUnbilledTimeEntries(clientId: number, caseId?: number): Observable<any> {
    let params = new HttpParams().set('clientId', clientId.toString());
    if (caseId) {
      params = params.set('legalCaseId', caseId.toString());
    }
    
    return this.http.get<any>(`${this.baseUrl}/unbilled-entries`, { params });
  }

  // Generate PDF
  generateInvoicePdf(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/pdf`, { responseType: 'blob' });
  }

  // Send invoice by email
  sendInvoiceByEmail(id: number, to: string, subject?: string, message?: string): Observable<any> {
    const body = { to, subject, message };
    return this.http.post<any>(`${this.baseUrl}/${id}/send`, body);
  }

  // Get invoice statistics
  getInvoiceStatistics(): Observable<InvoiceStatisticsResponse> {
    return this.http.get<InvoiceStatisticsResponse>(`${this.baseUrl}/statistics`)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Error handling
  private handleError(error: HttpErrorResponse): Observable<never> {
    const errorMessage = ApiResponseUtil.extractErrorMessage(error);
    console.error('Invoice API Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}