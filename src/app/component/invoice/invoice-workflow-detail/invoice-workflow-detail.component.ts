import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InvoiceWorkflowService } from 'src/app/service/invoice-workflow.service';
import { InvoiceWorkflowRule, InvoiceWorkflowExecution } from 'src/app/interface/invoice-workflow';
import { BehaviorSubject } from 'rxjs';
import Swal from 'sweetalert2';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-invoice-workflow-detail',
  templateUrl: './invoice-workflow-detail.component.html',
  styleUrls: ['./invoice-workflow-detail.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class InvoiceWorkflowDetailComponent implements OnInit {
  workflowRule: InvoiceWorkflowRule | null = null;
  executions: InvoiceWorkflowExecution[] = [];
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  
  activeTab = 'details';
  workflowId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workflowService: InvoiceWorkflowService
  ) {}

  ngOnInit(): void {
    // Debug: Check JWT token contents
    this.debugJWTToken();
    
    this.workflowId = this.route.snapshot.paramMap.get('id');
    if (this.workflowId) {
      this.loadWorkflowRule();
      this.loadExecutions();
    }
  }

  private debugJWTToken(): void {
    const token = localStorage.getItem('[KEY] TOKEN');
    if (token) {
      try {
        // Decode JWT token
        const payload = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payload));
        console.log('JWT Token Payload:', decodedPayload);
        console.log('Authorities:', decodedPayload.authorities);
        console.log('Permissions:', decodedPayload.permissions);
        console.log('Roles:', decodedPayload.roles);
      } catch (error) {
        console.error('Error decoding JWT token:', error);
      }
    } else {
      console.error('No token found in localStorage with key TOKEN');
    }
  }

  loadWorkflowRule(): void {
    if (!this.workflowId) return;
    
    this.isLoadingSubject.next(true);
    this.workflowService.getWorkflowRule(+this.workflowId).subscribe({
      next: (response) => {
        this.workflowRule = response.data;
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

  loadExecutions(): void {
    if (!this.workflowRule?.id) return;
    
    this.isLoadingSubject.next(true);
    this.workflowService.getWorkflowExecutions(this.workflowRule.id).subscribe({
      next: (response) => {
        this.executions = response.data || [];
        this.isLoadingSubject.next(false);
      },
      error: (error) => {
        console.error('Error loading executions:', error);
        this.executions = [];
        this.isLoadingSubject.next(false);
      }
    });
  }

  toggleRule(): void {
    if (!this.workflowRule?.id) return;
    
    console.log('Toggling workflow rule with ID:', this.workflowRule.id);
    
    this.workflowService.toggleWorkflowRule(this.workflowRule.id).subscribe({
      next: (response) => {
        console.log('Toggle response:', response);
        this.workflowRule = response.data;
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: response.message,
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (error) => {
        console.error('Toggle error:', error);
        console.error('Error status:', error?.status);
        console.error('Error details:', error?.error);
        const errorMessage = error?.error?.message || error?.message || 'Failed to toggle workflow rule';
        Swal.fire({
          icon: 'error',
          title: 'Error!',
          text: `${errorMessage} (Status: ${error?.status || 'Unknown'})`,
          confirmButtonText: 'OK'
        });
      }
    });
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'executions' && this.executions.length === 0) {
      this.loadExecutions();
    }
  }

  getTriggerDescription(): string {
    if (!this.workflowRule) return '';
    
    switch (this.workflowRule.triggerEvent) {
      case 'CREATED':
        return 'When invoice is created';
      case 'STATUS_CHANGED':
        return `When status changes to ${this.workflowRule.triggerStatus || 'any'}`;
      case 'SCHEDULED':
        if (this.workflowRule.daysBeforeDue) {
          return `${this.workflowRule.daysBeforeDue} days before due date`;
        } else if (this.workflowRule.daysAfterDue) {
          return `${this.workflowRule.daysAfterDue} days after due date`;
        }
        return 'Scheduled';
      case 'OVERDUE':
        return 'When invoice becomes overdue';
      case 'PAYMENT_RECEIVED':
        return 'When payment is received';
      default:
        return this.workflowRule.triggerEvent;
    }
  }

  getActionDescription(): string {
    if (!this.workflowRule) return '';
    
    switch (this.workflowRule.actionType) {
      case 'SEND_EMAIL':
        return `Send email (${this.workflowRule.actionConfig?.email_template || 'template'})`;
      case 'UPDATE_STATUS':
        return `Update status to ${this.workflowRule.actionConfig?.new_status || 'status'}`;
      case 'CREATE_REMINDER':
        return 'Create reminder';
      case 'APPLY_LATE_FEE':
        return `Apply ${this.workflowRule.actionConfig?.fee_percentage || '0'}% late fee`;
      default:
        return this.workflowRule.actionType;
    }
  }

  getConfigValue(key: string): any {
    return this.workflowRule?.actionConfig?.[key];
  }

  formatConfigValue(value: any): string {
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  getConfigKeys(): string[] {
    if (!this.workflowRule?.actionConfig) {
      return [];
    }
    return Object.keys(this.workflowRule.actionConfig);
  }

  hasConfigData(): boolean {
    return !!(this.workflowRule?.actionConfig && Object.keys(this.workflowRule.actionConfig).length > 0);
  }

  isObjectValue(key: string): boolean {
    const value = this.getConfigValue(key);
    return typeof value === 'object' && !Array.isArray(value) && value !== null;
  }

  goBack(): void {
    this.router.navigate(['/invoices/workflows']);
  }
  
  getExecutionCount(status: string): number {
    return this.executions.filter(e => e.status === status).length;
  }
  
  getStatusIcon(status: string): string {
    switch (status) {
      case 'SUCCESS':
        return 'ri-check-line';
      case 'FAILED':
        return 'ri-close-line';
      case 'SKIPPED':
        return 'ri-skip-forward-line';
      default:
        return 'ri-question-line';
    }
  }
  
  showExecutionDetails(execution: InvoiceWorkflowExecution): void {
    Swal.fire({
      title: 'Execution Details',
      html: `
        <div class="text-start">
          <p><strong>Workflow:</strong> ${this.workflowRule?.name || 'Unknown'}</p>
          <p><strong>Invoice ID:</strong> #${execution.invoiceId}</p>
          <p><strong>Executed At:</strong> ${new Date(execution.executedAt).toLocaleString()}</p>
          <p><strong>Status:</strong> <span class="badge ${this.getStatusBadgeClass(execution.status)}">${execution.status}</span></p>
          <hr>
          <p><strong>Result Message:</strong></p>
          <div class="bg-light p-3 rounded">
            <code>${execution.resultMessage || 'No additional details available'}</code>
          </div>
        </div>
      `,
      width: '600px',
      showCloseButton: true,
      showConfirmButton: false
    });
  }
  
  private getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'SUCCESS':
        return 'bg-success';
      case 'FAILED':
        return 'bg-danger';
      case 'SKIPPED':
        return 'bg-warning';
      default:
        return 'bg-secondary';
    }
  }
}