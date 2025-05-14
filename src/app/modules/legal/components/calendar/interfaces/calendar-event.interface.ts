export interface CalendarEvent {
  id?: number;
  title: string;
  description?: string;
  start: Date;
  end?: Date;
  location?: string;
  eventType: 'COURT_DATE' | 'DEADLINE' | 'CLIENT_MEETING' | 'TEAM_MEETING' | 'DEPOSITION' | 'MEDIATION' | 'CONSULTATION' | 'REMINDER' | 'OTHER';
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED' | 'PENDING';
  allDay?: boolean;
  recurrenceRule?: string;
  color?: string;
  
  caseId?: number;
  caseTitle?: string;
  caseNumber?: string;
  
  userId?: number;
  userName?: string;
  
  reminderMinutes?: number;
  reminderSent?: boolean;
  remindersSent?: number[]; // Track which reminders have been sent
  
  // Notification preferences
  emailNotification?: boolean;
  pushNotification?: boolean;
  
  externalId?: string;
  externalCalendar?: string;
  
  createdAt?: Date;
  updatedAt?: Date;
  
  // Additional fields for recurrence
  recurrenceEndDate?: Date;
  
  // Additional fields for deadlines
  highPriority?: boolean;
  additionalReminders?: number[];
}

export interface CreateEventRequest {
  id?: number; // Include ID for updates
  title: string;
  description?: string;
  startTime: Date; // Primary field expected by backend
  endTime?: Date; // Primary field expected by backend
  start?: Date; // Deprecated - do not use
  end?: Date; // Deprecated - do not use
  location?: string;
  eventType: 'COURT_DATE' | 'DEADLINE' | 'CLIENT_MEETING' | 'TEAM_MEETING' | 'DEPOSITION' | 'MEDIATION' | 'CONSULTATION' | 'REMINDER' | 'OTHER';
  status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED' | 'PENDING';
  allDay?: boolean;
  recurrenceRule?: string;
  color?: string;
  caseId?: number;
  reminderMinutes?: number;
  reminderSent?: boolean;
  externalCalendar?: string;
  
  // Notification preferences
  emailNotification?: boolean;
  pushNotification?: boolean;
  
  // Additional fields for recurrence
  recurrenceEndDate?: Date;
  
  // Additional fields for deadlines
  highPriority?: boolean;
  additionalReminders?: number[];
} 