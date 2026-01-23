import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, map, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Expense, ExpenseCategory, Vendor, Receipt } from '../interface/expense.interface';
import { CustomHttpResponse, Page } from '../interface/appstates';
import { Key } from '../enum/key.enum';

@Injectable({
  providedIn: 'root'
})
export class ExpensesService {
  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    // Try getting token from localStorage first, then sessionStorage
    const token = localStorage.getItem(Key.TOKEN) || sessionStorage.getItem(Key.TOKEN);
    
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    // Add authorization header if token exists
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }

  private handleError(error: HttpErrorResponse) {
    console.error('API error:', error);
    
    // For any error, just return it without aggressive token clearing
    return throwError(() => error);
  }

  // Expense CRUD operations
  getExpenses(page: number = 0, size: number = 10): Observable<CustomHttpResponse<Page<Expense>>> {
    return this.http.get<CustomHttpResponse<Page<Expense>>>(`${environment.apiUrl}/api/expenses?page=${page}&size=${size}`, { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  getExpense(id: number): Observable<CustomHttpResponse<Expense>> {
    return this.http.get<CustomHttpResponse<Expense>>(`${environment.apiUrl}/api/expenses/${id}`, { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  createExpense(expense: Expense): Observable<CustomHttpResponse<Expense>> {
    return this.http.post<CustomHttpResponse<Expense>>(`${environment.apiUrl}/api/expenses`, expense, { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  updateExpense(id: number, expense: Expense): Observable<CustomHttpResponse<Expense>> {
    return this.http.put<CustomHttpResponse<Expense>>(`${environment.apiUrl}/api/expenses/${id}`, expense, { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteExpense(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/api/expenses/${id}`, { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Expense Categories
  getCategories(): Observable<ExpenseCategory[]> {
    return this.http.get<ExpenseCategory[]>(`${environment.apiUrl}/api/expense-categories`, { headers: this.getHeaders() });
  }

  createCategory(category: ExpenseCategory): Observable<CustomHttpResponse<ExpenseCategory>> {
    return this.http.post<CustomHttpResponse<ExpenseCategory>>(`${environment.apiUrl}/api/expense-categories`, category, { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  updateCategory(id: number, category: ExpenseCategory): Observable<CustomHttpResponse<ExpenseCategory>> {
    return this.http.put<CustomHttpResponse<ExpenseCategory>>(`${environment.apiUrl}/api/expense-categories/${id}`, category, { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/api/expense-categories/${id}`, { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Vendors
  getVendors(): Observable<CustomHttpResponse<Vendor[]>> {
    return this.http.get<any>(`${environment.apiUrl}/api/vendors`, { headers: this.getHeaders() })
      .pipe(
        map(response => {
          // Handle both direct array response or wrapped response
          const vendors = Array.isArray(response) ? response : (response.data || []);
          return {
          data: vendors,
          message: 'Vendors loaded successfully',
          status: 'OK',
          statusCode: 200
          } as CustomHttpResponse<Vendor[]>;
        }),
        catchError(error => {
          console.error('Error loading vendors:', error);
          return throwError(() => error);
        })
      );
  }

  createVendor(vendor: Vendor): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/api/vendors`, vendor)
      .pipe(
        map(response => {
          // Handle both direct object and wrapped responses
          const responseData = response.data ? response.data : response;
          return {
            data: responseData,
            message: response.message || 'Vendor created successfully',
            status: response.status || 'success',
            statusCode: response.statusCode || 200
          };
        }),
        catchError(error => {
          console.error('Error creating vendor:', error);
          throw error;
        })
      );
  }

  updateVendor(id: number, vendor: Vendor): Observable<any> {
    if (!id) {
      console.error('Invalid vendor ID for update:', id);
      return throwError(() => new Error('Invalid vendor ID'));
    }

    return this.http.put<any>(`${environment.apiUrl}/api/vendors/${id}`, vendor)
      .pipe(
        map(response => {
          // Handle both direct object and wrapped responses
          const responseData = response.data ? response.data : response;
          return {
            data: responseData,
            message: response.message || 'Vendor updated successfully',
            status: response.status || 'success',
            statusCode: response.statusCode || 200
          };
        }),
        catchError(error => {
          console.error(`Error updating vendor ${id}:`, error);
          throw error;
        })
      );
  }

  deleteVendor(id: number): Observable<any> {
    if (!id) {
      console.error('Invalid vendor ID for deletion:', id);
      return throwError(() => new Error('Invalid vendor ID'));
    }

    return this.http.delete<any>(`${environment.apiUrl}/api/vendors/${id}`)
      .pipe(
        map(response => {
          return {
            data: null,
            message: response ? (response.message || 'Vendor deleted successfully') : 'Vendor deleted successfully',
            status: response ? (response.status || 'success') : 'success',
            statusCode: response ? (response.statusCode || 200) : 200
          };
        }),
        catchError(error => {
          console.error(`Error deleting vendor ${id}:`, error);
          throw error;
        })
      );
  }

  getVendorById(id: number): Observable<CustomHttpResponse<Vendor>> {
    if (!id) {
      console.error('Invalid vendor ID:', id);
      return throwError(() => new Error('Invalid vendor ID'));
    }

    return this.http.get<any>(`${environment.apiUrl}/api/vendors/${id}`, { headers: this.getHeaders() })
      .pipe(
        map(response => {
          // Handle either direct object or wrapped response
          const vendor = response.data || response;
          return {
            data: vendor,
            message: 'Vendor loaded successfully',
            status: 'OK',
            statusCode: 200
          } as CustomHttpResponse<Vendor>;
        }),
        catchError(error => {
          console.error('Error loading vendor:', error);
          return throwError(() => error);
        })
      );
  }

  // Receipts
  uploadReceipt(file: File): Observable<CustomHttpResponse<Receipt>> {
    const formData = new FormData();
    formData.append('file', file);

    // Get the auth token from localStorage or session storage
    const token = localStorage.getItem(Key.TOKEN) || sessionStorage.getItem(Key.TOKEN);

    // Set headers with token if available
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    // Return the observable with simple error handling
    return this.http.post<CustomHttpResponse<Receipt>>(
      `${environment.apiUrl}/api/receipts/upload`,
      formData,
      { headers }
    ).pipe(
      catchError(error => {
        console.error('Receipt upload error:', error);
        return throwError(() => ({
          error: error,
          message: 'Failed to upload receipt: ' + (error.error?.message || error.message || 'Server error')
        }));
      })
      );
  }

  getReceipt(id: number): Observable<CustomHttpResponse<Receipt>> {
    if (!id || isNaN(id)) {
      console.error('Invalid receipt ID:', id);
      return throwError(() => new Error('Invalid receipt ID'));
    }

    return this.http.get<CustomHttpResponse<Receipt>>(`${environment.apiUrl}/api/receipts/${id}`, { headers: this.getHeaders() })
      .pipe(
        catchError(error => {
          console.error('Error loading receipt:', error);
          return throwError(() => error);
        })
      );
  }

  deleteReceipt(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/api/receipts/${id}`, { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Clients
  getClients(): Observable<CustomHttpResponse<any[]>> {
    return this.http.get<CustomHttpResponse<any>>(`${environment.apiUrl}/client?page=0&size=100`, { headers: this.getHeaders() })
      .pipe(
        map(response => ({
          ...response,
          data: response.data?.page?.content || response.data?.content || response.data || []
        })),
        catchError(this.handleError)
      );
  }

  // Receipt attachment to expense
  attachReceiptToExpense(expenseId: number, receiptId: number): Observable<CustomHttpResponse<Expense>> {
    return this.http.post<CustomHttpResponse<Expense>>(
      `${environment.apiUrl}/api/expenses/${expenseId}/attachReceipt/${receiptId}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Error attaching receipt to expense:', error);
        return throwError(() => error);
      })
      );
  }
} 