import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExpenseCategory } from '../models/expense-category.model';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ExpenseCategoryService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Get all expense categories
  getAllCategories(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/expenses/categories`);
  }

  // Get category by ID
  getCategoryById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/expenses/categories/${id}`);
  }

  // Create new category
  createCategory(category: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/expenses/categories`, category);
  }

  // Update category
  updateCategory(id: number, category: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/expenses/categories/${id}`, category);
  }

  // Delete category
  deleteCategory(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/expenses/categories/${id}`);
  }

  getCategories(): Observable<ExpenseCategory[]> {
    return this.http.get<ExpenseCategory[]>(`${this.apiUrl}/api/expense-categories`);
  }

  getCategory(id: number): Observable<ExpenseCategory> {
    return this.http.get<ExpenseCategory>(`${this.apiUrl}/api/expense-categories/${id}`);
  }

  hasChildCategories(parentId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/api/expense-categories/has-children/${parentId}`);
  }
} 