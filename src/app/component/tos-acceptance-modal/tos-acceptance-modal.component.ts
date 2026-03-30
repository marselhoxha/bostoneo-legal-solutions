import { Component, EventEmitter, Output } from '@angular/core';
import { UserService } from '../../service/user.service';

@Component({
  selector: 'app-tos-acceptance-modal',
  templateUrl: './tos-acceptance-modal.component.html',
  styleUrls: ['./tos-acceptance-modal.component.scss']
})
export class TosAcceptanceModalComponent {
  @Output() accepted = new EventEmitter<void>();

  agreed = false;
  submitting = false;
  error = '';

  constructor(private userService: UserService) {}

  accept(): void {
    if (!this.agreed || this.submitting) return;
    this.submitting = true;
    this.error = '';

    this.userService.acceptTerms$().subscribe({
      next: () => {
        this.submitting = false;
        this.accepted.emit();
      },
      error: () => {
        this.submitting = false;
        this.error = 'Something went wrong. Please try again.';
      }
    });
  }
}
