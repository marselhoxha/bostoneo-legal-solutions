import { Injectable } from '@angular/core';
import { Observable, timer, combineLatest } from 'rxjs';
import { map, switchMap, filter } from 'rxjs/operators';
import { CaseContextService } from './case-context.service';
import { TaskAnalyticsService } from './task-analytics.service';
import { WebSocketService } from './websocket.service';

export interface SmartNotification {
  id: string;
  type: 'deadline' | 'overdue' | 'workload' | 'performance' | 'milestone';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  actionable: boolean;
  actions?: { label: string; action: string }[];
  timestamp: Date;
  caseId?: number;
  taskId?: number;
  userId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SmartNotificationsService {
  
  constructor(
    private caseContext: CaseContextService,
    private analytics: TaskAnalyticsService,
    private websocket: WebSocketService
  ) {
    this.initializeSmartMonitoring();
  }

  /**
   * Get smart notifications for current case
   */
  getSmartNotifications(caseId: number): Observable<SmartNotification[]> {
    return combineLatest([
      this.caseContext.getCaseTasks(),
      this.analytics.getTaskAnalytics(caseId),
      this.analytics.getPerformanceMetrics(caseId)
    ]).pipe(
      map(([tasks, analytics, performance]) => {
        const notifications: SmartNotification[] = [];

        // Deadline notifications
        notifications.push(...this.generateDeadlineNotifications(tasks, caseId));
        
        // Performance notifications
        notifications.push(...this.generatePerformanceNotifications(performance, caseId));
        
        // Workload notifications
        notifications.push(...this.generateWorkloadNotifications(performance, caseId));
        
        // Milestone notifications
        if (analytics.completionRate >= 50 && analytics.completionRate % 25 === 0) {
          notifications.push(this.createMilestoneNotification(analytics, caseId));
        }

        return notifications.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
      })
    );
  }

  /**
   * Initialize smart monitoring
   */
  private initializeSmartMonitoring(): void {
    // Check for smart notifications every 5 minutes
    timer(0, 300000).pipe(
      switchMap(() => this.caseContext.getCurrentCase()),
      filter(caseData => caseData !== null),
      switchMap(caseData => this.getSmartNotifications(caseData!.id))
    ).subscribe(notifications => {
      // Send critical notifications via WebSocket
      const criticalNotifications = notifications.filter(n => n.priority === 'critical');
      criticalNotifications.forEach(notification => {
        this.websocket.sendMessage({
          type: 'CRITICAL_NOTIFICATION',
          data: notification,
          timestamp: Date.now()
        });
      });
    });
  }

  private generateDeadlineNotifications(tasks: any[], caseId: number): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const now = new Date();
    
    // Due today
    const dueToday = tasks.filter(task => {
      if (!task.dueDate || task.status === 'COMPLETED') return false;
      const dueDate = new Date(task.dueDate);
      return dueDate.toDateString() === now.toDateString();
    });

    if (dueToday.length > 0) {
      notifications.push({
        id: `due-today-${caseId}`,
        type: 'deadline',
        priority: 'high',
        title: 'Tasks Due Today',
        message: `${dueToday.length} task(s) are due today`,
        actionable: true,
        actions: [{ label: 'View Tasks', action: 'view-due-tasks' }],
        timestamp: now,
        caseId
      });
    }

    // Overdue tasks
    const overdue = tasks.filter(task => {
      if (!task.dueDate || task.status === 'COMPLETED') return false;
      return new Date(task.dueDate) < now;
    });

    if (overdue.length > 0) {
      notifications.push({
        id: `overdue-${caseId}`,
        type: 'overdue',
        priority: 'critical',
        title: 'Overdue Tasks',
        message: `${overdue.length} task(s) are overdue`,
        actionable: true,
        actions: [
          { label: 'Prioritize', action: 'prioritize-overdue' },
          { label: 'Reassign', action: 'reassign-overdue' }
        ],
        timestamp: now,
        caseId
      });
    }

    return notifications;
  }

  private generatePerformanceNotifications(performance: any[], caseId: number): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    
    // Low performers
    const lowPerformers = performance.filter(p => p.overallRating < 60);
    if (lowPerformers.length > 0) {
      notifications.push({
        id: `low-performance-${caseId}`,
        type: 'performance',
        priority: 'medium',
        title: 'Performance Alert',
        message: `${lowPerformers.length} team member(s) need support`,
        actionable: true,
        actions: [{ label: 'View Details', action: 'view-performance' }],
        timestamp: new Date(),
        caseId
      });
    }

    // Top performer recognition
    const topPerformer = performance[0];
    if (topPerformer && topPerformer.overallRating > 90) {
      notifications.push({
        id: `top-performer-${caseId}`,
        type: 'performance',
        priority: 'low',
        title: 'Outstanding Performance',
        message: `${topPerformer.userName} is performing exceptionally well`,
        actionable: false,
        timestamp: new Date(),
        caseId,
        userId: topPerformer.userId
      });
    }

    return notifications;
  }

  private generateWorkloadNotifications(performance: any[], caseId: number): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    
    // Overloaded team members
    const overloaded = performance.filter(p => p.productivityScore < 40);
    if (overloaded.length > 0) {
      notifications.push({
        id: `overloaded-${caseId}`,
        type: 'workload',
        priority: 'high',
        title: 'Workload Imbalance',
        message: `${overloaded.length} team member(s) may be overloaded`,
        actionable: true,
        actions: [
          { label: 'Balance Workload', action: 'balance-workload' },
          { label: 'View Details', action: 'view-workload' }
        ],
        timestamp: new Date(),
        caseId
      });
    }

    return notifications;
  }

  private createMilestoneNotification(analytics: any, caseId: number): SmartNotification {
    return {
      id: `milestone-${caseId}-${analytics.completionRate}`,
      type: 'milestone',
      priority: 'medium',
      title: 'Milestone Achieved',
      message: `Case is ${analytics.completionRate}% complete`,
      actionable: false,
      timestamp: new Date(),
      caseId
    };
  }

  private getPriorityWeight(priority: string): number {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[priority as keyof typeof weights] || 0;
  }
}