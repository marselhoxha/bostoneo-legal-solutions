import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CaseTask } from '../../../../../interface/case-task';
import { CaseTaskService } from '../../../../../service/case-task.service';
import { UserService } from '../../../../../service/user.service';
import { NotificationService } from '../../../../../service/notification.service';

export interface TaskAssignmentData {
  task?: CaseTask;
  caseId: number;
  availableUsers: any[];
  preSelectedUserId?: number;
  mode: 'assign' | 'reassign' | 'create-and-assign';
}

@Component({
  selector: 'app-task-assignment-modal',
  templateUrl: './task-assignment-modal.component.html',
  styleUrls: ['./task-assignment-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class TaskAssignmentModalComponent implements OnInit {
  @Input() data!: TaskAssignmentData;
  @Output() taskAssigned = new EventEmitter<any>();

  assignmentForm: FormGroup;
  isLoading = false;
  availableUsers: any[] = [];
  today: string;

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private caseTaskService: CaseTaskService,
    private userService: UserService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.assignmentForm = this.fb.group({
      assignedToId: ['', Validators.required],
      priority: ['MEDIUM'],
      dueDate: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.today = new Date().toISOString().split('T')[0];
    this.setupForm();
    this.loadAvailableUsers();
  }

  private setupForm(): void {
    if (this.data.task) {
      this.assignmentForm.patchValue({
        assignedToId: this.data.task.assignedToId || this.data.preSelectedUserId || '',
        priority: this.data.task.priority || 'MEDIUM',
        dueDate: this.data.task.dueDate ? this.formatDateForInput(this.data.task.dueDate) : '',
        notes: ''
      });
    } else if (this.data.preSelectedUserId) {
      this.assignmentForm.patchValue({
        assignedToId: this.data.preSelectedUserId
      });
    }
  }

  private formatDateForInput(date: Date | string): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  private loadAvailableUsers(): void {
    if (this.data.availableUsers && this.data.availableUsers.length > 0) {
      this.availableUsers = this.data.availableUsers;
    } else {
      // Load from service if not provided
      this.userService.getUsers().subscribe({
        next: (response) => {
          this.availableUsers = response?.data?.users || [];
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading users:', error);
          this.availableUsers = [];
        }
      });
    }
  }

  onAssign(): void {
    if (this.assignmentForm.invalid) {
      this.assignmentForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const formValue = this.assignmentForm.value;

    if (this.data.task) {
      // Update existing task assignment
      const updateData = {
        assignedToId: formValue.assignedToId,
        priority: formValue.priority,
        dueDate: formValue.dueDate ? new Date(formValue.dueDate) : undefined
      };

      this.caseTaskService.updateTask(this.data.task.id, updateData).subscribe({
        next: (response) => {
          this.notificationService.onSuccess('Task assigned successfully');
          this.taskAssigned.emit({
            task: this.data.task,
            assignedUser: this.getSelectedUser(),
            action: 'assigned'
          });
          this.activeModal.close('assigned');
        },
        error: (error) => {
          console.error('Error assigning task:', error);
          this.notificationService.onError('Failed to assign task');
          this.isLoading = false;
        }
      });
    } else {
      // This would be for create-and-assign mode (future enhancement)
      this.notificationService.onInfo('Create and assign functionality not implemented yet');
      this.isLoading = false;
    }
  }

  private getSelectedUser(): any {
    const userId = this.assignmentForm.get('assignedToId')?.value;
    return this.availableUsers.find(user => user.id === parseInt(userId));
  }

  getModalTitle(): string {
    if (this.data.mode === 'reassign') {
      return `Reassign Task: ${this.data.task?.title || 'Unknown'}`;
    } else if (this.data.mode === 'create-and-assign') {
      return 'Create and Assign New Task';
    } else {
      return `Assign Task: ${this.data.task?.title || 'Unknown'}`;
    }
  }

  getUserWorkloadClass(user: any): string {
    const workload = user.workloadPercentage || 0;
    if (workload >= 90) return 'text-danger';
    if (workload >= 70) return 'text-warning';
    return 'text-success';
  }

  getUserWorkloadText(user: any): string {
    const workload = user.workloadPercentage || 0;
    if (workload >= 90) return 'Overloaded';
    if (workload >= 70) return 'Busy';
    return 'Available';
  }

  onCancel(): void {
    this.activeModal.dismiss('cancelled');
  }
}