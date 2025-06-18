export interface InvoiceLineItem {
  id?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  lineOrder?: number;
  category?: string;
  serviceDate?: string;
}