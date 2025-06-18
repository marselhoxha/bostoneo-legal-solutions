import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { InvoiceWorkflowService } from 'src/app/service/invoice-workflow.service';
import { InvoiceWorkflowRule, InvoiceWorkflowExecution } from 'src/app/interface/invoice-workflow';
import { BehaviorSubject } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-invoice-workflows',
  templateUrl: './invoice-workflows.component.html',
  styleUrls: ['./invoice-workflows.component.css']
})
export class InvoiceWorkflowsComponent implements OnInit {
  workflowRules: InvoiceWorkflowRule[] = [];
  executions: InvoiceWorkflowExecution[] = [];
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  
  activeTab = 'rules';

  constructor(
    private workflowService: InvoiceWorkflowService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadWorkflowRules();
  }

  loadWorkflowRules(): void {
    this.isLoadingSubject.next(true);
    this.workflowService.getWorkflowRules().subscribe({
      next: (response) => {
        this.workflowRules = response.data || [];
        this.isLoadingSubject.next(false);
      },
      error: (error) => {
        console.error('Error loading workflow rules:', error);
        this.isLoadingSubject.next(false);
      }
    });
  }

  loadExecutions(): void {
    this.isLoadingSubject.next(true);
    this.workflowService.getExecutions().subscribe({
      next: (response) => {
        if (response.data && response.data.content) {
          this.executions = response.data.content;
        } else if (response.data && Array.isArray(response.data)) {
          this.executions = response.data;
        } else {
          this.executions = [];
        }
        this.isLoadingSubject.next(false);
      },
      error: (error) => {
        console.error('Error loading executions:', error);
        this.executions = [];
        this.isLoadingSubject.next(false);
      }
    });
  }

  toggleRule(rule: InvoiceWorkflowRule): void {
    // Store the current state for potential rollback
    const previousState = rule.isActive;
    
    // Disable the toggle during the request
    const toggleElement = document.getElementById('switch-' + rule.id) as HTMLInputElement;
    if (toggleElement) {
      toggleElement.disabled = true;
    }
    
    // Call the official service without optimistic update
    this.workflowService.toggleWorkflowRule(rule.id!).subscribe({
      next: (response) => {
        const updatedRule = response.data;
        if (updatedRule) {
          // Update the entire rule object with server response
          const index = this.workflowRules.findIndex(r => r.id === updatedRule.id);
          if (index >= 0) {
            // Replace the entire object in the array
            this.workflowRules[index] = { ...updatedRule };
            // Also update the reference passed to the method
            Object.assign(rule, updatedRule);
          }
          
          // Force change detection
          this.cdr.detectChanges();
          
          // Show concise success message
          Swal.fire({
            icon: 'success',
            title: updatedRule.isActive ? 'Activated' : 'Deactivated',
            timer: 1500,
            showConfirmButton: false
          });
        }
        
        // Re-enable the toggle
        if (toggleElement) {
          toggleElement.disabled = false;
        }
      },
      error: (error) => {
        // Ensure UI stays at previous state
        rule.isActive = previousState;
        
        // Force change detection for error case too
        this.cdr.detectChanges();
        
        // Re-enable the toggle
        if (toggleElement) {
          toggleElement.disabled = false;
        }
        
        // Show appropriate error message
        let errorMessage = 'Failed to toggle workflow rule';
        if (error.error && error.error.message) {
          errorMessage = error.error.message;
        } else if (error.status === 403) {
          errorMessage = 'You do not have permission to edit workflow rules';
        } else if (error.status === 401) {
          errorMessage = 'Please log in to continue';
        }
        
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: errorMessage
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

  getTriggerDescription(rule: InvoiceWorkflowRule): string {
    switch (rule.triggerEvent) {
      case 'CREATED':
        return 'When invoice is created';
      case 'STATUS_CHANGED':
        return `When status changes to ${rule.triggerStatus || 'any'}`;
      case 'SCHEDULED':
        if (rule.daysBeforeDue) {
          return `${rule.daysBeforeDue} days before due date`;
        } else if (rule.daysAfterDue) {
          return `${rule.daysAfterDue} days after due date`;
        }
        return 'Scheduled';
      case 'OVERDUE':
        return 'When invoice becomes overdue';
      case 'PAYMENT_RECEIVED':
        return 'When payment is received';
      default:
        return rule.triggerEvent;
    }
  }

  getActionDescription(rule: InvoiceWorkflowRule): string {
    switch (rule.actionType) {
      case 'SEND_EMAIL':
        return `Send email (${rule.actionConfig?.email_template || 'template'})`;
      case 'UPDATE_STATUS':
        return `Update status to ${rule.actionConfig?.new_status || 'status'}`;
      case 'CREATE_REMINDER':
        return 'Create reminder';
      case 'APPLY_LATE_FEE':
        return `Apply ${rule.actionConfig?.fee_percentage || '0'}% late fee`;
      default:
        return rule.actionType;
    }
  }
}