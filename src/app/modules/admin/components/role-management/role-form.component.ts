import { Component, Inject, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RbacService, Role as RbacRole, Permission as RbacPermission } from '../../../../core/services/rbac.service';

@Component({
  selector: 'app-role-form',
  templateUrl: './role-form.component.html',
  styleUrls: ['./role-form.component.scss']
})
export class RoleFormComponent implements OnInit {
  @Input() role: RbacRole | null = null;
  @Input() permissions: RbacPermission[] = [];
  @Output() submit = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  roleForm: FormGroup;
  isEditMode = false;
  allPermissions: RbacPermission[] = [];
  filteredPermissions: RbacPermission[] = [];
  permissionsByResource: { [key: string]: RbacPermission[] } = {};
  resourceTypes: string[] = [];
  isLoading = false;
  isSubmitting = false;
  permissionSearchTerm = '';
  
  constructor(
    private fb: FormBuilder,
    private rbacService: RbacService,
    private dialogRef: MatDialogRef<RoleFormComponent>,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: { role: RbacRole }
  ) {
    this.roleForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      hierarchyLevel: ['', [Validators.required]],
      isSystemRole: [false],
      permissions: [[]]
    });
  }
  
  ngOnInit(): void {
    // Use injected data or input property
    this.role = this.role || this.data?.role || null;
    
    this.loadPermissions();
    
    if (this.role && this.role.id) {
      this.isEditMode = true;
      this.roleForm.patchValue({
        name: this.role.name,
        description: this.role.description,
        hierarchyLevel: this.role.hierarchyLevel || '',
        isSystemRole: this.role.isSystemRole || false,
        permissions: this.role.permissions?.map((p: any) => p.id) || []
      });
      
      // Disable name field for system roles
      if (this.role.isSystemRole) {
        this.roleForm.get('name')?.disable();
        this.roleForm.get('isSystemRole')?.disable();
      }
    }
  }
  
  loadPermissions(): void {
    this.isLoading = true;
    
    // Use input permissions if available, otherwise load from service
    if (this.permissions && this.permissions.length > 0) {
      this.allPermissions = this.permissions;
      this.filteredPermissions = [...this.allPermissions];
      this.groupPermissionsByResource();
      this.isLoading = false;
    } else {
      this.rbacService.getPermissions().subscribe(
        response => {
          this.allPermissions = response;
          this.filteredPermissions = [...this.allPermissions];
          this.groupPermissionsByResource();
          this.isLoading = false;
        },
        error => {
          console.error('Error loading permissions:', error);
          this.snackBar.open('Error loading permissions', 'Close', { duration: 3000 });
          this.isLoading = false;
        }
      );
    }
  }

  groupPermissionsByResource(): void {
    // Group permissions by resource type
    this.allPermissions.forEach(permission => {
      if (!this.permissionsByResource[permission.resourceType]) {
        this.permissionsByResource[permission.resourceType] = [];
      }
      this.permissionsByResource[permission.resourceType].push(permission);
    });
    
    this.resourceTypes = Object.keys(this.permissionsByResource);
  }

  getSelectedPermissionsCount(): number {
    const selectedPermissions = this.roleForm.get('permissions')?.value || [];
    return selectedPermissions.length;
  }

  getHierarchyLabel(level: number | string): string {
    const numLevel = Number(level);
    if (numLevel >= 90) return 'Executive';
    if (numLevel >= 80) return 'Senior Management';
    if (numLevel >= 70) return 'Management';
    if (numLevel >= 60) return 'Supervisor';
    if (numLevel >= 50) return 'Senior Staff';
    if (numLevel >= 40) return 'Staff';
    if (numLevel >= 30) return 'Junior Staff';
    if (numLevel >= 20) return 'Associate';
    if (numLevel >= 10) return 'Trainee';
    return 'Basic';
  }

  filterPermissions(): void {
    if (!this.permissionSearchTerm.trim()) {
      this.filteredPermissions = [...this.allPermissions];
    } else {
      const searchTerm = this.permissionSearchTerm.toLowerCase();
      this.filteredPermissions = this.allPermissions.filter(permission =>
        permission.name.toLowerCase().includes(searchTerm) ||
        permission.actionType.toLowerCase().includes(searchTerm) ||
        permission.resourceType.toLowerCase().includes(searchTerm)
      );
    }
  }

  selectAllPermissions(): void {
    const allPermissionIds = this.allPermissions.map(p => p.id);
    this.roleForm.get('permissions')?.setValue(allPermissionIds);
  }

  deselectAllPermissions(): void {
    this.roleForm.get('permissions')?.setValue([]);
  }

  selectBasicPermissions(): void {
    // Select basic read permissions
    const basicPermissions = this.allPermissions.filter(p => 
      p.actionType === 'READ' || p.actionType === 'VIEW'
    ).map(p => p.id);
    this.roleForm.get('permissions')?.setValue(basicPermissions);
  }

  isPermissionSelected(permission: RbacPermission): boolean {
    const selectedPermissions = this.roleForm.get('permissions')?.value || [];
    return selectedPermissions.includes(permission.id);
  }

  togglePermission(permission: RbacPermission): void {
    const currentPermissions = this.roleForm.get('permissions')?.value || [];
    
    if (this.isPermissionSelected(permission)) {
      // Remove permission
      const updatedPermissions = currentPermissions.filter((id: number) => id !== permission.id);
      this.roleForm.get('permissions')?.setValue(updatedPermissions);
    } else {
      // Add permission
      this.roleForm.get('permissions')?.setValue([...currentPermissions, permission.id]);
    }
  }

  trackByPermissionId(index: number, permission: RbacPermission): number {
    return permission.id;
  }
  
  onSubmit(): void {
    if (this.roleForm.invalid) {
      this.markFormGroupTouched();
      return;
    }
    
    this.isSubmitting = true;
    const formValue = this.roleForm.value;
    const roleData = {
      name: formValue.name,
      description: formValue.description,
      hierarchyLevel: Number(formValue.hierarchyLevel),
      isSystemRole: formValue.isSystemRole || false,
      permissions: this.allPermissions.filter(p => 
        formValue.permissions && formValue.permissions.includes(p.id)
      )
    };
    
    console.log('Submitting role data:', roleData);
    
    // Emit the submit event for parent component handling
    this.submit.emit(roleData);
    
    if (this.dialogRef) {
      // Handle dialog-based submission
      if (this.isEditMode && this.role) {
        this.rbacService.updateRole(this.role.id, roleData).subscribe({
          next: (response) => {
            console.log('Role update response:', response);
            this.snackBar.open('Role updated successfully', 'Close', { 
              duration: 3000,
              panelClass: ['bg-success', 'text-white']
            });
            this.dialogRef.close(true);
            this.isSubmitting = false;
          },
          error: (error) => {
            console.error('Error updating role:', error);
            this.snackBar.open('Error updating role. Please try again.', 'Close', { 
              duration: 5000,
              panelClass: ['bg-danger', 'text-white']
            });
            this.isSubmitting = false;
          }
        });
      } else {
        this.rbacService.createRole(roleData).subscribe({
          next: (response) => {
            console.log('Role create response:', response);
            this.snackBar.open('Role created successfully', 'Close', { 
              duration: 3000,
              panelClass: ['bg-success', 'text-white']
            });
            this.dialogRef.close(true);
            this.isSubmitting = false;
          },
          error: (error) => {
            console.error('Error creating role:', error);
            this.snackBar.open('Error creating role. Please try again.', 'Close', { 
              duration: 5000,
              panelClass: ['bg-danger', 'text-white']
            });
            this.isSubmitting = false;
          }
        });
      }
    }
  }
  
  private markFormGroupTouched(): void {
    Object.keys(this.roleForm.controls).forEach(key => {
      const control = this.roleForm.get(key);
      control?.markAsTouched();
    });
  }
  
  onCancel(): void {
    this.cancel.emit();
    if (this.dialogRef) {
      this.dialogRef.close();
    }
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