import { Component, OnInit, EventEmitter, Output, ViewChild, ElementRef, Input, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';

// Menu Package
// import MetisMenu from 'metismenujs';

import { MENU } from './menu';
import { MenuItem } from './menu.model';
import { User } from 'src/app/interface/user';
import { RbacService } from 'src/app/core/services/rbac.service';

@Component({
  selector: 'app-horizontal-topbar',
  templateUrl: './horizontal-topbar.component.html',
  styleUrls: ['./horizontal-topbar.component.scss']
})
export class HorizontalTopbarComponent implements OnInit {
  @Input() user: User;
  menu: any;
  menuItems: MenuItem[] = [];
  @ViewChild('sideMenu') sideMenu!: ElementRef;
  @Output() mobileMenuButtonClicked = new EventEmitter();
  showAdminNavigation = false;

  constructor(
    private router: Router,
    private rbacService: RbacService
  ) {
    // Subscribe to route changes to update active menu
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.initActiveMenu();
    });
  }

  ngOnInit(): void {
    this.menu = MENU;
    this.menuItems = this.filterMenuByPermissions(MENU);
    this.initActiveMenu();
    
    // Disabled RBAC subscription to avoid 400 errors
    // this.rbacService.permissions$.subscribe(() => {
    //   // Update menu when permissions change
    //   this.menuItems = this.filterMenuByPermissions(MENU);
    // });
    
    // Directly filter menu without RBAC subscription
    this.menuItems = this.filterMenuByPermissions(MENU);

    // Check comprehensive admin access
    if (this.rbacService.isAdmin()) {
      console.log('User has admin access - showing all navigation options');
      this.showAdminNavigation = true;
    } else {
      console.log('User does not have admin access');
      this.showAdminNavigation = false;
    }

    // Initialize responsive menu
    this.updateMenuResponsiveness();
  }

  /**
   * Initialize active menu highlighting
   */
  initActiveMenu(): void {
    // Add logic to highlight active menu items based on current route
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
   * Filter menu items based on user permissions
   * Updated for simplified 6-role structure:
   * ROLE_ADMIN (100), ROLE_ATTORNEY (70), ROLE_FINANCE (65), PARALEGAL (40), ROLE_SECRETARY (20), ROLE_USER (10)
   */
  filterMenuByPermissions(menuItems: MenuItem[]): MenuItem[] {
    // Debug role checks with simplified roles
    console.log('🔍 Role checks (simplified):');
    console.log('  - ROLE_ADMIN:', this.hasRole('ROLE_ADMIN'));
    console.log('  - ROLE_ATTORNEY:', this.hasRole('ROLE_ATTORNEY'));
    console.log('  - ROLE_FINANCE:', this.hasRole('ROLE_FINANCE'));
    console.log('  - PARALEGAL:', this.hasRole('PARALEGAL'));
    console.log('  - ROLE_SECRETARY:', this.hasRole('ROLE_SECRETARY'));

    // Admin and Attorney roles get full menu access
    if (this.hasRole('ROLE_ADMIN') || this.hasRole('ROLE_ATTORNEY')) {
      console.log('✅ User is admin/attorney, showing all menu items');
      return menuItems;
    }

    console.log('🔍 Filtering menu items based on permissions and roles');

    return menuItems.filter(item => {
      // Check role requirements first
      if (item.requiredRoles && item.requiredRoles.length > 0) {
        const hasRequiredRole = item.requiredRoles.some(role => this.hasRole(role));
        if (!hasRequiredRole) {
          console.log(`❌ ${item.label}: Missing required role`);
          return false;
        }
      }

      // Check permission requirements
      if (item.requiredPermission) {
        const hasPermission = this.hasPermission(
          item.requiredPermission.resource,
          item.requiredPermission.action
        );
        if (!hasPermission) {
          console.log(`❌ ${item.label}: Missing permission ${item.requiredPermission.resource}:${item.requiredPermission.action}`);
          return false;
        }
      }

      return true;
    }).map(item => {
      // Also filter subItems recursively if they exist
      if (item.subItems && item.subItems.length > 0) {
        const filteredSubItems = this.filterMenuByPermissions(item.subItems);
        
        // Return item with filtered subItems only if there are visible subItems
        // or if the parent item itself doesn't require permissions
        if (filteredSubItems.length > 0 || !item.requiredPermission) {
          return { ...item, subItems: filteredSubItems };
        } else {
          // If parent has subItems but none are visible, hide the parent too
          return null;
        }
      }
      
      return item;
    }).filter(item => item !== null); // Remove null items
  }

  /**
   * Check if user has permission
   */
  hasPermission(resource: string, action: string): boolean {
    return this.rbacService.hasPermissionSync(resource, action);
  }

  /**
   * Check if user has role (simplified 6-role structure)
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
    const hasRole = userRoles.includes(roleName) ||
                    this.user.roleName === roleName ||
                    userObj.primaryRoleName === roleName;

    return hasRole;
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
   * Check if screen is in laptop mode (for responsive menu behavior)
   */
  isLaptopMode(): boolean {
    return window.innerWidth <= 1366 && window.innerWidth >= 1024;
  }

  /**
   * Check if screen is in compact mode (for icon-only menu)
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
    return item.label;
  }

  /**
   * Handle window resize for responsive menu
   */
  @HostListener('window:resize', ['$event'])
  onWindowResize(event: any): void {
    // Update menu display based on new window size
    this.updateMenuResponsiveness();
  }

  /**
   * Update menu responsiveness based on screen size
   */
  private updateMenuResponsiveness(): void {
    const menuElements = document.querySelectorAll('.navbar-nav .nav-link .menu-text');
    
    if (this.isCompactMode()) {
      // Hide text in compact mode
      menuElements.forEach(element => {
        (element as HTMLElement).style.display = 'none';
      });
    } else {
      // Show text in normal mode
      menuElements.forEach(element => {
        (element as HTMLElement).style.display = 'inline';
      });
    }
  }

  /**
   * Get tooltip text for menu item (used in compact mode)
   */
  getTooltipText(item: MenuItem): string {
    return item.label;
  }
}
