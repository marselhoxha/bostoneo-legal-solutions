import { User } from 'src/app/interface/user';
import { DocumentType, DocumentCategory } from './document.interface';

export enum CaseStatus {
  ACTIVE = 'ACTIVE',
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
  title: string;
  caseNumber: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: User;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
  };
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  courtInfo?: CourtInfo;
  importantDates?: ImportantDates;
  billingInfo?: BillingInfo;
  documents?: CaseDocument[];
  notes?: CaseNote[];
  activities?: CaseActivity[];
}

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  uploadedBy: User;
  changes: string;
}

export interface CaseDocument {
  id: string;
  title: string;
  type: DocumentType;
  category: DocumentCategory;
  status?: string;
  fileName: string;
  fileUrl: string;
  description?: string;
  tags: string[];
  uploadedAt: Date;
  uploadedBy: User;
  currentVersion: number;
  versions: DocumentVersion[];
}

export interface CaseActivity {
  id: string;
  caseId: string;
  type: ActivityType;
  description: string;
  timestamp: Date;
  userId: string;
  user?: User;
  metadata?: {
    [key: string]: any;
  };
}

export enum ActivityType {
  CASE_CREATED = 'CASE_CREATED',
  CASE_UPDATED = 'CASE_UPDATED',
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  DOCUMENT_DOWNLOADED = 'DOCUMENT_DOWNLOADED',
  DOCUMENT_VERSION_ADDED = 'DOCUMENT_VERSION_ADDED',
  NOTE_ADDED = 'NOTE_ADDED',
  NOTE_UPDATED = 'NOTE_UPDATED',
  NOTE_DELETED = 'NOTE_DELETED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  ASSIGNMENT_CHANGED = 'ASSIGNMENT_CHANGED',
  DEADLINE_SET = 'DEADLINE_SET',
  DEADLINE_UPDATED = 'DEADLINE_UPDATED',
  DEADLINE_MET = 'DEADLINE_MET',
  DEADLINE_MISSED = 'DEADLINE_MISSED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_SCHEDULED = 'PAYMENT_SCHEDULED',
  PAYMENT_MISSED = 'PAYMENT_MISSED',
  HEARING_SCHEDULED = 'HEARING_SCHEDULED',
  HEARING_COMPLETED = 'HEARING_COMPLETED',
  HEARING_CANCELLED = 'HEARING_CANCELLED',
  OTHER = 'OTHER'
}

export interface CaseNote {
  id: string;
  caseId: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string;
  };
  updatedBy?: {
    id: string;
    name: string;
  };
} 