import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { InvoiceTemplate } from '../interface/invoice-template';
import { CustomHttpResponse, Page } from '../interface/appstates';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InvoiceTemplateService {
  private readonly baseUrl = `${environment.apiUrl}/api/invoice-templates`;

  constructor(private http: HttpClient) {}

  createTemplate(template: InvoiceTemplate): Observable<CustomHttpResponse<InvoiceTemplate>> {
    return this.http.post<CustomHttpResponse<InvoiceTemplate>>(this.baseUrl, template)
      .pipe(catchError(this.handleError));
  }

  getTemplates(page = 0, size = 10, sortBy = 'name', sortDirection = 'asc'): Observable<CustomHttpResponse<Page<InvoiceTemplate>>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortDirection', sortDirection);

    return this.http.get<CustomHttpResponse<Page<InvoiceTemplate>>>(this.baseUrl, { params })
      .pipe(catchError(this.handleError));
  }

  getActiveTemplates(): Observable<CustomHttpResponse<InvoiceTemplate[]>> {
    return this.http.get<CustomHttpResponse<InvoiceTemplate[]>>(`${this.baseUrl}/active`)
      .pipe(catchError(this.handleError));
  }

  getDefaultTemplate(): Observable<CustomHttpResponse<InvoiceTemplate>> {
    return this.http.get<CustomHttpResponse<InvoiceTemplate>>(`${this.baseUrl}/default`)
      .pipe(catchError(this.handleError));
  }

  getTemplateById(id: number): Observable<CustomHttpResponse<InvoiceTemplate>> {
    return this.http.get<CustomHttpResponse<InvoiceTemplate>>(`${this.baseUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  updateTemplate(id: number, template: InvoiceTemplate): Observable<CustomHttpResponse<InvoiceTemplate>> {
    return this.http.put<CustomHttpResponse<InvoiceTemplate>>(`${this.baseUrl}/${id}`, template)
      .pipe(catchError(this.handleError));
  }

  deleteTemplate(id: number): Observable<CustomHttpResponse<void>> {
    return this.http.delete<CustomHttpResponse<void>>(`${this.baseUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('Invoice template service error:', error);
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return throwError(() => new Error(errorMessage));
  }
}