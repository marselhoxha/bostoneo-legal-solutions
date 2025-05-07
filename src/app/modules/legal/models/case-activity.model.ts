import { User } from 'src/app/interface/user';

export enum ActivityType {
  NOTE_ADDED = 'NOTE_ADDED',
  NOTE_UPDATED = 'NOTE_UPDATED',
  NOTE_DELETED = 'NOTE_DELETED',
  DOCUMENT_ADDED = 'DOCUMENT_ADDED',
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  DOCUMENT_UPDATED = 'DOCUMENT_UPDATED',
  DOCUMENT_DOWNLOADED = 'DOCUMENT_DOWNLOADED',
  DOCUMENT_VERSION_ADDED = 'DOCUMENT_VERSION_ADDED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  CASE_CREATED = 'CASE_CREATED',
  CASE_UPDATED = 'CASE_UPDATED',
  HEARING_SCHEDULED = 'HEARING_SCHEDULED',
  HEARING_UPDATED = 'HEARING_UPDATED',
  HEARING_CANCELLED = 'HEARING_CANCELLED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_DELETED = 'TASK_DELETED',
  CLIENT_CONTACTED = 'CLIENT_CONTACTED',
  CUSTOM = 'CUSTOM'
}

export interface CaseActivity {
  id: number;
  caseId: number;
  userId: number;
  user?: User;
  activityType: string;
  referenceId?: number;
  referenceType?: string;
  description: string;
  metadata?: any;
  createdAt: Date;
}

export interface CreateActivityRequest {
  caseId: number;
  activityType: string;
  referenceId?: number;
  referenceType?: string;
  description: string;
  metadata?: any;
  metadataJson?: string;
  userId?: number;
}

export enum ReminderStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum ReminderPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export interface CaseReminder {
  id: number;
  caseId: number;
  userId?: number;
  user?: User;
  title: string;
  description?: string;
  dueDate: Date;
  reminderDate?: Date;
  status: ReminderStatus;
  priority: ReminderPriority;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReminderRequest {
  caseId: number;
  title: string;
  description?: string;
  dueDate: Date | string;
  reminderDate?: Date | string;
  priority?: ReminderPriority;
}

export interface UpdateReminderRequest {
  title?: string;
  description?: string;
  dueDate?: Date | string;
  reminderDate?: Date | string;
  status?: ReminderStatus;
  priority?: ReminderPriority;
} 