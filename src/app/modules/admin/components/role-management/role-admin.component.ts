import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTabGroup } from '@angular/material/tabs';
import { RbacService, Role as RbacRole, Permission as RbacPermission } from '@app/core/services/rbac.service';
import { RoleFormComponent } from './role-form.component';
import { PermissionAssignmentComponent } from './permission-assignment.component';
import { CustomHttpResponse } from '@app/core/models/custom-http-response';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PermissionDebuggerComponent } from '@app/shared/components/permission-debugger/permission-debugger.component';
import { ConfirmationDialogComponent } from '@app/shared/components/confirmation-dialog/confirmation-dialog.component';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Subject, takeUntil, finalize, forkJoin } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';
import Swal from 'sweetalert2';

// Use the interfaces from RBAC service to avoid type conflicts
interface Role extends RbacRole {
  userCount?: number;
}

interface Permission extends RbacPermission {
  // Already compatible with RbacPermission
}

@Component({
  selector: 'app-role-admin',
  templateUrl: './role-admin.component.html',
  styleUrls: ['./role-admin.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('300ms ease-in-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-in-out', style({ transform: 'translateX(100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class RoleAdminComponent implements OnInit, OnDestroy {
  @ViewChild('tabGroup') tabGroup!: MatTabGroup;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Data sources
  dataSource = new MatTableDataSource<Role>([]);
  roles: Role[] = [];
  permissions: Permission[] = [];
  filteredRoles: Role[] = [];
  
  // UI State
  loading = false;
  selectedRole: Role | null = null;
  showRoleForm = false;
  
  // Cached counts for performance
  systemRolesCount = 0;
  customRolesCount = 0;
  
  // Table configuration
  displayedColumns: string[] = ['name', 'description', 'hierarchyLevel', 'userCount', 'systemRole', 'actions'];
  
  // Filters
  searchTerm = '';
  filterType = 'all';
  hierarchyFilter = '';
  sortByField = 'name';
  
  // Pagination
  currentPage = 0;
  pageSize = 10;
  sortField = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Destroy subject for cleanup
  private destroy$ = new Subject<void>();
  
  constructor(
    private rbacService: RbacService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}
  
  ngOnInit(): void {
    this.loadData();
    this.setupTableDataSource();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  private setupTableDataSource(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    
    // Custom filter predicate
    this.dataSource.filterPredicate = (data: Role, filter: string) => {
      const searchStr = filter.toLowerCase();
      return data.name.toLowerCase().includes(searchStr) ||
             data.description?.toLowerCase().includes(searchStr) ||
             data.hierarchyLevel?.toString().includes(searchStr);
    };
  }

  loadData(): void {
    this.loading = true;
    
    forkJoin({
      roles: this.rbacService.getRoles(),
      permissions: this.rbacService.getPermissions()
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.roles = response.roles as unknown as Role[] ||  [];
        this.permissions = response.permissions as Permission[] || [];
        this.updateCachedCounts();
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading data:', error);
        this.showError('Failed to load roles and permissions');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
  
  applyFilter(): void {
    let filteredData = [...this.roles];
    
    // Apply type filter
    if (this.filterType !== 'all') {
      if (this.filterType === 'system') {
        filteredData = filteredData.filter(role => role.isSystemRole);
      } else if (this.filterType === 'custom') {
        filteredData = filteredData.filter(role => !role.isSystemRole);
      }
    }

    // Apply hierarchy filter
    if (this.hierarchyFilter) {
      filteredData = filteredData.filter(role => {
        const level = role.hierarchyLevel || 0;
        switch (this.hierarchyFilter) {
          case '1-20': return level >= 1 && level <= 20;
          case '21-40': return level >= 21 && level <= 40;
          case '41-60': return level >= 41 && level <= 60;
          case '61-80': return level >= 61 && level <= 80;
          case '81-100': return level >= 81 && level <= 100;
          default: return true;
        }
      });
    }
    
    // Apply search filter
    if (this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase();
      filteredData = filteredData.filter(role => 
        role.name.toLowerCase().includes(searchLower) ||
        role.description?.toLowerCase().includes(searchLower) ||
        role.hierarchyLevel?.toString().includes(searchLower)
      );
    }

    // Apply sorting based on sortByField
    if (this.sortByField !== 'name') {
      filteredData.sort((a, b) => {
        switch (this.sortByField) {
          case 'hierarchyLevel':
            return (a.hierarchyLevel || 0) - (b.hierarchyLevel || 0);
          case 'userCount':
            return (a.userCount || 0) - (b.userCount || 0);
          case 'isSystemRole':
            return (a.isSystemRole ? 1 : 0) - (b.isSystemRole ? 1 : 0);
          default:
            return a.name.localeCompare(b.name);
        }
      });
    } else {
      filteredData.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    this.filteredRoles = filteredData;
    this.updateDataSource();
    this.cdr.markForCheck();
  }

  clearFilter(): void {
    this.searchTerm = '';
    this.applyFilter();
  }

  sortBy(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.updateDataSource();
  }
  
  // Pagination methods
  getDisplayStart(): number {
    return this.currentPage * this.pageSize + 1;
  }

  getDisplayEnd(): number {
    const end = (this.currentPage + 1) * this.pageSize;
    return Math.min(end, this.dataSource.data.length);
  }

  getTotalPages(): number {
    return Math.ceil(this.dataSource.data.length / this.pageSize);
  }

  getPageNumbers(): number[] {
    const totalPages = this.getTotalPages();
    const pages: number[] = [];
    const maxVisible = 5;
    
    let start = Math.max(0, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible);
    
    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }
    
    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    
    return pages;
  }
  
  goToPage(page: number): void {
    this.currentPage = page;
    this.updateDataSource();
  }

  previousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.updateDataSource();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.getTotalPages() - 1) {
      this.currentPage++;
      this.updateDataSource();
    }
  }
  
  selectRole(role: Role): void {
    this.selectedRole = role;
    this.loadRoleDetails(role.id);
  }
  
  private loadRoleDetails(roleId: number): void {
    this.rbacService.getRoleById(roleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.selectedRole = response.data?.role;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading role details:', error);
          this.showError('Failed to load role details');
        }
      });
  }
  
  createRole(): void {
    this.selectedRole = null;
    this.showRoleForm = true;
  }

  editRole(role: Role): void {
    this.selectedRole = { ...role };
    this.showRoleForm = true;
  }
  
  deleteRole(role: Role): void {
    if (role.isSystemRole) {
      this.showError('System roles cannot be deleted');
      return;
    }

    if (confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
      this.loading = true;
      
      this.rbacService.deleteRole(role.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.showSuccess('Role deleted successfully');
            this.loadData();
          },
          error: (error) => {
            console.error('Error deleting role:', error);
            this.showError('Failed to delete role');
            this.loading = false;
          }
        });
    }
  }

  onRoleFormSubmit(roleData: any): void {
    this.loading = true;
    
    const operation = roleData.id ? 
      this.rbacService.updateRole(roleData.id, roleData) : 
      this.rbacService.createRole(roleData);

    operation
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const message = roleData.id ? 'Role updated successfully' : 'Role created successfully';
          this.showSuccess(message);
          this.showRoleForm = false;
          this.selectedRole = null;
          this.loadData();
        },
        error: (error) => {
          console.error('Error saving role:', error);
          this.showError('Failed to save role');
          this.loading = false;
        }
      });
  }
  
  onRoleFormCancel(): void {
    this.showRoleForm = false;
    this.selectedRole = null;
  }

  assignPermissions(role: Role): void {
    const dialogRef = this.dialog.open(PermissionAssignmentComponent, {
      width: '95vw',
      maxWidth: '1000px',
      maxHeight: '90vh',
      data: { role: role },
      disableClose: true,
      panelClass: 'permission-dialog-panel'
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadData(); // Reload data to reflect changes
      }
    });
  }
  
  private updateDataSource(): void {
    let filteredData = [...this.filteredRoles];
    
    // Apply sorting
    if (this.sortField) {
      filteredData.sort((a, b) => {
        const aVal = a[this.sortField as keyof Role];
        const bVal = b[this.sortField as keyof Role];
        
        if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    this.dataSource.data = filteredData;
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

  // Utility methods
  getRoleTypeLabel(role: Role): string {
    return role.isSystemRole ? 'System' : 'Custom';
  }
  
  getRoleTypeBadgeClass(role: Role): string {
    return role.isSystemRole ? 'system' : 'custom';
  }

  getHierarchyBadgeClass(level: number): string {
    if (level >= 90) return 'badge bg-danger';
    if (level >= 70) return 'badge bg-warning';
    if (level >= 50) return 'badge bg-info';
    return 'badge bg-success';
  }

  // Filter methods
  filterByType(type: string): void {
    this.filterType = type;
    this.applyFilter();
  }

  // Stats methods
  private updateCachedCounts(): void {
    this.systemRolesCount = this.roles.filter(role => role.isSystemRole).length;
    this.customRolesCount = this.roles.filter(role => !role.isSystemRole).length;
  }

  getSystemRolesCount(): number {
    return this.systemRolesCount;
  }

  getCustomRolesCount(): number {
    return this.customRolesCount;
  }
  
  getHierarchyClass(level: number): string {
    if (level >= 90) return 'admin';
    if (level >= 70) return 'manager';
    if (level >= 50) return 'staff';
    return 'basic';
  }
    
  // Cache role descriptions to avoid repeated object creation
  private readonly roleDescriptions: { [key: string]: string } = {
    'ROLE_ADMIN': 'Full system access with all administrative privileges. Can manage users, roles, and system settings.',
    'ROLE_SYSADMIN': 'System administration access with technical configuration capabilities and user management.',
    'ROLE_ATTORNEY': 'Legal professional access with case management, document handling, and client interaction capabilities.',
    'ROLE_PARALEGAL': 'Legal support access with document preparation, research, and case assistance capabilities.',
    'ROLE_CLIENT': 'Client portal access with limited view of assigned cases and documents.',
    'ROLE_SECRETARY': 'Administrative support access with scheduling, communication, and basic document management.',
    'ROLE_MANAGER': 'Management level access with team oversight and reporting capabilities.',
    'ROLE_USER': 'Basic user access with limited system functionality and read-only permissions.'
  };

  getRoleDescription(role: Role): string {
    return role.description || this.roleDescriptions[role.name] || 'Custom role with specific permissions and access levels defined by administrators.';
  }

  getHierarchyLabel(level: number): string {
    if (level >= 90) return 'Admin';
    if (level >= 70) return 'Manager';
    if (level >= 50) return 'Staff';
    return 'Basic';
  }

  getHierarchyDescription(level: number): string {
    if (level >= 90) return 'Highest level with full administrative control and system management capabilities.';
    if (level >= 70) return 'Management level with supervisory responsibilities and advanced permissions.';
    if (level >= 50) return 'Staff level with operational access and standard work permissions.';
    return 'Basic level with limited access and essential functionality only.';
  }

  // TrackBy functions for performance optimization
  trackByRoleId(index: number, role: Role): number {
    return role.id;
  }

  trackByIndex(index: number): number {
    return index;
  }

  // Additional methods for the enhanced UI
  refreshData(): void {
    this.loading = true;
    this.loadData();
    this.showSuccess('Data refreshed successfully');
  }

  exportRoles(): void {
    const exportData = this.roles.map(role => ({
      name: role.name,
      description: this.getRoleDescription(role),
      hierarchyLevel: role.hierarchyLevel,
      isSystemRole: role.isSystemRole,
      userCount: role.userCount || 0,
      permissionCount: role.permissions?.length || 0,
      permissions: role.permissions?.map(p => p.name) || []
    }));

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `roles-export-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    this.showSuccess('Roles exported successfully');
  }

  clearAllFilters(): void {
    this.searchTerm = '';
    this.filterType = 'all';
    this.hierarchyFilter = '';
    this.sortByField = 'name';
    this.applyFilter();
    
    // Show success message
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'info',
        title: 'Filters Cleared',
        text: 'All filters have been reset.',
        timer: 1500,
        showConfirmButton: false
      });
    }
  }

  hasActiveFilters(): boolean {
    return this.searchTerm !== '' || 
           this.filterType !== 'all' || 
           this.hierarchyFilter !== '' ||
           this.sortByField !== 'name';
  }

  getEmptyStateTitle(): string {
    if (this.hasActiveFilters()) {
      return 'No Matching Roles Found';
    }
    return 'No Roles Available';
  }

  getEmptyStateMessage(): string {
    if (this.hasActiveFilters()) {
      return 'Try adjusting your search criteria or clearing the filters to see more results.';
    }
    return 'Get started by creating your first role to manage user permissions effectively.';
  }

  getAccessLevel(hierarchyLevel: number): string {
    if (hierarchyLevel >= 90) return 'High';
    if (hierarchyLevel >= 70) return 'Medium';
    if (hierarchyLevel >= 50) return 'Standard';
    return 'Basic';
  }

  closeRoleDetails(): void {
    this.selectedRole = null;
  }

  applySorting(): void {
    this.applyFilter();
  }

  // New methods for redesigned role cards
  viewRoleDetails(role: Role): void {
    this.selectedRole = role;
  }

  openPermissionManager(role: Role): void {
    const dialogRef = this.dialog.open(PermissionAssignmentComponent, {
      width: '90vw',
      maxWidth: '1200px',
      height: '85vh',
      data: { role: role },
      disableClose: false,
      panelClass: 'permission-dialog',
      position: {
        top: '80px'  // Increased top position to ensure dialog appears below the topbar
      }
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadData(); // Refresh data if changes were made
        this.showSuccess('Permissions updated successfully');
      }
    });

    // Close role details if open
    this.closeRoleDetails();
  }

  confirmDeleteRole(role: Role): void {
    if (role.isSystemRole) {
      this.showError('System roles cannot be deleted');
      return;
    }

    const confirmed = confirm(`Are you sure you want to delete the role "${role.name}"?\n\nThis action cannot be undone.`);
    if (confirmed) {
      this.deleteRole(role);
    }

    // Close role details if open
    this.closeRoleDetails();
  }
} 