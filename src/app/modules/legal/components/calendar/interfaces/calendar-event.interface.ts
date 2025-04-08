export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  color?: string;
  caseId?: string;
  clientId?: string;
  type: 'hearing' | 'deadline' | 'meeting' | 'other';
  status: 'scheduled' | 'completed' | 'cancelled';
  reminder?: boolean;
  reminderTime?: Date;
} 