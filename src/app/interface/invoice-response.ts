import { Invoice } from './invoice';
import { CustomHttpResponse, Page } from './appstates';

/**
 * Type-safe response interfaces for Invoice API
 */

export interface InvoiceResponse extends CustomHttpResponse<Invoice> {
  data: Invoice;
}

export interface InvoicePageResponse extends CustomHttpResponse<Page<Invoice>> {
  data: Page<Invoice>;
}

export interface InvoiceListResponse extends CustomHttpResponse<Invoice[]> {
  data: Invoice[];
}

export interface InvoiceStatistics {
  totalInvoices: number;
  totalRevenue: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  averagePaymentDays: number;
  revenueByMonth: { [key: string]: number };
  revenueByClient: { [key: string]: number };
}

export interface InvoiceStatisticsResponse extends CustomHttpResponse<InvoiceStatistics> {
  data: InvoiceStatistics;
}

export interface InvoiceActionResponse extends CustomHttpResponse<void> {
  message: string;
  success: boolean;
}