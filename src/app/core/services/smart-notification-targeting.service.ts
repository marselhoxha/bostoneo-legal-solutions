import { Injectable } from '@angular/core';
import { NotificationManagerService } from './notification-manager.service';
import { UserService } from '../../service/user.service';
import { User } from '../../interface/user';

export enum NotificationEventType {
  CASE_STATUS_CHANGED = 'CASE_STATUS_CHANGED',
  CASE_PRIORITY_CHANGED = 'CASE_PRIORITY_CHANGED',
  CASE_ASSIGNMENT_ADDED = 'CASE_ASSIGNMENT_ADDED',
  TASK_CREATED = 'TASK_CREATED',
  TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED',
  TASK_DEADLINE_APPROACHING = 'TASK_DEADLINE_APPROACHING',
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  DOCUMENT_VERSION_UPDATED = 'DOCUMENT_VERSION_UPDATED',
  INVOICE_CREATED = 'INVOICE_CREATED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  EXPENSE_SUBMITTED = 'EXPENSE_SUBMITTED',
  LEAD_STATUS_CHANGED = 'LEAD_STATUS_CHANGED',
  INTAKE_FORM_SUBMITTED = 'INTAKE_FORM_SUBMITTED',
  CALENDAR_EVENT_CREATED = 'CALENDAR_EVENT_CREATED',
  SYSTEM_ISSUE = 'SYSTEM_ISSUE'
}

export interface SmartNotificationContext {
  eventType: NotificationEventType;
  caseId?: number;
  casePriority?: string;
  newStatus?: string;
  oldStatus?: string;
  amount?: number;
  assigneeId?: number;
  practiceArea?: string;
  clientTier?: string;
  taskType?: string;
  documentType?: string;
  leadValue?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SmartNotificationTargetingService {

  constructor(
    private notificationManager: NotificationManagerService,
    private userService: UserService
  ) {}

  /**
   * Get smart recipients based on role hierarchy, business logic, and context
   */
  async getSmartRecipients(context: SmartNotificationContext): Promise<{ primaryUsers: User[], secondaryUsers: User[] }> {
    const recipients = { primaryUsers: [] as User[], secondaryUsers: [] as User[] };

    switch (context.eventType) {
      case NotificationEventType.CASE_STATUS_CHANGED:
        return this.getCaseStatusChangeRecipients(context);

      case NotificationEventType.CASE_PRIORITY_CHANGED:
        return this.getCasePriorityChangeRecipients(context);

      case NotificationEventType.CASE_ASSIGNMENT_ADDED:
        return this.getCaseAssignmentRecipients(context);

      case NotificationEventType.TASK_CREATED:
      case NotificationEventType.TASK_STATUS_CHANGED:
        return this.getTaskNotificationRecipients(context);

      case NotificationEventType.TASK_DEADLINE_APPROACHING:
        return this.getDeadlineNotificationRecipients(context);

      case NotificationEventType.DOCUMENT_UPLOADED:
      case NotificationEventType.DOCUMENT_VERSION_UPDATED:
        return this.getDocumentNotificationRecipients(context);

      case NotificationEventType.INVOICE_CREATED:
        return this.getInvoiceNotificationRecipients(context);

      case NotificationEventType.PAYMENT_RECEIVED:
        return this.getPaymentNotificationRecipients(context);

      case NotificationEventType.EXPENSE_SUBMITTED:
        return this.getExpenseNotificationRecipients(context);

      case NotificationEventType.LEAD_STATUS_CHANGED:
      case NotificationEventType.INTAKE_FORM_SUBMITTED:
        return this.getCRMNotificationRecipients(context);

      case NotificationEventType.CALENDAR_EVENT_CREATED:
        return this.getCalendarNotificationRecipients(context);

      case NotificationEventType.SYSTEM_ISSUE:
        return this.getSystemIssueRecipients(context);

      default:
        console.warn(`🎯 Unknown event type: ${context.eventType}`);
        return recipients;
    }
  }

  /**
   * Case Status Change - Smart targeting based on status and case importance
   */
  private async getCaseStatusChangeRecipients(context: SmartNotificationContext): Promise<{ primaryUsers: User[], secondaryUsers: User[] }> {
    const recipients = { primaryUsers: [] as User[], secondaryUsers: [] as User[] };

    // Always notify case team (attorneys and paralegals working on the case)
    if (context.caseId) {
      recipients.primaryUsers = await this.getCaseTeamMembers(context.caseId);
    }

    // For critical status changes, notify management
    if (context.newStatus === 'CLOSED' || context.newStatus === 'URGENT' || context.oldStatus === 'CLOSED') {
      const managementRoles = await this.getManagementUsers();
      recipients.secondaryUsers = managementRoles;
    }

    // For new cases (OPEN), notify practice managers for resource allocation
    if (context.newStatus === 'OPEN') {
      const practiceManagers = await this.getUsersByRoleCategory('ADMINISTRATIVE', 70); // Practice managers and above
      recipients.secondaryUsers.push(...practiceManagers);
    }

    return recipients;
  }

  /**
   * Case Priority Change - Escalating notifications based on priority level
   */
  private async getCasePriorityChangeRecipients(context: SmartNotificationContext): Promise<{ primaryUsers: User[], secondaryUsers: User[] }> {
    const recipients = { primaryUsers: [] as User[], secondaryUsers: [] as User[] };

    // Always notify case team
    if (context.caseId) {
      recipients.primaryUsers = await this.getCaseTeamMembers(context.caseId);
    }

    // For URGENT/HIGH priority, notify management hierarchy
    if (context.casePriority === 'URGENT') {
      recipients.secondaryUsers = await this.getUsersByRoleCategory('LEGAL', 85); // Senior partners and above
    } else if (context.casePriority === 'HIGH') {
      recipients.secondaryUsers = await this.getUsersByRoleCategory('LEGAL', 70); // Senior associates and above
    }

    return recipients;
  }

  /**
   * Case Assignment - Notify assignee and their supervisors
   */
  private async getCaseAssignmentRecipients(context: SmartNotificationContext): Promise<{ primaryUsers: User[], secondaryUsers: User[] }> {
    const recipients = { primaryUsers: [] as User[], secondaryUsers: [] as User[] };

    // Notify the assignee (primary)
    if (context.assigneeId) {
      const assignee = await this.getUserById(context.assigneeId);
      if (assignee) {
        recipients.primaryUsers = [assignee];
      }
    }

    // Notify practice managers and senior attorneys (secondary)
    recipients.secondaryUsers = await this.getUsersByRoleCategory('LEGAL', 70);
    const practiceManagers = await this.getUsersByRoleCategory('ADMINISTRATIVE', 70);
    recipients.secondaryUsers.push(...practiceManagers);

    return recipients;
  }

  /**
   * Task Notifications - Context-aware based on task type and urgency
   */
  private async getTaskNotificationRecipients(context: SmartNotificationContext): Promise<{ primaryUsers: User[], secondaryUsers: User[] }> {
    const recipients = { primaryUsers: [] as User[], secondaryUsers: [] as User[] };

    // Administrative tasks -> Support staff + managers
    if (context.taskType?.toLowerCase().includes('admin') || context.taskType?.toLowerCase().includes('filing')) {
      recipients.primaryUsers = await this.getUsersByRoleCategory('SUPPORT', 15);
      recipients.secondaryUsers = await this.getUsersByRoleCategory('ADMINISTRATIVE', 60);
    }
    // Legal research tasks -> Attorneys + law clerks
    else if (context.taskType?.toLowerCase().includes('research') || context.taskType?.toLowerCase().includes('legal')) {
      recipients.primaryUsers = await this.getUsersByRoleCategory('LEGAL', 40); // Law clerks and above
    }
    // Court/deadline tasks -> Attorneys + paralegals
    else if (context.taskType?.toLowerCase().includes('court') || context.taskType?.toLowerCase().includes('deadline')) {
      recipients.primaryUsers = await this.getUsersByRoleCategory('LEGAL', 50); // Associates and above
      const paralegals = await this.getUsersByRoleCategory('SUPPORT', 25);
      recipients.primaryUsers.push(...paralegals);
    }
    // Default: Notify case team
    else if (context.caseId) {
      recipients.primaryUsers = await this.getCaseTeamMembers(context.caseId);
    }

    return recipients;
  }

  /**
   * Deadline Approaching - Escalating urgency
   */
  private async getDeadlineNotificationRecipients(context: SmartNotificationContext): Promise<{ primaryUsers: User[], secondaryUsers: User[] }> {
    const recipients = { primaryUsers: [] as User[], secondaryUsers: [] as User[] };

    // Notify task assignee and case team
    if (context.assigneeId) {
      const assignee = await this.getUserById(context.assigneeId);
      if (assignee) recipients.primaryUsers.push(assignee);
    }

    if (context.caseId) {
      const caseTeam = await this.getCaseTeamMembers(context.caseId);
      recipients.primaryUsers.push(...caseTeam);
    }

    // For very urgent deadlines, notify supervisors
    recipients.secondaryUsers = await this.getUsersByRoleCategory('LEGAL', 70);

    return recipients;
  }

  /**
   * Document Notifications - Only notify those working on the case
   */
  private async getDocumentNotificationRecipients(context: SmartNotificationContext): Promise<{ primaryUsers: User[], secondaryUsers: User[] }> {
    const recipients = { primaryUsers: [] as User[], secondaryUsers: [] as User[] };

    // Only notify case team members - documents are case-specific
    if (context.caseId) {
      recipients.primaryUsers = await this.getCaseTeamMembers(context.caseId);
    }

    return recipients;
  }

  /**
   * Invoice Notifications - Financial stakeholders based on amount
   */
  private async getInvoiceNotificationRecipients(context: SmartNotificationContext): Promise<{ primaryUsers: User[], secondaryUsers: User[] }> {
    const recipients = { primaryUsers: [] as User[], secondaryUsers: [] as User[] };

    // Always notify financial managers
    recipients.primaryUsers = await this.getUsersByRoleCategory('FINANCIAL', 60);

    // For large invoices (>$10K), notify senior management
    if (context.amount && context.amount > 10000) {
      recipients.secondaryUsers = await this.getUsersByRoleCategory('LEGAL', 90); // Partners and above
      const practiceManagers = await this.getUsersByRoleCategory('ADMINISTRATIVE', 80);
      recipients.secondaryUsers.push(...practiceManagers);
    }
    // For medium invoices (>$5K), notify practice managers
    else if (context.amount && context.amount > 5000) {
      recipients.secondaryUsers = await this.getUsersByRoleCategory('ADMINISTRATIVE', 70);
    }

    return recipients;
  }

  /**
   * Payment Notifications - Financial oversight based on amount
   */
  private async getPaymentNotificationRecipients(context: SmartNotificationContext): Promise<{ primaryUsers: User[], secondaryUsers: User[] }> {
    const recipients = { primaryUsers: [] as User[], secondaryUsers: [] as User[] };

    // Always notify financial managers
    recipients.primaryUsers = await this.getUsersByRoleCategory('FINANCIAL', 60);

    // For large payments (>$5K), notify senior management for cash flow awareness
    if (context.amount && context.amount > 5000) {
      recipients.secondaryUsers = await this.getUsersByRoleCategory('LEGAL', 95); // Senior partners and above
      const cfo = await this.getUsersByRoleCategory('FINANCIAL', 65);
      recipients.secondaryUsers.push(...cfo);
    }

    return recipients;
  }

  /**
   * Expense Notifications - Approval chain based on amount
   */
  private async getExpenseNotificationRecipients(context: SmartNotificationContext): Promise<{ primaryUsers: User[], secondaryUsers: User[] }> {
    const recipients = { primaryUsers: [] as User[], secondaryUsers: [] as User[] };

    // Small expenses (<$500) - Finance team only
    if (!context.amount || context.amount < 500) {
      recipients.primaryUsers = await this.getUsersByRoleCategory('FINANCIAL', 60);
    }
    // Medium expenses ($500-$2000) - Finance + practice managers
    else if (context.amount < 2000) {
      recipients.primaryUsers = await this.getUsersByRoleCategory('FINANCIAL', 60);
      recipients.secondaryUsers = await this.getUsersByRoleCategory('ADMINISTRATIVE', 70);
    }
    // Large expenses (>$2000) - Full approval chain
    else {
      recipients.primaryUsers = await this.getUsersByRoleCategory('FINANCIAL', 60);
      recipients.secondaryUsers = await this.getUsersByRoleCategory('LEGAL', 85); // Senior partners for approval
    }

    return recipients;
  }

  /**
   * CRM Notifications - Business development stakeholders
   */
  private async getCRMNotificationRecipients(context: SmartNotificationContext): Promise<{ primaryUsers: User[], secondaryUsers: User[] }> {
    const recipients = { primaryUsers: [] as User[], secondaryUsers: [] as User[] };

    // High-value leads - notify partners and practice managers
    if (context.leadValue && context.leadValue > 50000) {
      recipients.primaryUsers = await this.getUsersByRoleCategory('LEGAL', 85); // Partners for business development
      const practiceManagers = await this.getUsersByRoleCategory('ADMINISTRATIVE', 70);
      recipients.primaryUsers.push(...practiceManagers);
    }
    // Medium-value leads - notify senior attorneys and intake team
    else if (context.leadValue && context.leadValue > 10000) {
      recipients.primaryUsers = await this.getUsersByRoleCategory('LEGAL', 70); // Senior associates and above
      const intakeTeam = await this.getUsersByRoleCategory('SUPPORT', 20); // Legal assistants
      recipients.secondaryUsers = intakeTeam;
    }
    // Standard leads - intake team and junior attorneys
    else {
      recipients.primaryUsers = await this.getUsersByRoleCategory('LEGAL', 50); // Associates and above
      const intakeTeam = await this.getUsersByRoleCategory('SUPPORT', 20);
      recipients.primaryUsers.push(...intakeTeam);
    }

    return recipients;
  }

  /**
   * Calendar Notifications - Everyone who needs to coordinate schedules
   */
  private async getCalendarNotificationRecipients(context: SmartNotificationContext): Promise<{ primaryUsers: User[], secondaryUsers: User[] }> {
    const recipients = { primaryUsers: [] as User[], secondaryUsers: [] as User[] };

    // Court hearings - all attorneys and case team
    if (context.documentType?.toLowerCase().includes('hearing') || context.documentType?.toLowerCase().includes('court')) {
      recipients.primaryUsers = await this.getUsersByRoleCategory('LEGAL', 50); // Associates and above
      const secretaries = await this.getUsersByRoleCategory('SUPPORT', 15); // Secretaries for scheduling
      recipients.primaryUsers.push(...secretaries);
    }
    // Client meetings - case team + support staff
    else if (context.documentType?.toLowerCase().includes('client')) {
      if (context.caseId) {
        recipients.primaryUsers = await this.getCaseTeamMembers(context.caseId);
      }
      const adminSupport = await this.getUsersByRoleCategory('SUPPORT', 15);
      recipients.secondaryUsers = adminSupport;
    }
    // Internal meetings - broader notification
    else {
      recipients.primaryUsers = await this.getUsersByRoleCategory('LEGAL', 60); // Attorneys
      const managers = await this.getUsersByRoleCategory('ADMINISTRATIVE', 70);
      recipients.primaryUsers.push(...managers);
    }

    return recipients;
  }

  /**
   * System Issues - IT and affected users
   */
  private async getSystemIssueRecipients(context: SmartNotificationContext): Promise<{ primaryUsers: User[], secondaryUsers: User[] }> {
    const recipients = { primaryUsers: [] as User[], secondaryUsers: [] as User[] };

    // Always notify IT/technical staff
    recipients.primaryUsers = await this.getUsersByRoleCategory('TECHNICAL', 50);
    
    // For critical issues, notify management
    recipients.secondaryUsers = await this.getUsersByRoleCategory('LEGAL', 90); // Partners
    const practiceManagers = await this.getUsersByRoleCategory('ADMINISTRATIVE', 80);
    recipients.secondaryUsers.push(...practiceManagers);

    return recipients;
  }

  /**
   * Helper: Get case team members (attorneys and paralegals working on a specific case)
   */
  private async getCaseTeamMembers(caseId: number): Promise<User[]> {
    // This would ideally query case assignments, but for now use attorneys and paralegals
    const attorneys = await this.getUsersByRoleCategory('LEGAL', 50);
    const paralegals = await this.getUsersByRoleCategory('SUPPORT', 25);
    return [...attorneys, ...paralegals];
  }

  /**
   * Helper: Get users by role category and minimum hierarchy level
   */
  private async getUsersByRoleCategory(category: string, minHierarchy: number = 0): Promise<User[]> {
    try {
      const allUsers = await this.notificationManager.getAllUsers();
      
      return allUsers.filter(user => {
        if (!user.enabled) return false;
        
        const roleName = user.roleName?.toUpperCase() || '';
        
        // Define role categories and hierarchy levels
        const roleMapping: { [key: string]: { category: string, level: number } } = {
          'MANAGING_PARTNER': { category: 'LEGAL', level: 100 },
          'SENIOR_PARTNER': { category: 'LEGAL', level: 95 },
          'EQUITY_PARTNER': { category: 'LEGAL', level: 90 },
          'OF_COUNSEL': { category: 'LEGAL', level: 85 },
          'NON_EQUITY_PARTNER': { category: 'LEGAL', level: 80 },
          'SENIOR_ASSOCIATE': { category: 'LEGAL', level: 70 },
          'ASSOCIATE': { category: 'LEGAL', level: 60 },
          'ROLE_ATTORNEY': { category: 'LEGAL', level: 60 },
          'JUNIOR_ASSOCIATE': { category: 'LEGAL', level: 50 },
          'LAW_CLERK': { category: 'LEGAL', level: 40 },
          'PRACTICE_MANAGER': { category: 'ADMINISTRATIVE', level: 80 },
          'COO': { category: 'ADMINISTRATIVE', level: 85 },
          'CFO': { category: 'FINANCIAL', level: 65 },
          'FINANCE_MANAGER': { category: 'FINANCIAL', level: 60 },
          'HR_MANAGER': { category: 'ADMINISTRATIVE', level: 45 },
          'IT_MANAGER': { category: 'TECHNICAL', level: 50 },
          'ROLE_ADMIN': { category: 'TECHNICAL', level: 100 },
          'SENIOR_PARALEGAL': { category: 'SUPPORT', level: 30 },
          'PARALEGAL': { category: 'SUPPORT', level: 25 },
          'LEGAL_ASSISTANT': { category: 'SUPPORT', level: 20 },
          'LEGAL_SECRETARY': { category: 'SUPPORT', level: 15 },
          'ROLE_USER': { category: 'SUPPORT', level: 10 }
        };

        const userRole = roleMapping[roleName];
        if (!userRole) return false;
        
        return userRole.category === category && userRole.level >= minHierarchy;
      });
    } catch (error) {
      console.error(`Failed to get users by category ${category}:`, error);
      return [];
    }
  }

  /**
   * Helper: Get management users (senior roles across all categories)
   */
  private async getManagementUsers(): Promise<User[]> {
    const legal = await this.getUsersByRoleCategory('LEGAL', 85); // Partners
    const admin = await this.getUsersByRoleCategory('ADMINISTRATIVE', 70); // Practice managers
    const financial = await this.getUsersByRoleCategory('FINANCIAL', 60); // Finance managers
    const technical = await this.getUsersByRoleCategory('TECHNICAL', 50); // IT managers
    
    return [...legal, ...admin, ...financial, ...technical];
  }

  /**
   * Helper: Get user by ID
   */
  private async getUserById(userId: number): Promise<User | null> {
    try {
      const allUsers = await this.notificationManager.getAllUsers();
      return allUsers.find(user => user.id === userId && user.enabled) || null;
    } catch (error) {
      console.error(`Failed to get user by ID ${userId}:`, error);
      return null;
    }
  }
}