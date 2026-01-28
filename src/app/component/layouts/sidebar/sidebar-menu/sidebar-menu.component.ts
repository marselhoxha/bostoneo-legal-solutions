import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { RbacService, UserPermissions } from '../../../../core/services/rbac.service';
import { PermissionDebuggerComponent } from '../../../../shared/components/permission-debugger/permission-debugger.component';
import { DOCUMENT } from '@angular/common';

interface MenuItem {
  id: number;
  label: string;
  icon?: string;
  link?: string;
  subItems?: MenuItem[];
  badge?: string;
  badgeColor?: string;
  permission?: {
    resource: string;
    action: string;
    hierarchyLevel?: number;
    roles?: string[];
  };
  isParent?: boolean;
  parentId?: number;
  isActive?: boolean;
  isVisible?: boolean;
}

@Component({
  selector: 'app-sidebar-menu',
  templateUrl: './sidebar-menu.component.html',
  styleUrls: ['./sidebar-menu.component.scss']
})
export class SidebarMenuComponent implements OnInit, OnDestroy {
  // Property to control debugger visibility
  showDebugger = false;
  
  private destroy$ = new Subject<void>();
  userPermissions: UserPermissions | null = null;
  menuItems: MenuItem[] = [];
  
  constructor(
    private router: Router,
    private rbacService: RbacService,
    @Inject(DOCUMENT) private document: Document
  ) {}
  
  ngOnInit(): void {
    this.initializeMenu();
    this.subscribeToPermissions();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  private subscribeToPermissions(): void {
    this.rbacService.getCurrentUserPermissions()
      .pipe(takeUntil(this.destroy$))
      .subscribe(permissions => {
        this.userPermissions = permissions;
        this.updateMenuVisibility();
      });
  }
  
  private initializeMenu(): void {
    this.menuItems = [
      // Client Portal - Only visible for ROLE_CLIENT
      {
        id: 100,
        label: 'My Portal',
        icon: 'ri-user-heart-line',
        isParent: true,
        permission: { resource: 'CLIENT_PORTAL', action: 'VIEW', roles: ['ROLE_CLIENT'] },
        subItems: [
          {
            id: 101,
            label: 'Dashboard',
            link: '/client/dashboard',
            parentId: 100,
            permission: { resource: 'CLIENT_PORTAL', action: 'VIEW', roles: ['ROLE_CLIENT'] }
          },
          {
            id: 102,
            label: 'My Cases',
            link: '/client/cases',
            parentId: 100,
            permission: { resource: 'CLIENT_PORTAL', action: 'VIEW', roles: ['ROLE_CLIENT'] }
          },
          {
            id: 103,
            label: 'My Documents',
            link: '/client/documents',
            parentId: 100,
            permission: { resource: 'CLIENT_PORTAL', action: 'VIEW', roles: ['ROLE_CLIENT'] }
          },
          {
            id: 104,
            label: 'Appointments',
            link: '/client/appointments',
            parentId: 100,
            permission: { resource: 'CLIENT_PORTAL', action: 'VIEW', roles: ['ROLE_CLIENT'] }
          },
          {
            id: 105,
            label: 'Messages',
            link: '/client/messages',
            parentId: 100,
            permission: { resource: 'CLIENT_PORTAL', action: 'VIEW', roles: ['ROLE_CLIENT'] }
          },
          {
            id: 106,
            label: 'My Invoices',
            link: '/client/invoices',
            parentId: 100,
            permission: { resource: 'CLIENT_PORTAL', action: 'VIEW', roles: ['ROLE_CLIENT'] }
          },
          {
            id: 107,
            label: 'My Profile',
            link: '/client/profile',
            parentId: 100,
            permission: { resource: 'CLIENT_PORTAL', action: 'VIEW', roles: ['ROLE_CLIENT'] }
          }
        ]
      },

      // Dashboard - Always visible for authenticated users
      {
        id: 1,
        label: 'Dashboard',
        icon: 'ri-dashboard-2-line',
        link: '/home'
      },

      // Case Management
      {
        id: 2,
        label: 'Case Management',
        icon: 'ri-briefcase-4-line',
        isParent: true,
        permission: { resource: 'CASE', action: 'VIEW' },
        subItems: [
          {
            id: 21,
            label: 'All Cases',
            link: '/legal/cases',
            parentId: 2,
            permission: { resource: 'CASE', action: 'VIEW' }
          },
          {
            id: 22,
            label: 'Create Case',
            link: '/legal/cases/create',
            parentId: 2,
            permission: { resource: 'CASE', action: 'CREATE', hierarchyLevel: 25 }
          },
          {
            id: 23,
            label: 'Case Calendar',
            link: '/legal/calendar',
            parentId: 2,
            permission: { resource: 'CALENDAR', action: 'VIEW' }
          },
          {
            id: 24,
            label: 'Documents',
            link: '/legal/documents',
            parentId: 2,
            permission: { resource: 'DOCUMENT', action: 'VIEW' }
          },
          {
            id: 25,
            label: 'Case Assignments',
            link: '/case-management/assignments',
            parentId: 2,
            permission: { resource: 'CASE', action: 'VIEW' }
          },
          {
            id: 27,
            label: 'Task Management',
            link: '/case-management/tasks',
            parentId: 2,
            permission: { resource: 'CASE', action: 'VIEW' }
          }
        ]
      },

      // File Manager
      {
        id: 3,
        label: 'File Manager',
        icon: 'ri-folder-2-line',
        isParent: true,
        permission: { resource: 'DOCUMENT', action: 'VIEW' },
        subItems: [
          {
            id: 31,
            label: 'My Documents',
            link: '/file-manager',
            parentId: 3,
            permission: { resource: 'DOCUMENT', action: 'VIEW' }
          },
          {
            id: 32,
            label: 'Templates',
            link: '/file-manager/templates',
            parentId: 3,
            permission: { resource: 'DOCUMENT', action: 'VIEW' }
          },
          {
            id: 33,
            label: 'Firm Templates',
            link: '/file-manager/firm-templates',
            parentId: 3,
            permission: { resource: 'SYSTEM', action: 'VIEW', hierarchyLevel: 30 }
          },
          {
            id: 34,
            label: 'Permissions',
            link: '/file-manager/permissions',
            parentId: 3,
            permission: { resource: 'SYSTEM', action: 'VIEW', hierarchyLevel: 30 }
          },
          {
            id: 35,
            label: 'Deleted Files',
            link: '/file-manager/deleted',
            parentId: 3,
            icon: 'ri-delete-bin-line',
            permission: { resource: 'DOCUMENT', action: 'VIEW' }
          }
        ]
      },

      // Time & Billing
      {
        id: 4,
        label: 'Time & Billing',
        icon: 'ri-time-line',
        isParent: true,
        permission: { resource: 'TIME_TRACKING', action: 'VIEW_OWN' },
        subItems: [
          {
            id: 41,
            label: 'Time Dashboard',
            link: '/time-tracking/dashboard',
            parentId: 4,
            permission: { resource: 'TIME_TRACKING', action: 'VIEW_OWN' }
          },
          {
            id: 42,
            label: 'Log Time',
            link: '/time-tracking/entry',
            parentId: 4,
            permission: { resource: 'TIME_TRACKING', action: 'CREATE' }
          },
          {
            id: 43,
            label: 'My Timesheet',
            link: '/time-tracking/timesheet',
            parentId: 4,
            permission: { resource: 'TIME_TRACKING', action: 'VIEW_OWN' }
          },
          {
            id: 44,
            label: 'Team Timesheet',
            link: '/time-tracking/timesheet/team',
            parentId: 4,
            permission: { resource: 'TIME_TRACKING', action: 'VIEW_TEAM', hierarchyLevel: 25 }
          },
          {
            id: 45,
            label: 'Time Approval',
            link: '/time-tracking/approval',
            parentId: 4,
            permission: { resource: 'TIME_TRACKING', action: 'APPROVE', hierarchyLevel: 30 }
          },
          {
            id: 46,
            label: 'Billing Analytics',
            link: '/time-tracking/billing/analytics',
            parentId: 4,
            permission: { resource: 'BILLING', action: 'VIEW', hierarchyLevel: 30 }
          }
        ]
      },

      // Client Management
      {
        id: 5,
        label: 'Clients',
        icon: 'ri-user-3-line',
        isParent: true,
        permission: { resource: 'CLIENT', action: 'VIEW' },
        subItems: [
          {
            id: 51,
            label: 'All Clients',
            link: '/clients',
            parentId: 5,
            permission: { resource: 'CLIENT', action: 'VIEW' }
          },
          {
            id: 52,
            label: 'Add Client',
            link: '/clients/create',
            parentId: 5,
            permission: { resource: 'CLIENT', action: 'CREATE', hierarchyLevel: 25 }
          }
        ]
      },

      // Financial Management
      {
        id: 6,
        label: 'Financial',
        icon: 'ri-money-dollar-circle-line',
        isParent: true,
        permission: { resource: 'BILLING', action: 'VIEW', hierarchyLevel: 30 },
        subItems: [
          {
            id: 61,
            label: 'Invoices',
            link: '/invoices',
            parentId: 6,
            permission: { resource: 'BILLING', action: 'VIEW' }
          },
          {
            id: 62,
            label: 'Generate Invoice',
            link: '/time-tracking/billing/invoices',
            parentId: 6,
            permission: { resource: 'BILLING', action: 'CREATE', hierarchyLevel: 50 }
          },
          {
            id: 63,
            label: 'Billing Rates',
            link: '/time-tracking/billing/rates',
            parentId: 6,
            permission: { resource: 'BILLING', action: 'EDIT', hierarchyLevel: 50 }
          },
          {
            id: 64,
            label: 'Expenses',
            link: '/expenses',
            parentId: 6,
            permission: { resource: 'EXPENSE', action: 'VIEW' }
          }
        ]
      },

      // Reports & Analytics
      {
        id: 7,
        label: 'Reports',
        icon: 'ri-bar-chart-2-line',
        isParent: true,
        permission: { resource: 'REPORT', action: 'VIEW_OWN' },
        subItems: [
          {
            id: 71,
            label: 'My Reports',
            link: '/time-tracking/reports',
            parentId: 7,
            permission: { resource: 'REPORT', action: 'VIEW_OWN' }
          },
          {
            id: 72,
            label: 'Team Reports',
            link: '/time-tracking/reports/team',
            parentId: 7,
            permission: { resource: 'REPORT', action: 'VIEW_TEAM', hierarchyLevel: 30 }
          },
          {
            id: 73,
            label: 'Firm Analytics',
            link: '/stats',
            parentId: 7,
            permission: { resource: 'REPORT', action: 'VIEW_ALL', hierarchyLevel: 70 }
          }
        ]
      },

      // Administration
      {
        id: 8,
        label: 'Administration',
        icon: 'ri-settings-2-line',
        isParent: true,
        permission: { resource: 'USER', action: 'VIEW', hierarchyLevel: 50 },
        subItems: [
          {
            id: 81,
            label: 'User Management',
            link: '/admin/users',
            parentId: 8,
            permission: { resource: 'USER', action: 'ADMIN', hierarchyLevel: 80 }
          },
          {
            id: 82,
            label: 'Role Management',
            link: '/admin/roles',
            parentId: 8,
            permission: { resource: 'ROLE', action: 'ADMIN', hierarchyLevel: 90 }
          },
          {
            id: 83,
            label: 'System Settings',
            link: '/admin/system',
            parentId: 8,
            permission: {
              resource: 'SYSTEM',
              action: 'ADMIN',
              hierarchyLevel: 100,
              roles: ['ROLE_ADMIN']
            }
          },
          {
            id: 84,
            label: 'Organizations',
            link: '/organizations/list',
            parentId: 8,
            permission: {
              resource: 'ORGANIZATION',
              action: 'VIEW',
              hierarchyLevel: 100,
              roles: ['ROLE_ADMIN']
            }
          }
        ]
      }
    ];
  }
  
  private updateMenuVisibility(): void {
    if (!this.userPermissions) {
      // Hide all permission-based menu items if no permissions loaded
      this.menuItems.forEach(item => {
        item.isVisible = !item.permission;
        if (item.subItems) {
          item.subItems.forEach(subItem => {
            subItem.isVisible = !subItem.permission;
          });
        }
      });
      return;
    }

    this.menuItems.forEach(item => {
      item.isVisible = this.checkMenuPermission(item);
      
      if (item.subItems) {
        item.subItems.forEach(subItem => {
          subItem.isVisible = this.checkMenuPermission(subItem);
        });
        
        // Hide parent if no child items are visible
        const hasVisibleChildren = item.subItems.some(subItem => subItem.isVisible);
        if (item.isParent && !hasVisibleChildren) {
          item.isVisible = false;
        }
      }
    });
  }
  
  private checkMenuPermission(item: MenuItem): boolean {
    if (!item.permission) {
      return true; // No permission required
    }

    const { resource, action, hierarchyLevel, roles } = item.permission;

    // Special handling for role-only permissions (like CLIENT_PORTAL)
    // If roles are specified and resource is CLIENT_PORTAL, only check roles
    if (roles && roles.length > 0 && resource === 'CLIENT_PORTAL') {
      const hasRequiredRole = roles.some(role =>
        this.userPermissions!.roles.some(userRole => userRole.name === role)
      );
      return hasRequiredRole;
    }

    // Check hierarchy level requirement
    if (hierarchyLevel && this.userPermissions!.hierarchyLevel < hierarchyLevel) {
      return false;
    }

    // Check specific role requirements
    if (roles && roles.length > 0) {
      const hasRequiredRole = roles.some(role =>
        this.userPermissions!.roles.some(userRole => userRole.name === role)
      );
      if (!hasRequiredRole) {
        return false;
      }
    }

    // Check basic permission
    const permissionName = `${resource}:${action}`;
    return this.userPermissions!.effectivePermissions.some(permission =>
      permission.name === permissionName
    );
  }
  
  getVisibleMenuItems(): MenuItem[] {
    return this.menuItems.filter(item => item.isVisible);
  }
  
  getVisibleSubItems(parentItem: MenuItem): MenuItem[] {
    return parentItem.subItems?.filter(item => item.isVisible) || [];
  }
  
  onMenuClick(item: MenuItem): void {
    if (item.link) {
      this.router.navigate([item.link]);
    }
  }
  
  isMenuActive(item: MenuItem): boolean {
    if (item.link) {
      return this.router.url.includes(item.link);
    }
    
    if (item.subItems) {
      return item.subItems.some(subItem => 
        subItem.link && this.router.url.includes(subItem.link)
      );
    }
    
    return false;
  }
  
  // Helper methods for role-based features
  isPartnerLevel(): boolean {
    return this.userPermissions?.hierarchyLevel >= 80 || false;
  }
  
  isAttorneyLevel(): boolean {
    return this.userPermissions?.hierarchyLevel >= 40 || false;
  }
  
  isSupportStaff(): boolean {
    return this.userPermissions?.hierarchyLevel < 40 || false;
  }
  
  hasFinancialAccess(): boolean {
    return this.userPermissions?.hasFinancialAccess || false;
  }
  
  hasAdministrativeAccess(): boolean {
    return this.userPermissions?.hasAdministrativeAccess || false;
  }
  
  /**
   * Toggle the permission debugger visibility
   */
  toggleDebugger(): void {
    this.showDebugger = !this.showDebugger;
  }
  
  /**
   * Check if the current user has a specific permission
   * @param resource The resource type (CASE, DOCUMENT, etc.)
   * @param action The action type (VIEW, CREATE, etc.)
   * @returns True if the user has the permission
   */
  hasPermission(resource: string, action: string): boolean {
    return this.rbacService.hasPermissionSync(resource, action);
  }
  
  /**
   * Check if the current user has a specific role
   * @param roleName The role name to check
   * @returns True if the user has the role
   */
  hasRole(roleName: string): boolean {
    return this.rbacService.hasRole(roleName);
  }
} 