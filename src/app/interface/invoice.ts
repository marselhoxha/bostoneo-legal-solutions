import { InvoiceLineItem } from './invoice-line-item';

export interface Invoice {
    id?: number;
    invoiceNumber?: string;
    clientId: number;
    clientName?: string;
    legalCaseId?: number;
    caseName?: string;
    issueDate: string;
    dueDate: string;
    status: 'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'ISSUED';
    subtotal: number;
    taxRate?: number;
    taxAmount?: number;
    totalAmount: number;
    totalPaid?: number;
    balanceDue?: number;
    lastPaymentDate?: string;
    paymentStatus?: string;
    notes?: string;
    timeEntryIds?: number[];
    lineItems?: InvoiceLineItem[];
    createdAt?: Date;
    updatedAt?: Date;
    createdBy?: number;
}