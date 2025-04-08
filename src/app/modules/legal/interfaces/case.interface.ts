import { User } from 'src/app/interface/user';

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

export enum DocumentType {
  CONTRACT = 'CONTRACT',
  PLEADING = 'PLEADING',
  EVIDENCE = 'EVIDENCE',
  CORRESPONDENCE = 'CORRESPONDENCE',
  OTHER = 'OTHER'
}

export interface CourtInfo {
  courtName: string;
  judgeName: string;
  courtroom: string;
}

export interface ImportantDates {
  filingDate: Date;
  nextHearing: Date;
  trialDate: Date;
}

export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  url: string;
  uploadedAt: Date;
}

export interface Note {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  updatedBy?: {
    id: string;
    name: string;
    email: string;
  };
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
  courtInfo: {
    courtName: string;
    judgeName: string;
    courtroom: string;
  };
  importantDates: {
    filingDate: Date;
    nextHearing: Date;
    trialDate: Date;
  };
  documents: string[];
  notes: string[];
  billingInfo: {
    hourlyRate: number;
    totalHours: number;
    totalAmount: number;
    paymentStatus: PaymentStatus;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseDocument {
  id: string;
  title: string;
  type: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  uploadedBy: {
    id: string;
    name: string;
    email: string;
  };
} 