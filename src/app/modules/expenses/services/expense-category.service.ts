import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExpenseCategory } from '../models/expense-category.model';
import { environment } from '../../../../environments/environment';
import { Key } from '../../../enum/key.enum';

@Injectable({
  providedIn: 'root'
})
export class ExpenseCategoryService {
  private apiUrl = `${environment.apiUrl}/api/expense-categories`;

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

  // Get all expense categories
  getAllCategories(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}`, { headers: this.getHeaders() });
  }

  // Get category by ID
  getCategoryById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  // Create new category
  createCategory(category: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}`, category, { headers: this.getHeaders() });
  }

  // Update category
  updateCategory(id: number, category: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, category, { headers: this.getHeaders() });
  }

  // Delete category
  deleteCategory(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  getCategories(): Observable<ExpenseCategory[]> {
    return this.http.get<ExpenseCategory[]>(`${this.apiUrl}`, { headers: this.getHeaders() });
  }

  getCategory(id: number): Observable<ExpenseCategory> {
    return this.http.get<ExpenseCategory>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  hasChildCategories(parentId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/has-children/${parentId}`, { headers: this.getHeaders() });
  }
} 