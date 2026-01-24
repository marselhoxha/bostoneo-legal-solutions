import { Injectable } from '@angular/core';

export interface NotificationTemplate {
  title: string;
  message: string;
  icon?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

export interface NotificationContext {
  userName: string;
  userRole?: string;
  fileName?: string;
  fileCount?: number;
  caseName?: string;
  caseNumber?: string;
  caseId?: number;
  section?: string;
  area?: string;
  timestamp?: string;
  additionalInfo?: any;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationTemplatesService {

  constructor() { }

  /**
   * Helper method to get enhanced case name with fallbacks
   */
  private getEnhancedCaseName(context: NotificationContext): string {
    // Prioritize actual case name from context
    let caseName = context.caseName;
    if (!caseName || caseName.trim() === '') {
      // Fallback: try to get case name from additional info
      caseName = context.additionalInfo?.caseName;
    }
    if (!caseName || caseName.trim() === '') {
      // Final fallback: use case number if available, otherwise generic
      if (context.caseNumber) {
        caseName = `Case ${context.caseNumber}`;
      } else {
        caseName = `Case #${context.caseId}`;
      }
    }
    return caseName;
  }

  /**
   * Generate a professional notification template for file uploads
   */
  generateFileUploadNotification(context: NotificationContext): NotificationTemplate {
    const { userName, fileName, fileCount, caseName, caseNumber, area, section } = context;
    
    let title = '';
    let message = '';
    
    if (fileCount && fileCount > 1) {
      // Multiple files
      title = `📁 ${fileCount} Documents Uploaded`;
      if (caseName) {
        message = `${userName} uploaded ${fileCount} documents to case "${caseName}"`;
      } else if (caseNumber) {
        message = `${userName} uploaded ${fileCount} documents to case ${caseNumber}`;
      } else {
        message = `${userName} uploaded ${fileCount} documents to ${section || 'File Manager'}`;
      }
    } else {
      // Single file
      title = `📄 Document Uploaded`;
      if (caseName) {
        message = `${userName} uploaded "${fileName}" to case "${caseName}"`;
      } else if (caseNumber) {
        message = `${userName} uploaded "${fileName}" to case ${caseNumber}`;
      } else {
        message = `${userName} uploaded "${fileName}" to ${section || 'File Manager'}`;
      }
    }

    return {
      title,
      message,
      icon: 'ri-file-upload-line',
      priority: 'normal'
    };
  }

  /**
   * Generate a professional notification template for case assignments
   */
  generateCaseAssignmentNotification(context: NotificationContext): NotificationTemplate {
    const { userName, caseName, caseNumber, additionalInfo } = context;
    const assigneeName = additionalInfo?.assigneeName || 'a team member';
    
    let title = '👩‍💼 Case Assignment';
    let message = '';
    
    if (caseName) {
      message = `${userName} assigned ${assigneeName} to case "${caseName}"`;
    } else if (caseNumber) {
      message = `${userName} assigned ${assigneeName} to case ${caseNumber}`;
    } else {
      message = `${userName} made a case assignment`;
    }

    return {
      title,
      message,
      icon: 'ri-user-add-line',
      priority: 'high'
    };
  }

  /**
   * Generate a professional notification template for task assignments
   */
  generateTaskAssignmentNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const taskTitle = additionalInfo?.taskTitle || 'a new task';
    const assigneeName = additionalInfo?.assigneeName || 'you';
    
    return {
      title: '✅ Task Assigned',
      message: `${userName} assigned "${taskTitle}" to ${assigneeName}`,
      icon: 'ri-task-line',
      priority: 'normal'
    };
  }

  /**
   * Generate a professional notification template for deadlines
   */
  generateDeadlineNotification(context: NotificationContext): NotificationTemplate {
    const { additionalInfo } = context;
    const daysRemaining = additionalInfo?.daysRemaining || 0;
    const taskTitle = additionalInfo?.taskTitle || 'task';
    const caseName = additionalInfo?.caseName;
    
    let urgencyIcon = '⏰';
    let priority: 'low' | 'normal' | 'high' | 'critical' = 'normal';
    
    if (daysRemaining <= 1) {
      urgencyIcon = '🚨';
      priority = 'critical';
    } else if (daysRemaining <= 3) {
      urgencyIcon = '⚠️';
      priority = 'high';
    }
    
    let message = `${taskTitle} is due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
    if (caseName) {
      message += ` for case "${caseName}"`;
    }

    return {
      title: `${urgencyIcon} Deadline Approaching`,
      message,
      icon: 'ri-alarm-warning-line',
      priority
    };
  }

  /**
   * Generate a professional notification template for lead activities
   */
  generateLeadActivityNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const leadName = additionalInfo?.leadName || 'a lead';
    const activity = additionalInfo?.activity || 'updated';
    
    return {
      title: '🎯 Lead Activity',
      message: `${userName} ${activity} lead "${leadName}"`,
      icon: 'ri-user-star-line',
      priority: 'normal'
    };
  }

  /**
   * Generate a professional notification template for client updates
   */
  generateClientUpdateNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const clientName = additionalInfo?.clientName || 'a client';
    const updateType = additionalInfo?.updateType || 'updated';
    
    return {
      title: '👥 Client Update',
      message: `${userName} ${updateType} client "${clientName}"`,
      icon: 'ri-user-line',
      priority: 'normal'
    };
  }

  /**
   * Generate a professional notification template for invoice activities
   */
  generateInvoiceNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const invoiceNumber = additionalInfo?.invoiceNumber || '#INV-XXX';
    const action = additionalInfo?.action || 'created';
    const amount = additionalInfo?.amount;
    
    let message = `${userName} ${action} invoice ${invoiceNumber}`;
    if (amount) {
      message += ` for $${amount}`;
    }

    return {
      title: '💰 Invoice Activity',
      message,
      icon: 'ri-file-text-line',
      priority: 'normal'
    };
  }

  /**
   * Generate a professional notification template for expense submissions
   */
  generateExpenseNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const amount = additionalInfo?.amount || '0.00';
    const category = additionalInfo?.category || 'expense';
    
    return {
      title: '💸 Expense Submitted',
      message: `${userName} submitted a ${category} expense for $${amount}`,
      icon: 'ri-money-dollar-circle-line',
      priority: 'normal'
    };
  }

  /**
   * Generate a professional notification template for calendar events
   */
  generateCalendarEventNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const eventTitle = additionalInfo?.eventTitle || 'meeting';
    const eventTime = additionalInfo?.eventTime;
    const action = additionalInfo?.action || 'scheduled';
    
    let message = `${userName} ${action} "${eventTitle}"`;
    if (eventTime) {
      message += ` for ${eventTime}`;
    }

    return {
      title: '📅 Calendar Event',
      message,
      icon: 'ri-calendar-event-line',
      priority: 'normal'
    };
  }

  /**
   * Generate a professional notification template for task creation
   */
  generateTaskCreatedNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const taskTitle = additionalInfo?.taskTitle || 'a new task';
    const assigneeName = additionalInfo?.assigneeName || 'team members';
    const caseName = this.getEnhancedCaseName(context);
    const dueDate = additionalInfo?.dueDate;
    
    let message = `${userName} created task "${taskTitle}"`;
    if (assigneeName !== 'team members') {
      message += ` and assigned it to ${assigneeName}`;
    }
    if (caseName) {
      message += ` for case "${caseName}"`;
    }
    if (dueDate) {
      message += ` (due ${dueDate})`;
    }

    return {
      title: '📝 New Task Created',
      message,
      icon: 'ri-task-line',
      priority: 'normal'
    };
  }

  /**
   * Generate a professional notification template for task status changes
   */
  generateTaskStatusChangeNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const taskTitle = additionalInfo?.taskTitle || 'a task';
    const oldStatus = additionalInfo?.oldStatus || 'Unknown';
    const newStatus = additionalInfo?.newStatus || 'Unknown';
    const caseName = this.getEnhancedCaseName(context);
    
    const statusEmojis: { [key: string]: string } = {
      'TODO': '📋',
      'IN_PROGRESS': '⏳',
      'COMPLETED': '✅',
      'CANCELLED': '❌',
      'ON_HOLD': '⏸️'
    };
    
    const emoji = statusEmojis[newStatus] || '📝';
    const priority = newStatus === 'COMPLETED' ? 'normal' : newStatus === 'CANCELLED' ? 'low' : 'normal';
    
    return {
      title: `${emoji} Task Status Updated`,
      message: `${userName} changed "${taskTitle}" from ${oldStatus} to ${newStatus} for case "${caseName}"`,
      icon: 'ri-refresh-line',
      priority: priority as 'low' | 'normal' | 'high' | 'critical'
    };
  }

  /**
   * Generate a professional notification template for document version updates
   */
  generateDocumentVersionNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const fileName = additionalInfo?.fileName || 'a document';
    const versionNumber = additionalInfo?.versionNumber || '2';
    const caseName = this.getEnhancedCaseName(context);
    
    return {
      title: '📄 Document Updated',
      message: `${userName} uploaded version ${versionNumber} of "${fileName}" for case "${caseName}"`,
      icon: 'ri-file-edit-line',
      priority: 'normal'
    };
  }

  /**
   * Generate a professional notification template for case notes
   */
  generateCaseNoteNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const noteTitle = additionalInfo?.noteTitle || '';
    const notePreview = additionalInfo?.notePreview || '';
    const caseName = this.getEnhancedCaseName(context);
    const action = additionalInfo?.action || 'added';
    
    let message = `${userName} ${action} a note`;
    if (noteTitle) {
      message += ` titled "${noteTitle}"`;
    }
    message += ` to case "${caseName}"`;
    if (notePreview) {
      message += `: "${notePreview.substring(0, 50)}..."`;
    }

    return {
      title: '📝 Case Note Added',
      message,
      icon: 'ri-sticky-note-line',
      priority: 'low'
    };
  }

  /**
   * Generate a professional notification template for payment received
   */
  generatePaymentReceivedNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const amount = additionalInfo?.amount || '0.00';
    const invoiceNumber = additionalInfo?.invoiceNumber || '#INV-XXX';
    const clientName = additionalInfo?.clientName || 'a client';
    const paymentMethod = additionalInfo?.paymentMethod || '';
    
    let message = `Payment of $${amount} received from ${clientName} for invoice ${invoiceNumber}`;
    if (paymentMethod) {
      message += ` via ${paymentMethod}`;
    }

    return {
      title: '💳 Payment Received',
      message,
      icon: 'ri-money-dollar-circle-line',
      priority: 'high'
    };
  }

  /**
   * Generate a professional notification template for intake form submissions
   */
  generateIntakeFormNotification(context: NotificationContext): NotificationTemplate {
    const { additionalInfo } = context;
    const clientName = additionalInfo?.clientName || 'Someone';
    const caseType = additionalInfo?.caseType || 'Legal Service';
    const submissionTime = additionalInfo?.submissionTime || 'now';
    const priority = additionalInfo?.priority || 'normal';
    
    return {
      title: '📋 New Intake Form',
      message: `${clientName} submitted an intake form for ${caseType} at ${submissionTime}`,
      icon: 'ri-file-list-line',
      priority: priority === 'urgent' ? 'high' : 'normal' as 'low' | 'normal' | 'high' | 'critical'
    };
  }

  /**
   * Generate a professional notification template for lead status changes
   */
  generateLeadStatusChangeNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const leadName = additionalInfo?.leadName || 'a lead';
    const oldStatus = additionalInfo?.oldStatus || 'Unknown';
    const newStatus = additionalInfo?.newStatus || 'Unknown';
    
    const statusEmojis: { [key: string]: string } = {
      'NEW': '🆕',
      'QUALIFIED': '✅',
      'CONVERTED': '🎉',
      'CLOSED': '❌'
    };
    
    const emoji = statusEmojis[newStatus] || '🎯';
    const priority = newStatus === 'CONVERTED' ? 'high' : 'normal';
    
    return {
      title: `${emoji} Lead Status Updated`,
      message: `${userName} moved lead "${leadName}" from ${oldStatus} to ${newStatus}`,
      icon: 'ri-user-star-line',
      priority: priority as 'low' | 'normal' | 'high' | 'critical'
    };
  }

  /**
   * Generate a professional notification template for time tracking
   */
  generateTimeTrackingNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const hours = additionalInfo?.hours || '0.0';
    const caseName = additionalInfo?.caseName;
    const taskDescription = additionalInfo?.taskDescription || 'work';
    
    let message = `${userName} logged ${hours} hours`;
    if (caseName) {
      message += ` on case "${caseName}"`;
    }
    if (taskDescription && taskDescription !== 'work') {
      message += ` for ${taskDescription}`;
    }

    return {
      title: '⏱️ Time Logged',
      message,
      icon: 'ri-time-line',
      priority: 'low'
    };
  }

  /**
   * Generate a professional notification template for case status changes
   */
  generateCaseStatusChangeNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const oldStatus = additionalInfo?.oldStatus || 'Unknown';
    const newStatus = additionalInfo?.newStatus || 'Unknown';
    
    const caseName = this.getEnhancedCaseName(context);

    // Map status to appropriate emoji and priority
    const statusEmojis: { [key: string]: string } = {
      'OPEN': '📂',
      'IN_PROGRESS': '🔄',
      'PENDING': '⏳',
      'CLOSED': '✅',
      'ARCHIVED': '🗄️',
      'ACTIVE': '🟢'
    };
    
    const priority = newStatus === 'CLOSED' ? 'high' : 'normal';
    const emoji = statusEmojis[newStatus] || '🔄';
    
    return {
      title: `${emoji} Case Status Updated`,
      message: `${userName} changed case "${caseName}" from ${oldStatus} to ${newStatus}`,
      icon: 'ri-refresh-line',
      priority: priority as 'low' | 'normal' | 'high' | 'critical'
    };
  }

  /**
   * Generate a professional notification template for case priority changes
   */
  generateCasePriorityChangeNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const oldPriority = additionalInfo?.oldPriority || 'Unknown';
    const newPriority = additionalInfo?.newPriority || 'Unknown';
    
    const caseName = this.getEnhancedCaseName(context);
    
    // Map priority to appropriate emoji and notification priority
    const priorityEmojis: { [key: string]: string } = {
      'LOW': '🟢',
      'MEDIUM': '🟡',
      'HIGH': '🟠',
      'URGENT': '🔴'
    };
    
    const notificationPriority = newPriority === 'URGENT' ? 'critical' : newPriority === 'HIGH' ? 'high' : 'normal';
    const emoji = priorityEmojis[newPriority] || '🔄';
    
    return {
      title: `${emoji} Case Priority Updated`,
      message: `${userName} changed case "${caseName}" priority from ${oldPriority} to ${newPriority}`,
      icon: 'ri-alarm-warning-line',
      priority: notificationPriority as 'low' | 'normal' | 'high' | 'critical'
    };
  }

  /**
   * Generate a professional notification template for new case assignments
   */
  generateCaseNewAssignmentNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const assigneeName = additionalInfo?.assigneeName || 'a team member';
    const roleType = additionalInfo?.roleType || 'team member';
    
    const caseName = this.getEnhancedCaseName(context);
    
    return {
      title: '👩‍💼 New Case Assignment',
      message: `${userName} assigned ${assigneeName} (${roleType}) to case "${caseName}"`,
      icon: 'ri-user-add-line',
      priority: 'high'
    };
  }

  /**
   * Generate a professional notification template for case assignment removals
   */
  generateCaseAssignmentRemovedNotification(context: NotificationContext): NotificationTemplate {
    const { userName, additionalInfo } = context;
    const assigneeName = additionalInfo?.assigneeName || 'a team member';
    
    const caseName = this.getEnhancedCaseName(context);
    
    return {
      title: '👤 Case Assignment Removed',
      message: `${userName} removed ${assigneeName} from case "${caseName}"`,
      icon: 'ri-user-unfollow-line',
      priority: 'normal'
    };
  }

  /**
   * Generate a notification based on category and context
   */
  generateNotificationByCategory(category: string, context: NotificationContext): NotificationTemplate {
    switch (category.toLowerCase()) {
      case 'files':
      case 'documents':
        return this.generateFileUploadNotification(context);
      
      case 'document_version':
        return this.generateDocumentVersionNotification(context);
      
      case 'case_assignment':
      case 'case':
        return this.generateCaseAssignmentNotification(context);
      
      case 'case_status':
        return this.generateCaseStatusChangeNotification(context);
        
      case 'case_priority':
        return this.generateCasePriorityChangeNotification(context);
        
      case 'case_new_assignment':
        return this.generateCaseNewAssignmentNotification(context);
        
      case 'case_assignment_removed':
        return this.generateCaseAssignmentRemovedNotification(context);
      
      case 'case_note':
        return this.generateCaseNoteNotification(context);
      
      case 'task_created':
        return this.generateTaskCreatedNotification(context);
        
      case 'task_status':
        return this.generateTaskStatusChangeNotification(context);
      
      case 'task':
      case 'task_assignment':
        return this.generateTaskAssignmentNotification(context);
      
      case 'deadline':
      case 'due_date':
        return this.generateDeadlineNotification(context);
      
      case 'lead_status':
        return this.generateLeadStatusChangeNotification(context);
      
      case 'lead':
      case 'crm':
        return this.generateLeadActivityNotification(context);
        
      case 'intake_form':
        return this.generateIntakeFormNotification(context);
      
      case 'client':
        return this.generateClientUpdateNotification(context);
      
      case 'invoice':
      case 'billing':
        return this.generateInvoiceNotification(context);
        
      case 'payment_received':
        return this.generatePaymentReceivedNotification(context);
      
      case 'expense':
        return this.generateExpenseNotification(context);
      
      case 'calendar':
      case 'event':
        return this.generateCalendarEventNotification(context);
      
      case 'time':
      case 'timesheet':
        return this.generateTimeTrackingNotification(context);
      
      default:
        return {
          title: '🔔 Notification',
          message: `${context.userName} performed an action in ${context.section || 'the system'}`,
          icon: 'ri-notification-line',
          priority: 'normal'
        };
    }
  }
}