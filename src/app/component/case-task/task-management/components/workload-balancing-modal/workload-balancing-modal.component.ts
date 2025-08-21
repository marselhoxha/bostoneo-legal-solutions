import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CaseTaskService } from '../../../../../service/case-task.service';
import { UserService } from '../../../../../service/user.service';
import { NotificationService } from '../../../../../service/notification.service';

export interface WorkloadBalancingData {
  caseId: number;
  teamMembers: any[];
  unassignedTasks: any[];
}

interface TaskReassignment {
  taskId: number;
  fromUserId: number;
  toUserId: number;
  task: any;
  fromUser: any;
  toUser: any;
}

@Component({
  selector: 'app-workload-balancing-modal',
  templateUrl: './workload-balancing-modal.component.html',
  styleUrls: ['./workload-balancing-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class WorkloadBalancingModalComponent implements OnInit {
  @Input() data!: WorkloadBalancingData;
  @Output() workloadBalanced = new EventEmitter<any>();

  isLoading = false;
  teamMembers: any[] = [];
  unassignedTasks: any[] = [];
  proposedReassignments: TaskReassignment[] = [];
  balancingStrategy: 'auto' | 'manual' = 'auto';

  constructor(
    public activeModal: NgbActiveModal,
    private caseTaskService: CaseTaskService,
    private userService: UserService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setupData();
    this.generateBalancingRecommendations();
  }

  private setupData(): void {
    this.teamMembers = [...(this.data.teamMembers || [])];
    this.unassignedTasks = [...(this.data.unassignedTasks || [])];
  }

  private generateBalancingRecommendations(): void {
    this.proposedReassignments = [];

    // Sort members by workload (highest first)
    const sortedMembers = this.teamMembers
      .filter(member => member.workloadPercentage > 0)
      .sort((a, b) => (b.workloadPercentage || 0) - (a.workloadPercentage || 0));

    if (sortedMembers.length < 2) return;

    const overloadedMembers = sortedMembers.filter(m => m.workloadPercentage >= 80);
    const availableMembers = sortedMembers.filter(m => m.workloadPercentage < 70);

    // Generate reassignment suggestions for overloaded members
    overloadedMembers.forEach(overloadedMember => {
      const memberTasks = this.getMemberTasks(overloadedMember.id);
      const reassignableTasks = memberTasks
        .filter(task => task.priority !== 'URGENT' && task.status === 'TODO')
        .slice(0, 2); // Limit to 2 tasks per member

      reassignableTasks.forEach(task => {
        const bestTarget = this.findBestReassignmentTarget(task, availableMembers);
        if (bestTarget) {
          this.proposedReassignments.push({
            taskId: task.id,
            fromUserId: overloadedMember.id,
            toUserId: bestTarget.id,
            task: task,
            fromUser: overloadedMember,
            toUser: bestTarget
          });
        }
      });
    });
  }

  private getMemberTasks(memberId: number): any[] {
    // This would typically come from the service, for now we'll simulate
    return [];
  }

  private findBestReassignmentTarget(task: any, availableMembers: any[]): any {
    if (availableMembers.length === 0) return null;

    // Find member with lowest workload who has relevant skills
    return availableMembers
      .filter(member => member.workloadPercentage < 60)
      .sort((a, b) => (a.workloadPercentage || 0) - (b.workloadPercentage || 0))[0];
  }

  toggleReassignment(reassignment: TaskReassignment): void {
    const index = this.proposedReassignments.findIndex(r => 
      r.taskId === reassignment.taskId && r.fromUserId === reassignment.fromUserId
    );
    
    if (index > -1) {
      this.proposedReassignments.splice(index, 1);
    } else {
      this.proposedReassignments.push(reassignment);
    }
  }

  isReassignmentSelected(taskId: number, fromUserId: number): boolean {
    return this.proposedReassignments.some(r => 
      r.taskId === taskId && r.fromUserId === fromUserId
    );
  }

  getWorkloadColor(percentage: number): string {
    if (percentage >= 90) return 'danger';
    if (percentage >= 70) return 'warning';
    if (percentage >= 50) return 'info';
    return 'success';
  }

  getWorkloadWidth(percentage: number): string {
    return Math.min(percentage, 100) + '%';
  }

  getEstimatedNewWorkload(memberId: number): number {
    const currentWorkload = this.teamMembers.find(m => m.id === memberId)?.workloadPercentage || 0;
    const tasksBeingRemoved = this.proposedReassignments.filter(r => r.fromUserId === memberId).length;
    const tasksBeingAdded = this.proposedReassignments.filter(r => r.toUserId === memberId).length;
    
    // Rough estimation: each task is ~10% workload
    const estimatedChange = (tasksBeingAdded - tasksBeingRemoved) * 10;
    return Math.max(0, Math.min(100, currentWorkload + estimatedChange));
  }

  onApplyRebalancing(): void {
    if (this.proposedReassignments.length === 0) {
      this.notificationService.onWarning('No reassignments selected');
      return;
    }

    this.isLoading = true;

    const reassignmentRequests = this.proposedReassignments.map(reassignment => ({
      taskId: reassignment.taskId,
      newAssigneeId: reassignment.toUserId
    }));

    // Use individual task updates since bulk method doesn't exist
    const updatePromises = reassignmentRequests.map(request => 
      this.caseTaskService.updateTask(request.taskId, { 
        assignedToId: request.newAssigneeId 
      }).toPromise()
    );

    Promise.all(updatePromises).then(() => {
      this.notificationService.onSuccess(`Successfully rebalanced ${this.proposedReassignments.length} tasks`);
      this.workloadBalanced.emit({
        reassignments: this.proposedReassignments,
        action: 'workload_balanced'
      });
      this.activeModal.close('balanced');
    }).catch((error) => {
      console.error('Error rebalancing workload:', error);
      this.notificationService.onError('Failed to rebalance workload');
      this.isLoading = false;
    });
  }

  onCancel(): void {
    this.activeModal.dismiss('cancelled');
  }
}