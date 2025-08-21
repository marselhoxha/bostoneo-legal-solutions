import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { UserService } from '../../../../../service/user.service';
import { NotificationService } from '../../../../../service/notification.service';
import { CaseAssignmentService } from '../../../../../service/case-assignment.service';
import { CaseRoleType } from '../../../../../interface/case-assignment';

export interface TeamAssignmentData {
  caseId: number;
  currentTeamMembers: any[];
  availableUsers: any[];
}

@Component({
  selector: 'app-team-assignment-modal',
  templateUrl: './team-assignment-modal.component.html',
  styleUrls: ['./team-assignment-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class TeamAssignmentModalComponent implements OnInit {
  @Input() data!: TeamAssignmentData;
  @Output() teamUpdated = new EventEmitter<any>();

  teamForm: FormGroup;
  isLoading = false;
  availableUsers: any[] = [];
  currentTeamMembers: any[] = [];
  selectedUsers: number[] = [];
  
  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private userService: UserService,
    private caseAssignmentService: CaseAssignmentService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.teamForm = this.fb.group({
      teamMembers: [[], Validators.required],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.setupData();
    this.loadAvailableUsers();
  }

  private setupData(): void {
    this.currentTeamMembers = this.data.currentTeamMembers || [];
    this.selectedUsers = this.currentTeamMembers.map(member => member.id);
    
    this.teamForm.patchValue({
      teamMembers: this.selectedUsers
    });
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

  onUserToggle(userId: number, isChecked: boolean): void {
    if (isChecked) {
      if (!this.selectedUsers.includes(userId)) {
        this.selectedUsers.push(userId);
      }
    } else {
      const index = this.selectedUsers.indexOf(userId);
      if (index > -1) {
        this.selectedUsers.splice(index, 1);
      }
    }
    
    this.teamForm.patchValue({
      teamMembers: this.selectedUsers
    });
  }

  isUserSelected(userId: number): boolean {
    return this.selectedUsers.includes(userId);
  }

  isCurrentMember(userId: number): boolean {
    return this.currentTeamMembers.some(member => member.id === userId);
  }

  getUserStatus(userId: number): string {
    const isSelected = this.isUserSelected(userId);
    const isCurrent = this.isCurrentMember(userId);
    
    if (isSelected && isCurrent) return 'current';
    if (isSelected && !isCurrent) return 'adding';
    if (!isSelected && isCurrent) return 'removing';
    return 'available';
  }

  getUserStatusText(userId: number): string {
    const status = this.getUserStatus(userId);
    switch (status) {
      case 'current': return 'Current member';
      case 'adding': return 'Will be added';
      case 'removing': return 'Will be removed';
      default: return 'Available';
    }
  }

  getUserStatusClass(userId: number): string {
    const status = this.getUserStatus(userId);
    switch (status) {
      case 'current': return 'text-success';
      case 'adding': return 'text-primary';
      case 'removing': return 'text-warning';
      default: return 'text-muted';
    }
  }

  getAddedMembers(): any[] {
    return this.availableUsers.filter(user => 
      this.selectedUsers.includes(user.id) && 
      !this.isCurrentMember(user.id)
    );
  }

  getRemovedMembers(): any[] {
    return this.currentTeamMembers.filter(member => 
      !this.selectedUsers.includes(member.id)
    );
  }

  onUpdateTeam(): void {
    if (this.teamForm.invalid) {
      this.teamForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const formValue = this.teamForm.value;

    const updateData = {
      caseId: this.data.caseId,
      teamMemberIds: this.selectedUsers,
      notes: formValue.notes
    };

    // Process team changes using individual assign/unassign operations
    const addedMembers = this.getAddedMembers();
    const removedMembers = this.getRemovedMembers();
    
    const operations: Promise<any>[] = [];
    
    // Add new members
    addedMembers.forEach(member => {
      const assignRequest = {
        caseId: this.data.caseId,
        userId: member.id,
        roleType: CaseRoleType.ASSOCIATE // Default role for team members
      };
      operations.push(this.caseAssignmentService.assignCase(assignRequest).toPromise());
    });
    
    // Remove members
    removedMembers.forEach(member => {
      operations.push(
        this.caseAssignmentService.unassignCase(
          this.data.caseId, 
          member.id, 
          formValue.notes || 'Team restructuring'
        ).toPromise()
      );
    });
    
    if (operations.length === 0) {
      this.notificationService.onInfo('No changes made to team');
      this.isLoading = false;
      return;
    }
    
    Promise.all(operations).then(() => {
      this.notificationService.onSuccess('Team updated successfully');
      this.teamUpdated.emit({
        addedMembers: addedMembers,
        removedMembers: removedMembers,
        currentTeam: this.selectedUsers,
        action: 'team_updated'
      });
      this.activeModal.close('updated');
    }).catch((error) => {
      console.error('Error updating team:', error);
      this.notificationService.onError('Failed to update team');
      this.isLoading = false;
    });
  }

  onCancel(): void {
    this.activeModal.dismiss('cancelled');
  }
}