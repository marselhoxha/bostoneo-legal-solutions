export interface Expense {
  id?: number;
  amount: number;
  currency: string;
  date: string;
  description: string;
  tax?: number;
  vendorId?: number;
  customerId?: number;
  categoryId?: number;
  invoiceId?: number;
  createdAt?: string;
  updatedAt?: string;
  customer?: {
    id: number;
    name: string;
  };
  invoice?: {
    id: number;
    invoiceNumber: string;
  };
  legalCaseId?: number;
  receiptId?: number;
  receiptFileName?: string;
  category?: ExpenseCategory;
  vendor?: Vendor;
  receipt?: Receipt;
}

export interface ExpenseCategory {
  id?: number;
  name: string;
  color: string;
  parentId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Vendor {
  id?: number;
  name: string;
  contact?: string;
  taxId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Receipt {
  id?: number;
  fileName: string;
  contentType: string;
  fileSize: number;
  thumbnail?: string;
  content?: string;
  createdAt?: Date;
  updatedAt?: Date;
} 