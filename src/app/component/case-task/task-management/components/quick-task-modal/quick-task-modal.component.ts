import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import flatpickr from 'flatpickr';
import { CaseTask, TaskCreateRequest, TaskType, TaskPriority } from '../../../../../interface/case-task';
import { CaseTaskService } from '../../../../../service/case-task.service';
import { UserService } from '../../../../../service/user.service';
import { NotificationService } from '../../../../../service/notification.service';

export interface QuickTaskData {
  caseId: number;
  availableUsers: any[];
  preSelectedUserId?: number;
  preSelectedPriority?: string;
}

@Component({
  selector: 'app-quick-task-modal',
  templateUrl: './quick-task-modal.component.html',
  styleUrls: ['./quick-task-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class QuickTaskModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() data!: QuickTaskData;
  @Output() taskCreated = new EventEmitter<any>();
  @ViewChild('dueDateInput', { static: false }) dueDateInput!: ElementRef;

  taskForm: FormGroup;
  isLoading = false;
  availableUsers: any[] = [];
  today: string;
  private flatpickrInstance: any;

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private caseTaskService: CaseTaskService,
    private userService: UserService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.taskForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      assignedToId: [''],
      priority: ['MEDIUM'],
      dueDate: [''],
      estimatedHours: [''],
      taskType: ['OTHER']
    });
  }

  ngOnInit(): void {
    this.today = new Date().toISOString().split('T')[0];
    this.setupForm();
    this.loadAvailableUsers();
  }

  ngAfterViewInit(): void {
    // Initialize flatpickr after view is initialized
    setTimeout(() => {
      this.initializeFlatpickr();
    }, 100);
  }

  private setupForm(): void {
    if (this.data.preSelectedUserId) {
      this.taskForm.patchValue({
        assignedToId: this.data.preSelectedUserId
      });
    }
    
    if (this.data.preSelectedPriority) {
      this.taskForm.patchValue({
        priority: this.data.preSelectedPriority
      });
    }
  }

  private loadAvailableUsers(): void {
    if (this.data.availableUsers && this.data.availableUsers.length > 0) {
      this.availableUsers = this.data.availableUsers;
    } else {
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

  onCreate(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const formValue = this.taskForm.value;

    const newTask: TaskCreateRequest = {
      caseId: this.data.caseId,
      title: formValue.title,
      description: formValue.description,
      taskType: formValue.taskType as TaskType,
      priority: formValue.priority as TaskPriority,
      assignedToId: formValue.assignedToId || undefined,
      dueDate: formValue.dueDate ? new Date(formValue.dueDate) : undefined,
      estimatedHours: formValue.estimatedHours || undefined,
      tags: []
    };

    this.caseTaskService.createTask(newTask).subscribe({
      next: (response) => {
        this.notificationService.onSuccess('Task created successfully');
        this.taskCreated.emit({
          task: response.data.task,
          assignedUser: this.getSelectedUser(),
          action: 'created'
        });
        this.activeModal.close('created');
      },
      error: (error) => {
        console.error('Error creating task:', error);
        this.notificationService.onError('Failed to create task');
        this.isLoading = false;
      }
    });
  }

  private getSelectedUser(): any {
    const userId = this.taskForm.get('assignedToId')?.value;
    if (!userId) return null;
    return this.availableUsers.find(user => user.id === parseInt(userId));
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
    this.destroyFlatpickr();
    this.activeModal.dismiss('cancelled');
  }

  private initializeFlatpickr(): void {
    if (this.dueDateInput && this.dueDateInput.nativeElement) {
      this.flatpickrInstance = flatpickr(this.dueDateInput.nativeElement, {
        dateFormat: 'Y-m-d',
        minDate: 'today',
        allowInput: true,
        onChange: (selectedDates) => {
          if (selectedDates.length > 0) {
            this.taskForm.patchValue({
              dueDate: selectedDates[0].toISOString().split('T')[0]
            });
          }
        }
      });
    }
  }

  private destroyFlatpickr(): void {
    if (this.flatpickrInstance) {
      this.flatpickrInstance.destroy();
      this.flatpickrInstance = null;
    }
  }

  ngOnDestroy(): void {
    this.destroyFlatpickr();
  }
}