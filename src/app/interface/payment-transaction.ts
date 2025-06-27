export interface PaymentTransaction {
  id?: number;
  invoiceId: number;
  transactionType: string;
  transactionStatus?: string;
  amount: number;
  routingNumber?: string;
  accountNumberLast4?: string;
  wireReference?: string;
  bankName?: string;
  processingDate?: string;
  completionDate?: string;
  referenceNumber?: string;
  notes?: string;
  createdBy?: number;
  createdAt?: string;
  updatedAt?: string;
}