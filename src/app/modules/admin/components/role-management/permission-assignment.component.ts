import { Component, Inject, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RbacService } from '@app/core/services/rbac.service';
import { MatSnackBar } from '@angular/material/snack-bar';

interface Permission {
  id: number;
  name: string;
  description: string;
  resourceType: string;
  actionType: string;
  assigned?: boolean;
}

interface Role {
  id: number;
  name: string;
  description: string;
  hierarchyLevel: number;
  systemRole: boolean;
  permissions?: Permission[];
}

interface PermissionGroup {
  name: string;
  displayName: string;
  permissions: Permission[];
  assignedCount: number;
}

@Component({
  selector: 'app-permission-assignment',
  templateUrl: './permission-assignment.component.html',
  styleUrls: ['./permission-assignment.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PermissionAssignmentComponent implements OnInit, OnDestroy {
  role: Role;
  allPermissions: Permission[] = [];
  filteredPermissions: Permission[] = [];
  groupedPermissions: PermissionGroup[] = [];
  
  // Cached counts
  assignedCount = 0;
  unassignedCount = 0;
  
  // UI State
  searchTerm = '';
  filterType = 'all';
  loading = false;
  saving = false;
  expandedGroups = new Set<string>(['CASE', 'DOCUMENT', 'USER']);

  // Group display configuration
  private readonly groupConfig = {
    'CASE': { displayName: 'Case Management', icon: 'ri-briefcase-4-line', class: 'bg-primary-subtle text-primary' },
    'DOCUMENT': { displayName: 'Document Management', icon: 'ri-file-text-line', class: 'bg-info-subtle text-info' },
    'USER': { displayName: 'User Management', icon: 'ri-user-settings-line', class: 'bg-success-subtle text-success' },
    'CALENDAR': { displayName: 'Calendar & Events', icon: 'ri-calendar-event-line', class: 'bg-warning-subtle text-warning' },
    'ADMINISTRATIVE': { displayName: 'Administrative', icon: 'ri-settings-3-line', class: 'bg-danger-subtle text-danger' },
    'SYSTEM': { displayName: 'System Settings', icon: 'ri-computer-line', class: 'bg-secondary-subtle text-secondary' },
    'REPORT': { displayName: 'Reports & Analytics', icon: 'ri-bar-chart-line', class: 'bg-purple-subtle text-purple' },
    'BILLING': { displayName: 'Billing & Finance', icon: 'ri-money-dollar-circle-line', class: 'bg-orange-subtle text-orange' },
    'CLIENT': { displayName: 'Client Portal', icon: 'ri-client-service-line', class: 'bg-teal-subtle text-teal' },
    'NOTIFICATION': { displayName: 'Notifications', icon: 'ri-notification-3-line', class: 'bg-pink-subtle text-pink' }
  };

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
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  loadPermissions(): void {
    this.loading = true;
    this.cdr.markForCheck();
    
    this.rbacService.getPermissions().subscribe({
      next: (response) => {
        this.allPermissions = response as Permission[] || [];
        
        // Mark assigned permissions
        const assignedIds = new Set(this.role.permissions?.map(p => p.id) || []);
        this.allPermissions.forEach(permission => {
          permission.assigned = assignedIds.has(permission.id);
        });
        
        this.filterType = 'all';
        this.updateFilteredData();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading permissions:', error);
        this.showError('Failed to load permissions');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onSearchChange(): void {
    // Debounce search to avoid excessive filtering
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.updateFilteredData();
    }, 300);
  }

  onFilterChange(): void {
    this.updateFilteredData();
  }

  private searchTimeout: any;

  private updateFilteredData(): void {
    // Apply filters
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
    
    this.filteredPermissions = filtered;
    this.updateGroupedPermissions();
    this.updateCounts();
    this.cdr.markForCheck();
  }

  private updateGroupedPermissions(): void {
    const groups = new Map<string, Permission[]>();
    
    this.filteredPermissions.forEach(permission => {
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
        assignedCount: permissions.filter(p => p.assigned).length
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  private updateCounts(): void {
    this.assignedCount = this.allPermissions.filter(p => p.assigned).length;
    this.unassignedCount = this.allPermissions.length - this.assignedCount;
  }

  onPermissionChange(): void {
    this.updateCounts();
    this.updateGroupedPermissions();
    this.cdr.markForCheck();
  }

  toggleGroupExpanded(groupName: string): void {
    if (this.expandedGroups.has(groupName)) {
      this.expandedGroups.delete(groupName);
    } else {
      this.expandedGroups.add(groupName);
    }
    this.cdr.markForCheck();
  }

  isGroupExpanded(groupName: string): boolean {
    return this.expandedGroups.has(groupName);
  }

  getGroupDisplayName(resourceType: string): string {
    return this.groupConfig[resourceType as keyof typeof this.groupConfig]?.displayName || 
           resourceType.charAt(0) + resourceType.slice(1).toLowerCase();
  }

  getGroupIcon(resourceType: string): string {
    return this.groupConfig[resourceType as keyof typeof this.groupConfig]?.icon || 'ri-shield-check-line';
  }

  getGroupIconClass(resourceType: string): string {
    return this.groupConfig[resourceType as keyof typeof this.groupConfig]?.class || 'bg-primary-subtle text-primary';
  }

  getPermissionDisplayName(permissionName: string): string {
    return permissionName
      .replace(/^(CREATE_|READ_|UPDATE_|DELETE_|MANAGE_|VIEW_|EDIT_)/, '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  savePermissions(): void {
    if (this.role.systemRole) {
      this.showError('Cannot modify permissions for system roles');
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();
    
    const assignedPermissionIds = this.allPermissions
      .filter(p => p.assigned)
      .map(p => p.id);

    this.rbacService.assignPermissionsToRole(this.role.id, assignedPermissionIds).subscribe({
      next: () => {
        this.showSuccess('Permissions updated successfully');
        this.dialogRef.close(true);
      },
      error: (error) => {
        console.error('Error updating permissions:', error);
        this.showError('Failed to update permissions');
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  // TrackBy functions for performance
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
} 