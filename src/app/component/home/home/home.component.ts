import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { User } from 'src/app/interface/user';
import { UserService } from 'src/app/service/user.service';
import { RbacService } from 'src/app/core/services/rbac.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {

  // Core properties
  currentUser: User | null = null;
  userRole: string = '';
  isDarkMode: boolean = false;

  private destroy$ = new Subject<void>();
  private themeObserver?: MutationObserver;

  constructor(
    private router: Router, 
    private userService: UserService,
    private rbacService: RbacService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    console.log('Home component initializing...');
    
    // Clear any stale session data when component initializes
    this.clearStaleSessionData();
    
    // Get current user and role
    this.currentUser = this.userService.getCurrentUser();
    
    // If no current user, try to load from profile
    if (!this.currentUser) {
      console.log('No current user found, attempting to load from profile...');
      this.userService.profile$().subscribe({
        next: (response) => {
          if (response?.data?.user) {
            this.currentUser = response.data.user;
            this.userRole = this.detectUserRole();
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error('Failed to load user profile:', error);
          this.userRole = this.detectUserRole();
        }
      });
    } else {
      this.userRole = this.detectUserRole();
    }
    
    // Detect and monitor theme changes
    this.detectTheme();
    this.setupThemeObserver();
    
    console.log('Home component initialized with role:', this.userRole);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clean up theme observer
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }
  }

  /**
   * Force refresh user role - useful when role might have changed
   */
  public refreshUserRole(): void {
    console.log('🔄 Force refreshing user role...');
    
    // Clear all caches
    sessionStorage.removeItem('userRole');
    sessionStorage.removeItem('userRoleId');
    
    // Re-detect role
    this.userRole = this.detectUserRole();
    
    // Force change detection
    this.cdr.detectChanges();
    
    console.log('🔄 Role refreshed to:', this.userRole);
  }

  /**
   * Clear stale session data that might cause incorrect role detection
   */
  private clearStaleSessionData(): void {
    const sessionUserId = sessionStorage.getItem('userRoleId');
    const currentUserId = this.currentUser?.id?.toString();
    
    // Clear session data if user changed or if we have suspicious CLIENT role for potential admin
    const sessionRole = sessionStorage.getItem('userRole');
    if (sessionUserId !== currentUserId || 
        (sessionRole === 'CLIENT' && this.isPotentialAdminUser())) {
      console.log('Clearing stale session data - user changed or suspicious role detected');
      sessionStorage.removeItem('userRole');
      sessionStorage.removeItem('userRoleId');
    }
  }

  /**
   * Check if current user might be an admin based on email or other indicators
   */
  private isPotentialAdminUser(): boolean {
    if (!this.currentUser) return false;
    
    // Check for admin indicators
    const adminEmails = ['marsel', 'admin', 'managing.partner', 'senior.partner'];
    const userEmail = this.currentUser.email?.toLowerCase() || '';
    
    return adminEmails.some(adminEmail => userEmail.includes(adminEmail));
  }

  /**
   * Detect current user role from various sources
   */
  private detectUserRole(): string {
    console.log('🔍 Starting role detection for user:', this.currentUser?.email);
    
    // IMPORTANT: Do NOT use session storage for admin users to avoid stale data issues
    const isAdminUser = this.isPotentialAdminUser();
    
    if (!isAdminUser) {
      // Only check session storage for non-admin users
      const sessionRole = sessionStorage.getItem('userRole');
      const sessionUserId = sessionStorage.getItem('userRoleId');
      const currentUserId = this.currentUser?.id?.toString();
      
      if (sessionRole && sessionUserId === currentUserId && sessionRole !== 'CLIENT') {
        console.log('Using persisted role from session for non-admin user:', sessionRole);
        return sessionRole;
      }
    }

    // Try multiple sources for role detection
    let roles: string[] = [];

    // 1. Check current user object for multiple roles
    if (this.currentUser?.roleName) {
      roles.push(this.currentUser.roleName);
      console.log('Role from currentUser.roleName:', this.currentUser.roleName);
    }
    if (this.currentUser?.primaryRoleName) {
      roles.push(this.currentUser.primaryRoleName);
      console.log('Role from currentUser.primaryRoleName:', this.currentUser.primaryRoleName);
    }
    if (this.currentUser?.roles && Array.isArray(this.currentUser.roles)) {
      roles.push(...this.currentUser.roles);
      console.log('Roles from currentUser.roles:', this.currentUser.roles);
    }

    // 2. Check local storage (synchronous)
    if (roles.length === 0) {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          if (user.roleName) roles.push(user.roleName);
          if (user.primaryRoleName) roles.push(user.primaryRoleName);
          if (user.role) roles.push(user.role);
          if (user.roles && Array.isArray(user.roles)) roles.push(...user.roles);
        } catch (error) {
          console.warn('Could not parse stored user:', error);
        }
      }
    }

    // 3. Check auth service (synchronous)
    if (roles.length === 0) {
      try {
        const authUser = this.authService.getCurrentUser();
        if (authUser) {
          if (authUser.roles && authUser.roles.length > 0) {
            roles.push(...authUser.roles);
          }
          if ('primaryRoleName' in authUser && typeof authUser.primaryRoleName === 'string') {
            roles.push(authUser.primaryRoleName);
          }
          if ('roleName' in authUser && typeof authUser.roleName === 'string') {
            roles.push(authUser.roleName);
          }
        }
      } catch (error) {
        console.warn('Could not get user from auth service:', error);
      }
    }

    // 4. Check JWT token
    if (roles.length === 0) {
      const token = localStorage.getItem('token') || localStorage.getItem('Token') || localStorage.getItem('TOKEN');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.role) roles.push(payload.role);
          if (payload.primaryRoleName) roles.push(payload.primaryRoleName);
          if (payload.roleName) roles.push(payload.roleName);
          if (payload.roles && Array.isArray(payload.roles)) roles.push(...payload.roles);
          console.log('Roles from JWT token:', roles);
        } catch (error) {
          console.warn('Could not parse JWT token:', error);
        }
      }
    }

    // 5. If no roles detected, check if this might be an admin user
    if (roles.length === 0) {
      // For potential admin users, try harder to find their role
      if (this.isPotentialAdminUser()) {
        console.warn('⚠️ No roles detected for potential admin user - attempting fallback detection');
        
        // Check for any admin-like properties in the user object
        if (this.currentUser) {
          const userStr = JSON.stringify(this.currentUser).toLowerCase();
          if (userStr.includes('admin') || userStr.includes('partner') || userStr.includes('managing')) {
            console.log('Found admin indicators in user object, assigning ADMIN role');
            roles = ['ADMIN'];
          }
        }
        
        // If still no roles, DO NOT default to CLIENT for admin users
        if (roles.length === 0) {
          console.error('❌ CRITICAL: No roles found for admin user, defaulting to ADMIN to prevent security issue');
          roles = ['ADMIN']; // Safe default for admin users
        }
      } else {
        console.warn('No roles detected for regular user - using CLIENT as default');
        roles = ['CLIENT']; // Safe default for non-admin users
      }
    }

    // Normalize and prioritize roles
    const normalizedRoles = roles.map(role => this.normalizeRole(role));
    const prioritizedRole = this.prioritizeRole(normalizedRoles);
    
    console.log('Raw roles:', roles, 'Normalized roles:', normalizedRoles, 'Prioritized role:', prioritizedRole);
    
    // Only persist role in session storage for non-admin users to avoid caching issues
    if (!this.isPotentialAdminUser() && prioritizedRole !== 'ADMIN') {
      sessionStorage.setItem('userRole', prioritizedRole);
      if (this.currentUser?.id) {
        sessionStorage.setItem('userRoleId', this.currentUser.id.toString());
      }
    } else {
      // Clear any existing session storage for admin users
      sessionStorage.removeItem('userRole');
      sessionStorage.removeItem('userRoleId');
      console.log('🔒 Not caching role for admin user to prevent stale data issues');
    }
    
    return prioritizedRole;
  }

  private normalizeRole(role: string): string {
    let normalizedRole = role ? role.toUpperCase() : '';
    
    // Remove ROLE_ prefix if present
    if (normalizedRole.startsWith('ROLE_')) {
      normalizedRole = normalizedRole.substring(5);
    }
    
    // Map database roles to frontend dashboard types
    const roleMapping: { [key: string]: string } = {
      // Admin roles (highest priority) - EXPANDED LIST
      'ADMIN': 'ADMIN',
      'ROLE_ADMIN': 'ADMIN',
      'ADMINISTRATOR': 'ADMIN',
      'ROLE_SYSADMIN': 'ADMIN',
      'SYSADMIN': 'ADMIN',
      'MANAGING_PARTNER': 'ADMIN',
      'SENIOR_PARTNER': 'ADMIN',
      'EQUITY_PARTNER': 'ADMIN',
      'COO': 'ADMIN',
      'CFO': 'ADMIN',
      
      // Attorney roles  
      'ATTORNEY': 'ATTORNEY',
      'NON_EQUITY_PARTNER': 'ATTORNEY',
      'OF_COUNSEL': 'ATTORNEY',
      'SENIOR_ASSOCIATE': 'ATTORNEY',
      'ASSOCIATE': 'ATTORNEY',
      'JUNIOR_ASSOCIATE': 'ATTORNEY',
      
      // Manager roles
      'MANAGER': 'MANAGER',
      'PRACTICE_MANAGER': 'MANAGER',
      'IT_MANAGER': 'MANAGER',
      'HR_MANAGER': 'MANAGER',
      'FINANCE_MANAGER': 'MANAGER',
      
      // Secretary roles
      'SECRETARY': 'SECRETARY',
      'LEGAL_SECRETARY': 'SECRETARY',
      
      // Paralegal roles
      'PARALEGAL': 'PARALEGAL',
      'SENIOR_PARALEGAL': 'PARALEGAL',
      'LEGAL_ASSISTANT': 'PARALEGAL',
      'LAW_CLERK': 'PARALEGAL',
      
      // Client roles (lowest priority)
      'CLIENT': 'CLIENT',
      'ROLE_USER': 'CLIENT',
      'USER': 'CLIENT'
    };
    
    const mappedRole = roleMapping[normalizedRole] || 'CLIENT';
    
    // Log mapping for debugging
    if (role && normalizedRole) {
      console.log(`🎭 Role mapping: "${role}" -> "${normalizedRole}" -> "${mappedRole}"`);
      
      // Warning if a potential admin role is being mapped to CLIENT
      if (mappedRole === 'CLIENT' && 
          (normalizedRole.includes('ADMIN') || normalizedRole.includes('PARTNER'))) {
        console.error(`❌ WARNING: Potential admin role "${normalizedRole}" mapped to CLIENT!`);
      }
    }
    
    return mappedRole;
  }

  /**
   * Prioritize roles when user has multiple roles
   * Admin roles take precedence over other roles
   */
  private prioritizeRole(roles: string[]): string {
    if (roles.length === 0) return 'CLIENT';
    if (roles.length === 1) return roles[0];
    
    // Role priority order (highest to lowest)
    const rolePriority = ['ADMIN', 'MANAGER', 'ATTORNEY', 'SECRETARY', 'PARALEGAL', 'CLIENT'];
    
    // Find the highest priority role
    for (const priority of rolePriority) {
      if (roles.includes(priority)) {
        console.log(`Selected role ${priority} from available roles:`, roles);
        return priority;
      }
    }
    
    // Fallback to first role
    return roles[0];
  }

  /**
   * Detect current theme (dark/light mode)
   */
  private detectTheme(): void {
    // Check document body for theme classes
    const body = document.body;
    const html = document.documentElement;
    
    // Check for various dark mode indicators
    this.isDarkMode = 
      body.classList.contains('dark') ||
      body.classList.contains('dark-mode') ||
      html.classList.contains('dark') ||
      html.classList.contains('dark-mode') ||
      body.getAttribute('data-theme') === 'dark' ||
      html.getAttribute('data-theme') === 'dark' ||
      body.getAttribute('data-bs-theme') === 'dark' ||
      html.getAttribute('data-bs-theme') === 'dark';

    console.log('Theme detected:', this.isDarkMode ? 'Dark' : 'Light');
  }

  /**
   * Set up observer to watch for theme changes
   */
  private setupThemeObserver(): void {
    this.themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && 
           (mutation.attributeName === 'class' || 
            mutation.attributeName === 'data-theme' || 
            mutation.attributeName === 'data-bs-theme')) {
          this.detectTheme();
          this.cdr.detectChanges();
        }
      });
    });

    // Observe both body and html elements
    this.themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-bs-theme']
    });

    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-bs-theme']
    });
  }
}




