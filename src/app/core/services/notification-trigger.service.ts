import { Injectable } from '@angular/core';
import { NotificationManagerService, NotificationCategory, NotificationPriority } from './notification-manager.service';
import { NotificationTemplatesService, NotificationContext } from './notification-templates.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { SmartNotificationTargetingService, NotificationEventType as SmartEventType, SmartNotificationContext } from './smart-notification-targeting.service';
import { UserService } from '../../service/user.service';

export enum EventType {
  CASE_STATUS_CHANGED = 'CASE_STATUS_CHANGED',
  CASE_PRIORITY_CHANGED = 'CASE_PRIORITY_CHANGED',
  CASE_ASSIGNMENT_ADDED = 'CASE_ASSIGNMENT_ADDED',
  CASE_ASSIGNMENT_REMOVED = 'CASE_ASSIGNMENT_REMOVED',
  TASK_CREATED = 'TASK_CREATED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  DEADLINE_APPROACHING = 'DEADLINE_APPROACHING',
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  DOCUMENT_VERSION_UPDATED = 'DOCUMENT_VERSION_UPDATED',
  CASE_NOTE_ADDED = 'CASE_NOTE_ADDED',
  CASE_NOTE_UPDATED = 'CASE_NOTE_UPDATED',
  INVOICE_CREATED = 'INVOICE_CREATED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  EXPENSE_SUBMITTED = 'EXPENSE_SUBMITTED',
  LEAD_STATUS_CHANGED = 'LEAD_STATUS_CHANGED',
  LEAD_ASSIGNED = 'LEAD_ASSIGNED',
  INTAKE_FORM_SUBMITTED = 'INTAKE_FORM_SUBMITTED',
  CALENDAR_EVENT_CREATED = 'CALENDAR_EVENT_CREATED',
  CALENDAR_EVENT_UPDATED = 'CALENDAR_EVENT_UPDATED'
}

export interface NotificationEvent {
  type: EventType;
  entityId: number | string;
  entityType: string;
  triggeredBy?: {
    id: number | string;
    name: string;
    email?: string;
  };
  data: {
    [key: string]: any;
  };
  metadata?: {
    [key: string]: any;
  };
}

@Injectable({
  providedIn: 'root'
})
export class NotificationTriggerService {

  constructor(
    private notificationManager: NotificationManagerService,
    private notificationTemplates: NotificationTemplatesService,
    private notificationPreferences: NotificationPreferencesService,
    private smartTargeting: SmartNotificationTargetingService,
    private userService: UserService
  ) { }

  /**
   * Trigger a notification based on an event
   */
  async triggerNotification(event: NotificationEvent): Promise<void> {
    try {
      
      // Get current user if not provided
      let triggeredBy = event.triggeredBy;
      if (!triggeredBy) {
        const currentUser = this.userService.getCurrentUser();
        triggeredBy = {
          id: currentUser?.id || 0,
          name: currentUser?.firstName && currentUser?.lastName 
            ? `${currentUser.firstName} ${currentUser.lastName}`
            : currentUser?.email || 'System',
          email: currentUser?.email
        };
      }

      // Determine recipients based on event type and entity
      const allRecipients = await this.getEventRecipients(event);
      
      // Exclude the triggering user from recipients (users shouldn't get notifications for their own actions)
      const currentUserId = triggeredBy.id;
      const recipients = {
        primaryUsers: allRecipients.primaryUsers.filter(user => user.id !== currentUserId),
        secondaryUsers: allRecipients.secondaryUsers.filter(user => user.id !== currentUserId)
      };

      // Skip notification if no recipients after filtering
      if (recipients.primaryUsers.length === 0 && recipients.secondaryUsers.length === 0) {
        return;
      }
      
      // Build notification context
      const notificationContext: NotificationContext = {
        userName: triggeredBy.name,
        caseId: event.entityType === 'case' ? Number(event.entityId) : event.data.caseId,
        caseName: event.data.caseName,
        caseNumber: event.data.caseNumber,
        section: this.getEventSection(event.type),
        area: this.getEventArea(event.type),
        timestamp: new Date().toISOString(),
        additionalInfo: {
          ...event.data,
          ...event.metadata,
          triggeredBy
        }
      };

      // Generate notification using templates
      const category = this.getNotificationCategory(event.type);
      const notification = this.notificationTemplates.generateNotificationByCategory(category, notificationContext);
      
      // Map notification priority to system priority
      const priority = this.mapNotificationPriority(notification.priority);
      
      // Send notification
      await this.notificationManager.sendNotification(
        category,
        notification.title,
        notification.message,
        priority,
        recipients,
        this.getEventUrl(event),
        {
          entityId: Number(event.entityId),
          entityType: event.entityType,
          triggeredBy: {
            id: Number(triggeredBy.id),
            name: triggeredBy.name,
            email: triggeredBy.email || ''
          },
          additionalData: {
            ...event.data,
            template: {
              icon: notification.icon,
              priority: notification.priority,
              category
            },
            context: notificationContext
          }
        }
      );
    } catch (error) {
      console.error('❌ Failed to trigger notification for event:', event.type, error);
    }
  }

  /**
   * Get recipients for an event based on the event type and entity
   */
  private async getEventRecipients(event: NotificationEvent): Promise<{ primaryUsers: any[], secondaryUsers: any[] }> {
    const recipients = { primaryUsers: [] as any[], secondaryUsers: [] as any[] };

    switch (event.type) {
      case EventType.CASE_STATUS_CHANGED:
      case EventType.CASE_PRIORITY_CHANGED:
        // Notify all case team members for status/priority changes
        if (event.entityType === 'case') {
          const caseTeamMembers = await this.notificationManager.getCaseTeamMembers(Number(event.entityId));
          recipients.primaryUsers = caseTeamMembers;
          
          // Also notify supervisors/managers for critical changes
          if (event.data.newStatus === 'CLOSED' || event.data.newPriority === 'URGENT') {
            const supervisors = await this.notificationManager.getUsersByRole('MANAGER');
            const attorneys = await this.notificationManager.getUsersByRole('ATTORNEY');
            const admins = await this.notificationManager.getUsersByRole('ADMIN');
            recipients.secondaryUsers = [...supervisors, ...attorneys, ...admins];
          }
        }
        break;

      case EventType.CASE_ASSIGNMENT_ADDED:
        // Notify the new assignee and existing case team
        if (event.data.assigneeId) {
          // TODO: Get user by ID when available
          // const newAssignee = await this.userService.getUserById(event.data.assigneeId);
          // recipients.primaryUsers = [newAssignee];
        }
        if (event.entityType === 'case') {
          const caseTeamMembers = await this.notificationManager.getCaseTeamMembers(Number(event.entityId));
          recipients.secondaryUsers = caseTeamMembers;
        }
        break;

      case EventType.CASE_ASSIGNMENT_REMOVED:
        // Notify the removed assignee and remaining case team
        if (event.entityType === 'case') {
          const caseTeamMembers = await this.notificationManager.getCaseTeamMembers(Number(event.entityId));
          recipients.primaryUsers = caseTeamMembers;
        }
        break;

      default:
        // Default: notify case team members if case-related, otherwise all users
        if (event.data.caseId) {
          const caseTeamMembers = await this.notificationManager.getCaseTeamMembers(event.data.caseId);
          recipients.primaryUsers = caseTeamMembers;
        } else {
          // For non-case events, notify relevant role groups
          const relevantUsers = await this.getRelevantUsersByEventType(event.type);
          recipients.primaryUsers = relevantUsers;
        }
        break;
    }

    return recipients;
  }

  /**
   * Get relevant users based on event type - Enhanced with flexible role matching
   */
  private async getRelevantUsersByEventType(eventType: EventType): Promise<any[]> {
    console.log(`🔍 🎯 Getting relevant users for event type: ${eventType}`);
    
    try {
      let relevantUsers: any[] = [];
      
      switch (eventType) {
        case EventType.INVOICE_CREATED:
        case EventType.PAYMENT_RECEIVED:
        case EventType.EXPENSE_SUBMITTED:
          console.log(`🔍 🎯 Financial event - getting managers, attorneys, finance team`);
          // Financial events: notify managers, attorneys, and finance team (using enhanced role matching)
          const managers = await this.notificationManager.getUsersByRole('MANAGER');
          const attorneys = await this.notificationManager.getUsersByRole('ATTORNEY');
          const finance = await this.notificationManager.getUsersByRole('FINANCE_MANAGER');
          const admins = await this.notificationManager.getUsersByRole('ADMIN'); // Include admins for financial oversight
          relevantUsers = [...managers, ...attorneys, ...finance, ...admins];
          break;

        case EventType.LEAD_STATUS_CHANGED:
        case EventType.LEAD_ASSIGNED:
        case EventType.INTAKE_FORM_SUBMITTED:
          console.log(`🔍 🎯 CRM event - getting attorneys, managers, paralegals`);
          // CRM events: notify attorneys, managers, and paralegals (who often handle intake)
          const crmAttorneys = await this.notificationManager.getUsersByRole('ATTORNEY');
          const crmManagers = await this.notificationManager.getUsersByRole('MANAGER');
          const paralegals = await this.notificationManager.getUsersByRole('PARALEGAL');
          const crmAdmins = await this.notificationManager.getUsersByRole('ADMIN');
          relevantUsers = [...crmAttorneys, ...crmManagers, ...paralegals, ...crmAdmins];
          break;

        case EventType.TASK_CREATED:
        case EventType.TASK_STATUS_CHANGED:
        case EventType.TASK_ASSIGNED:
        case EventType.DEADLINE_APPROACHING:
          console.log(`🔍 🎯 Task event - getting attorneys, managers, paralegals`);
          // Task events: notify attorneys, managers, and paralegals
          const taskAttorneys = await this.notificationManager.getUsersByRole('ATTORNEY');
          const taskManagers = await this.notificationManager.getUsersByRole('MANAGER');
          const taskParalegals = await this.notificationManager.getUsersByRole('PARALEGAL');
          const taskAdmins = await this.notificationManager.getUsersByRole('ADMIN');
          relevantUsers = [...taskAttorneys, ...taskManagers, ...taskParalegals, ...taskAdmins];
          break;

        case EventType.DOCUMENT_UPLOADED:
        case EventType.DOCUMENT_VERSION_UPDATED:
          console.log(`🔍 🎯 Document event - getting attorneys, paralegals, managers`);
          // Document events: notify attorneys, paralegals, and managers
          const docAttorneys = await this.notificationManager.getUsersByRole('ATTORNEY');
          const docManagers = await this.notificationManager.getUsersByRole('MANAGER');
          const docParalegals = await this.notificationManager.getUsersByRole('PARALEGAL');
          const docAdmins = await this.notificationManager.getUsersByRole('ADMIN');
          relevantUsers = [...docAttorneys, ...docManagers, ...docParalegals, ...docAdmins];
          break;

        case EventType.CALENDAR_EVENT_CREATED:
        case EventType.CALENDAR_EVENT_UPDATED:
          console.log(`🔍 🎯 Calendar event - getting all team members`);
          // Calendar events: notify all team members who need to be aware of schedule changes
          const calAttorneys = await this.notificationManager.getUsersByRole('ATTORNEY');
          const calManagers = await this.notificationManager.getUsersByRole('MANAGER');
          const calParalegals = await this.notificationManager.getUsersByRole('PARALEGAL');
          const calSecretaries = await this.notificationManager.getUsersByRole('SECRETARY');
          const calAdmins = await this.notificationManager.getUsersByRole('ADMIN');
          relevantUsers = [...calAttorneys, ...calManagers, ...calParalegals, ...calSecretaries, ...calAdmins];
          break;

        default:
          console.log(`🔍 🎯 Default/unknown event - getting all eligible users`);
          // Default: Use comprehensive fallback to ensure everyone gets notified
          relevantUsers = await this.notificationManager.getAllEligibleUsers();
          break;
      }
      
      // Remove duplicates based on user ID
      const uniqueUsers = relevantUsers.filter((user, index, arr) => 
        arr.findIndex(u => u.id === user.id) === index
      );
      
      console.log(`🔍 🎯 Event ${eventType} - Found ${uniqueUsers.length} relevant users:`);
      uniqueUsers.forEach(user => {
        console.log(`🔍 🎯   - ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.roleName}`);
        
        // Special attention for Jennifer Rodriguez
        if (user.firstName?.toLowerCase().includes('jennifer') || user.lastName?.toLowerCase().includes('rodriguez')) {
          console.log(`🎯 🎯 🎯 JENNIFER RODRIGUEZ FOUND IN RECIPIENT LIST FOR ${eventType} 🎯 🎯 🎯`);
        }
      });
      
      return uniqueUsers;
      
    } catch (error) {
      console.error(`🔍 🎯 Failed to get relevant users for event ${eventType}:`, error);
      
      // Fallback: return all eligible users to ensure notifications still go out
      console.log(`🔍 🎯 Using fallback - all eligible users`);
      return await this.notificationManager.getAllEligibleUsers();
    }
  }

  /**
   * Map event type to notification category
   */
  private getNotificationCategory(eventType: EventType): NotificationCategory {
    switch (eventType) {
      case EventType.CASE_STATUS_CHANGED:
      case EventType.CASE_PRIORITY_CHANGED:
      case EventType.CASE_ASSIGNMENT_ADDED:
      case EventType.CASE_ASSIGNMENT_REMOVED:
      case EventType.CASE_NOTE_ADDED:
      case EventType.CASE_NOTE_UPDATED:
      case EventType.TASK_CREATED:
      case EventType.TASK_STATUS_CHANGED:
      case EventType.TASK_ASSIGNED:
      case EventType.TASK_COMPLETED:
        return NotificationCategory.CASE_MANAGEMENT;
      case EventType.DOCUMENT_UPLOADED:
      case EventType.DOCUMENT_VERSION_UPDATED:
        return NotificationCategory.FILES;
      case EventType.INVOICE_CREATED:
      case EventType.PAYMENT_RECEIVED:
      case EventType.EXPENSE_SUBMITTED:
        return NotificationCategory.BILLING;
      case EventType.LEAD_STATUS_CHANGED:
      case EventType.LEAD_ASSIGNED:
      case EventType.INTAKE_FORM_SUBMITTED:
        return NotificationCategory.CRM;
      case EventType.CALENDAR_EVENT_CREATED:
      case EventType.CALENDAR_EVENT_UPDATED:
        return NotificationCategory.CALENDAR;
      default:
        return NotificationCategory.SYSTEM;
    }
  }

  /**
   * Get event section for context
   */
  private getEventSection(eventType: EventType): string {
    if (eventType.toString().startsWith('CASE_')) {
      return 'Legal Cases';
    } else if (eventType.toString().startsWith('TASK_')) {
      return 'Task Management';
    } else if (eventType.toString().startsWith('DOCUMENT_')) {
      return 'Document Management';
    } else if (eventType.toString().startsWith('INVOICE_') || eventType.toString().startsWith('PAYMENT_') || eventType.toString().startsWith('EXPENSE_')) {
      return 'Financial Management';
    } else if (eventType.toString().startsWith('LEAD_') || eventType === EventType.INTAKE_FORM_SUBMITTED) {
      return 'CRM';
    } else if (eventType.toString().startsWith('CALENDAR_')) {
      return 'Calendar';
    }
    return 'System';
  }

  /**
   * Get event area for context
   */
  private getEventArea(eventType: EventType): string {
    if (eventType.toString().startsWith('CASE_') || eventType.toString().startsWith('TASK_')) {
      return 'Case Management';
    } else if (eventType.toString().startsWith('DOCUMENT_')) {
      return 'File Manager';
    } else if (eventType.toString().startsWith('INVOICE_') || eventType.toString().startsWith('PAYMENT_') || eventType.toString().startsWith('EXPENSE_')) {
      return 'Financial Management';
    } else if (eventType.toString().startsWith('LEAD_') || eventType === EventType.INTAKE_FORM_SUBMITTED) {
      return 'Customer Relations';
    } else if (eventType.toString().startsWith('CALENDAR_')) {
      return 'Calendar Management';
    }
    return 'System Administration';
  }

  /**
   * Get URL for the event entity
   */
  private getEventUrl(event: NotificationEvent): string {
    switch (event.entityType) {
      case 'case':
        return `/legal/cases/details/${event.entityId}`;
      case 'task':
        return `/case-task/management`;
      case 'document':
        return `/file-manager`;
      case 'invoice':
        return `/invoice/detail/${event.entityId}`;
      case 'lead':
        return `/crm/leads`;
      case 'calendar_event':
        return `/legal/calendar`;
      default:
        return '/dashboard';
    }
  }

  /**
   * Map template notification priority to system priority
   */
  private mapNotificationPriority(templatePriority: 'low' | 'normal' | 'high' | 'critical'): NotificationPriority {
    switch (templatePriority) {
      case 'low':
        return NotificationPriority.LOW;
      case 'normal':
        return NotificationPriority.NORMAL;
      case 'high':
        return NotificationPriority.HIGH;
      case 'critical':
        return NotificationPriority.CRITICAL;
      default:
        return NotificationPriority.NORMAL;
    }
  }

  /**
   * SMART TARGETING: Enhanced case status change with role-based targeting
   */
  async triggerSmartCaseStatusChanged(caseId: number, oldStatus: string, newStatus: string, caseName?: string, caseNumber?: string, casePriority?: string): Promise<void> {
    try {
      console.log(`🎯 Smart case status notification: ${caseName} (${oldStatus} → ${newStatus})`);

      // Use smart targeting to get appropriate recipients
      const smartContext: SmartNotificationContext = {
        eventType: SmartEventType.CASE_STATUS_CHANGED,
        caseId,
        oldStatus,
        newStatus,
        casePriority
      };

      const recipients = await this.smartTargeting.getSmartRecipients(smartContext);
      
      console.log(`🎯 Smart recipients: ${recipients.primaryUsers.length} primary, ${recipients.secondaryUsers.length} secondary`);

      if (recipients.primaryUsers.length === 0 && recipients.secondaryUsers.length === 0) {
        console.log('🎯 No recipients found, skipping notification');
        return;
      }

      // Get template and send notification
      const notificationContext: NotificationContext = {
        userName: this.userService.getCurrentUser()?.firstName + ' ' + this.userService.getCurrentUser()?.lastName || 'System',
        caseId,
        caseName: caseName || `Case #${caseId}`,
        caseNumber,
        section: 'case_status',
        additionalInfo: { oldStatus, newStatus }
      };

      const template = this.notificationTemplates.generateCaseStatusChangeNotification(notificationContext);
      const { title, message, priority } = template;

      await this.notificationManager.sendNotification(
        NotificationCategory.CASE_MANAGEMENT,
        title,
        message,
        this.mapNotificationPriority(priority),
        recipients,
        `/legal/cases/details/${caseId}`,
        notificationContext
      );

      console.log(`🎯 ✅ Smart case status notification sent successfully`);

    } catch (error) {
      console.error('🎯 ❌ Failed to send smart case status notification:', error);
    }
  }

  /**
   * SMART TARGETING: Enhanced task notification with role-based targeting
   */
  async triggerSmartTaskCreated(taskId: number, taskTitle: string, taskType: string, assigneeId?: number, caseId?: number, caseName?: string): Promise<void> {
    try {
      const smartContext: SmartNotificationContext = {
        eventType: SmartEventType.TASK_CREATED,
        caseId,
        taskType,
        assigneeId
      };

      const recipients = await this.smartTargeting.getSmartRecipients(smartContext);
      
      if (recipients.primaryUsers.length === 0 && recipients.secondaryUsers.length === 0) {
        return;
      }

      const notificationContext: NotificationContext = {
        userName: this.userService.getCurrentUser()?.firstName + ' ' + this.userService.getCurrentUser()?.lastName || 'System',
        caseId,
        caseName,
        section: 'task_created',
        additionalInfo: { taskId, taskTitle, taskType }
      };

      const template = this.notificationTemplates.generateTaskCreatedNotification(notificationContext);
      const { title, message, priority } = template;

      await this.notificationManager.sendNotification(
        NotificationCategory.CASE_MANAGEMENT,
        title,
        message,
        this.mapNotificationPriority(priority),
        recipients,
        `/case-task/management`,
        notificationContext
      );

    } catch (error) {
      console.error('Failed to send smart task notification:', error);
    }
  }

  /**
   * SMART TARGETING: Enhanced financial notification with amount-based targeting
   */
  async triggerSmartInvoiceCreated(invoiceId: number, invoiceNumber: string, amount: number, clientName: string): Promise<void> {
    try {
      const smartContext: SmartNotificationContext = {
        eventType: SmartEventType.INVOICE_CREATED,
        amount
      };

      const recipients = await this.smartTargeting.getSmartRecipients(smartContext);
      
      if (recipients.primaryUsers.length === 0 && recipients.secondaryUsers.length === 0) {
        return;
      }

      const notificationContext: NotificationContext = {
        userName: this.userService.getCurrentUser()?.firstName + ' ' + this.userService.getCurrentUser()?.lastName || 'System',
        section: 'invoice',
        additionalInfo: { invoiceId, invoiceNumber, amount, clientName }
      };

      const template = this.notificationTemplates.generateInvoiceNotification(notificationContext);
      const { title, message, priority } = template;

      await this.notificationManager.sendNotification(
        NotificationCategory.BILLING,
        title,
        message,
        this.mapNotificationPriority(priority),
        recipients,
        `/invoice/detail/${invoiceId}`,
        notificationContext
      );

    } catch (error) {
      console.error('Failed to send smart invoice notification:', error);
    }
  }

  /**
   * LEGACY: Convenience methods for common events (keeping for compatibility)
   */
  async triggerCaseStatusChanged(caseId: number, oldStatus: string, newStatus: string, caseName?: string, caseNumber?: string): Promise<void> {
    await this.triggerNotification({
      type: EventType.CASE_STATUS_CHANGED,
      entityId: caseId,
      entityType: 'case',
      data: {
        oldStatus,
        newStatus,
        caseName,
        caseNumber,
        caseId
      }
    });
  }

  async triggerCasePriorityChanged(caseId: number, oldPriority: string, newPriority: string, caseName?: string, caseNumber?: string): Promise<void> {
    await this.triggerNotification({
      type: EventType.CASE_PRIORITY_CHANGED,
      entityId: caseId,
      entityType: 'case',
      data: {
        oldPriority,
        newPriority,
        caseName,
        caseNumber,
        caseId
      }
    });
  }

  async triggerCaseAssignmentAdded(caseId: number, assigneeId: number, assigneeName: string, roleType: string, caseName?: string, caseNumber?: string): Promise<void> {
    await this.triggerNotification({
      type: EventType.CASE_ASSIGNMENT_ADDED,
      entityId: caseId,
      entityType: 'case',
      data: {
        assigneeId,
        assigneeName,
        roleType,
        caseName,
        caseNumber,
        caseId
      }
    });
  }

  async triggerCaseAssignmentRemoved(caseId: number, assigneeName: string, caseName?: string, caseNumber?: string): Promise<void> {
    await this.triggerNotification({
      type: EventType.CASE_ASSIGNMENT_REMOVED,
      entityId: caseId,
      entityType: 'case',
      data: {
        assigneeName,
        caseName,
        caseNumber,
        caseId
      }
    });
  }

  /**
   * Trigger personalized case assignment removal notifications
   * Sends different messages to the removed user vs other team members
   */
  async triggerCaseUnassignmentWithPersonalizedMessages(
    caseId: number, 
    removedUserId: number,
    removedUserName: string, 
    caseName?: string, 
    caseNumber?: string,
    reason?: string
  ): Promise<void> {
    try {
      const currentUser = this.userService.getCurrentUser();
      const removerName = currentUser?.firstName && currentUser?.lastName 
        ? `${currentUser.firstName} ${currentUser.lastName}`
        : currentUser?.email || 'System';

      // Get case team members (excluding the remover who performed the action)
      const allTeamMembers = await this.notificationManager.getCaseTeamMembers(caseId);
      const otherTeamMembers = allTeamMembers.filter(member => member.id !== currentUser?.id);
      
      // Separate the removed user from other team members
      const removedUser = otherTeamMembers.find(member => member.id === removedUserId);
      const remainingTeamMembers = otherTeamMembers.filter(member => member.id !== removedUserId);

      // Send notification to the removed user (personalized: "You were removed")
      if (removedUser) {
        await this.notificationManager.sendNotification(
          NotificationCategory.CASE_MANAGEMENT,
          '🚫 Unassigned from Case',
          `${removerName} removed you from case "${caseName || `Case #${caseId}`}"${reason ? ` - ${reason}` : ''}`,
          NotificationPriority.HIGH,
          {
            primaryUsers: [removedUser],
            secondaryUsers: []
          },
          `/legal/cases/details/${caseId}`,
          {
            entityId: caseId,
            entityType: 'case',
            triggeredBy: {
              id: Number(currentUser?.id || 0),
              name: removerName,
              email: currentUser?.email || ''
            },
            additionalData: {
              caseName: caseName || `Case #${caseId}`,
              caseNumber,
              removedUserName,
              reason,
              eventType: 'CASE_UNASSIGNMENT_PERSONAL'
            }
          }
        );
      }

      // Send notification to remaining team members (general: "X was removed")
      if (remainingTeamMembers.length > 0) {
        await this.notificationManager.sendNotification(
          NotificationCategory.CASE_MANAGEMENT,
          '👤 Team Member Unassigned',
          `${removerName} unassigned ${removedUserName} from case "${caseName || `Case #${caseId}`}"${reason ? ` - ${reason}` : ''}`,
          NotificationPriority.NORMAL,
          {
            primaryUsers: remainingTeamMembers,
            secondaryUsers: []
          },
          `/legal/cases/details/${caseId}`,
          {
            entityId: caseId,
            entityType: 'case',
            triggeredBy: {
              id: Number(currentUser?.id || 0),
              name: removerName,
              email: currentUser?.email || ''
            },
            additionalData: {
              caseName: caseName || `Case #${caseId}`,
              caseNumber,
              removedUserName,
              reason,
              eventType: 'CASE_UNASSIGNMENT_TEAM'
            }
          }
        );
      }

      console.log(`✅ Personalized unassignment notifications sent:`, {
        removedUser: removedUserName,
        case: caseName || `Case #${caseId}`,
        removedBy: removerName,
        recipientCounts: {
          removedUser: removedUser ? 1 : 0,
          teamMembers: remainingTeamMembers.length
        }
      });

    } catch (error) {
      console.error('❌ Failed to send personalized case unassignment notifications:', error);
      throw error;
    }
  }

  async triggerTaskCreated(taskId: number, taskTitle: string, assigneeName: string, caseId?: number, caseName?: string, dueDate?: string): Promise<void> {
    await this.triggerNotification({
      type: EventType.TASK_CREATED,
      entityId: taskId,
      entityType: 'task',
      data: {
        taskTitle,
        assigneeName,
        caseId,
        caseName,
        dueDate
      }
    });
  }

  /**
   * Trigger personalized task assignment notifications
   * Sends different messages to the assigned user vs other team members
   */
  async triggerTaskAssignmentWithPersonalizedMessages(
    taskId: number, 
    taskTitle: string,
    assignedUserId: number,
    assignedUserName: string,
    caseId?: number,
    caseName?: string,
    dueDate?: string,
    priority?: string
  ): Promise<void> {
    try {
      const currentUser = this.userService.getCurrentUser();
      const assignerName = currentUser?.firstName && currentUser?.lastName 
        ? `${currentUser.firstName} ${currentUser.lastName}`
        : currentUser?.email || 'System';

      // Get case team members (excluding the assigner who performed the action)
      let allTeamMembers: any[] = [];
      if (caseId) {
        allTeamMembers = await this.notificationManager.getCaseTeamMembers(caseId);
      } else {
        // If no case, get all users (fallback)
        // If no case, get all eligible users as fallback
        allTeamMembers = await this.notificationManager.getAllEligibleUsers();
      }
      
      const otherTeamMembers = allTeamMembers.filter(member => member.id !== currentUser?.id);
      
      // Separate the assigned user from other team members
      const assignedUser = otherTeamMembers.find(member => member.id === assignedUserId);
      const remainingTeamMembers = otherTeamMembers.filter(member => member.id !== assignedUserId);

      const caseContext = caseName ? ` for case "${caseName}"` : caseId ? ` for Case #${caseId}` : '';
      const dueDateText = dueDate ? ` (due ${dueDate})` : '';
      const priorityEmoji = priority === 'HIGH' ? '🔥 ' : priority === 'URGENT' ? '🚨 ' : '';

      // Send notification to the assigned user (personalized: "You have been assigned")
      if (assignedUser) {
        await this.notificationManager.sendNotification(
          NotificationCategory.CASE_MANAGEMENT,
          `${priorityEmoji}📋 Task Assigned`,
          `${assignerName} assigned you task "${taskTitle}"${caseContext}${dueDateText}`,
          priority === 'URGENT' ? NotificationPriority.CRITICAL : priority === 'HIGH' ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
          {
            primaryUsers: [assignedUser],
            secondaryUsers: []
          },
          caseId ? `/legal/cases/details/${caseId}` : `/case-management/tasks/${taskId}`,
          {
            entityId: taskId,
            entityType: 'task',
            triggeredBy: {
              id: Number(currentUser?.id || 0),
              name: assignerName,
              email: currentUser?.email || ''
            },
            additionalData: {
              taskTitle,
              taskId,
              assignedUserId,
              assignedUserName,
              caseName: caseName || `Case #${caseId}`,
              caseId,
              dueDate,
              priority,
              eventType: 'TASK_ASSIGNMENT_PERSONAL',
              // Rich detail for notification details modal
              taskDetails: {
                assignedTo: assignedUserName,
                taskCount: 1,
                assignmentDate: new Date().toISOString(),
                case: caseName || (caseId ? `Case #${caseId}` : 'No case'),
                caseNumber: caseId ? caseId.toString() : undefined
              }
            }
          }
        );
      }

      // Send notification to remaining team members (general: "X was assigned task Y")
      if (remainingTeamMembers.length > 0) {
        await this.notificationManager.sendNotification(
          NotificationCategory.CASE_MANAGEMENT,
          '📝 Task Assignment',
          `${assignerName} assigned "${taskTitle}" to ${assignedUserName}${caseContext}${dueDateText}`,
          NotificationPriority.NORMAL,
          {
            primaryUsers: remainingTeamMembers,
            secondaryUsers: []
          },
          caseId ? `/legal/cases/details/${caseId}` : `/case-management/tasks/${taskId}`,
          {
            entityId: taskId,
            entityType: 'task',
            triggeredBy: {
              id: Number(currentUser?.id || 0),
              name: assignerName,
              email: currentUser?.email || ''
            },
            additionalData: {
              taskTitle,
              taskId,
              assignedUserId,
              assignedUserName,
              caseName: caseName || `Case #${caseId}`,
              caseId,
              dueDate,
              priority,
              eventType: 'TASK_ASSIGNMENT_TEAM',
              // Rich detail for notification details modal
              taskDetails: {
                assignedTo: assignedUserName,
                taskCount: 1,
                assignmentDate: new Date().toISOString(),
                case: caseName || (caseId ? `Case #${caseId}` : 'No case'),
                caseNumber: caseId ? caseId.toString() : undefined
              }
            }
          }
        );
      }

    } catch (error) {
      console.error('❌ Failed to send personalized task assignment notifications:', error);
      throw error;
    }
  }

  async triggerTaskStatusChanged(taskId: number, taskTitle: string, oldStatus: string, newStatus: string, caseId?: number, caseName?: string): Promise<void> {
    await this.triggerNotification({
      type: EventType.TASK_STATUS_CHANGED,
      entityId: taskId,
      entityType: 'task',
      data: {
        taskTitle,
        oldStatus,
        newStatus,
        caseId,
        caseName
      }
    });
  }

  async triggerDocumentVersionUpdated(documentId: number, fileName: string, versionNumber: string, caseId?: number, caseName?: string): Promise<void> {
    await this.triggerNotification({
      type: EventType.DOCUMENT_VERSION_UPDATED,
      entityId: documentId,
      entityType: 'document',
      data: {
        fileName,
        versionNumber,
        caseId,
        caseName
      }
    });
  }

  async triggerCaseNoteAdded(caseId: number, noteTitle: string, notePreview: string, caseName?: string, caseNumber?: string): Promise<void> {
    await this.triggerNotification({
      type: EventType.CASE_NOTE_ADDED,
      entityId: caseId,
      entityType: 'case',
      data: {
        noteTitle,
        notePreview,
        action: 'added',
        caseId,
        caseName,
        caseNumber
      }
    });
  }

  async triggerInvoiceCreated(invoiceId: number, invoiceNumber: string, amount: string, clientName?: string): Promise<void> {
    await this.triggerNotification({
      type: EventType.INVOICE_CREATED,
      entityId: invoiceId,
      entityType: 'invoice',
      data: {
        invoiceNumber,
        action: 'created',
        amount,
        clientName
      }
    });
  }

  async triggerPaymentReceived(paymentId: number, amount: string, invoiceNumber: string, clientName: string, paymentMethod?: string): Promise<void> {
    await this.triggerNotification({
      type: EventType.PAYMENT_RECEIVED,
      entityId: paymentId,
      entityType: 'payment',
      data: {
        amount,
        invoiceNumber,
        clientName,
        paymentMethod
      }
    });
  }

  async triggerLeadStatusChanged(leadId: number, leadName: string, oldStatus: string, newStatus: string): Promise<void> {
    await this.triggerNotification({
      type: EventType.LEAD_STATUS_CHANGED,
      entityId: leadId,
      entityType: 'lead',
      data: {
        leadName,
        oldStatus,
        newStatus
      }
    });
  }

  async triggerIntakeFormSubmitted(formId: number, clientName: string, caseType: string, priority?: string): Promise<void> {
    await this.triggerNotification({
      type: EventType.INTAKE_FORM_SUBMITTED,
      entityId: formId,
      entityType: 'intake_form',
      data: {
        clientName,
        caseType,
        submissionTime: new Date().toLocaleString(),
        priority: priority || 'normal'
      }
    });
  }

  async triggerCalendarEventCreated(eventId: number, eventTitle: string, eventTime: string): Promise<void> {
    await this.triggerNotification({
      type: EventType.CALENDAR_EVENT_CREATED,
      entityId: eventId,
      entityType: 'calendar_event',
      data: {
        eventTitle,
        eventTime,
        action: 'scheduled'
      }
    });
  }

  async triggerExpenseSubmitted(expenseId: number, amount: number, category: string, clientName: string, description: string): Promise<void> {
    await this.triggerNotification({
      type: EventType.EXPENSE_SUBMITTED,
      entityId: expenseId,
      entityType: 'expense',
      data: {
        expenseId,
        amount,
        category,
        clientName,
        description
      },
      metadata: {
        expenseId,
        amount,
        category,
        clientName
      }
    });
  }

  async triggerDeadlineAlert(taskId: number, taskTitle: string, daysRemaining: number, caseId?: number, caseName?: string, assignedToId?: number, assigneeName?: string): Promise<void> {
    await this.triggerNotification({
      type: EventType.DEADLINE_APPROACHING,
      entityId: taskId,
      entityType: 'task',
      data: {
        taskId,
        taskTitle,
        daysRemaining,
        caseId,
        caseName,
        assignedToId,
        assigneeName
      },
      metadata: {
        taskId,
        taskTitle,
        daysRemaining,
        urgency: daysRemaining <= 0 ? 'overdue' : daysRemaining === 1 ? 'critical' : 'warning'
      }
    });
  }
}