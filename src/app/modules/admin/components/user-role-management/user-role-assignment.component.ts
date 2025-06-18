import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RbacService } from '../../../../core/services/rbac.service';
import { UserService } from '../../../../service/user.service';
import { CaseService } from '@app/modules/legal/services/case.service';

@Component({
  selector: 'app-user-role-assignment',
  templateUrl: './user-role-assignment.component.html',
  styleUrls: ['./user-role-assignment.component.scss']
})
export class UserRoleAssignmentComponent implements OnInit {
  users: any[] = [];
  roles: any[] = [];
  availableRoles: any[] = [];
  selectedUser: any = null;
  userRoles: any[] = [];
  caseRoles: any[] = [];
  cases: any[] = [];
  
  isLoadingUsers = false;
  isLoadingRoles = false;
  isLoadingUserRoles = false;
  isLoadingCaseRoles = false;
  isAssigningRole = false;
  isAssigningCaseRole = false;
  
  roleForm: FormGroup;
  caseRoleForm: FormGroup;
  
  constructor(
    private userService: UserService,
    private rbacService: RbacService,
    private caseService: CaseService,
    private formBuilder: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.roleForm = this.formBuilder.group({
      roleId: [null, Validators.required],
      isPrimary: [false],
      expiresAt: [null]
    });
    
    this.caseRoleForm = this.formBuilder.group({
      caseId: [null, Validators.required],
      roleId: [null, Validators.required],
      expiresAt: [null]
    });
  }
  
  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
    this.loadCases();
  }
  
  loadUsers(): void {
    this.isLoadingUsers = true;
    this.rbacService.getAllUsers().subscribe({
      next: (response) => {
        this.users = response || [];
        this.isLoadingUsers = false;
      },
      error: (error) => {
        console.error('Error loading users', error);
        this.snackBar.open('Failed to load users', 'Close', { duration: 3000 });
        this.isLoadingUsers = false;
      }
    });
  }
  
  loadRoles(): void {
    this.isLoadingRoles = true;
    this.rbacService.getRoles().subscribe({
      next: (response) => {
        this.roles = response || [];
        this.availableRoles = [...this.roles];
        this.isLoadingRoles = false;
      },
      error: (error) => {
        console.error('Error loading roles', error);
        this.snackBar.open('Failed to load roles', 'Close', { duration: 3000 });
        this.isLoadingRoles = false;
      }
    });
  }
  
  loadCases(): void {
    this.caseService.getCases().subscribe({
      next: (response) => {
        this.cases = response.data?.page?.content || [];
      },
      error: (error) => {
        console.error('Error loading cases', error);
        this.snackBar.open('Failed to load cases', 'Close', { duration: 3000 });
      }
    });
  }
  
  onUserSelect(): void {
    if (this.selectedUser) {
      this.loadUserRoles();
      this.loadUserCaseRoles();
      this.roleForm.reset({
        roleId: null,
        isPrimary: false,
        expiresAt: null
      });
      this.caseRoleForm.reset({
        caseId: null,
        roleId: null,
        expiresAt: null
      });
    } else {
      this.userRoles = [];
      this.caseRoles = [];
    }
  }
  
  loadUserRoles(): void {
    if (!this.selectedUser) return;
    
    this.isLoadingUserRoles = true;
    this.rbacService.getUserRoles(this.selectedUser.id).subscribe({
      next: (response) => {
        this.userRoles = response.map((role: any) => {
          return {
            userId: this.selectedUser.id,
            roleId: role.id,
            roleName: role.name,
            primary: role.primary || false,
            expiresAt: role.expiresAt || null
          };
        }) || [];
        this.isLoadingUserRoles = false;
      },
      error: (error) => {
        console.error('Error loading user roles', error);
        this.snackBar.open('Failed to load user roles', 'Close', { duration: 3000 });
        this.isLoadingUserRoles = false;
      }
    });
  }
  
  loadUserCaseRoles(): void {
    if (!this.selectedUser) return;
    
    this.isLoadingCaseRoles = true;
    this.rbacService.getUserCaseRoles(this.selectedUser.id).subscribe({
      next: (response) => {
        this.caseRoles = response || [];
        this.isLoadingCaseRoles = false;
      },
      error: (error) => {
        console.error('Error loading case roles', error);
        this.snackBar.open('Failed to load case roles', 'Close', { duration: 3000 });
        this.isLoadingCaseRoles = false;
      }
    });
  }
  
  assignRole(): void {
    if (this.roleForm.invalid || !this.selectedUser) return;
    
    const formData = {
      roleId: this.roleForm.value.roleId,
      isPrimary: this.roleForm.value.isPrimary,
      expiresAt: this.roleForm.value.expiresAt
    };
    
    this.isAssigningRole = true;
    
    // Use the correct API endpoint that matches the backend
    this.rbacService.assignRoleToUser(this.selectedUser.id, formData.roleId, formData.expiresAt ? new Date(formData.expiresAt) : undefined).subscribe({
      next: () => {
        this.snackBar.open('Role assigned successfully', 'Close', { duration: 3000 });
        
        // If this is set as primary role, update it
        if (formData.isPrimary) {
          this.rbacService.setPrimaryRole(this.selectedUser.id, formData.roleId).subscribe({
            next: () => {
              this.loadUserRoles();
            },
            error: (error) => {
              console.error('Error setting primary role', error);
              this.loadUserRoles(); // Still reload to show the assigned role
            }
          });
        } else {
        this.loadUserRoles();
        }
        
        this.roleForm.reset({
          roleId: null,
          isPrimary: false,
          expiresAt: null
        });
        this.isAssigningRole = false;
      },
      error: (error) => {
        console.error('Error assigning role', error);
        this.snackBar.open('Failed to assign role', 'Close', { duration: 3000 });
        this.isAssigningRole = false;
      }
    });
  }
  
  assignCaseRole(): void {
    if (this.caseRoleForm.invalid || !this.selectedUser) return;
    
    const caseId = this.caseRoleForm.value.caseId;
    const userId = this.selectedUser.id;
    const roleId = this.caseRoleForm.value.roleId;
    
    this.isAssigningCaseRole = true;
    this.rbacService.assignCaseRole(caseId, userId, roleId).subscribe({
      next: () => {
        this.snackBar.open('Case role assigned successfully', 'Close', { duration: 3000 });
        this.loadUserCaseRoles();
        this.caseRoleForm.reset({
          caseId: null,
          roleId: null,
          expiresAt: null
        });
        this.isAssigningCaseRole = false;
      },
      error: (error) => {
        console.error('Error assigning case role', error);
        this.snackBar.open('Failed to assign case role', 'Close', { duration: 3000 });
        this.isAssigningCaseRole = false;
      }
    });
  }
  
  removeRole(userRole: any): void {
    if (confirm('Are you sure you want to remove this role from the user?')) {
      this.rbacService.removeRoleFromUser(userRole.userId, userRole.roleId).subscribe({
        next: () => {
          this.snackBar.open('Role removed successfully', 'Close', { duration: 3000 });
          this.loadUserRoles();
        },
        error: (error) => {
          console.error('Error removing role', error);
          this.snackBar.open('Failed to remove role', 'Close', { duration: 3000 });
        }
      });
    }
  }
  
  removeCaseRole(caseRole: any): void {
    if (confirm('Are you sure you want to remove this case role assignment?')) {
      // Use the assignment ID from the case role object
      const assignmentId = caseRole.id || caseRole.assignmentId;
      
      if (!assignmentId) {
        this.snackBar.open('Missing assignment ID for this role assignment', 'Close', { duration: 3000 });
        return;
      }
      
      this.rbacService.removeCaseRole(assignmentId).subscribe({
        next: () => {
          this.snackBar.open('Case role removed successfully', 'Close', { duration: 3000 });
          this.loadUserCaseRoles();
        },
        error: (error) => {
          console.error('Error removing case role', error);
          this.snackBar.open('Failed to remove case role', 'Close', { duration: 3000 });
        }
      });
    }
  }
  
  setPrimaryRole(userRole: any): void {
    this.rbacService.setPrimaryRole(userRole.userId, userRole.roleId).subscribe({
      next: () => {
        this.snackBar.open('Primary role set successfully', 'Close', { duration: 3000 });
        this.loadUserRoles();
      },
      error: (error) => {
        console.error('Error setting primary role', error);
        this.snackBar.open('Failed to set primary role', 'Close', { duration: 3000 });
      }
    });
  }
} 