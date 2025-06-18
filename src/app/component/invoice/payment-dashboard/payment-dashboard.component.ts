import { Component, OnInit } from '@angular/core';
import { Observable, BehaviorSubject, catchError, of, map } from 'rxjs';
import { InvoicePaymentService } from '../../../service/invoice-payment.service';
import { InvoiceService } from '../../../service/invoice.service';
import { State } from '../../../interface/state';
import { CustomHttpResponse, Page } from '../../../interface/appstates';
import { InvoicePayment } from '../../../interface/invoice-payment';
import { DataState } from '../../../enum/datastate.enum';

interface PaymentStats {
  totalReceived: number;
  totalPending: number;
  totalOverdue: number;
  recentPaymentsCount: number;
  averagePaymentTime: number;
  paymentMethodBreakdown: {
    method: string;
    count: number;
    amount: number;
  }[];
}

@Component({
  selector: 'app-payment-dashboard',
  templateUrl: './payment-dashboard.component.html',
  styleUrls: ['./payment-dashboard.component.scss']
})
export class PaymentDashboardComponent implements OnInit {
  paymentState$: Observable<State<CustomHttpResponse<Page<InvoicePayment>>>>;
  statsState$: Observable<State<PaymentStats>>;
  private dataSubject = new BehaviorSubject<CustomHttpResponse<Page<InvoicePayment>>>(null);
  private statsSubject = new BehaviorSubject<PaymentStats>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(true);
  isLoading$ = this.isLoadingSubject.asObservable();
  
  readonly DataState = DataState;
  currentPage = 0;
  selectedDateRange = '30'; // Default to last 30 days
  selectedPaymentMethod = 'all';
  selectedStatus = 'all';

  constructor(
    private paymentService: InvoicePaymentService,
    private invoiceService: InvoiceService
  ) {}

  ngOnInit(): void {
    this.paymentState$ = this.dataSubject.asObservable()
      .pipe(
        map(response => {
          return {
            dataState: response ? DataState.LOADED : DataState.LOADING,
            appData: response
          } as State<CustomHttpResponse<Page<InvoicePayment>>>;
        })
      );

    this.statsState$ = this.statsSubject.asObservable()
      .pipe(
        map(stats => {
          return {
            dataState: stats ? DataState.LOADED : DataState.LOADING,
            appData: stats
          } as State<PaymentStats>;
        })
      );

    this.loadPayments();
    this.loadPaymentStats();
  }

  loadPayments(page: number = 0): void {
    this.isLoadingSubject.next(true);
    const startDate = this.getStartDate();
    const endDate = new Date().toISOString().split('T')[0];
    
    this.paymentService.getPaymentsByDateRange$(startDate, endDate, page, 20)
      .pipe(
        catchError(error => {
          console.error('Error loading payments:', error);
          return of({ data: { content: [], totalElements: 0, totalPages: 0 } } as CustomHttpResponse<Page<InvoicePayment>>);
        })
      )
      .subscribe(response => {
        this.dataSubject.next(response);
        this.isLoadingSubject.next(false);
        this.currentPage = page;
      });
  }

  loadPaymentStats(): void {
    const startDate = this.getStartDate();
    const endDate = new Date().toISOString().split('T')[0];
    
    // This would need to be implemented in the backend
    // For now, we'll calculate from the loaded payments
    this.paymentService.getPaymentsByDateRange$(startDate, endDate, 0, 1000)
      .pipe(
        map(response => this.calculateStats(response.data.content)),
        catchError(error => {
          console.error('Error loading payment stats:', error);
          return of(this.getEmptyStats());
        })
      )
      .subscribe(stats => {
        this.statsSubject.next(stats);
      });
  }

  private calculateStats(payments: InvoicePayment[]): PaymentStats {
    const stats: PaymentStats = {
      totalReceived: 0,
      totalPending: 0,
      totalOverdue: 0,
      recentPaymentsCount: payments.length,
      averagePaymentTime: 0,
      paymentMethodBreakdown: []
    };

    const methodMap = new Map<string, { count: number; amount: number }>();

    payments.forEach(payment => {
      stats.totalReceived += payment.amount || 0;
      
      const method = payment.paymentMethod || 'Unknown';
      if (!methodMap.has(method)) {
        methodMap.set(method, { count: 0, amount: 0 });
      }
      const methodData = methodMap.get(method);
      methodData.count++;
      methodData.amount += payment.amount || 0;
    });

    stats.paymentMethodBreakdown = Array.from(methodMap.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      amount: data.amount
    }));

    return stats;
  }

  private getEmptyStats(): PaymentStats {
    return {
      totalReceived: 0,
      totalPending: 0,
      totalOverdue: 0,
      recentPaymentsCount: 0,
      averagePaymentTime: 0,
      paymentMethodBreakdown: []
    };
  }

  private getStartDate(): string {
    const date = new Date();
    const days = parseInt(this.selectedDateRange);
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  onDateRangeChange(): void {
    this.loadPayments();
    this.loadPaymentStats();
  }

  onPaymentMethodChange(): void {
    this.loadPayments();
  }

  onStatusChange(): void {
    this.loadPayments();
  }

  getPaymentMethodIcon(method: string): string {
    const icons = {
      'CHECK': 'ri-bank-card-line',
      'CREDIT_CARD': 'ri-bank-card-2-line',
      'ACH': 'ri-exchange-dollar-line',
      'WIRE_TRANSFER': 'ri-exchange-line',
      'CASH': 'ri-money-dollar-circle-line',
      'OTHER': 'ri-file-list-3-line'
    };
    return icons[method] || icons['OTHER'];
  }

  getPaymentMethodColor(method: string): string {
    const colors = {
      'CHECK': 'text-info',
      'CREDIT_CARD': 'text-primary',
      'ACH': 'text-success',
      'WIRE_TRANSFER': 'text-warning',
      'CASH': 'text-secondary',
      'OTHER': 'text-muted'
    };
    return colors[method] || colors['OTHER'];
  }

  exportPayments(): void {
    // TODO: Implement export functionality
    console.log('Export payments clicked');
  }

  viewInvoice(payment: InvoicePayment): void {
    if (payment.invoiceId) {
      window.open(`/invoices/detail/${payment.invoiceId}`, '_blank');
    }
  }
}
