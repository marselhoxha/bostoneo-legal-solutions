import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RbacService } from '../../../../core/services/rbac.service';
import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { RoleFormComponent } from './role-form.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-role-list',
  templateUrl: './role-list.component.html',
  styleUrls: ['./role-list.component.scss'],
  imports: [CommonModule, MatDialogModule, MatSnackBarModule, ConfirmationDialogComponent],
  standalone: true
})
export class RoleListComponent implements OnInit {
  roles: any[] = [];
  isLoading = false;
  
  constructor(
    private rbacService: RbacService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}
  
  ngOnInit(): void {
    this.loadRoles();
    
    // Debugging: Check current permissions
    console.log('Current permissions:', this.rbacService['permissionsSubject'].value);
    console.log('Current roles:', this.rbacService['rolesSubject'].value);
    console.log('Has SYSTEM:VIEW permission:', this.rbacService.hasPermissionSync('SYSTEM', 'VIEW'));
  }
  
  loadRoles(): void {
    this.isLoading = true;
    this.rbacService.getRoles().subscribe(
      response => {
        this.roles = response;
        this.isLoading = false;
      },
      error => {
        console.error('Error loading roles:', error);
        this.snackBar.open('Error loading roles', 'Close', { duration: 3000 });
        this.isLoading = false;
      }
    );
  }
  
  openRoleForm(role?: any): void {
    const dialogRef = this.dialog.open(RoleFormComponent, {
      width: '600px',
      data: { role: role ? { ...role } : {} }
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadRoles();
      }
    });
  }
  
  deleteRole(role: any): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Role',
        message: `Are you sure you want to delete the role "${role.name}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });
    
    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.rbacService.deleteRole(role.id).subscribe(
          () => {
            this.snackBar.open('Role deleted successfully', 'Close', { duration: 3000 });
            this.loadRoles();
          },
          error => {
            console.error('Error deleting role:', error);
            this.snackBar.open('Error deleting role', 'Close', { duration: 3000 });
          }
        );
      }
    });
  }
} 