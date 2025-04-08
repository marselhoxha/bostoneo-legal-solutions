export enum EventType {
  HEARING = 'HEARING',
  DEADLINE = 'DEADLINE',
  MEETING = 'MEETING',
  TASK = 'TASK',
  OTHER = 'OTHER'
}

export enum EventPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum EventStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  RESCHEDULED = 'RESCHEDULED'
}

export enum ReminderType {
  NONE = 'NONE',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  BOTH = 'BOTH'
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  priority: EventPriority;
  status: EventStatus;
  startDate: Date;
  endDate: Date;
  caseId?: string;
  location?: string;
  attendees?: string[];
  reminderType: ReminderType;
  reminderTime?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
  notes?: string;
  isAllDay: boolean;
  recurrence?: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    interval: number;
    endDate?: Date;
    count?: number;
  };
  tags?: string[];
  metadata?: {
    [key: string]: any;
  };
} 