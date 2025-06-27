import { Component, Inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RbacService, Role as RbacRole, Permission as RbacPermission } from '@app/core/services/rbac.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';

// Use the interfaces from RBAC service to avoid type conflicts
interface Permission extends RbacPermission {
  assigned?: boolean;
}

interface Role extends RbacRole {
  // Already compatible with RbacRole
}

interface PermissionGroup {
  name: string;
  displayName: string;
  permissions: Permission[];
  assignedCount: number;
  isExpanded: boolean;
}

@Component({
  selector: 'app-permission-assignment',
  templateUrl: './permission-assignment.component.html',
  styleUrls: ['./permission-assignment.component.scss']
})
export class PermissionAssignmentComponent implements OnInit, OnDestroy {
  role: Role;
  allPermissions: Permission[] = [];
  groupedPermissions: PermissionGroup[] = [];
  
  // Counts
  assignedCount = 0;
  unassignedCount = 0;
  
  // UI State
  searchTerm = '';
  filterType = 'all';
  loading = false;
  saving = false;
  
  private destroy$ = new Subject<void>();
  private originalPermissions: Set<number> = new Set();

  constructor(
    public dialogRef: MatDialogRef<PermissionAssignmentComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { role: Role },
    private rbacService: RbacService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {
    this.role = data.role;
  }

  ngOnInit(): void {
    this.loadPermissions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPermissions(): void {
    this.loading = true;
    console.log('Loading permissions for role:', this.role.name);
    
    this.rbacService.getPermissions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (permissions) => {
          this.allPermissions = permissions as Permission[] || [];
          console.log('Loaded permissions:', this.allPermissions.length);
          
          // Mark assigned permissions and store original state
          const rolePermissionIds = new Set((this.role.permissions || []).map(p => p.id));
          this.originalPermissions = new Set(rolePermissionIds);
          
          this.allPermissions.forEach(permission => {
            permission.assigned = rolePermissionIds.has(permission.id);
          });
          
          this.updateData();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading permissions:', error);
          this.showError('Failed to load permissions');
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  updateData(): void {
    // Store current expanded states before recreating groups
    const expandedStates = new Map<string, boolean>();
    this.groupedPermissions.forEach(group => {
      expandedStates.set(group.name, group.isExpanded);
    });

    // Filter permissions
    let filtered = [...this.allPermissions];
    
    if (this.searchTerm.trim()) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(search) ||
        p.description?.toLowerCase().includes(search) ||
        p.resourceType.toLowerCase().includes(search)
      );
    }
    
    if (this.filterType === 'assigned') {
      filtered = filtered.filter(p => p.assigned);
    } else if (this.filterType === 'unassigned') {
      filtered = filtered.filter(p => !p.assigned);
    }
    
    // Group permissions
    const groups = new Map<string, Permission[]>();
    filtered.forEach(permission => {
      const type = permission.resourceType.toUpperCase();
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(permission);
    });

    this.groupedPermissions = Array.from(groups.entries())
      .map(([name, permissions]) => ({
        name,
        displayName: this.getGroupDisplayName(name),
        permissions: permissions.sort((a, b) => a.name.localeCompare(b.name)),
        assignedCount: permissions.filter(p => p.assigned).length,
        isExpanded: expandedStates.get(name) || false // Preserve expanded state
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    
    // Update counts
    this.assignedCount = this.allPermissions.filter(p => p.assigned).length;
    this.unassignedCount = this.allPermissions.length - this.assignedCount;
    
    console.log('Updated data - Groups:', this.groupedPermissions.length, 'Assigned:', this.assignedCount);
  }

  // New method to update only counts without recreating groups
  updateCounts(): void {
    // Update assigned counts for each group
    this.groupedPermissions.forEach(group => {
      group.assignedCount = group.permissions.filter(p => p.assigned).length;
    });
    
    // Update overall counts
    this.assignedCount = this.allPermissions.filter(p => p.assigned).length;
    this.unassignedCount = this.allPermissions.length - this.assignedCount;
    
    console.log('Updated counts - Assigned:', this.assignedCount);
  }

  onSearchChange(): void {
    this.updateData();
  }

  onFilterChange(): void {
    this.updateData();
  }

  onPermissionChange(): void {
    console.log('Permission changed');
    // Only update counts, don't recreate groups to preserve expanded state
    this.updateCounts();
    this.cdr.detectChanges();
  }

  toggleGroup(groupName: string): void {
    const group = this.groupedPermissions.find(g => g.name === groupName);
    if (group) {
      group.isExpanded = !group.isExpanded;
      console.log(`Group ${groupName} is now ${group.isExpanded ? 'expanded' : 'collapsed'}`);
      this.cdr.detectChanges();
    }
  }

  getGroupDisplayName(resourceType: string): string {
    const typeMap: { [key: string]: string } = {
      'CASE': 'Case Management',
      'DOCUMENT': 'Document Management',
      'USER': 'User Management',
      'ROLE': 'Role Management',
      'CALENDAR': 'Calendar & Events',
      'ADMINISTRATIVE': 'Administrative',
      'SYSTEM': 'System Settings',
      'REPORT': 'Reports & Analytics',
      'BILLING': 'Billing & Finance',
      'CLIENT': 'Client Portal',
      'NOTIFICATION': 'Notifications',
      'TIME_TRACKING': 'Time Tracking',
      'EXPENSE': 'Expense Management',
      'TASK': 'Task Management',
      'INVOICE': 'Invoice Management',
      'TIME_ENTRY': 'Time Entry'
    };
    
    return typeMap[resourceType] || resourceType.charAt(0) + resourceType.slice(1).toLowerCase();
  }

  savePermissions(): void {
    if (this.saving) return;
    
    this.saving = true;
    console.log('Saving permissions...');
    
    const assignedPermissionIds = this.allPermissions
      .filter(permission => permission.assigned)
      .map(permission => permission.id);
    
    console.log('Assigning permission IDs:', assignedPermissionIds);
    
    this.rbacService.assignPermissionsToRole(this.role.id, assignedPermissionIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          this.saving = false;
          console.log('Save result:', success);
          
          if (success) {
            this.showSuccess('Permissions updated successfully');
            this.dialogRef.close(true);
          } else {
            this.showError('Failed to update permissions');
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.saving = false;
          console.error('Error saving permissions:', error);
          this.showError('Failed to update permissions');
          this.cdr.detectChanges();
        }
      });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  // TrackBy functions
  trackByPermissionId(index: number, permission: Permission): number {
    return permission.id;
  }

  trackByGroupName(index: number, group: PermissionGroup): string {
    return group.name;
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

  // New methods for enhanced functionality
  getAssignedPercentage(): number {
    if (this.allPermissions.length === 0) return 0;
    return Math.round((this.assignedCount / this.allPermissions.length) * 100);
  }

  getCategoryIcon(categoryName: string): string {
    const iconMap: { [key: string]: string } = {
      'CASE': 'ri-briefcase-line text-primary',
      'DOCUMENT': 'ri-file-text-line text-info',
      'USER': 'ri-user-line text-success',
      'ROLE': 'ri-shield-user-line text-warning',
      'CALENDAR': 'ri-calendar-line text-danger',
      'ADMINISTRATIVE': 'ri-settings-line text-secondary',
      'SYSTEM': 'ri-computer-line text-dark',
      'REPORT': 'ri-bar-chart-line text-info',
      'BILLING': 'ri-money-dollar-circle-line text-success',
      'CLIENT': 'ri-customer-service-line text-primary',
      'NOTIFICATION': 'ri-notification-line text-warning',
      'TIME_TRACKING': 'ri-time-line text-info',
      'EXPENSE': 'ri-wallet-line text-danger',
      'TASK': 'ri-task-line text-success',
      'INVOICE': 'ri-bill-line text-warning',
      'TIME_ENTRY': 'ri-timer-line text-info'
    };
    
    return iconMap[categoryName] || 'ri-folder-line text-muted';
  }

  getCategoryProgress(group: PermissionGroup): number {
    if (group.permissions.length === 0) return 0;
    return Math.round((group.assignedCount / group.permissions.length) * 100);
  }

  getPermissionDescription(permission: Permission): string {
    if (permission.description && permission.description.trim()) {
      return permission.description;
    }
    
    // Generate description based on action and resource
    const actionDescriptions: { [key: string]: string } = {
      'CREATE': 'Create new',
      'READ': 'View and read',
      'UPDATE': 'Modify and update',
      'DELETE': 'Remove and delete',
      'MANAGE': 'Full management of',
      'APPROVE': 'Approve and authorize',
      'ASSIGN': 'Assign and delegate',
      'EXPORT': 'Export data from',
      'IMPORT': 'Import data to'
    };
    
    const resourceDescriptions: { [key: string]: string } = {
      'CASE': 'legal cases',
      'DOCUMENT': 'documents',
      'USER': 'user accounts',
      'ROLE': 'roles and permissions',
      'CALENDAR': 'calendar events',
      'ADMINISTRATIVE': 'administrative functions',
      'SYSTEM': 'system settings',
      'REPORT': 'reports and analytics',
      'BILLING': 'billing and invoices',
      'CLIENT': 'client information',
      'NOTIFICATION': 'notifications',
      'TIME_TRACKING': 'time tracking',
      'EXPENSE': 'expenses',
      'TASK': 'tasks',
      'INVOICE': 'invoices',
      'TIME_ENTRY': 'time entries'
    };
    
    const actionDesc = actionDescriptions[permission.actionType] || permission.actionType.toLowerCase();
    const resourceDesc = resourceDescriptions[permission.resourceType] || permission.resourceType.toLowerCase();
    
    return `${actionDesc} ${resourceDesc}`;
  }

  getActionLabel(actionType: string): string {
    const labels: { [key: string]: string } = {
      'CREATE': 'Create',
      'READ': 'Read',
      'UPDATE': 'Update',
      'DELETE': 'Delete',
      'MANAGE': 'Manage',
      'APPROVE': 'Approve',
      'ASSIGN': 'Assign',
      'EXPORT': 'Export',
      'IMPORT': 'Import'
    };
    
    return labels[actionType] || actionType;
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.updateData();
  }

  selectAllVisible(): void {
    const visiblePermissions = this.getVisiblePermissions();
    visiblePermissions.forEach(permission => {
      permission.assigned = true;
    });
    this.updateData();
    this.showSuccess(`Selected ${visiblePermissions.length} permissions`);
  }

  deselectAllVisible(): void {
    const visiblePermissions = this.getVisiblePermissions();
    visiblePermissions.forEach(permission => {
      permission.assigned = false;
    });
    this.updateData();
    this.showSuccess(`Deselected ${visiblePermissions.length} permissions`);
  }

  selectBasicPermissions(): void {
    // Define basic permissions that most roles should have
    const basicActions = ['READ', 'CREATE', 'UPDATE'];
    const basicResources = ['CASE', 'DOCUMENT', 'CLIENT', 'TIME_ENTRY'];
    
    let selectedCount = 0;
    this.allPermissions.forEach(permission => {
      if (basicActions.includes(permission.actionType) && 
          basicResources.includes(permission.resourceType)) {
        permission.assigned = true;
        selectedCount++;
      }
    });
    
    this.updateData();
    this.showSuccess(`Applied basic permission set (${selectedCount} permissions)`);
  }

  selectAllInCategory(group: PermissionGroup): void {
    group.permissions.forEach(permission => {
      permission.assigned = true;
    });
    this.updateData();
    this.showSuccess(`Selected all permissions in ${group.displayName}`);
  }

  deselectAllInCategory(group: PermissionGroup): void {
    group.permissions.forEach(permission => {
      permission.assigned = false;
    });
    this.updateData();
    this.showSuccess(`Deselected all permissions in ${group.displayName}`);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.filterType = 'all';
    this.updateData();
    this.showSuccess('Filters reset');
  }

  togglePermission(permission: Permission): void {
    if (!this.role.isSystemRole) {
      permission.assigned = !permission.assigned;
      this.onPermissionChange();
    }
  }

  hasChanges(): boolean {
    const currentPermissions = new Set(
      this.allPermissions
        .filter(p => p.assigned)
        .map(p => p.id)
    );
    
    // Check if sets are different
    if (currentPermissions.size !== this.originalPermissions.size) {
      return true;
    }
    
    for (const id of currentPermissions) {
      if (!this.originalPermissions.has(id)) {
        return true;
      }
    }
    
    return false;
  }

  private getVisiblePermissions(): Permission[] {
    let filtered = [...this.allPermissions];
    
    if (this.searchTerm.trim()) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(search) ||
        p.description?.toLowerCase().includes(search) ||
        p.resourceType.toLowerCase().includes(search)
      );
    }
    
    if (this.filterType === 'assigned') {
      filtered = filtered.filter(p => p.assigned);
    } else if (this.filterType === 'unassigned') {
      filtered = filtered.filter(p => !p.assigned);
    }
    
    return filtered;
  }
} 