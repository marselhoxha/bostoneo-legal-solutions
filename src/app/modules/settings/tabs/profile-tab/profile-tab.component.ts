import { Component, Input, Output, EventEmitter, ViewChild, ChangeDetectorRef } from '@angular/core';
import { NgForm } from '@angular/forms';
import { UserService } from '../../../../service/user.service';
import { NotificationService } from '../../../../service/notification.service';

@Component({
  selector: 'app-settings-profile-tab',
  templateUrl: './profile-tab.component.html',
  styleUrls: ['./profile-tab.component.scss']
})
export class ProfileTabComponent {
  @Input() user: any;
  @Input() events: any[] = [];
  @Output() userUpdated = new EventEmitter<any>();
  @ViewChild('profileForm') profileForm: NgForm;

  isLoading = false;
  fileInput: HTMLInputElement;

  constructor(
    private userService: UserService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  updateProfile(form: NgForm): void {
    this.isLoading = true;
    this.userService.update$(form.value).subscribe({
      next: (response) => {
        this.isLoading = false;
        const updatedUser = response.data?.user || this.user;
        this.userUpdated.emit(updatedUser);
        this.notificationService.onDefault('Profile updated successfully');
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.isLoading = false;
        this.notificationService.onError(error);
        this.cdr.markForCheck();
      }
    });
  }

  updateImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const formData = new FormData();
    formData.append('image', input.files[0]);
    this.isLoading = true;

    this.userService.updateImage$(formData).subscribe({
      next: (response) => {
        this.isLoading = false;
        const updatedUser = response.data?.user || this.user;
        this.userUpdated.emit(updatedUser);
        this.notificationService.onDefault('Profile image updated');
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.isLoading = false;
        this.notificationService.onError(error);
        this.cdr.markForCheck();
      }
    });
  }
}
