import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { CaseAssignmentService } from '../../../service/case-assignment.service';
import { UserService } from '../../../service/user.service';
import { NotificationService } from '../../../service/notification.service';
import { 
  CaseAssignmentRequest,
  CaseRoleType,
  CaseAssignment
} from '../../../interface/case-assignment';
import { User } from '../../../interface/user';

@Component({
  selector: 'app-case-assignment-form',
  templateUrl: './case-assignment-form.component.html',
  styleUrls: ['./case-assignment-form.component.css']
})
export class CaseAssignmentFormComponent implements OnInit, OnDestroy {
  @Input() caseId!: number;
  @Input() assignment?: CaseAssignment;
  @Output() assignmentSaved = new EventEmitter<CaseAssignment>();
  @Output() cancelled = new EventEmitter<void>();
  
  private destroy$ = new Subject<void>();
  
  assignmentForm!: FormGroup;
  availableUsers: User[] = [];
  roleTypes = Object.values(CaseRoleType);
  loading = false;
  
  constructor(
    private fb: FormBuilder,
    private caseAssignmentService: CaseAssignmentService,
    private userService: UserService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadAvailableUsers();
    
    if (this.assignment) {
      this.populateForm(this.assignment);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.assignmentForm = this.fb.group({
      userId: [null, Validators.required],
      roleType: [CaseRoleType.ASSOCIATE, Validators.required],
      effectiveFrom: [new Date().toISOString().split('T')[0], Validators.required],
      effectiveTo: [null],
      workloadWeight: [1, [Validators.required, Validators.min(0.1), Validators.max(5)]],
      notes: ['']
    });
  }

  private populateForm(assignment: CaseAssignment): void {
    this.assignmentForm.patchValue({
      userId: assignment.userId,
      roleType: assignment.roleType,
      effectiveFrom: assignment.effectiveFrom ? 
        new Date(assignment.effectiveFrom).toISOString().split('T')[0] : null,
      effectiveTo: assignment.effectiveTo ? 
        new Date(assignment.effectiveTo).toISOString().split('T')[0] : null,
      workloadWeight: assignment.workloadWeight,
      notes: assignment.notes
    });
  }

  private loadAvailableUsers(): void {
    this.userService.getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.availableUsers = response.data['content'] || response.data;
          // Filter out inactive users if needed
          this.availableUsers = this.availableUsers.filter(user => user.enabled);
        },
        error: (error) => {
          console.error('Error loading users:', error);
          this.notificationService.onError('Failed to load users');
        }
      });
  }

  onSubmit(): void {
    if (this.assignmentForm.invalid) {
      Object.keys(this.assignmentForm.controls).forEach(key => {
        this.assignmentForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading = true;
    const formValue = this.assignmentForm.value;
    
    const request: CaseAssignmentRequest = {
      caseId: this.caseId,
      userId: formValue.userId,
      roleType: formValue.roleType,
      effectiveFrom: formValue.effectiveFrom ? new Date(formValue.effectiveFrom) : undefined,
      effectiveTo: formValue.effectiveTo ? new Date(formValue.effectiveTo) : undefined,
      workloadWeight: formValue.workloadWeight,
      notes: formValue.notes
    };

    this.caseAssignmentService.assignCase(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.notificationService.onSuccess('Case assigned successfully');
          this.assignmentSaved.emit(response.data);
          this.assignmentForm.reset();
          this.loading = false;
        },
        error: (error) => {
          this.notificationService.onError(error.error?.message || 'Failed to assign case');
          console.error('Error assigning case:', error);
          this.loading = false;
        }
      });
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  getRoleDisplayName(role: CaseRoleType): string {
    const roleNames: { [key: string]: string } = {
      'LEAD_ATTORNEY': 'Lead Attorney',
      'CO_COUNSEL': 'Co-Counsel',
      'ASSOCIATE': 'Associate',
      'PARALEGAL': 'Paralegal',
      'LEGAL_ASSISTANT': 'Legal Assistant',
      'CONSULTANT': 'Consultant'
    };
    return roleNames[role] || role;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.assignmentForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.assignmentForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['min']) return `Minimum value is ${field.errors['min'].min}`;
      if (field.errors['max']) return `Maximum value is ${field.errors['max'].max}`;
    }
    return '';
  }
}