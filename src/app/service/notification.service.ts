import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Injectable()
export class NotificationService {
    private readonly notifier: ToastrService;

    constructor(notificationService: ToastrService) {
        this.notifier = notificationService;
    }

    onDefault(message: string): void {
        this.notifier.show(message);
    }

    onSuccess(message: string): void {
        this.notifier.success(message);
    }

    onInfo(message: string): void {
        this.notifier.info( message);
    }

    onWarning(message: string): void {
        this.notifier.warning(message);
    }

    onError(message: string): void {
        this.notifier.error( message);
    }
}

