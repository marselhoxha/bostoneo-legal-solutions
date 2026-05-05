import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Key } from 'src/app/enum/key.enum';
import { Expense } from 'src/app/interface/expense.interface';

/**
 * Case-scoped facade over the expense API for the Damages-tab Case Costs
 * section (P3). Hits the same {@code /api/expenses} backend as the global
 * expenses module, but with an opinionated case-id-first surface area —
 * loading expenses for one case, summing them for the Net-to-Client
 * breakdown, and the usual create/update/delete delegation.
 *
 * <p>Multi-tenant: the backend filters by the caller's organization on
 * every read. Cross-org expense leaks aren't possible from this client
 * either way.
 */
@Injectable({ providedIn: 'root' })
export class CaseExpenseService {
  private readonly baseUrl = `${environment.apiUrl}/api/expenses`;

  constructor(private http: HttpClient) {}

  /** Returns all expenses logged against {@code caseId}. */
  getCaseExpenses(caseId: number | string): Observable<Expense[]> {
    return this.http
      .get<any>(`${this.baseUrl}/case/${caseId}`, { headers: this.headers() })
      .pipe(map(res => (res?.data ?? []) as Expense[]));
  }

  /**
   * Running total for the Damages-tab Net-to-Client breakdown. Returns 0
   * when no expenses are logged.
   */
  getCaseExpenseTotal(caseId: number | string): Observable<number> {
    return this.http
      .get<any>(`${this.baseUrl}/case/${caseId}/total`, { headers: this.headers() })
      .pipe(map(res => Number(res?.data?.total ?? 0)));
  }

  /**
   * Creates a new expense. The DTO must include {@code legalCaseId}; backend
   * will populate {@code organizationId} from the auth context. Returns the
   * persisted entity so the table can append it without a refetch.
   */
  createExpense(expense: Expense): Observable<Expense> {
    return this.http
      .post<any>(this.baseUrl, expense, { headers: this.headers() })
      .pipe(map(res => res?.data as Expense));
  }

  /** Updates an expense in-place. Identical mapping to {@link createExpense}. */
  updateExpense(id: number, expense: Expense): Observable<Expense> {
    return this.http
      .put<any>(`${this.baseUrl}/${id}`, expense, { headers: this.headers() })
      .pipe(map(res => res?.data as Expense));
  }

  /** Soft delete via the existing controller; tenant-isolated server-side. */
  deleteExpense(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`, { headers: this.headers() });
  }

  private headers(): HttpHeaders {
    const token = localStorage.getItem(Key.TOKEN);
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }
}
