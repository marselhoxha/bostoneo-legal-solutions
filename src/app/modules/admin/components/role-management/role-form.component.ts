import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RbacService } from '../../../../core/services/rbac.service';

@Component({
  selector: 'app-role-form',
  templateUrl: './role-form.component.html',
  styleUrls: ['./role-form.component.scss']
})
export class RoleFormComponent implements OnInit {
  roleForm: FormGroup;
  isEditMode = false;
  allPermissions: any[] = [];
  permissionsByResource: { [key: string]: any[] } = {};
  resourceTypes: string[] = [];
  isLoading = false;
  
  constructor(
    private fb: FormBuilder,
    private rbacService: RbacService,
    private dialogRef: MatDialogRef<RoleFormComponent>,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: { role: any }
  ) {
    this.roleForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(50)]],
      description: ['', Validators.maxLength(255)],
      hierarchyLevel: [0, [Validators.required, Validators.min(0)]],
      isSystemRole: [false],
      permissions: [[]]
    });
  }
  
  ngOnInit(): void {
    this.loadPermissions();
    
    if (this.data.role && this.data.role.id) {
      this.isEditMode = true;
      this.roleForm.patchValue({
        name: this.data.role.name,
        description: this.data.role.description,
        hierarchyLevel: this.data.role.hierarchyLevel || 0,
        isSystemRole: this.data.role.isSystemRole || false,
        permissions: this.data.role.permissions?.map((p: any) => p.id) || []
      });
      
      // Disable name field for system roles
      if (this.data.role.isSystemRole) {
        this.roleForm.get('name')?.disable();
        this.roleForm.get('isSystemRole')?.disable();
      }
    }
  }
  
  loadPermissions(): void {
    this.isLoading = true;
    this.rbacService.getPermissions().subscribe(
      response => {
        this.allPermissions = response;
        
        // Group permissions by resource type
        this.allPermissions.forEach(permission => {
          if (!this.permissionsByResource[permission.resourceType]) {
            this.permissionsByResource[permission.resourceType] = [];
          }
          this.permissionsByResource[permission.resourceType].push(permission);
        });
        
        this.resourceTypes = Object.keys(this.permissionsByResource);
        this.isLoading = false;
      },
      error => {
        console.error('Error loading permissions:', error);
        this.snackBar.open('Error loading permissions', 'Close', { duration: 3000 });
        this.isLoading = false;
      }
    );
  }
  
  onSubmit(): void {
    if (this.roleForm.invalid) {
      return;
    }
    
    const roleData = { ...this.roleForm.value };
    
    if (this.isEditMode) {
      roleData.id = this.data.role.id;
      this.rbacService.updateRole(roleData.id, roleData).subscribe(
        response => {
          this.snackBar.open('Role updated successfully', 'Close', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error => {
          console.error('Error updating role:', error);
          this.snackBar.open('Error updating role', 'Close', { duration: 3000 });
        }
      );
    } else {
      this.rbacService.createRole(roleData).subscribe(
        response => {
          this.snackBar.open('Role created successfully', 'Close', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error => {
          console.error('Error creating role:', error);
          this.snackBar.open('Error creating role', 'Close', { duration: 3000 });
        }
      );
    }
  }
  
  onCancel(): void {
    this.dialogRef.close();
  }
  
  toggleAllPermissionsForResource(resourceType: string, isChecked: boolean): void {
    const permissions = this.permissionsByResource[resourceType];
    const currentPermissions = new Set(this.roleForm.get('permissions')?.value || []);
    
    if (isChecked) {
      // Add all permissions for this resource type
      permissions.forEach(permission => {
        currentPermissions.add(permission.id);
      });
    } else {
      // Remove all permissions for this resource type
      permissions.forEach(permission => {
        currentPermissions.delete(permission.id);
      });
    }
    
    this.roleForm.get('permissions')?.setValue(Array.from(currentPermissions));
  }
  
  isAllResourcePermissionsSelected(resourceType: string): boolean {
    const permissions = this.permissionsByResource[resourceType];
    const currentPermissions = new Set(this.roleForm.get('permissions')?.value || []);
    
    return permissions.every(permission => currentPermissions.has(permission.id));
  }
  
  isSomeResourcePermissionsSelected(resourceType: string): boolean {
    const permissions = this.permissionsByResource[resourceType];
    const currentPermissions = new Set(this.roleForm.get('permissions')?.value || []);
    
    return permissions.some(permission => currentPermissions.has(permission.id)) && 
           !this.isAllResourcePermissionsSelected(resourceType);
  }

  handlePermissionChange(permissionId: number, isChecked: boolean): void {
    const currentPermissions = this.roleForm.get('permissions')?.value || [];
    
    if (isChecked) {
      // Add permission to the list
      this.roleForm.get('permissions')?.setValue([...currentPermissions, permissionId]);
    } else {
      // Remove permission from the list
      this.roleForm.get('permissions')?.setValue(
        currentPermissions.filter((id: number) => id !== permissionId)
      );
    }
  }
} 