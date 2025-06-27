export interface PaymentIntentDTO {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
  invoiceId: number;
  invoiceNumber: string;
}