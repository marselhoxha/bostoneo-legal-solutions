import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InvoiceWorkflowService } from 'src/app/service/invoice-workflow.service';
import { InvoiceWorkflowRule } from 'src/app/interface/invoice-workflow';
import { BehaviorSubject } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-invoice-workflow-config',
  templateUrl: './invoice-workflow-config.component.html',
  styleUrls: ['./invoice-workflow-config.component.css']
})
export class InvoiceWorkflowConfigComponent implements OnInit {
  workflowRule: InvoiceWorkflowRule | null = null;
  configForm!: FormGroup;
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  
  // Email templates
  emailTemplates = [
    { value: 'invoice_created', label: 'Invoice Created' },
    { value: 'payment_reminder', label: 'Payment Reminder' },
    { value: 'payment_reminder_urgent', label: 'Urgent Payment Reminder' },
    { value: 'overdue_notice', label: 'Overdue Notice' },
    { value: 'payment_received', label: 'Payment Received' }
  ];
  
  // Invoice statuses
  invoiceStatuses = [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'ISSUED', label: 'Issued' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'OVERDUE', label: 'Overdue' },
    { value: 'PAID', label: 'Paid' },
    { value: 'CANCELLED', label: 'Cancelled' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private workflowService: InvoiceWorkflowService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadWorkflowRule(+id);
    }
  }

  loadWorkflowRule(id: number): void {
    this.isLoadingSubject.next(true);
    this.workflowService.getWorkflowRule(id).subscribe({
      next: (response) => {
        this.workflowRule = response.data;
        this.initializeForm();
        this.isLoadingSubject.next(false);
      },
      error: (error) => {
        console.error('Error loading workflow rule:', error);
        this.isLoadingSubject.next(false);
        Swal.fire('Error!', 'Failed to load workflow rule', 'error');
        this.router.navigate(['/invoices/workflows']);
      }
    });
  }

  initializeForm(): void {
    if (!this.workflowRule) return;
    
    // Build form based on action type
    switch (this.workflowRule.actionType) {
      case 'SEND_EMAIL':
        this.configForm = this.fb.group({
          email_template: [this.workflowRule.actionConfig?.email_template || '', Validators.required],
          send_to_client: [this.workflowRule.actionConfig?.send_to_client !== false],
          attach_pdf: [this.workflowRule.actionConfig?.attach_pdf || false],
          cc_accounting: [this.workflowRule.actionConfig?.cc_accounting || false],
          cc_emails: [this.workflowRule.actionConfig?.cc_emails?.join(', ') || ''],
          custom_subject: [this.workflowRule.actionConfig?.custom_subject || ''],
          custom_message: [this.workflowRule.actionConfig?.custom_message || '']
        });
        break;
        
      case 'UPDATE_STATUS':
        this.configForm = this.fb.group({
          new_status: [this.workflowRule.actionConfig?.new_status || '', Validators.required],
          condition_status: [this.workflowRule.actionConfig?.condition_status || []],
          notify_client: [this.workflowRule.actionConfig?.notify_client || false],
          add_note: [this.workflowRule.actionConfig?.add_note || false],
          note_text: [this.workflowRule.actionConfig?.note_text || '']
        });
        break;
        
      case 'APPLY_LATE_FEE':
        this.configForm = this.fb.group({
          fee_percentage: [this.workflowRule.actionConfig?.fee_percentage || 1.5, [Validators.required, Validators.min(0), Validators.max(100)]],
          fee_description: [this.workflowRule.actionConfig?.fee_description || 'Late payment fee', Validators.required],
          max_fee_amount: [this.workflowRule.actionConfig?.max_fee_amount || 500, [Validators.required, Validators.min(0)]],
          compound_fees: [this.workflowRule.actionConfig?.compound_fees || false],
          waive_if_paid_within: [this.workflowRule.actionConfig?.waive_if_paid_within || 0]
        });
        break;
        
      case 'CREATE_REMINDER':
        this.configForm = this.fb.group({
          reminder_days: [this.workflowRule.actionConfig?.reminder_days || 1, [Validators.required, Validators.min(1)]],
          reminder_time: [this.workflowRule.actionConfig?.reminder_time || '09:00'],
          reminder_subject: [this.workflowRule.actionConfig?.reminder_subject || 'Invoice Reminder', Validators.required],
          reminder_message: [this.workflowRule.actionConfig?.reminder_message || ''],
          send_email: [this.workflowRule.actionConfig?.send_email !== false],
          create_task: [this.workflowRule.actionConfig?.create_task || false]
        });
        break;
        
      default:
        this.configForm = this.fb.group({});
    }
    
    // Add schedule-specific fields if applicable
    if (this.workflowRule.triggerEvent === 'SCHEDULED') {
      const scheduleGroup = this.fb.group({
        daysBeforeDue: [this.workflowRule.daysBeforeDue || null],
        daysAfterDue: [this.workflowRule.daysAfterDue || null],
        executionTime: [this.workflowRule.executionTime || '09:00'],
        maxExecutions: [this.workflowRule.maxExecutions || 1, [Validators.required, Validators.min(1)]]
      });
      
      Object.keys(scheduleGroup.controls).forEach(key => {
        this.configForm.addControl(key, scheduleGroup.get(key)!);
      });
    }
  }

  onSubmit(): void {
    if (!this.configForm.valid || !this.workflowRule) return;
    
    const formValue = this.configForm.value;
    
    // Prepare action config based on action type
    let actionConfig: any = {};
    
    switch (this.workflowRule.actionType) {
      case 'SEND_EMAIL':
        actionConfig = {
          email_template: formValue.email_template,
          send_to_client: formValue.send_to_client,
          attach_pdf: formValue.attach_pdf,
          cc_accounting: formValue.cc_accounting
        };
        
        if (formValue.cc_emails) {
          actionConfig.cc_emails = formValue.cc_emails.split(',').map((e: string) => e.trim()).filter((e: string) => e);
        }
        
        if (formValue.custom_subject) {
          actionConfig.custom_subject = formValue.custom_subject;
        }
        
        if (formValue.custom_message) {
          actionConfig.custom_message = formValue.custom_message;
        }
        break;
        
      case 'UPDATE_STATUS':
        actionConfig = {
          new_status: formValue.new_status,
          notify_client: formValue.notify_client,
          add_note: formValue.add_note
        };
        
        if (formValue.condition_status && formValue.condition_status.length > 0) {
          actionConfig.condition_status = formValue.condition_status;
        }
        
        if (formValue.add_note && formValue.note_text) {
          actionConfig.note_text = formValue.note_text;
        }
        break;
        
      case 'APPLY_LATE_FEE':
        actionConfig = {
          fee_percentage: formValue.fee_percentage,
          fee_description: formValue.fee_description,
          max_fee_amount: formValue.max_fee_amount,
          compound_fees: formValue.compound_fees,
          waive_if_paid_within: formValue.waive_if_paid_within
        };
        break;
        
      case 'CREATE_REMINDER':
        actionConfig = {
          reminder_days: formValue.reminder_days,
          reminder_time: formValue.reminder_time,
          reminder_subject: formValue.reminder_subject,
          reminder_message: formValue.reminder_message,
          send_email: formValue.send_email,
          create_task: formValue.create_task
        };
        break;
    }
    
    // Prepare update request
    const updateData = {
      actionConfig: actionConfig,
      daysBeforeDue: formValue.daysBeforeDue,
      daysAfterDue: formValue.daysAfterDue,
      executionTime: formValue.executionTime,
      maxExecutions: formValue.maxExecutions
    };
    
    this.isLoadingSubject.next(true);
    
    this.workflowService.updateWorkflowConfig(this.workflowRule.id!, updateData).subscribe({
      next: (response) => {
        this.isLoadingSubject.next(false);
        Swal.fire({
          icon: 'success',
          title: 'Configuration Updated',
          text: response.message || 'Workflow configuration has been updated successfully',
          timer: 2000,
          showConfirmButton: false
        }).then(() => {
          this.router.navigate(['/invoices/workflows', this.workflowRule!.id]);
        });
      },
      error: (error) => {
        this.isLoadingSubject.next(false);
        console.error('Error updating workflow configuration:', error);
        Swal.fire('Error!', 'Failed to update workflow configuration', 'error');
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/invoices/workflows', this.workflowRule?.id || '']);
  }

  getFieldError(fieldName: string): string {
    const field = this.configForm.get(fieldName);
    if (field?.invalid && field?.touched) {
      if (field.errors?.['required']) {
        return 'This field is required';
      }
      if (field.errors?.['min']) {
        return `Minimum value is ${field.errors['min'].min}`;
      }
      if (field.errors?.['max']) {
        return `Maximum value is ${field.errors['max'].max}`;
      }
    }
    return '';
  }
}