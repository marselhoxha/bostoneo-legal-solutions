export enum CaseStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING = 'PENDING',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED'
}

export enum CasePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE'
}

export interface CourtInfo {
  courtName: string;
  judgeName: string;
  courtroom?: string;
}

export interface ImportantDates {
  filingDate: Date;
  nextHearing: Date;
  trialDate?: Date;
  estimatedCompletionDate?: Date;
}

export interface BillingInfo {
  hourlyRate: number;
  totalHours: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
}

export interface LegalCase {
  id: string;
  caseNumber: string;
  title: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  status: CaseStatus;
  priority: CasePriority;
  description: string;
  courtInfo: CourtInfo;
  importantDates: ImportantDates;
  documents?: string[];
  notes?: string[];
  billingInfo?: BillingInfo;
  createdAt: Date;
  updatedAt: Date;
} 