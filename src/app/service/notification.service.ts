import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { CustomHttpResponse } from '../interface/custom-http-response';
import { UserNotification, NotificationAction, NotificationPreferences, NotificationDelivery } from '../interface/user-notification';
import { UserService } from './user.service';
import { environment } from '../../environments/environment';

// Interface for push notifications displayed in topbar
export interface PushNotification {
    id: string;
    title: string;
    body: string;
    timestamp: Date;
    read: boolean;
    data: any;
    type: string;
    isFromBackend: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private readonly apiUrl = `${environment.apiUrl}/api/v1`;
    private readonly notifier: ToastrService;

    // In-memory notification store for current user
    private userNotifications$ = new BehaviorSubject<UserNotification[]>([]);
    private unreadCount$ = new BehaviorSubject<number>(0);
    private preferences$ = new BehaviorSubject<NotificationPreferences | null>(null);

    // Push notifications for topbar display (persisted in service)
    private pushNotifications$ = new BehaviorSubject<PushNotification[]>([]);
    private pushNotificationsLoaded = false;

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

    // ==================== Push Notifications (Topbar Display) ====================

    /**
     * Get push notifications for topbar display
     */
    getPushNotifications(): Observable<PushNotification[]> {
        return this.pushNotifications$.asObservable();
    }

    /**
     * Get current push notifications value
     */
    getPushNotificationsValue(): PushNotification[] {
        return this.pushNotifications$.value;
    }

    /**
     * Get push notifications unread count
     */
    getPushUnreadCount(): number {
        return this.pushNotifications$.value.filter(n => !n.read).length;
    }

    /**
     * Check if push notifications have been loaded
     */
    isPushNotificationsLoaded(): boolean {
        return this.pushNotificationsLoaded;
    }

    /**
     * Set push notifications loaded flag
     */
    setPushNotificationsLoaded(loaded: boolean): void {
        this.pushNotificationsLoaded = loaded;
    }

    /**
     * Add a push notification to the list
     * Returns true if notification was added, false if skipped (duplicate, read, etc.)
     */
    addPushNotification(notification: PushNotification): boolean {
        // Filter out message-related notifications
        const messageTypes = ['NEW_MESSAGE', 'CLIENT_MESSAGE', 'ATTORNEY_MESSAGE', 'MESSAGE'];
        if (messageTypes.includes(notification.type?.toUpperCase())) {
            return false;
        }

        // Skip if already read
        if (notification.read) {
            return false;
        }

        // Check for duplicates
        const existing = this.pushNotifications$.value.find(n => n.id === notification.id);
        if (existing) {
            return false;
        }

        // Add to beginning of list
        const notifications = [notification, ...this.pushNotifications$.value];
        // Sort by timestamp and keep only latest 50
        notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        this.pushNotifications$.next(notifications.slice(0, 50));
        return true;
    }

    /**
     * Mark a push notification as read and remove from list
     */
    markPushNotificationAsRead(notificationId: string): void {
        const notifications = this.pushNotifications$.value.filter(n => n.id !== notificationId);
        this.pushNotifications$.next(notifications);
    }

    /**
     * Mark all push notifications as read (clear the list)
     */
    markAllPushNotificationsAsRead(): void {
        this.pushNotifications$.next([]);
    }

    /**
     * Clear all push notifications
     */
    clearAllPushNotifications(): void {
        this.pushNotifications$.next([]);
    }

    /**
     * Reset push notifications (on logout)
     */
    resetPushNotifications(): void {
        this.pushNotifications$.next([]);
        this.pushNotificationsLoaded = false;
    }

    /**
     * Mark notification as read
     */
    markAsRead(notificationId: string): Observable<void> {
        console.log('NotificationService.markAsRead called with ID:', notificationId);
        console.log('API URL:', `${this.apiUrl}/notifications/${notificationId}/read`);

        return this.http.put<CustomHttpResponse<void>>(
            `${this.apiUrl}/notifications/${notificationId}/read`,
            {}
        ).pipe(
            tap(response => {
                console.log('markAsRead API response:', response);
            }),
            map(response => response.data),
            tap(() => {
                console.log('Notification marked as read successfully in backend');
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
                console.error('Failed to mark notification as read - Full error:', error);
                console.error('Error status:', error.status);
                console.error('Error message:', error.message);
                console.error('Error body:', error.error);
                throw error; // Re-throw to let caller handle it
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
                // Router navigation would be handled by the component
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

    // ==================== CRM Notification Methods ====================
    
    /**
     * Notify user about new intake form submission
     */
    notifyNewSubmission(userId: number, submissionId: number, practiceArea: string, urgency: string): Observable<UserNotification> {
        const priority = urgency === 'URGENT' ? 'URGENT' : urgency === 'HIGH' ? 'HIGH' : 'MEDIUM';
        
        return this.sendToUser({
            userId,
            type: 'SUBMISSION',
            priority,
            title: 'New Intake Submission',
            message: `New ${practiceArea} intake submission received${urgency === 'URGENT' || urgency === 'HIGH' ? ' - ' + urgency + ' priority' : ''}`,
            data: { submissionId, practiceArea, urgency },
            actions: [
                {
                    label: 'Review Submission',
                    action: 'NAVIGATE',
                    target: `/crm/intake-submissions`,
                    style: priority === 'URGENT' ? 'danger' : 'primary'
                },
                {
                    label: 'Dismiss',
                    action: 'DISMISS',
                    style: 'secondary'
                }
            ],
            relatedEntityId: submissionId,
            relatedEntityType: 'submission'
        });
    }

    /**
     * Notify user about intake submission assignment
     */
    notifySubmissionAssignment(userId: number, submissionId: number, practiceArea: string, urgency: string): Observable<UserNotification> {
        const priority = urgency === 'URGENT' ? 'URGENT' : urgency === 'HIGH' ? 'HIGH' : 'MEDIUM';
        
        return this.sendToUser({
            userId,
            type: 'ASSIGNMENT',
            priority,
            title: 'Submission Assigned',
            message: `${practiceArea} intake submission assigned to you${urgency === 'URGENT' || urgency === 'HIGH' ? ' - ' + urgency + ' priority' : ''}`,
            data: { submissionId, practiceArea, urgency },
            actions: [
                {
                    label: 'Review Submission',
                    action: 'NAVIGATE',
                    target: `/crm/intake-submissions`,
                    style: priority === 'URGENT' ? 'danger' : 'primary'
                }
            ],
            relatedEntityId: submissionId,
            relatedEntityType: 'submission'
        });
    }

    /**
     * Notify user about submission status change
     */
    notifySubmissionStatusChange(userId: number, submissionId: number, oldStatus: string, newStatus: string, practiceArea: string): Observable<UserNotification> {
        return this.sendToUser({
            userId,
            type: 'STATUS_CHANGE',
            priority: 'MEDIUM',
            title: 'Submission Status Updated',
            message: `${practiceArea} submission status changed from ${oldStatus} to ${newStatus}`,
            data: { submissionId, oldStatus, newStatus, practiceArea },
            actions: [
                {
                    label: 'View Submission',
                    action: 'NAVIGATE',
                    target: `/crm/intake-submissions`,
                    style: 'primary'
                }
            ],
            relatedEntityId: submissionId,
            relatedEntityType: 'submission'
        });
    }

    /**
     * Notify user about submission to lead conversion
     */
    notifyLeadConversion(userId: number, submissionId: number, leadId: number, practiceArea: string): Observable<UserNotification> {
        return this.sendToUser({
            userId,
            type: 'CONVERSION',
            priority: 'HIGH',
            title: 'Submission Converted to Lead',
            message: `${practiceArea} submission successfully converted to lead`,
            data: { submissionId, leadId, practiceArea },
            actions: [
                {
                    label: 'View Lead',
                    action: 'NAVIGATE',
                    target: `/crm/leads-dashboard`,
                    style: 'success'
                },
                {
                    label: 'View Submission',
                    action: 'NAVIGATE', 
                    target: `/crm/intake-submissions`,
                    style: 'primary'
                }
            ],
            relatedEntityId: leadId,
            relatedEntityType: 'lead'
        });
    }

    /**
     * Notify user about lead assignment
     */
    notifyLeadAssignment(userId: number, leadId: number, leadName: string, practiceArea: string): Observable<UserNotification> {
        return this.sendToUser({
            userId,
            type: 'ASSIGNMENT',
            priority: 'HIGH',
            title: 'New Lead Assigned',
            message: `${practiceArea} lead "${leadName}" has been assigned to you`,
            data: { leadId, leadName, practiceArea },
            actions: [
                {
                    label: 'View Lead',
                    action: 'NAVIGATE',
                    target: `/crm/leads-dashboard`,
                    style: 'primary'
                },
                {
                    label: 'Dismiss',
                    action: 'DISMISS',
                    style: 'secondary'
                }
            ],
            relatedEntityId: leadId,
            relatedEntityType: 'lead'
        });
    }

    /**
     * Notify user about lead status change
     */
    notifyLeadStatusChange(userId: number, leadId: number, oldStatus: string, newStatus: string, leadName: string): Observable<UserNotification> {
        return this.sendToUser({
            userId,
            type: 'STATUS_CHANGE',
            priority: 'MEDIUM',
            title: 'Lead Status Updated',
            message: `Lead "${leadName}" status changed from ${oldStatus} to ${newStatus}`,
            data: { leadId, oldStatus, newStatus, leadName },
            actions: [
                {
                    label: 'View Lead',
                    action: 'NAVIGATE',
                    target: `/crm/leads-dashboard`,
                    style: 'primary'
                }
            ],
            relatedEntityId: leadId,
            relatedEntityType: 'lead'
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
                CASE_UPDATE: { enabled: true, channels: ['inApp'], threshold: 'MEDIUM' },
                SUBMISSION: { enabled: true, channels: ['inApp', 'email'], threshold: 'HIGH' },
                STATUS_CHANGE: { enabled: true, channels: ['inApp'], threshold: 'MEDIUM' },
                CONVERSION: { enabled: true, channels: ['inApp', 'email'], threshold: 'HIGH' }
            }
        };
    }
}

