import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { CustomHttpResponse } from '../interface/custom-http-response';
import { UserNotification, NotificationAction, NotificationPreferences, NotificationDelivery } from '../interface/user-notification';
import { UserService } from './user.service';

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private readonly apiUrl = 'http://localhost:8085/api/v1';
    private readonly notifier: ToastrService;
    
    // In-memory notification store for current user
    private userNotifications$ = new BehaviorSubject<UserNotification[]>([]);
    private unreadCount$ = new BehaviorSubject<number>(0);
    private preferences$ = new BehaviorSubject<NotificationPreferences | null>(null);
    
    // Current user ID
    private currentUserId: number | null = null;

    constructor(
        notificationService: ToastrService,
        private http: HttpClient,
        private userService: UserService
    ) {
        this.notifier = notificationService;
        this.initializeUserSubscription();
    }

    // ==================== Legacy Methods (Backward Compatibility) ====================
    
    onDefault(message: string): void {
        this.notifier.show(message);
    }

    onSuccess(message: string): void {
        this.notifier.success(message);
    }

    onInfo(message: string): void {
        this.notifier.info(message);
    }

    onWarning(message: string): void {
        this.notifier.warning(message);
    }

    onError(message: string): void {
        this.notifier.error(message);
    }

    // ==================== Enhanced User-Targeted Notifications ====================
    
    /**
     * Initialize user subscription to track current user
     */
    private initializeUserSubscription(): void {
        this.userService.userData$.subscribe(user => {
            if (user?.id) {
                this.currentUserId = user.id;
                this.loadUserNotifications();
                this.loadUserPreferences();
            }
        });
    }

    /**
     * Send notification to specific user(s)
     */
    sendToUser(notification: Omit<UserNotification, 'id' | 'createdAt' | 'read'>): Observable<UserNotification> {
        const payload = {
            ...notification,
            createdAt: new Date()
        };

        return this.http.post<CustomHttpResponse<UserNotification>>(
            `${this.apiUrl}/notifications/send`,
            payload
        ).pipe(
            map(response => response.data),
            tap(savedNotification => {
                // Show local toastr if it's for current user
                if (savedNotification.userId === this.currentUserId) {
                    this.showLocalNotification(savedNotification);
                    this.addToLocalStore(savedNotification);
                }
            }),
            catchError(error => {
                console.error('Failed to send notification:', error);
                this.onError('Failed to send notification');
                throw error;
            })
        );
    }

    /**
     * Send notification to multiple users
     */
    sendToUsers(userIds: number[], notification: Omit<UserNotification, 'id' | 'createdAt' | 'read' | 'userId'>): Observable<UserNotification[]> {
        const notifications = userIds.map(userId => ({
            ...notification,
            userId,
            createdAt: new Date()
        }));

        return this.http.post<CustomHttpResponse<UserNotification[]>>(
            `${this.apiUrl}/notifications/send-bulk`,
            { notifications }
        ).pipe(
            map(response => response.data),
            tap(savedNotifications => {
                // Show local toastr for current user's notifications
                savedNotifications
                    .filter(n => n.userId === this.currentUserId)
                    .forEach(n => {
                        this.showLocalNotification(n);
                        this.addToLocalStore(n);
                    });
            }),
            catchError(error => {
                console.error('Failed to send bulk notifications:', error);
                this.onError('Failed to send notifications');
                return of([]);
            })
        );
    }

    /**
     * Get notifications for current user
     */
    getUserNotifications(): Observable<UserNotification[]> {
        return this.userNotifications$.asObservable();
    }

    /**
     * Get unread notification count
     */
    getUnreadCount(): Observable<number> {
        return this.unreadCount$.asObservable();
    }

    /**
     * Mark notification as read
     */
    markAsRead(notificationId: string): Observable<void> {
        return this.http.put<CustomHttpResponse<void>>(
            `${this.apiUrl}/notifications/${notificationId}/read`,
            {}
        ).pipe(
            map(response => response.data),
            tap(() => {
                // Update local store
                const notifications = this.userNotifications$.value;
                const notification = notifications.find(n => n.id === notificationId);
                if (notification && !notification.read) {
                    notification.read = true;
                    this.userNotifications$.next([...notifications]);
                    this.updateUnreadCount();
                }
            }),
            catchError(error => {
                console.error('Failed to mark notification as read:', error);
                return of();
            })
        );
    }

    /**
     * Mark all notifications as read
     */
    markAllAsRead(): Observable<void> {
        if (!this.currentUserId) return of();

        return this.http.put<CustomHttpResponse<void>>(
            `${this.apiUrl}/notifications/user/${this.currentUserId}/read-all`,
            {}
        ).pipe(
            map(response => response.data),
            tap(() => {
                // Update local store
                const notifications = this.userNotifications$.value.map(n => ({ ...n, read: true }));
                this.userNotifications$.next(notifications);
                this.unreadCount$.next(0);
            }),
            catchError(error => {
                console.error('Failed to mark all notifications as read:', error);
                return of();
            })
        );
    }

    /**
     * Delete notification
     */
    deleteNotification(notificationId: string): Observable<void> {
        return this.http.delete<CustomHttpResponse<void>>(
            `${this.apiUrl}/notifications/${notificationId}`
        ).pipe(
            map(response => response.data),
            tap(() => {
                // Remove from local store
                const notifications = this.userNotifications$.value.filter(n => n.id !== notificationId);
                this.userNotifications$.next(notifications);
                this.updateUnreadCount();
            }),
            catchError(error => {
                console.error('Failed to delete notification:', error);
                return of();
            })
        );
    }

    /**
     * Execute notification action
     */
    executeAction(notification: UserNotification, action: NotificationAction): void {
        switch (action.action) {
            case 'NAVIGATE':
                if (action.target) {
                    // Router navigation would be handled by the component
                    console.log('Navigate to:', action.target);
                }
                break;
            case 'API_CALL':
                if (action.target && action.payload) {
                    this.http.post(action.target, action.payload).subscribe({
                        next: () => this.onSuccess('Action completed successfully'),
                        error: () => this.onError('Failed to execute action')
                    });
                }
                break;
            case 'MODAL':
                // Modal opening would be handled by the component
                console.log('Open modal:', action.target);
                break;
            case 'DISMISS':
                this.markAsRead(notification.id).subscribe();
                break;
        }
    }

    /**
     * Get user notification preferences
     */
    getPreferences(): Observable<NotificationPreferences | null> {
        return this.preferences$.asObservable();
    }

    /**
     * Update user notification preferences
     */
    updatePreferences(preferences: Partial<NotificationPreferences>): Observable<NotificationPreferences> {
        if (!this.currentUserId) throw new Error('No current user');

        return this.http.put<CustomHttpResponse<NotificationPreferences>>(
            `${this.apiUrl}/notifications/preferences/${this.currentUserId}`,
            preferences
        ).pipe(
            map(response => response.data),
            tap(updatedPrefs => this.preferences$.next(updatedPrefs)),
            catchError(error => {
                console.error('Failed to update preferences:', error);
                this.onError('Failed to update notification preferences');
                throw error;
            })
        );
    }

    // ==================== Assignment-Specific Notifications ====================
    
    /**
     * Notify user about case assignment
     */
    notifyCaseAssignment(userId: number, caseId: number, caseName: string, roleType: string): Observable<UserNotification> {
        return this.sendToUser({
            userId,
            type: 'ASSIGNMENT',
            priority: 'HIGH',
            title: 'New Case Assignment',
            message: `You have been assigned as ${roleType} to case: ${caseName}`,
            data: { caseId, roleType },
            actions: [
                {
                    label: 'View Case',
                    action: 'NAVIGATE',
                    target: `/cases/${caseId}`,
                    style: 'primary'
                },
                {
                    label: 'Dismiss',
                    action: 'DISMISS',
                    style: 'secondary'
                }
            ],
            relatedEntityId: caseId,
            relatedEntityType: 'case'
        });
    }

    /**
     * Notify user about task assignment
     */
    notifyTaskAssignment(userId: number, taskId: number, taskTitle: string, caseId: number): Observable<UserNotification> {
        return this.sendToUser({
            userId,
            type: 'TASK',
            priority: 'MEDIUM',
            title: 'New Task Assignment',
            message: `You have been assigned a new task: ${taskTitle}`,
            data: { taskId, caseId },
            actions: [
                {
                    label: 'View Task',
                    action: 'NAVIGATE',
                    target: `/cases/${caseId}/tasks/${taskId}`,
                    style: 'primary'
                }
            ],
            relatedEntityId: taskId,
            relatedEntityType: 'task'
        });
    }

    /**
     * Notify about approaching deadline
     */
    notifyDeadline(userId: number, taskId: number, taskTitle: string, dueDate: Date): Observable<UserNotification> {
        const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const priority = daysUntilDue <= 1 ? 'URGENT' : daysUntilDue <= 3 ? 'HIGH' : 'MEDIUM';

        return this.sendToUser({
            userId,
            type: 'DEADLINE',
            priority,
            title: 'Approaching Deadline',
            message: `Task "${taskTitle}" is due in ${daysUntilDue} day(s)`,
            data: { taskId, dueDate },
            actions: [
                {
                    label: 'View Task',
                    action: 'NAVIGATE',
                    target: `/tasks/${taskId}`,
                    style: 'warning'
                }
            ],
            relatedEntityId: taskId,
            relatedEntityType: 'task',
            expiresAt: dueDate
        });
    }

    // ==================== Private Helper Methods ====================
    
    private loadUserNotifications(): void {
        if (!this.currentUserId) return;

        const params = new HttpParams()
            .set('page', '0')
            .set('size', '50')
            .set('sort', 'createdAt,desc');

        this.http.get<CustomHttpResponse<any>>(
            `${this.apiUrl}/notifications/user/${this.currentUserId}`,
            { params }
        ).subscribe({
            next: (response) => {
                // Ensure we have an array - handle both direct array and nested data structures
                let notifications: UserNotification[] = [];
                if (response && response.data) {
                    if (Array.isArray(response.data)) {
                        notifications = response.data;
                    } else if (response.data.notifications && Array.isArray(response.data.notifications)) {
                        notifications = response.data.notifications;
                    }
                }
                this.userNotifications$.next(notifications);
                this.updateUnreadCount();
            },
            error: (error) => {
                console.error('Failed to load user notifications:', error);
                this.userNotifications$.next([]);
            }
        });
    }

    private loadUserPreferences(): void {
        if (!this.currentUserId) return;

        this.http.get<CustomHttpResponse<NotificationPreferences>>(
            `${this.apiUrl}/notifications/preferences/${this.currentUserId}`
        ).subscribe({
            next: (response) => this.preferences$.next(response.data),
            error: (error) => {
                console.error('Failed to load notification preferences:', error);
                // Set default preferences
                this.preferences$.next(this.getDefaultPreferences());
            }
        });
    }

    private showLocalNotification(notification: UserNotification): void {
        const title = `${notification.title}: ${notification.message}`;
        
        switch (notification.priority) {
            case 'URGENT':
                this.notifier.error(title, notification.title, { timeOut: 10000 });
                break;
            case 'HIGH':
                this.notifier.warning(title, notification.title, { timeOut: 7000 });
                break;
            case 'MEDIUM':
                this.notifier.info(title, notification.title, { timeOut: 5000 });
                break;
            case 'LOW':
                this.notifier.show(title, notification.title, { timeOut: 3000 });
                break;
        }
    }

    private addToLocalStore(notification: UserNotification): void {
        const notifications = [notification, ...this.userNotifications$.value];
        this.userNotifications$.next(notifications);
        this.updateUnreadCount();
    }

    private updateUnreadCount(): void {
        const notifications = this.userNotifications$.value;
        if (Array.isArray(notifications)) {
            const unreadCount = notifications.filter(n => !n.read).length;
            this.unreadCount$.next(unreadCount);
        } else {
            console.warn('Notifications is not an array:', notifications);
            this.unreadCount$.next(0);
        }
    }

    private getDefaultPreferences(): NotificationPreferences {
        return {
            userId: this.currentUserId!,
            inApp: true,
            email: true,
            sms: false,
            push: true,
            types: {
                ASSIGNMENT: { enabled: true, channels: ['inApp', 'email'], threshold: 'MEDIUM' },
                TASK: { enabled: true, channels: ['inApp'], threshold: 'MEDIUM' },
                DEADLINE: { enabled: true, channels: ['inApp', 'email'], threshold: 'HIGH' },
                WORKLOAD: { enabled: true, channels: ['inApp'], threshold: 'HIGH' },
                SYSTEM: { enabled: true, channels: ['inApp'], threshold: 'LOW' },
                CASE_UPDATE: { enabled: true, channels: ['inApp'], threshold: 'MEDIUM' }
            }
        };
    }
}

