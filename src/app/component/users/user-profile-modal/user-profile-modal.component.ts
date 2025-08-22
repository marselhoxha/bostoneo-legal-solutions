import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';

import { User } from '../../../interface/user';
import { UserService } from '../../../service/user.service';
import { NotificationService } from '../../../service/notification.service';
import { RbacService } from '../../../core/services/rbac.service';

@Component({
  selector: 'app-user-profile-modal',
  templateUrl: './user-profile-modal.component.html',
  styleUrls: ['./user-profile-modal.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class UserProfileModalComponent implements OnInit, OnDestroy {
  @Input() userId!: number;
  @Input() user?: User;

  private destroy$ = new Subject<void>();
  
  userDetails: User | null = null;
  loading = false;
  error: string | null = null;
  
  constructor(
    public activeModal: NgbActiveModal,
    private userService: UserService,
    private notificationService: NotificationService,
    private rbacService: RbacService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.user) {
      this.userDetails = this.user;
    } else if (this.userId) {
      this.loadUserDetails();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUserDetails(): void {
    if (!this.userId) return;
    
    this.loading = true;
    this.error = null;

    this.userService.getUserById(this.userId).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading user details:', error);
        this.error = 'Failed to load user details.';
        this.notificationService.onError('Failed to load user details');
        return of({ data: null });
      })
    ).subscribe({
      next: (response) => {
        this.userDetails = response?.data || null;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error in user details subscription:', error);
        this.loading = false;
        this.error = 'Failed to load user details.';
        this.cdr.detectChanges();
      }
    });
  }

  getUserInitials(user: User): string {
    const firstName = user.firstName?.charAt(0)?.toUpperCase() || '';
    const lastName = user.lastName?.charAt(0)?.toUpperCase() || '';
    return firstName + lastName;
  }

  getUserStatusClass(user: User): string {
    if (!user.enabled) return 'danger';
    if (!user.notLocked) return 'warning';
    return 'success';
  }

  getUserStatusText(user: User): string {
    if (!user.enabled) return 'Disabled';
    if (!user.notLocked) return 'Locked';
    return 'Active';
  }

  canViewContactInfo(): boolean {
    return this.rbacService.hasPermissionSync('USER', 'VIEW') || 
           this.userService.getCurrentUser()?.id === this.userDetails?.id;
  }

  canViewSensitiveInfo(): boolean {
    return this.rbacService.hasPermissionSync('USER', 'VIEW_ALL') ||
           this.rbacService.hasRole('ROLE_ADMIN');
  }

  sendEmail(): void {
    if (this.userDetails?.email) {
      window.open(`mailto:${this.userDetails.email}`, '_blank');
    }
  }

  callUser(): void {
    if (this.userDetails?.phone) {
      window.open(`tel:${this.userDetails.phone}`, '_blank');
    }
  }

  close(): void {
    this.activeModal.dismiss();
  }

  getRoleDisplayName(roleName: string): string {
    // Convert role names to display-friendly format
    switch (roleName) {
      case 'ROLE_ADMIN':
        return 'Administrator';
      case 'ROLE_PARTNER':
        return 'Partner';
      case 'ROLE_ATTORNEY':
        return 'Attorney';
      case 'ROLE_PARALEGAL':
        return 'Paralegal';
      case 'ROLE_ASSOCIATE':
        return 'Associate';
      case 'ROLE_CLIENT':
        return 'Client';
      case 'ROLE_SUPPORT_STAFF':
        return 'Support Staff';
      default:
        return roleName?.replace('ROLE_', '').replace('_', ' ') || 'Unknown';
    }
  }

  getPermissionsList(permissions: string): string[] {
    if (!permissions) return [];
    
    try {
      // If permissions is already parsed JSON
      if (typeof permissions === 'object') {
        return Object.keys(permissions);
      }
      
      // If permissions is a JSON string
      const parsedPermissions = JSON.parse(permissions);
      return Object.keys(parsedPermissions);
    } catch (error) {
      // If it's a comma-separated string
      return permissions.split(',').map(p => p.trim()).filter(p => p.length > 0);
    }
  }

  formatPermissionName(permission: string): string {
    return permission.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }
}