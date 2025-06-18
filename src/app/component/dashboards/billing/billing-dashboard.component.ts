import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { TimeTrackingService } from '../../../modules/time-tracking/services/time-tracking.service';
import { InvoiceService } from '../../../modules/time-tracking/services/invoice.service';
import { CaseService } from '../../../modules/legal/services/case.service';

interface CaseProfitability {
  caseId: number;
  caseName: string;
  caseNumber: string;
  clientName: string;
  totalHours: number;
  billableHours: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  status: string;
}

interface BillingSummary {
  totalRevenue: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalClients: number;
  averageRate: number;
  totalHoursBilled: number;
  pendingAmount?: number;
  overdueAmount?: number;
  newClientsThisMonth?: number;
  corporateRevenue?: number;
  individualRevenue?: number;
}

@Component({
  selector: 'app-billing-dashboard',
  templateUrl: './billing-dashboard.component.html',
  styleUrls: ['./billing-dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class BillingDashboardComponent implements OnInit {
  // Data
  billingSummary: BillingSummary = {
    totalRevenue: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    totalClients: 0,
    averageRate: 0,
    totalHoursBilled: 0
  };
  
  caseProfitability: CaseProfitability[] = [];
  recentInvoices: any[] = [];
  topClients: any[] = [];
  
  // UI State
  isLoading = true;
  error: string | null = null;
  
  // Chart data
  revenueChartData: any;
  profitabilityChartData: any;

  constructor(
    private http: HttpClient,
    private timeTrackingService: TimeTrackingService,
    private invoiceService: InvoiceService,
    private caseService: CaseService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.isLoading = true;
    
    // Load multiple data sources in parallel
    forkJoin([
      this.loadInvoiceStatistics(),
      this.loadCaseProfitability(),
      this.loadRecentInvoices(),
      this.loadTopClients()
    ]).subscribe({
      next: ([invoiceStats, caseProfitability, recentInvoices, topClients]) => {
        // Process invoice statistics
        this.processBillingSummary(invoiceStats);
        
        // Set case profitability data
        this.caseProfitability = caseProfitability;
        
        // Set recent invoices
        this.recentInvoices = recentInvoices;
        
        // Set top clients
        this.topClients = topClients;
        
        // Prepare chart data
        this.prepareChartData();
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.error = 'Failed to load dashboard data';
        this.isLoading = false;
        
        // Load demo data as fallback
        this.loadDemoData();
      }
    });
  }

  private loadInvoiceStatistics() {
    return this.http.get<any>(`${environment.apiUrl}/api/invoices/statistics`).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('Error loading invoice statistics:', error);
        return of({});
      })
    );
  }

  private loadCaseProfitability() {
    return this.http.get<any>(`${environment.apiUrl}/api/analytics/case-profitability`).pipe(
      map(response => response.data || []),
      map((cases: any[]) => cases.map((caseData: any) => ({
        caseId: caseData.id,
        caseName: caseData.title,
        caseNumber: caseData.caseNumber,
        clientName: caseData.clientName,
        totalHours: caseData.totalHours || 0,
        billableHours: caseData.billableHours || 0,
        totalRevenue: caseData.totalRevenue || 0,
        totalExpenses: caseData.totalExpenses || 0,
        netProfit: (caseData.totalRevenue || 0) - (caseData.totalExpenses || 0),
        profitMargin: caseData.totalRevenue ? 
          ((caseData.totalRevenue - caseData.totalExpenses) / caseData.totalRevenue * 100) : 0,
        status: caseData.status
      }))),
      catchError(error => {
        console.error('Error loading case profitability:', error);
        return of([] as CaseProfitability[]);
      })
    );
  }

  private loadRecentInvoices() {
    return this.http.get<any>(`${environment.apiUrl}/api/invoices?page=0&size=5&sortBy=createdAt&sortDirection=desc`).pipe(
      map(response => response.data?.content || []),
      catchError(error => {
        console.error('Error loading recent invoices:', error);
        return of([]);
      })
    );
  }

  private loadTopClients() {
    return this.http.get<any>(`${environment.apiUrl}/api/analytics/top-clients?limit=5`).pipe(
      map(response => response.data || []),
      catchError(error => {
        console.error('Error loading top clients:', error);
        return of([]);
      })
    );
  }

  private processBillingSummary(stats: any): void {
    this.billingSummary = {
      totalRevenue: stats.totalRevenue || 0,
      pendingInvoices: stats.pendingInvoices || 0,
      overdueInvoices: stats.overdueInvoices || 0,
      totalClients: stats.totalClients || 0,
      averageRate: stats.averageRate || 0,
      totalHoursBilled: stats.totalHoursBilled || 0
    };
  }

  private prepareChartData(): void {
    // Revenue trend chart data
    this.revenueChartData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'Revenue',
        data: [12000, 15000, 18000, 22000, 25000, 28000],
        backgroundColor: 'rgba(25, 135, 84, 0.2)',
        borderColor: 'rgba(25, 135, 84, 1)',
        borderWidth: 2
      }]
    };
    
    // Case profitability chart
    this.profitabilityChartData = {
      labels: this.caseProfitability.slice(0, 5).map(c => c.caseName),
      datasets: [{
        label: 'Net Profit',
        data: this.caseProfitability.slice(0, 5).map(c => c.netProfit),
        backgroundColor: [
          'rgba(13, 110, 253, 0.8)',
          'rgba(25, 135, 84, 0.8)',
          'rgba(255, 193, 7, 0.8)',
          'rgba(220, 53, 69, 0.8)',
          'rgba(108, 117, 125, 0.8)'
        ]
      }]
    };
  }

  private loadDemoData(): void {
    // Demo billing summary
    this.billingSummary = {
      totalRevenue: 150000,
      pendingInvoices: 12,
      overdueInvoices: 3,
      totalClients: 25,
      averageRate: 175,
      totalHoursBilled: 857
    };
    
    // Demo case profitability
    this.caseProfitability = [
      {
        caseId: 1,
        caseName: 'Smith vs. Johnson',
        caseNumber: 'CASE-2024-001',
        clientName: 'John Smith',
        totalHours: 120,
        billableHours: 115,
        totalRevenue: 25000,
        totalExpenses: 5000,
        netProfit: 20000,
        profitMargin: 80,
        status: 'ACTIVE'
      },
      {
        caseId: 2,
        caseName: 'Brown Estate Planning',
        caseNumber: 'CASE-2024-002',
        clientName: 'Mary Brown',
        totalHours: 80,
        billableHours: 75,
        totalRevenue: 15000,
        totalExpenses: 2000,
        netProfit: 13000,
        profitMargin: 86.7,
        status: 'ACTIVE'
      },
      {
        caseId: 3,
        caseName: 'Tech Corp Merger',
        caseNumber: 'CASE-2024-003',
        clientName: 'Tech Corp Inc.',
        totalHours: 200,
        billableHours: 190,
        totalRevenue: 45000,
        totalExpenses: 8000,
        netProfit: 37000,
        profitMargin: 82.2,
        status: 'ACTIVE'
      }
    ];
    
    // Demo recent invoices
    this.recentInvoices = [
      {
        id: 1,
        invoiceNumber: 'INV-2024-001',
        clientName: 'John Smith',
        totalAmount: 5000,
        status: 'PAID',
        dueDate: new Date('2024-01-15')
      },
      {
        id: 2,
        invoiceNumber: 'INV-2024-002',
        clientName: 'Mary Brown',
        totalAmount: 3500,
        status: 'PENDING',
        dueDate: new Date('2024-01-20')
      },
      {
        id: 3,
        invoiceNumber: 'INV-2024-003',
        clientName: 'Tech Corp Inc.',
        totalAmount: 12000,
        status: 'OVERDUE',
        dueDate: new Date('2023-12-30')
      }
    ];
    
    // Demo top clients
    this.topClients = [
      {
        id: 1,
        name: 'Tech Corp Inc.',
        totalRevenue: 45000,
        totalCases: 3,
        activeCases: 2
      },
      {
        id: 2,
        name: 'John Smith',
        totalRevenue: 25000,
        totalCases: 2,
        activeCases: 1
      },
      {
        id: 3,
        name: 'Mary Brown',
        totalRevenue: 15000,
        totalCases: 1,
        activeCases: 1
      }
    ];
    
    this.prepareChartData();
  }

  // Helper methods
  getStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'PAID': 'text-success',
      'PENDING': 'text-warning',
      'OVERDUE': 'text-danger',
      'DRAFT': 'text-secondary'
    };
    return statusClasses[status] || 'text-secondary';
  }

  getStatusBadgeClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'PAID': 'bg-success-subtle text-success',
      'PENDING': 'bg-warning-subtle text-warning',
      'OVERDUE': 'bg-danger-subtle text-danger',
      'DRAFT': 'bg-secondary-subtle text-secondary'
    };
    return statusClasses[status] || 'bg-secondary-subtle text-secondary';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatCurrencyShort(amount: number): string {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    } else {
      return `$${amount.toFixed(0)}`;
    }
  }

  formatDate(date: any): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Enhanced methods for the new design
  refreshData(): void {
    this.loadDashboardData();
  }

  calculateCollectionRate(): number {
    const totalBilled = this.billingSummary.totalRevenue;
    const totalPaid = totalBilled - (this.billingSummary.pendingAmount || 0) - (this.billingSummary.overdueAmount || 0);
    return totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 85; // Default to 85% for demo
  }

  getClientColor(index: number): string {
    const colors = [
      '#405189', '#0ab39c', '#f7b84b', '#f06548', '#6c757d', 
      '#3577f1', '#405189', '#0ab39c', '#f7b84b', '#f06548'
    ];
    return colors[index % colors.length];
  }

  calculateClientPercentage(clientRevenue: number): number {
    return this.billingSummary.totalRevenue > 0 ? 
      Math.round((clientRevenue / this.billingSummary.totalRevenue) * 100) : 0;
  }

  getProfitMarginClass(margin: number): string {
    if (margin >= 70) return 'bg-success';
    if (margin >= 40) return 'bg-warning';
    return 'bg-danger';
  }

  getDueDateClass(dueDate: string): string {
    const due = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 3600 * 24));
    
    if (diffDays < 0) return 'text-danger fw-bold';
    if (diffDays <= 7) return 'text-warning fw-semibold';
    return 'text-muted';
  }

  // Action methods
  exportInvoices(): void {
    // Implementation for exporting invoices
    console.log('Exporting invoices...');
  }

  downloadInvoicePdf(invoiceId: number): void {
    // Implementation for downloading PDF
    console.log('Downloading PDF for invoice:', invoiceId);
  }

  sendInvoiceEmail(invoiceId: number): void {
    // Implementation for sending email
    console.log('Sending email for invoice:', invoiceId);
  }

  // Helper property for template usage
  get Math() {
    return Math;
  }
}