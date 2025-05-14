export interface CalendarEvent {
  id?: number;
  title: string;
  description?: string;
  start: Date | string;
  end?: Date | string;
  startTime?: Date | string;
  endTime?: Date | string;
  location?: string;
  eventType: EventType;
  status: EventStatus;
  allDay?: boolean;
  recurrenceRule?: string;
  color?: string;
  caseId?: number | string;
  caseTitle?: string;
  caseNumber?: string;
  reminderMinutes?: number;
  emailNotification?: boolean;
  pushNotification?: boolean;
  highPriority?: boolean;
  additionalReminders?: number[];
  recurrenceEndDate?: Date | string;
}

export interface CreateEventRequest {
  id?: number;
  title: string;
  description?: string;
  startTime: Date | string;
  endTime?: Date | string;
  location?: string;
  eventType: EventType;
  status?: EventStatus;
  allDay?: boolean;
  caseId?: number | string;
  reminderMinutes?: number;
  color?: string;
  emailNotification?: boolean;
  pushNotification?: boolean;
  highPriority?: boolean;
  additionalReminders?: number[];
  recurrenceRule?: string;
}

export type EventType = 
  | 'COURT_DATE' 
  | 'DEADLINE' 
  | 'CLIENT_MEETING' 
  | 'TEAM_MEETING' 
  | 'DEPOSITION' 
  | 'MEDIATION' 
  | 'CONSULTATION' 
  | 'REMINDER' 
  | 'OTHER';

export type EventStatus = 
  | 'SCHEDULED' 
  | 'COMPLETED' 
  | 'CANCELLED' 
  | 'RESCHEDULED' 
  | 'PENDING'; 