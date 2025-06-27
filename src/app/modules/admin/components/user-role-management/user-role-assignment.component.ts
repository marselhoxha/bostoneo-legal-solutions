import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RbacService } from '../../../../core/services/rbac.service';
import { UserService } from '../../../../service/user.service';
import { LegalCaseService } from '@app/modules/legal/services/legal-case.service';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  enabled: boolean;
  roles?: string[];
}

interface Role {
  id: number;
  name: string;
  description?: string;
  hierarchyLevel: number;
  systemRole?: boolean;
}

interface UserRole {
  id?: number;
  userId: number;
  roleId: number;
  roleName: string;
  primary: boolean;
  expiresAt?: Date;
  assignedAt?: Date;
}

interface CaseRole {
  id: number;
  caseId: number;
  userId: number;
  roleId: number;
  caseName?: string;
  roleName?: string;
  role?: Role;
  legalCase?: any;
  expiresAt?: Date;
  assignedAt?: Date;
}

interface LegalCase {
  id: number;
  title: string;
  caseNumber: string;
  clientName?: string;
  status: string;
}

@Component({
  selector: 'app-user-role-assignment',
  templateUrl: './user-role-assignment.component.html',
  styleUrls: ['./user-role-assignment.component.scss']
})
export class UserRoleAssignmentComponent implements OnInit, OnDestroy {
  users: User[] = [];
  filteredUsers: User[] = [];
  roles: Role[] = [];
  availableRoles: Role[] = [];
  selectedUser: User | null = null;
  userRoles: UserRole[] = [];
  caseRoles: CaseRole[] = [];
  cases: LegalCase[] = [];
  searchTerm = '';
  
  isLoadingUsers = false;
  isLoadingRoles = false;
  isLoadingUserRoles = false;
  isLoadingCaseRoles = false;
  isAssigningRole = false;
  isAssigningCaseRole = false;
  
  roleForm: FormGroup;
  caseRoleForm: FormGroup;
  
  private destroy$ = new Subject<void>();
  
  constructor(
    private userService: UserService,
    private rbacService: RbacService,
    private legalCaseService: LegalCaseService,
    private formBuilder: FormBuilder,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForms();
  }
  
  ngOnInit(): void {
    this.loadInitialData();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  private initializeForms(): void {
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
  
  private loadInitialData(): void {
    this.isLoadingUsers = true;
    this.isLoadingRoles = true;
    
    forkJoin({
      users: this.rbacService.getAllUsers().pipe(
        catchError(error => {
          console.error('Error loading users:', error);
          this.showError('Failed to load users');
          return of([]);
        })
      ),
      roles: this.rbacService.getRoles().pipe(
        catchError(error => {
          console.error('Error loading roles:', error);
          this.showError('Failed to load roles');
          return of([]);
        })
      ),
      cases: this.legalCaseService.getAllCases(0, 1000).pipe(
        catchError(error => {
          console.error('Error loading cases:', error);
          this.showError('Failed to load cases');
          return of({ data: { page: { content: [] } } });
        })
      )
    }).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoadingUsers = false;
        this.isLoadingRoles = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response) => {
        this.users = response.users || [];
        this.filteredUsers = [...this.users];
        this.roles = response.roles || [];
        this.availableRoles = [...this.roles];
        this.cases = response.cases?.data?.page?.content || [];
        
        console.log('Loaded data:', {
          users: this.users.length,
          roles: this.roles.length,
          cases: this.cases.length
        });
      },
      error: (error) => {
        console.error('Error in loadInitialData:', error);
        this.showError('Failed to load initial data');
      }
    });
  }
  
  selectUser(user: User): void {
    this.selectedUser = user;
    this.onUserSelect();
  }
  
  filterUsers(): void {
    if (!this.searchTerm.trim()) {
      this.filteredUsers = [...this.users];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredUsers = this.users.filter(user => 
        user.firstName?.toLowerCase().includes(term) ||
        user.lastName?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term)
      );
    }
  }
  
  onUserSelect(): void {
    if (this.selectedUser) {
      this.loadUserRoles();
      this.loadUserCaseRoles();
      this.resetForms();
    } else {
      this.clearUserData();
    }
  }
  
  private resetForms(): void {
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
  }
  
  private clearUserData(): void {
    this.userRoles = [];
    this.caseRoles = [];
  }
  
  loadUserRoles(): void {
    if (!this.selectedUser) return;
    
    this.isLoadingUserRoles = true;
    this.rbacService.getUserRoles(this.selectedUser.id).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoadingUserRoles = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response: any[]) => {
        this.userRoles = response.map((role: any) => ({
          userId: this.selectedUser!.id,
          roleId: role.id,
          roleName: role.name,
          primary: role.primary || false,
          expiresAt: role.expiresAt ? new Date(role.expiresAt) : undefined,
          assignedAt: role.assignedAt ? new Date(role.assignedAt) : undefined
        }));
        
        console.log('User roles loaded:', this.userRoles);
      },
      error: (error) => {
        console.error('Error loading user roles:', error);
        this.showError('Failed to load user roles');
        this.userRoles = [];
      }
    });
  }
  
  loadUserCaseRoles(): void {
    if (!this.selectedUser) return;
    
    this.isLoadingCaseRoles = true;
    this.rbacService.getUserCaseRoles(this.selectedUser.id).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoadingCaseRoles = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response: any[]) => {
        this.caseRoles = response || [];
        console.log('Case roles loaded:', this.caseRoles);
      },
      error: (error) => {
        console.error('Error loading case roles:', error);
        this.showError('Failed to load case roles');
        this.caseRoles = [];
      }
    });
  }
  
  assignRole(): void {
    if (this.roleForm.invalid || !this.selectedUser) {
      this.showError('Please fill in all required fields');
      return;
    }
    
    const formData = this.roleForm.value;
    this.isAssigningRole = true;
    
    // Convert string values to numbers
    const roleId = Number(formData.roleId);
    if (isNaN(roleId)) {
      this.showError('Invalid role selected');
      this.isAssigningRole = false;
      return;
    }
    
    this.rbacService.assignRoleToUser(
      this.selectedUser.id, 
      roleId, 
      formData.expiresAt ? new Date(formData.expiresAt) : undefined
    ).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isAssigningRole = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (success) => {
        if (success) {
          this.showSuccess('Role assigned successfully');
          
          // Handle primary role setting
          if (formData.isPrimary) {
            this.rbacService.setPrimaryRole(this.selectedUser!.id, roleId).pipe(
              takeUntil(this.destroy$)
            ).subscribe({
              next: () => {
                this.loadUserRoles();
              },
              error: (error) => {
                console.error('Error setting primary role:', error);
                this.showError('Role assigned but failed to set as primary');
                this.loadUserRoles();
              }
            });
          } else {
            this.loadUserRoles();
          }
          
          this.resetForms();
        } else {
          this.showError('Failed to assign role');
        }
      },
      error: (error) => {
        console.error('Error assigning role:', error);
        this.showError('Failed to assign role');
      }
    });
  }
  
  assignCaseRole(): void {
    if (this.caseRoleForm.invalid || !this.selectedUser) {
      this.showError('Please fill in all required fields');
      return;
    }
    
    const formData = this.caseRoleForm.value;
    this.isAssigningCaseRole = true;
    
    // Convert string values to numbers
    const caseId = Number(formData.caseId);
    const roleId = Number(formData.roleId);
    
    if (isNaN(caseId) || isNaN(roleId)) {
      this.showError('Invalid case or role selected');
      this.isAssigningCaseRole = false;
      return;
    }
    
    this.rbacService.assignCaseRole(caseId, this.selectedUser.id, roleId).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isAssigningCaseRole = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (success) => {
        if (success) {
          this.showSuccess('Case role assigned successfully');
          this.loadUserCaseRoles();
          this.resetForms();
        } else {
          this.showError('Failed to assign case role');
        }
      },
      error: (error) => {
        console.error('Error assigning case role:', error);
        this.showError('Failed to assign case role');
      }
    });
  }
  
  removeRole(userRole: UserRole): void {
    if (!confirm('Are you sure you want to remove this role from the user?')) {
      return;
    }
    
    this.rbacService.removeRoleFromUser(userRole.userId, userRole.roleId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (success) => {
        if (success) {
          this.showSuccess('Role removed successfully');
          this.loadUserRoles();
        } else {
          this.showError('Failed to remove role');
        }
      },
      error: (error) => {
        console.error('Error removing role:', error);
        this.showError('Failed to remove role');
      }
    });
  }
  
  removeCaseRole(caseRole: CaseRole): void {
    if (!confirm('Are you sure you want to remove this case role assignment?')) {
      return;
    }
    
    const assignmentId = caseRole.id;
    if (!assignmentId) {
      this.showError('Missing assignment ID for this role assignment');
      return;
    }
    
    this.rbacService.removeCaseRole(assignmentId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (success) => {
        if (success) {
          this.showSuccess('Case role removed successfully');
          this.loadUserCaseRoles();
        } else {
          this.showError('Failed to remove case role');
        }
      },
      error: (error) => {
        console.error('Error removing case role:', error);
        this.showError('Failed to remove case role');
      }
    });
  }
  
  setPrimaryRole(userRole: UserRole): void {
    this.rbacService.setPrimaryRole(userRole.userId, userRole.roleId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (success) => {
        if (success) {
          this.showSuccess('Primary role set successfully');
          this.loadUserRoles();
        } else {
          this.showError('Failed to set primary role');
        }
      },
      error: (error) => {
        console.error('Error setting primary role:', error);
        this.showError('Failed to set primary role');
      }
    });
  }
  
  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['bg-success', 'text-white']
    });
  }
  
  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['bg-danger', 'text-white']
    });
  }
  
  getUserDisplayName(user: User): string {
    return `${user.firstName} ${user.lastName}`.trim() || user.email;
  }
  
  getRoleDisplayName(role: Role | UserRole | CaseRole | string | any): string {
    if (typeof role === 'string') {
      return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
    
    if (role && typeof role === 'object') {
      // Handle Role object
      if (role.name) {
        return role.name.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      }
      
      // Handle UserRole object
      if (role.roleName) {
        return role.roleName.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      }
      
      // Handle CaseRole object
      if (role.roleName || (role.role && role.role.name)) {
        const roleName = role.roleName || role.role.name;
        return roleName.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      }
    }
    
    return 'Unknown Role';
  }
  
  getCaseDisplayName(caseItem: LegalCase | CaseRole | any): string {
    if (!caseItem) return 'Unknown Case';
    
    // Handle LegalCase object
    if (caseItem.title || caseItem.caseNumber) {
      return caseItem.title || caseItem.caseNumber || `Case #${caseItem.id}`;
    }
    
    // Handle CaseRole object
    if (caseItem.caseName) {
      return caseItem.caseName;
    }
    
    if (caseItem.legalCase) {
      return caseItem.legalCase.title || caseItem.legalCase.caseNumber || `Case #${caseItem.legalCase.id}`;
    }
    
    if (caseItem.caseId) {
      return `Case #${caseItem.caseId}`;
    }
    
    return 'Unknown Case';
  }
} 