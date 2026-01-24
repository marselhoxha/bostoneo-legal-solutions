import { Injectable } from '@angular/core';
import { Subject, Observable, filter } from 'rxjs';

export interface EventBusEvent {
  type: string;
  payload: any;
  timestamp: Date;
  source?: string;
  metadata?: { [key: string]: any };
}

export interface EventHandler {
  type: string;
  handler: (event: EventBusEvent) => void | Promise<void>;
  priority?: number; // Higher numbers execute first
}

@Injectable({
  providedIn: 'root'
})
export class EventBusService {
  private eventSubject = new Subject<EventBusEvent>();
  private handlers: Map<string, EventHandler[]> = new Map();
  
  constructor() {
  }

  /**
   * Publish an event to the event bus
   */
  publish(event: Omit<EventBusEvent, 'timestamp'>): void {
    const fullEvent: EventBusEvent = {
      ...event,
      timestamp: new Date()
    };

    this.eventSubject.next(fullEvent);
  }

  /**
   * Subscribe to events of a specific type
   */
  subscribe<T = any>(eventType: string): Observable<TypedEventBusEvent<T>> {
    return this.eventSubject.asObservable().pipe(
      filter(event => event.type === eventType)
    ) as Observable<TypedEventBusEvent<T>>;
  }

  /**
   * Subscribe to all events
   */
  subscribeToAll(): Observable<EventBusEvent> {
    return this.eventSubject.asObservable();
  }

  /**
   * Register a handler for a specific event type
   */
  register(eventType: string, handler: (event: EventBusEvent) => void | Promise<void>, priority = 0): void {
    const eventHandler: EventHandler = {
      type: eventType,
      handler,
      priority
    };

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    const handlers = this.handlers.get(eventType)!;
    handlers.push(eventHandler);

    // Sort handlers by priority (higher numbers first)
    handlers.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Unregister a handler for a specific event type
   */
  unregister(eventType: string, handler: (event: EventBusEvent) => void | Promise<void>): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.findIndex(h => h.handler === handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Execute registered handlers for an event
   */
  private async executeHandlers(event: EventBusEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.length === 0) {
      return;
    }

    for (const eventHandler of handlers) {
      try {
        const result = eventHandler.handler(event);
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        console.error(`🚌 Error in event handler for ${event.type}:`, error);
      }
    }
  }

  /**
   * Initialize the event bus with automatic handler execution
   */
  initialize(): void {
    this.subscribeToAll().subscribe(async (event) => {
      await this.executeHandlers(event);
    });
  }
}

// Event type constants for better type safety
export const EVENT_TYPES = {
  // Case Management Events
  CASE_CREATED: 'case.created',
  CASE_UPDATED: 'case.updated',
  CASE_STATUS_CHANGED: 'case.status.changed',
  CASE_PRIORITY_CHANGED: 'case.priority.changed',
  CASE_ASSIGNED: 'case.assigned',
  
  // Task Management Events  
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_STATUS_CHANGED: 'task.status.changed',
  TASK_ASSIGNED: 'task.assigned',
  TASK_COMPLETED: 'task.completed',
  TASK_DEADLINE_APPROACHING: 'task.deadline.approaching',
  
  // Document Events
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_UPDATED: 'document.updated',
  DOCUMENT_VERSION_CREATED: 'document.version.created',
  
  // Financial Events
  INVOICE_CREATED: 'invoice.created',
  INVOICE_UPDATED: 'invoice.updated',
  PAYMENT_RECEIVED: 'payment.received',
  EXPENSE_SUBMITTED: 'expense.submitted',
  
  // CRM Events
  LEAD_CREATED: 'lead.created',
  LEAD_UPDATED: 'lead.updated',
  LEAD_STATUS_CHANGED: 'lead.status.changed',
  LEAD_CONVERTED: 'lead.converted',
  INTAKE_FORM_SUBMITTED: 'intake.form.submitted',
  
  // Calendar Events
  CALENDAR_EVENT_CREATED: 'calendar.event.created',
  CALENDAR_EVENT_UPDATED: 'calendar.event.updated',
  CALENDAR_EVENT_CANCELLED: 'calendar.event.cancelled',
  
  // Communication Events
  EMAIL_SENT: 'communication.email.sent',
  SMS_SENT: 'communication.sms.sent',
  CALL_LOGGED: 'communication.call.logged',
  NOTE_ADDED: 'communication.note.added',
  
  // User Events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_LOGGED_IN: 'user.logged.in',
  USER_LOGGED_OUT: 'user.logged.out',
  USER_ROLE_CHANGED: 'user.role.changed',
  
  // System Events
  NOTIFICATION_SENT: 'system.notification.sent',
  ERROR_OCCURRED: 'system.error.occurred',
  BACKUP_COMPLETED: 'system.backup.completed',
  MAINTENANCE_STARTED: 'system.maintenance.started',
  MAINTENANCE_COMPLETED: 'system.maintenance.completed'
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

// Helper interface for typed events
export interface TypedEventBusEvent<T = any> {
  type: string;
  payload: T;
  timestamp: Date;
  source?: string;
  metadata?: { [key: string]: any };
}