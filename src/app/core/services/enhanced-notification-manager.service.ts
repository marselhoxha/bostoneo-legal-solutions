import { Injectable } from '@angular/core';
import { EventBusService, EVENT_TYPES, EventBusEvent } from './event-bus.service';
import { NotificationTriggerService } from './notification-trigger.service';
import { UserService } from '../../service/user.service';

@Injectable({
  providedIn: 'root'
})
export class EnhancedNotificationManagerService {
  
  constructor(
    private eventBus: EventBusService,
    private notificationTrigger: NotificationTriggerService,
    private userService: UserService
  ) {
    this.registerEventHandlers();
  }

  /**
   * Initialize the enhanced notification manager
   */
  initialize(): void {
    this.eventBus.initialize();
  }

  /**
   * Register all event handlers for notifications
   */
  private registerEventHandlers(): void {
    // Case Management Events
    this.eventBus.register(EVENT_TYPES.CASE_STATUS_CHANGED, this.handleCaseStatusChanged.bind(this), 100);
    this.eventBus.register(EVENT_TYPES.CASE_PRIORITY_CHANGED, this.handleCasePriorityChanged.bind(this), 100);
    this.eventBus.register(EVENT_TYPES.CASE_ASSIGNED, this.handleCaseAssigned.bind(this), 100);

    // Task Management Events
    this.eventBus.register(EVENT_TYPES.TASK_CREATED, this.handleTaskCreated.bind(this), 100);
    this.eventBus.register(EVENT_TYPES.TASK_STATUS_CHANGED, this.handleTaskStatusChanged.bind(this), 100);
    this.eventBus.register(EVENT_TYPES.TASK_ASSIGNED, this.handleTaskAssigned.bind(this), 100);
    this.eventBus.register(EVENT_TYPES.TASK_DEADLINE_APPROACHING, this.handleTaskDeadlineApproaching.bind(this), 100);

    // Document Events
    this.eventBus.register(EVENT_TYPES.DOCUMENT_VERSION_CREATED, this.handleDocumentVersionCreated.bind(this), 100);

    // Financial Events
    this.eventBus.register(EVENT_TYPES.INVOICE_CREATED, this.handleInvoiceCreated.bind(this), 100);
    this.eventBus.register(EVENT_TYPES.PAYMENT_RECEIVED, this.handlePaymentReceived.bind(this), 100);
    this.eventBus.register(EVENT_TYPES.EXPENSE_SUBMITTED, this.handleExpenseSubmitted.bind(this), 100);

    // CRM Events
    this.eventBus.register(EVENT_TYPES.LEAD_STATUS_CHANGED, this.handleLeadStatusChanged.bind(this), 100);
    this.eventBus.register(EVENT_TYPES.INTAKE_FORM_SUBMITTED, this.handleIntakeFormSubmitted.bind(this), 100);

    // Calendar Events
    this.eventBus.register(EVENT_TYPES.CALENDAR_EVENT_CREATED, this.handleCalendarEventCreated.bind(this), 100);

    // Communication Events
    this.eventBus.register(EVENT_TYPES.NOTE_ADDED, this.handleNoteAdded.bind(this), 100);
  }

  /**
   * Publish a case status changed event
   */
  publishCaseStatusChanged(caseId: number, oldStatus: string, newStatus: string, caseName: string, caseNumber?: string): void {
    this.eventBus.publish({
      type: EVENT_TYPES.CASE_STATUS_CHANGED,
      payload: {
        caseId,
        oldStatus,
        newStatus,
        caseName,
        caseNumber
      },
      source: 'case-management'
    });
  }

  /**
   * Publish a task created event
   */
  publishTaskCreated(taskId: number, taskTitle: string, assigneeName?: string, caseId?: number, caseName?: string): void {
    this.eventBus.publish({
      type: EVENT_TYPES.TASK_CREATED,
      payload: {
        taskId,
        taskTitle,
        assigneeName,
        caseId,
        caseName
      },
      source: 'task-management'
    });
  }

  /**
   * Publish an expense submitted event
   */
  publishExpenseSubmitted(expenseId: number, amount: number, category: string, clientName: string, description: string): void {
    this.eventBus.publish({
      type: EVENT_TYPES.EXPENSE_SUBMITTED,
      payload: {
        expenseId,
        amount,
        category,
        clientName,
        description
      },
      source: 'expense-management'
    });
  }

  // Event Handlers
  private async handleCaseStatusChanged(event: EventBusEvent): Promise<void> {
    const { caseId, oldStatus, newStatus, caseName, caseNumber } = event.payload;
    
    await this.notificationTrigger.triggerCaseStatusChanged(
      caseId,
      oldStatus,
      newStatus,
      caseName,
      caseNumber
    );
  }

  private async handleCasePriorityChanged(event: EventBusEvent): Promise<void> {
    const { caseId, oldPriority, newPriority, caseName, caseNumber } = event.payload;
    
    await this.notificationTrigger.triggerCasePriorityChanged(
      caseId,
      oldPriority,
      newPriority,
      caseName,
      caseNumber
    );
  }

  private async handleCaseAssigned(event: EventBusEvent): Promise<void> {
    const { caseId, assigneeId, assigneeName, caseName, caseNumber } = event.payload;
    
    await this.notificationTrigger.triggerCaseAssignmentAdded(
      caseId,
      assigneeId,
      assigneeName,
      caseName
    );
  }

  private async handleTaskCreated(event: EventBusEvent): Promise<void> {
    const { taskId, taskTitle, assigneeName, caseId, caseName } = event.payload;
    
    await this.notificationTrigger.triggerTaskCreated(
      taskId,
      taskTitle,
      assigneeName,
      caseId,
      caseName
    );
  }

  private async handleTaskStatusChanged(event: EventBusEvent): Promise<void> {
    const { taskId, taskTitle, oldStatus, newStatus, caseId, caseName } = event.payload;
    
    await this.notificationTrigger.triggerTaskStatusChanged(
      taskId,
      taskTitle,
      oldStatus,
      newStatus,
      caseId,
      caseName
    );
  }

  private async handleTaskAssigned(event: EventBusEvent): Promise<void> {
    // Implementation for task assignment notifications
    // TODO: Implement task assignment notification handling
  }

  private async handleTaskDeadlineApproaching(event: EventBusEvent): Promise<void> {
    const { taskId, taskTitle, daysRemaining, caseId, caseName, assignedToId, assigneeName } = event.payload;
    
    await this.notificationTrigger.triggerDeadlineAlert(
      taskId,
      taskTitle,
      daysRemaining,
      caseId,
      caseName,
      assignedToId,
      assigneeName
    );
  }

  private async handleDocumentVersionCreated(event: EventBusEvent): Promise<void> {
    const { documentId, fileName, caseId, caseName, changes } = event.payload;
    
    await this.notificationTrigger.triggerDocumentVersionUpdated(
      documentId,
      fileName,
      caseId,
      caseName,
      changes
    );
  }

  private async handleInvoiceCreated(event: EventBusEvent): Promise<void> {
    const { invoiceId, invoiceNumber, clientName, totalAmount, caseName, caseId } = event.payload;
    
    await this.notificationTrigger.triggerInvoiceCreated(
      invoiceId,
      invoiceNumber,
      totalAmount.toString(),
      clientName
    );
  }

  private async handlePaymentReceived(event: EventBusEvent): Promise<void> {
    const { paymentId, amount, invoiceNumber, clientName, paymentMethod } = event.payload;
    
    await this.notificationTrigger.triggerPaymentReceived(
      paymentId,
      amount,
      invoiceNumber,
      clientName,
      paymentMethod
    );
  }

  private async handleExpenseSubmitted(event: EventBusEvent): Promise<void> {
    const { expenseId, amount, category, clientName, description } = event.payload;
    
    await this.notificationTrigger.triggerExpenseSubmitted(
      expenseId,
      amount,
      category,
      clientName,
      description
    );
  }

  private async handleLeadStatusChanged(event: EventBusEvent): Promise<void> {
    const { leadId, leadName, oldStatus, newStatus } = event.payload;
    
    await this.notificationTrigger.triggerLeadStatusChanged(
      leadId,
      leadName,
      oldStatus,
      newStatus
    );
  }

  private async handleIntakeFormSubmitted(event: EventBusEvent): Promise<void> {
    const { submissionId, clientName, email, practiceArea } = event.payload;
    
    await this.notificationTrigger.triggerIntakeFormSubmitted(
      submissionId,
      clientName,
      email,
      practiceArea
    );
  }

  private async handleCalendarEventCreated(event: EventBusEvent): Promise<void> {
    const { eventId, eventTitle, eventTime } = event.payload;
    
    await this.notificationTrigger.triggerCalendarEventCreated(
      eventId,
      eventTitle,
      eventTime
    );
  }

  private async handleNoteAdded(event: EventBusEvent): Promise<void> {
    const { noteId, noteTitle, notePreview, caseId, caseName } = event.payload;
    
    await this.notificationTrigger.triggerCaseNoteAdded(
      noteId,
      noteTitle,
      notePreview,
      caseId,
      caseName
    );
  }
}