import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PaymentIntentDTO } from '../interface/payment-intent';
import { PaymentMethodDTO } from '../interface/payment-method';
import { PaymentTransaction } from '../interface/payment-transaction';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private readonly apiUrl = '/api/v1';

  constructor(private http: HttpClient) {}

  createPaymentIntent(invoiceId: number): Observable<PaymentIntentDTO> {
    return this.http.post<PaymentIntentDTO>(
      `${this.apiUrl}/payments/intent/${invoiceId}`, 
      {}
    );
  }

  getPaymentIntent(paymentIntentId: string): Observable<PaymentIntentDTO> {
    return this.http.get<PaymentIntentDTO>(
      `${this.apiUrl}/payments/intent/${paymentIntentId}`
    );
  }

  getClientPaymentMethods(clientId: number): Observable<PaymentMethodDTO[]> {
    return this.http.get<PaymentMethodDTO[]>(
      `${this.apiUrl}/payments/methods/client/${clientId}`
    );
  }

  savePaymentMethod(clientId: number, paymentMethodId: string): Observable<PaymentMethodDTO> {
    return this.http.post<PaymentMethodDTO>(
      `${this.apiUrl}/payments/methods/client/${clientId}`,
      { paymentMethodId }
    );
  }

  deletePaymentMethod(paymentMethodId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/payments/methods/${paymentMethodId}`
    );
  }

  // Payment Transaction methods
  createPaymentTransaction(transaction: PaymentTransaction): Observable<PaymentTransaction> {
    return this.http.post<PaymentTransaction>(
      `${this.apiUrl}/payment-transactions`,
      transaction
    );
  }

  getPaymentTransaction(id: number): Observable<PaymentTransaction> {
    return this.http.get<PaymentTransaction>(
      `${this.apiUrl}/payment-transactions/${id}`
    );
  }

  getInvoiceTransactions(invoiceId: number, page = 0, size = 10): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/payment-transactions/invoice/${invoiceId}`,
      { params: { page: page.toString(), size: size.toString() } }
    );
  }

  updateTransactionStatus(id: number, status: string, notes?: string): Observable<PaymentTransaction> {
    return this.http.put<PaymentTransaction>(
      `${this.apiUrl}/payment-transactions/${id}/status`,
      { status, notes }
    );
  }

  completeTransaction(id: number): Observable<PaymentTransaction> {
    return this.http.post<PaymentTransaction>(
      `${this.apiUrl}/payment-transactions/${id}/complete`,
      {}
    );
  }

  cancelTransaction(id: number): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/payment-transactions/${id}/cancel`,
      {}
    );
  }
}