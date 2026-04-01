import { Component, Input, ViewChild, ChangeDetectorRef } from '@angular/core';
import { NgForm } from '@angular/forms';
import { UserService } from '../../../../service/user.service';
import { NotificationService } from '../../../../service/notification.service';
import { EventType } from '../../../../enum/event-type.enum';

@Component({
  selector: 'app-settings-security-tab',
  templateUrl: './security-tab.component.html',
  styleUrls: ['./security-tab.component.scss']
})
export class SecurityTabComponent {
  @Input() user: any;
  @Input() events: any[] = [];

  isLoading = false;
  readonly EventType = EventType;

  constructor(
    private userService: UserService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  updatePassword(form: NgForm): void {
    this.isLoading = true;
    this.userService.updatePassword$(form.value).subscribe({
      next: () => {
        this.isLoading = false;
        form.reset();
        this.notificationService.onDefault('Password updated successfully');
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.isLoading = false;
        this.notificationService.onError(error);
        this.cdr.markForCheck();
      }
    });
  }

  toggleMfa(): void {
    this.isLoading = true;
    this.userService.toggleMfa$().subscribe({
      next: (response) => {
        this.isLoading = false;
        this.user = { ...this.user, usingMFA: !this.user.usingMFA };
        this.notificationService.onDefault(
          this.user.usingMFA ? 'MFA enabled' : 'MFA disabled'
        );
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.isLoading = false;
        this.notificationService.onError(error);
        this.cdr.markForCheck();
      }
    });
  }

  getEventBadgeClass(type: string): string {
    const map: { [key: string]: string } = {
      'LOGIN_ATTEMPT_SUCCESS': 'border-success text-success',
      'LOGIN_ATTEMPT': 'border-warning text-warning',
      'LOGIN_ATTEMPT_FAILURE': 'border-danger text-danger',
      'PROFILE_UPDATE': 'border-primary text-primary',
      'PROFILE_PICTURE_UPDATE': 'border-primary text-primary',
      'ROLE_UPDATE': 'border-info text-info',
      'ACCOUNT_SETTINGS_UPDATE': 'border-warning text-warning',
      'PASSWORD_UPDATE': 'border-warning text-warning',
      'MFA_UPDATE': 'border-info text-info'
    };
    return map[type] || 'border-secondary text-secondary';
  }
}
