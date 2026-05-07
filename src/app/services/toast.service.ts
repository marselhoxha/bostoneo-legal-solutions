import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

/**
 * Lightweight toast notifications backed by ngx-toastr.
 *
 * The app's `ToastrModule.forRoot(...)` is already configured at
 * `notification.module.ts` (4s timeout, bottom-right, preventDuplicates) —
 * this service is a thin facade so callers don't need to know about
 * positioning or timing.
 *
 * Usage:
 *   constructor(private toast: ToastService) {}
 *   this.toast.success('Task updated');
 *   this.toast.error('Failed to update task');
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  constructor(private toastr: ToastrService) {}

  success(message: string, title?: string): void {
    this.toastr.success(message, title);
  }

  error(message: string, title?: string): void {
    // Errors get a slightly longer timeout so users can read them.
    this.toastr.error(message, title, { timeOut: 6000 });
  }

  info(message: string, title?: string): void {
    this.toastr.info(message, title);
  }

  warn(message: string, title?: string): void {
    this.toastr.warning(message, title, { timeOut: 5000 });
  }
}
