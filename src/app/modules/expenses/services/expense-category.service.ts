import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExpenseCategory } from '../models/expense-category.model';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ExpenseCategoryService {
  private apiUrl = `${environment.apiUrl}/api/expense-categories`;

  constructor(private http: HttpClient) {}

  getCategories(): Observable<ExpenseCategory[]> {
    return this.http.get<ExpenseCategory[]>(this.apiUrl);
  }

  getCategory(id: number): Observable<ExpenseCategory> {
    return this.http.get<ExpenseCategory>(`${this.apiUrl}/${id}`);
  }

  createCategory(category: ExpenseCategory): Observable<ExpenseCategory> {
    return this.http.post<ExpenseCategory>(this.apiUrl, category);
  }

  updateCategory(id: number, category: ExpenseCategory): Observable<ExpenseCategory> {
    return this.http.put<ExpenseCategory>(`${this.apiUrl}/${id}`, category);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  hasChildCategories(parentId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/has-children/${parentId}`);
  }
} 