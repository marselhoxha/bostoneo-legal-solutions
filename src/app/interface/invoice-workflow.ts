export interface InvoiceWorkflowRule {
  id?: number;
  name: string;
  description?: string;
  isActive?: boolean;
  
  // Trigger conditions
  triggerEvent: 'CREATED' | 'STATUS_CHANGED' | 'SCHEDULED' | 'OVERDUE' | 'PAYMENT_RECEIVED';
  triggerStatus?: string;
  daysBeforeDue?: number;
  daysAfterDue?: number;
  
  // Actions
  actionType: 'SEND_EMAIL' | 'UPDATE_STATUS' | 'CREATE_REMINDER' | 'APPLY_LATE_FEE';
  actionConfig?: any;
  
  // Execution settings
  executionTime?: string;
  maxExecutions?: number;
  
  // Metadata
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InvoiceWorkflowExecution {
  id?: number;
  workflowRule?: InvoiceWorkflowRule;
  invoiceId: number;
  executedAt: Date;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  resultMessage?: string;
}

export interface InvoiceReminder {
  id?: number;
  invoiceId: number;
  reminderType: 'DUE_SOON' | 'OVERDUE' | 'PAYMENT_RECEIVED' | 'CUSTOM';
  scheduledDate: string;
  scheduledTime?: string;
  status: 'PENDING' | 'SENT' | 'CANCELLED';
  sentAt?: Date;
  subject?: string;
  message?: string;
  recipients?: string[];
  createdByWorkflow?: InvoiceWorkflowRule;
}