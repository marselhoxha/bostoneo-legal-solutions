export interface InvoiceTemplate {
  id?: number;
  name: string;
  description?: string;
  isActive?: boolean;
  isDefault?: boolean;
  
  // Template settings
  taxRate?: number;
  paymentTerms?: number;
  currencyCode?: string;
  
  // Template content
  headerText?: string;
  footerText?: string;
  notesTemplate?: string;
  termsAndConditions?: string;
  
  // Styling options
  logoPosition?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  
  // Related data
  templateItems?: InvoiceTemplateItem[];
  createdByName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InvoiceTemplateItem {
  id?: number;
  description: string;
  defaultQuantity?: number;
  defaultUnitPrice?: number;
  category?: string;
  isOptional?: boolean;
  sortOrder?: number;
}