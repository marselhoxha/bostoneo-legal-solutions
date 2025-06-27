import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { InvoicePayment, PaymentAnalytics } from '../interface/invoice-payment';
import { CustomHttpResponse } from '../interface/custom-http-response';

@Injectable({
  providedIn: 'root'
})
export class InvoicePaymentService {
  private readonly apiUrl = 'http://localhost:8085/api/invoices';

  constructor(private http: HttpClient) { }

  createPayment(invoiceId: number, payment: InvoicePayment): Observable<CustomHttpResponse<InvoicePayment>> {
    return this.http.post<CustomHttpResponse<InvoicePayment>>(
      `${this.apiUrl}/${invoiceId}/payments`, payment
    );
  }

  getPaymentsByInvoiceId(invoiceId: number): Observable<CustomHttpResponse<InvoicePayment[]>> {
    return this.http.get<CustomHttpResponse<InvoicePayment[]>>(
      `${this.apiUrl}/${invoiceId}/payments`
    );
  }

  getPayment(paymentId: number): Observable<CustomHttpResponse<InvoicePayment>> {
    return this.http.get<CustomHttpResponse<InvoicePayment>>(
      `${this.apiUrl}/payments/${paymentId}`
    );
  }

  deletePayment(paymentId: number): Observable<CustomHttpResponse<void>> {
    return this.http.delete<CustomHttpResponse<void>>(
      `${this.apiUrl}/payments/${paymentId}`
    );
  }

  getRecentPayments(limit: number = 10): Observable<CustomHttpResponse<InvoicePayment[]>> {
    return this.http.get<CustomHttpResponse<InvoicePayment[]>>(
      `${this.apiUrl}/payments/recent?limit=${limit}`
    );
  }

  getPaymentAnalytics(startDate: string, endDate: string): Observable<CustomHttpResponse<PaymentAnalytics>> {
    return this.http.get<CustomHttpResponse<PaymentAnalytics>>(
      `${this.apiUrl}/payments/analytics?startDate=${startDate}&endDate=${endDate}`
    );
  }

  getPaymentsByDateRange$(startDate: string, endDate: string, page: number = 0, size: number = 20): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/payments?startDate=${startDate}&endDate=${endDate}&page=${page}&size=${size}`
    );
  }
}