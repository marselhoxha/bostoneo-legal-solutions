export interface InvoicePayment {
  id?: number;
  invoiceId: number;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
  createdBy?: number;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
  invoiceNumber?: string;
  clientName?: string;
}

export interface PaymentAnalytics {
  startDate: string;
  endDate: string;
  totalPayments: number;
}