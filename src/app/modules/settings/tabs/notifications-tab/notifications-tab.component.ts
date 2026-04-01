import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-settings-notifications-tab',
  template: `
    <app-notification-preferences
      [userId]="userId"
      [userRole]="userRole">
    </app-notification-preferences>
  `
})
export class NotificationsTabComponent {
  @Input() userId!: number;
  @Input() userRole!: string;
}
