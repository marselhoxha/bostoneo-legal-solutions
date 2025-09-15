import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval, Subscription } from 'rxjs';
import { NotificationTriggerService } from './notification-trigger.service';
import { environment } from '../../../environments/environment';

export interface Task {
  id: number;
  title: string;
  dueDate: string;
  assignedToId?: number;
  assignedTo?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  caseId?: number;
  case?: {
    id: number;
    title: string;
  };
  status: string;
}

export interface DeadlineCheck {
  taskId: number;
  title: string;
  dueDate: Date;
  daysRemaining: number;
  assignedToId?: number;
  assigneeName?: string;
  caseId?: number;
  caseName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DeadlineAlertService {
  private readonly API_URL = `${environment.apiUrl}/api`;
  private checkInterval: Subscription | null = null;
  
  constructor(
    private http: HttpClient,
    private notificationTrigger: NotificationTriggerService
  ) {}

  /**
   * Start periodic deadline checking (every 4 hours)
   */
  startDeadlineMonitoring(): void {
    if (this.checkInterval) {
      this.checkInterval.unsubscribe();
    }

    // Check immediately on start
    this.checkUpcomingDeadlines().subscribe();

    // Then check every 4 hours (14400000 milliseconds)
    this.checkInterval = interval(14400000).subscribe(() => {
      this.checkUpcomingDeadlines().subscribe();
    });

    console.log('📅 Deadline monitoring started - checking every 4 hours');
  }

  /**
   * Stop deadline monitoring
   */
  stopDeadlineMonitoring(): void {
    if (this.checkInterval) {
      this.checkInterval.unsubscribe();
      this.checkInterval = null;
      console.log('📅 Deadline monitoring stopped');
    }
  }

  /**
   * Check for upcoming deadlines
   */
  checkUpcomingDeadlines(): Observable<DeadlineCheck[]> {
    return new Observable(observer => {
      this.getTasks().subscribe({
        next: (tasks) => {
          const upcomingDeadlines = this.analyzeDeadlines(tasks);
          
          // Send notifications for approaching deadlines
          this.sendDeadlineNotifications(upcomingDeadlines);
          
          observer.next(upcomingDeadlines);
          observer.complete();
        },
        error: (error) => {
          console.error('Error checking deadlines:', error);
          observer.error(error);
        }
      });
    });
  }

  /**
   * Get all active tasks from the backend
   */
  private getTasks(): Observable<Task[]> {
    return new Observable(observer => {
      // Get tasks from the task management API
      this.http.get<any>(`${this.API_URL}/tasks?status=TODO,IN_PROGRESS&size=1000`).subscribe({
        next: (response) => {
          const tasks = response.data?.content || response.data || response || [];
          observer.next(tasks);
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
        }
      });
    });
  }

  /**
   * Analyze tasks and identify those with approaching deadlines
   */
  private analyzeDeadlines(tasks: Task[]): DeadlineCheck[] {
    const now = new Date();
    const upcomingDeadlines: DeadlineCheck[] = [];

    tasks.forEach(task => {
      if (!task.dueDate || task.status === 'COMPLETED') {
        return;
      }

      const dueDate = new Date(task.dueDate);
      const timeDiff = dueDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

      // Check for deadlines: 7 days, 3 days, 1 day, and overdue
      if (daysRemaining <= 7 && daysRemaining >= -1) {
        const assigneeName = task.assignedTo 
          ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
          : undefined;
        
        const caseName = task.case?.title || `Case ID ${task.caseId}`;

        upcomingDeadlines.push({
          taskId: task.id,
          title: task.title,
          dueDate,
          daysRemaining,
          assignedToId: task.assignedToId,
          assigneeName,
          caseId: task.caseId,
          caseName
        });
      }
    });

    return upcomingDeadlines.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  /**
   * Send deadline notifications for approaching tasks
   */
  private async sendDeadlineNotifications(deadlines: DeadlineCheck[]): Promise<void> {
    for (const deadline of deadlines) {
      try {
        // Only send notifications for specific intervals: 7 days, 3 days, 1 day, overdue
        const shouldNotify = deadline.daysRemaining === 7 || 
                           deadline.daysRemaining === 3 || 
                           deadline.daysRemaining === 1 || 
                           deadline.daysRemaining <= 0;

        if (shouldNotify) {
          await this.notificationTrigger.triggerDeadlineAlert(
            deadline.taskId,
            deadline.title,
            deadline.daysRemaining,
            deadline.caseId,
            deadline.caseName,
            deadline.assignedToId,
            deadline.assigneeName
          );

          // Add a small delay between notifications to avoid overwhelming the system
          await this.delay(100);
        }
      } catch (error) {
        console.error('Error sending deadline notification for task:', deadline.taskId, error);
      }
    }
  }

  /**
   * Utility method to add delay between notifications
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Manual check for deadlines (for testing or on-demand checking)
   */
  async checkDeadlinesNow(): Promise<DeadlineCheck[]> {
    return new Promise((resolve, reject) => {
      this.checkUpcomingDeadlines().subscribe({
        next: (deadlines) => resolve(deadlines),
        error: (error) => reject(error)
      });
    });
  }
}