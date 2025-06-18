import { Component, OnInit } from '@angular/core';
import { RbacService } from '../../../../core/services/rbac.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-role-hierarchy',
  templateUrl: './role-hierarchy.component.html',
  styles: []
})
export class RoleHierarchyComponent implements OnInit {
  roles: any[] = [];
  permissions: any[] = [];
  loading = false;
  
  hierarchyLevels: any[] = [
    { level: 100, class: 'top-level', name: 'Administrator' },
    { level: 90, class: 'level-2', name: 'Managing Partner' },
    { level: 80, class: 'level-3', name: 'Attorney' },
    { level: 70, class: 'level-4', name: 'Paralegal' },
    { level: 60, class: 'level-5', name: 'Legal Assistant' },
    { level: 60, class: 'level-5', name: 'Finance' },
    { level: 50, class: 'level-6', name: 'Client' },
    { level: 10, class: 'level-7', name: 'Basic User' }
  ];
  
  resourceCategories: any[] = [
    { name: 'Case', icon: 'ri-folder-line' },
    { name: 'Document', icon: 'ri-file-text-line' },
    { name: 'Client', icon: 'ri-user-line' },
    { name: 'Calendar', icon: 'ri-calendar-line' },
    { name: 'Financial', icon: 'ri-money-dollar-circle-line' },
    { name: 'Administrative', icon: 'ri-settings-line' }
  ];
  
  actionTypes: string[] = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'ADMIN'];
  
  constructor(
    private rbacService: RbacService,
    private snackBar: MatSnackBar
  ) {}
  
  ngOnInit(): void {
    this.loadRoles();
    this.loadPermissions();
  }
  
  loadRoles(): void {
    this.loading = true;
    this.rbacService.getRoles().subscribe({
      next: (response) => {
        this.roles = response || [];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading roles', error);
        this.snackBar.open('Failed to load roles', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }
  
  loadPermissions(): void {
    this.loading = true;
    this.rbacService.getPermissions().subscribe({
      next: (response) => {
        this.permissions = response || [];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading permissions', error);
        this.snackBar.open('Failed to load permissions', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }
  
  getRolesByLevel(level: number): any[] {
    return this.roles.filter(role => role.hierarchyLevel === level);
  }
  
  getPermissionsByResource(resource: string): any[] {
    return this.permissions.filter(permission => 
      permission.resourceType === resource.toUpperCase()
    );
  }
  
  hasPermission(roleName: string, permissionName: string): boolean {
    const role = this.roles.find(r => r.name === roleName);
    if (!role || !role.permissions) return false;
    
    return role.permissions.some((p: any) => p.name === permissionName);
  }
  
  getPermissionClass(roleName: string, permissionName: string): string {
    return this.hasPermission(roleName, permissionName) ? 'has-permission' : 'no-permission';
  }
} 