// invoice-analytics.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface InvoiceAnalytics {
  paidInvoices: number;
  unpaidInvoices: number;
}

@Injectable({
  providedIn: 'root'
})
export class InvoiceAnalyticsService {
  private baseUrl = 'http://localhost:8085/analytics';  // Change to your backend URL

  constructor(private http: HttpClient) { }

  // Fetch total earnings
  getTotalEarnings(): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/total-earnings`);
  }

  // Fetch paid vs unpaid analytics
  getPaidVsUnpaidInvoices(): Observable<InvoiceAnalytics> {
    return this.http.get<InvoiceAnalytics>(`${this.baseUrl}/paid-vs-unpaid`);
  }

  // Fetch overdue invoices count
  getOverdueInvoices(): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/overdue`);
  }
}
