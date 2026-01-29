import { Component, OnInit, OnDestroy, EventEmitter, Output, ViewChild, ElementRef, Input, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

import { MENU, getMenuForRole, getDefaultRedirectForRole, ROLE_MENU_CONFIGS } from './menu';
import { MenuItem, UserRole, ROLE_HIERARCHY } from './menu.model';
import { User } from 'src/app/interface/user';
import { RbacService } from 'src/app/core/services/rbac.service';

@Component({
  selector: 'app-horizontal-topbar',
  templateUrl: './horizontal-topbar.component.html',
  styleUrls: ['./horizontal-topbar.component.scss']
})
export class HorizontalTopbarComponent implements OnInit, OnDestroy {
  @Input() user: User | null = null;
  menu: MenuItem[] = [];
  menuItems: MenuItem[] = [];
  @ViewChild('sideMenu') sideMenu!: ElementRef;
  @Output() mobileMenuButtonClicked = new EventEmitter();

  showAdminNavigation = false;
  currentUserRole: string = '';

  private destroy$ = new Subject<void>();
  private menuLoaded = false;

  constructor(
    private router: Router,
    private rbacService: RbacService
  ) {
    // Subscribe to route changes to update active menu
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.initActiveMenu();
    });
  }

  ngOnInit(): void {
    // Load menu immediately with localStorage data
    this.loadMenuForUserRole();
    this.initActiveMenu();

    // Subscribe to permission changes to reload menu when permissions are available
    this.rbacService.getCurrentUserPermissions()
      .pipe(takeUntil(this.destroy$))
      .subscribe(permissions => {
        if (permissions) {
          this.loadMenuForUserRole();
        }
      });

    // Check comprehensive admin access
    const isAdmin = this.rbacService.isAdmin();
    if (isAdmin) {
      this.showAdminNavigation = true;
    }

    // Initialize responsive menu
    this.updateMenuResponsiveness();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Determine user's primary role and load appropriate menu
   */
  private loadMenuForUserRole(): void {
    const userRole = this.getUserPrimaryRole();
    this.currentUserRole = userRole;

    // Check for SUPERADMIN role from multiple sources for reliability
    const isSuperAdmin = this.checkIsSuperAdmin();

    if (isSuperAdmin) {
      this.menuItems = getMenuForRole('ROLE_SUPERADMIN');
      this.currentUserRole = 'ROLE_SUPERADMIN';
    } else if (this.rbacService.isAdmin()) {
      this.menuItems = getMenuForRole('ROLE_ADMIN');
    } else {
      this.menuItems = getMenuForRole(userRole);
    }
    this.menu = this.menuItems;
  }

  /**
   * Check if user is SUPERADMIN from multiple sources
   */
  private checkIsSuperAdmin(): boolean {
    // 1. Check via RBAC service
    if (this.rbacService.hasRole('ROLE_SUPERADMIN')) {
      return true;
    }

    // 2. Check from user input
    if (this.user) {
      const userObj = this.user as any;
      if (userObj.roleName === 'ROLE_SUPERADMIN' ||
          userObj.primaryRoleName === 'ROLE_SUPERADMIN' ||
          (userObj.roles && userObj.roles.includes('ROLE_SUPERADMIN'))) {
        return true;
      }
    }

    // 3. Check from localStorage
    try {
      const currentUserStr = localStorage.getItem('currentUser');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        if (currentUser.roleName === 'ROLE_SUPERADMIN' ||
            currentUser.primaryRoleName === 'ROLE_SUPERADMIN' ||
            (currentUser.roles && currentUser.roles.includes('ROLE_SUPERADMIN'))) {
          return true;
        }
      }
    } catch (error) {
      // Silently handle localStorage errors
    }

    return false;
  }

  /**
   * Get user's primary role from various sources
   */
  private getUserPrimaryRole(): string {
    // 1. Try from user input first
    if (this.user) {
      const userObj = this.user as any;

      // Check primaryRoleName first
      if (userObj.primaryRoleName) {
        return userObj.primaryRoleName;
      }

      // Check roleName
      if (this.user.roleName) {
        return this.user.roleName;
      }

      // Check roles array - get highest hierarchy role
      if (userObj.roles && Array.isArray(userObj.roles) && userObj.roles.length > 0) {
        return this.getHighestHierarchyRole(userObj.roles);
      }
    }

    // 2. Try from localStorage
    try {
      const currentUserStr = localStorage.getItem('currentUser');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);

        if (currentUser.primaryRoleName) {
          return currentUser.primaryRoleName;
        }

        if (currentUser.roleName) {
          return currentUser.roleName;
        }

        if (currentUser.roles && Array.isArray(currentUser.roles) && currentUser.roles.length > 0) {
          return this.getHighestHierarchyRole(currentUser.roles);
        }
      }
    } catch (error) {
      // Silently handle localStorage errors
    }

    // 3. Try from RBAC service role checks
    if (this.rbacService.hasRole('ROLE_SUPERADMIN')) return 'ROLE_SUPERADMIN';
    if (this.rbacService.hasRole('ROLE_ADMIN')) return 'ROLE_ADMIN';
    if (this.rbacService.hasRole('ROLE_ATTORNEY')) return 'ROLE_ATTORNEY';
    if (this.rbacService.hasRole('ROLE_FINANCE')) return 'ROLE_FINANCE';
    if (this.rbacService.hasRole('PARALEGAL')) return 'PARALEGAL';
    if (this.rbacService.hasRole('ROLE_SECRETARY')) return 'ROLE_SECRETARY';
    if (this.rbacService.hasRole('ROLE_USER')) return 'ROLE_USER';

    // Default to USER role
    return 'ROLE_USER';
  }

  /**
   * Get the highest hierarchy role from a list of roles
   */
  private getHighestHierarchyRole(roles: string[]): string {
    let highestRole = 'ROLE_USER';
    let highestLevel = 0;

    roles.forEach(role => {
      const roleKey = role.toUpperCase() as UserRole;
      const level = ROLE_HIERARCHY[roleKey] || 0;

      if (level > highestLevel) {
        highestLevel = level;
        highestRole = role;
      }
    });

    return highestRole;
  }

  /**
   * Initialize active menu highlighting
   */
  initActiveMenu(): void {
    const currentRoute = this.router.url;

    // Remove active class from all menu items
    const menuElements = document.querySelectorAll('.navbar-nav .nav-link');
    menuElements.forEach(element => {
      element.classList.remove('active');
    });

    // Add active class to current route
    const activeElement = document.querySelector(`[href="${currentRoute}"]`);
    if (activeElement) {
      activeElement.classList.add('active');
    }
  }

  /**
   * Check if user has permission (simplified - mainly for additional filtering if needed)
   */
  hasPermission(resource: string, action: string): boolean {
    return this.rbacService.hasPermissionSync(resource, action);
  }

  /**
   * Check if user has role
   */
  hasRole(roleName: string): boolean {
    // First check via RBAC service
    if (this.rbacService.hasRole(roleName)) {
      return true;
    }

    if (!this.user) {
      return false;
    }

    // Fallback: Check roles directly from user object
    const userObj = this.user as any;
    const userRoles = userObj.roles || [];
    return userRoles.includes(roleName) ||
           this.user.roleName === roleName ||
           userObj.primaryRoleName === roleName;
  }

  /**
   * Toggle Mobile Menu
   */
  toggleMobileMenu(event: any) {
    event.preventDefault();
    this.mobileMenuButtonClicked.emit();
  }

  /**
   * Window scroll
   */
  windowScroll() {
    if (document.body.scrollTop > 70 || document.documentElement.scrollTop > 70) {
      document.getElementById('page-topbar')?.classList.add('topbar-shadow');
    } else {
      document.getElementById('page-topbar')?.classList.remove('topbar-shadow');
    }
  }

  /**
   * Check if menu item has sub items
   */
  hasItems(item: MenuItem): boolean {
    return item.subItems !== undefined ? item.subItems.length > 0 : false;
  }

  /**
   * Toggle menu item
   */
  toggleItem(event: any): void {
    event.preventDefault();
    const nextEl = event.target.nextElementSibling;
    if (nextEl) {
      const hasShow = nextEl.classList.contains('show');
      if (hasShow) {
        nextEl.classList.remove('show');
      } else {
        nextEl.classList.add('show');
      }
    }
  }

  /**
   * Toggle sub menu item
   */
  toggleSubItem(event: any): void {
    event.preventDefault();
    const nextEl = event.target.nextElementSibling;
    if (nextEl) {
      const hasShow = nextEl.classList.contains('show');
      if (hasShow) {
        nextEl.classList.remove('show');
      } else {
        nextEl.classList.add('show');
      }
    }
  }

  /**
   * Update active menu item
   */
  updateActive(event: any): void {
    const target = event.target;
    if (target) {
      // Remove active class from all nav links
      const navLinks = document.querySelectorAll('.nav-link');
      navLinks.forEach(link => link.classList.remove('active'));

      // Add active class to clicked item
      target.classList.add('active');
    }
  }

  /**
   * Check if screen is in laptop mode
   */
  isLaptopMode(): boolean {
    return window.innerWidth <= 1366 && window.innerWidth >= 1024;
  }

  /**
   * Check if screen is in compact mode
   */
  isCompactMode(): boolean {
    return window.innerWidth <= 1200;
  }

  /**
   * Get menu item display text based on screen size
   */
  getMenuDisplayText(item: MenuItem): string {
    if (this.isCompactMode()) {
      return ''; // Return empty string for icon-only mode
    }
    return item.label || '';
  }

  /**
   * Handle window resize for responsive menu
   */
  @HostListener('window:resize', ['$event'])
  onWindowResize(event: any): void {
    this.updateMenuResponsiveness();
  }

  /**
   * Update menu responsiveness based on screen size
   */
  private updateMenuResponsiveness(): void {
    const menuElements = document.querySelectorAll('.navbar-nav .nav-link .menu-text');

    if (this.isCompactMode()) {
      menuElements.forEach(element => {
        (element as HTMLElement).style.display = 'none';
      });
    } else {
      menuElements.forEach(element => {
        (element as HTMLElement).style.display = 'inline';
      });
    }
  }

  /**
   * Get tooltip text for menu item
   */
  getTooltipText(item: MenuItem): string {
    return item.label || '';
  }

  /**
   * Get current user role display name
   */
  getCurrentRoleDisplayName(): string {
    const roleKey = this.currentUserRole.toUpperCase() as UserRole;
    const config = ROLE_MENU_CONFIGS[roleKey];
    return config ? this.formatRoleName(this.currentUserRole) : 'User';
  }

  /**
   * Format role name for display
   */
  private formatRoleName(role: string): string {
    return role.replace('ROLE_', '').replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
