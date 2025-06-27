export interface PaymentMethodDTO {
  id: string;
  type: string;
  brand?: string;
  last4?: string;
  expiryMonth?: string;
  expiryYear?: string;
  clientId: number;
  isDefault: boolean;
}