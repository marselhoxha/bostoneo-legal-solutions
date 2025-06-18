import { Injectable } from '@angular/core';
import { Observable, combineLatest, map, of } from 'rxjs';
import { InvoicePaymentService } from './invoice-payment.service';
import { InvoiceService } from './invoice.service';
import { InvoicePayment } from '../interface/invoice-payment';
import { Invoice } from '../interface/invoice';

export interface PaymentAnalytics {
  totalReceived: number;
  totalPending: number;
  totalOverdue: number;
  averagePaymentTime: number;
  paymentTrends: PaymentTrend[];
  topPayingClients: ClientPaymentSummary[];
  paymentMethodDistribution: PaymentMethodSummary[];
  monthlyRevenue: MonthlyRevenue[];
  outstandingBalances: OutstandingBalance[];
  collectionRate: number;
  averageInvoiceValue: number;
}

export interface PaymentTrend {
  date: string;
  amount: number;
  count: number;
}

export interface ClientPaymentSummary {
  clientId: number;
  clientName: string;
  totalPaid: number;
  invoiceCount: number;
  averagePaymentTime: number;
  lastPaymentDate: string;
}

export interface PaymentMethodSummary {
  method: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

export interface MonthlyRevenue {
  month: string;
  year: number;
  revenue: number;
  invoiceCount: number;
  paidCount: number;
}

export interface OutstandingBalance {
  invoiceId: number;
  invoiceNumber: string;
  clientName: string;
  daysOverdue: number;
  amountDue: number;
  totalAmount: number;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentAnalyticsService {

  constructor(
    private paymentService: InvoicePaymentService,
    private invoiceService: InvoiceService
  ) { }

  getPaymentAnalytics(startDate: string, endDate: string): Observable<PaymentAnalytics> {
    return combineLatest([
      this.paymentService.getPaymentsByDateRange$(startDate, endDate, 0, 1000),
      this.invoiceService.getInvoices$(0, 1000) // This might need filtering by date
    ]).pipe(
      map(([paymentsResponse, invoicesResponse]) => {
        const payments = paymentsResponse.data?.content || [];
        const invoices = invoicesResponse.data?.content || [];
        
        return this.calculateAnalytics(payments, invoices, startDate, endDate);
      })
    );
  }

  private calculateAnalytics(payments: InvoicePayment[], invoices: Invoice[], startDate: string, endDate: string): PaymentAnalytics {
    const totalReceived = this.calculateTotalReceived(payments);
    const { totalPending, totalOverdue } = this.calculatePendingAndOverdue(invoices);
    const averagePaymentTime = this.calculateAveragePaymentTime(invoices);
    const paymentTrends = this.calculatePaymentTrends(payments);
    const topPayingClients = this.calculateTopPayingClients(payments);
    const paymentMethodDistribution = this.calculatePaymentMethodDistribution(payments);
    const monthlyRevenue = this.calculateMonthlyRevenue(payments, startDate, endDate);
    const outstandingBalances = this.calculateOutstandingBalances(invoices);
    const collectionRate = this.calculateCollectionRate(invoices);
    const averageInvoiceValue = this.calculateAverageInvoiceValue(invoices);

    return {
      totalReceived,
      totalPending,
      totalOverdue,
      averagePaymentTime,
      paymentTrends,
      topPayingClients,
      paymentMethodDistribution,
      monthlyRevenue,
      outstandingBalances,
      collectionRate,
      averageInvoiceValue
    };
  }

  private calculateTotalReceived(payments: InvoicePayment[]): number {
    return payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  }

  private calculatePendingAndOverdue(invoices: Invoice[]): { totalPending: number; totalOverdue: number } {
    let totalPending = 0;
    let totalOverdue = 0;
    const today = new Date();

    invoices.forEach(invoice => {
      if (invoice.status === 'PENDING' || invoice.status === 'ISSUED') {
        const balanceDue = (invoice.totalAmount || 0) - (invoice.totalPaid || 0);
        totalPending += balanceDue;
        
        if (invoice.dueDate && new Date(invoice.dueDate) < today) {
          totalOverdue += balanceDue;
        }
      }
    });

    return { totalPending, totalOverdue };
  }

  private calculateAveragePaymentTime(invoices: Invoice[]): number {
    const paidInvoices = invoices.filter(inv => inv.status === 'PAID' && inv.issueDate && inv.lastPaymentDate);
    
    if (paidInvoices.length === 0) return 0;

    const totalDays = paidInvoices.reduce((sum, invoice) => {
      const issueDate = new Date(invoice.issueDate);
      const paymentDate = new Date(invoice.lastPaymentDate);
      const days = Math.floor((paymentDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);

    return Math.round(totalDays / paidInvoices.length);
  }

  private calculatePaymentTrends(payments: InvoicePayment[]): PaymentTrend[] {
    const trendMap = new Map<string, { amount: number; count: number }>();

    payments.forEach(payment => {
      const date = payment.paymentDate?.split('T')[0] || '';
      if (date) {
        const existing = trendMap.get(date) || { amount: 0, count: 0 };
        existing.amount += payment.amount || 0;
        existing.count += 1;
        trendMap.set(date, existing);
      }
    });

    return Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date,
        amount: data.amount,
        count: data.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateTopPayingClients(payments: InvoicePayment[]): ClientPaymentSummary[] {
    const clientMap = new Map<string, ClientPaymentSummary>();

    payments.forEach(payment => {
      const clientName = payment.clientName || 'Unknown';
      const existing = clientMap.get(clientName) || {
        clientId: 0, // Would need to be populated from invoice data
        clientName,
        totalPaid: 0,
        invoiceCount: 0,
        averagePaymentTime: 0,
        lastPaymentDate: ''
      };

      existing.totalPaid += payment.amount || 0;
      existing.invoiceCount += 1;
      
      if (!existing.lastPaymentDate || payment.paymentDate > existing.lastPaymentDate) {
        existing.lastPaymentDate = payment.paymentDate;
      }

      clientMap.set(clientName, existing);
    });

    return Array.from(clientMap.values())
      .sort((a, b) => b.totalPaid - a.totalPaid)
      .slice(0, 10); // Top 10 clients
  }

  private calculatePaymentMethodDistribution(payments: InvoicePayment[]): PaymentMethodSummary[] {
    const methodMap = new Map<string, { count: number; totalAmount: number }>();
    const totalAmount = this.calculateTotalReceived(payments);

    payments.forEach(payment => {
      const method = payment.paymentMethod || 'Unknown';
      const existing = methodMap.get(method) || { count: 0, totalAmount: 0 };
      existing.count += 1;
      existing.totalAmount += payment.amount || 0;
      methodMap.set(method, existing);
    });

    return Array.from(methodMap.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      totalAmount: data.totalAmount,
      percentage: totalAmount > 0 ? (data.totalAmount / totalAmount) * 100 : 0
    }));
  }

  private calculateMonthlyRevenue(payments: InvoicePayment[], startDate: string, endDate: string): MonthlyRevenue[] {
    const monthMap = new Map<string, MonthlyRevenue>();
    
    // Initialize months between start and end date
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    
    while (current <= end) {
      const key = `${current.getFullYear()}-${(current.getMonth() + 1).toString().padStart(2, '0')}`;
      monthMap.set(key, {
        month: current.toLocaleString('default', { month: 'long' }),
        year: current.getFullYear(),
        revenue: 0,
        invoiceCount: 0,
        paidCount: 0
      });
      current.setMonth(current.getMonth() + 1);
    }

    // Populate with payment data
    payments.forEach(payment => {
      if (payment.paymentDate) {
        const date = new Date(payment.paymentDate);
        const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        const monthData = monthMap.get(key);
        if (monthData) {
          monthData.revenue += payment.amount || 0;
          monthData.paidCount += 1;
        }
      }
    });

    return Array.from(monthMap.values());
  }

  private calculateOutstandingBalances(invoices: Invoice[]): OutstandingBalance[] {
    const today = new Date();
    
    return invoices
      .filter(invoice => {
        const balanceDue = (invoice.totalAmount || 0) - (invoice.totalPaid || 0);
        return balanceDue > 0 && (invoice.status === 'PENDING' || invoice.status === 'ISSUED' || invoice.status === 'OVERDUE');
      })
      .map(invoice => {
        const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : today;
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        
        return {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.clientName || 'Unknown',
          daysOverdue,
          amountDue: (invoice.totalAmount || 0) - (invoice.totalPaid || 0),
          totalAmount: invoice.totalAmount || 0
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }

  private calculateCollectionRate(invoices: Invoice[]): number {
    const totalBilled = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const totalCollected = invoices.reduce((sum, inv) => sum + (inv.totalPaid || 0), 0);
    
    return totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;
  }

  private calculateAverageInvoiceValue(invoices: Invoice[]): number {
    if (invoices.length === 0) return 0;
    
    const total = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    return total / invoices.length;
  }

  // Utility methods for specific analytics queries
  
  getRevenueByDateRange(startDate: string, endDate: string): Observable<number> {
    return this.paymentService.getPaymentsByDateRange$(startDate, endDate, 0, 1000).pipe(
      map((response: any) => {
        const payments = response.data?.content || [];
        return this.calculateTotalReceived(payments);
      })
    );
  }

  getClientPaymentHistory(clientId: number): Observable<ClientPaymentSummary> {
    // This would need to be implemented with a specific endpoint
    // For now, returning a placeholder
    return of({
      clientId,
      clientName: '',
      totalPaid: 0,
      invoiceCount: 0,
      averagePaymentTime: 0,
      lastPaymentDate: ''
    });
  }

  getPaymentForecast(months: number): Observable<number[]> {
    // Calculate payment forecast based on historical data
    // This is a simplified implementation
    return this.getPaymentAnalytics(
      new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      new Date().toISOString().split('T')[0]
    ).pipe(
      map(analytics => {
        const avgMonthlyRevenue = analytics.totalReceived / 12;
        const forecast: number[] = [];
        
        for (let i = 1; i <= months; i++) {
          // Simple linear forecast with some randomness
          const variation = 0.9 + Math.random() * 0.2; // ±10% variation
          forecast.push(avgMonthlyRevenue * variation);
        }
        
        return forecast;
      })
    );
  }
}