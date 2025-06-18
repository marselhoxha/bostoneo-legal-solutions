import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { map, catchError, finalize } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface BillingSummary {
  totalRevenue: number;
  pendingInvoices: number;
  pendingAmount: number;
  overdueInvoices: number;
  overdueAmount: number;
  totalClients: number;
  averageRate: number;
}

interface TopClient {
  id: number;
  name: string;
  type: string;
  total_revenue: number;
  invoice_count: number;
  avg_invoice_value: number;
  last_invoice_date: string;
}

interface CaseProfitability {
  caseId: number;
  caseName: string;
  caseNumber: string;
  clientName: string;
  totalRevenue: number;
  invoicedAmount: number;
  invoiceCount: number;
  status: string;
  profitMargin: number;
}

@Component({
  selector: 'app-billing-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './billing-dashboard.component.html',
  styleUrls: ['./billing-dashboard.component.scss']
})
export class BillingDashboardComponent implements OnInit {
  // Loading states
  loading = true;
  error: string | null = null;

  // Data properties - Initialize arrays to prevent undefined errors
  billingSummary: BillingSummary | null = null;
  topClients: TopClient[] = [];
  caseProfitability: CaseProfitability[] = [];

  private apiUrl = environment.apiUrl || 'http://localhost:8085';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    // Initialize arrays to prevent template errors
    this.topClients = [];
    this.caseProfitability = [];
  }

  ngOnInit(): void {
    console.log('BillingDashboardComponent initialized');
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    console.log('Loading real billing dashboard data...');
    this.loading = true;
    this.error = null;
    
    // Reset arrays to prevent stale data
    this.topClients = [];
    this.caseProfitability = [];
    this.cdr.detectChanges();

    // Load real data from new API endpoints
    const billingSummary$ = this.http.get<BillingSummary>(`${this.apiUrl}/analytics/billing-summary`).pipe(
      catchError(error => {
        console.error('Error loading billing summary:', error);
        return of({
          totalRevenue: 0,
          pendingInvoices: 0,
          pendingAmount: 0,
          overdueInvoices: 0,
          overdueAmount: 0,
          totalClients: 0,
          averageRate: 0
        } as BillingSummary);
      })
    );

    const topClients$ = this.http.get<TopClient[]>(`${this.apiUrl}/analytics/top-clients`).pipe(
      catchError(error => {
        console.error('Error loading top clients:', error);
        return of([]);
      })
    );

    const caseProfitability$ = this.http.get<CaseProfitability[]>(`${this.apiUrl}/analytics/case-profitability`).pipe(
      catchError(error => {
        console.error('Error loading case profitability:', error);
        return of([]);
      })
    );

    forkJoin({
      billingSummary: billingSummary$,
      topClients: topClients$,
      caseProfitability: caseProfitability$
    }).pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
        console.log('Billing dashboard data loading completed');
      })
    ).subscribe({
      next: (data) => {
        console.log('Real billing data loaded:', data);
        this.billingSummary = data.billingSummary;
        this.topClients = Array.isArray(data.topClients) ? data.topClients : [];
        this.caseProfitability = Array.isArray(data.caseProfitability) ? data.caseProfitability : [];
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading billing dashboard data:', error);
        this.error = 'Failed to load billing dashboard data. Please try again.';
        // Ensure arrays are still initialized even on error
        this.topClients = [];
        this.caseProfitability = [];
        this.cdr.detectChanges();
      }
    });
  }

  refreshData(): void {
    console.log('Refreshing billing dashboard data...');
    this.error = null;
    this.loadDashboardData();
  }

  // Utility methods for display
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  }

  formatCurrencyShort(amount: number): string {
    if (!amount) return '$0';
    
    if (amount >= 1000000) {
      return '$' + (amount / 1000000).toFixed(1) + 'M';
    } else if (amount >= 1000) {
      return '$' + (amount / 1000).toFixed(1) + 'K';
    } else {
      return '$' + amount.toFixed(0);
    }
  }

  calculateCollectionRate(): number {
    if (!this.billingSummary) return 0;
    const totalBilled = this.billingSummary.totalRevenue + this.billingSummary.pendingAmount + this.billingSummary.overdueAmount;
    return totalBilled > 0 ? Math.round((this.billingSummary.totalRevenue / totalBilled) * 100) : 0;
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'open':
      case 'in_progress':
        return 'badge bg-success';
      case 'closed':
        return 'badge bg-secondary';
      case 'pending':
        return 'badge bg-warning';
      case 'overdue':
        return 'badge bg-danger';
      default:
        return 'badge bg-light text-dark';
    }
  }

  getProfitMarginClass(margin: number): string {
    if (margin >= 80) return 'text-success fw-bold';
    if (margin >= 60) return 'text-success';
    if (margin >= 40) return 'text-warning';
    return 'text-danger';
  }

  // Template compatibility properties
  get isLoading(): boolean {
    return this.loading;
  }

  // Safe array getters
  get safeTopClients(): TopClient[] {
    return Array.isArray(this.topClients) ? this.topClients : [];
  }

  get safeCaseProfitability(): CaseProfitability[] {
    return Array.isArray(this.caseProfitability) ? this.caseProfitability : [];
  }
}