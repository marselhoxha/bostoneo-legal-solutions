import { Injectable } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { CaseContextService } from './case-context.service';
import { WorkloadBalancerService } from './workload-balancer.service';

export interface TaskAnalytics {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  avgCompletionTime: number;
  completionRate: number;
  efficiency: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface PerformanceMetrics {
  userId: number;
  userName: string;
  tasksCompleted: number;
  avgTimeToComplete: number;
  qualityScore: number;
  productivityScore: number;
  collaborationScore: number;
  overallRating: number;
}

export interface TeamInsights {
  topPerformers: PerformanceMetrics[];
  bottlenecks: { area: string; impact: string; suggestion: string }[];
  trends: { metric: string; direction: 'up' | 'down' | 'stable'; change: number }[];
  recommendations: string[];
}

@Injectable({
  providedIn: 'root'
})
export class TaskAnalyticsService {

  constructor(
    private caseContextService: CaseContextService,
    private workloadBalancer: WorkloadBalancerService
  ) {}

  /**
   * Get comprehensive task analytics
   */
  getTaskAnalytics(caseId: number, timeframe: 'week' | 'month' | 'quarter' = 'month'): Observable<TaskAnalytics> {
    return this.caseContextService.getCaseTasks().pipe(
      map(tasks => {
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
        const overdueTasks = tasks.filter(t => 
          t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'COMPLETED'
        ).length;

        const completionTimes = tasks
          .filter(t => t.status === 'COMPLETED' && t.createdAt && t.updatedAt)
          .map(t => {
            const created = new Date(t.createdAt).getTime();
            const completed = new Date(t.updatedAt).getTime();
            return (completed - created) / (1000 * 60 * 60 * 24); // days
          });

        const avgCompletionTime = completionTimes.length > 0 
          ? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length 
          : 0;

        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        const efficiency = Math.max(0, 100 - (overdueTasks / Math.max(totalTasks, 1)) * 100);
        
        return {
          totalTasks,
          completedTasks,
          overdueTasks,
          avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
          completionRate: Math.round(completionRate),
          efficiency: Math.round(efficiency),
          trend: this.calculateTrend(completionRate, efficiency)
        };
      })
    );
  }

  /**
   * Get individual performance metrics
   */
  getPerformanceMetrics(caseId: number): Observable<PerformanceMetrics[]> {
    return combineLatest([
      this.caseContextService.getCaseTasks(),
      this.caseContextService.getCaseTeam(),
      this.workloadBalancer.calculateTeamWorkload(caseId)
    ]).pipe(
      map(([tasks, team, workloads]) => {
        return team.map(member => {
          const memberTasks = tasks.filter(t => t.assignedToId === member.userId);
          const completedTasks = memberTasks.filter(t => t.status === 'COMPLETED');
          const workload = workloads.find(w => w.userId === member.userId);

          const avgTimeToComplete = this.calculateAvgCompletionTime(completedTasks);
          const qualityScore = this.calculateQualityScore(memberTasks);
          const productivityScore = workload ? workload.efficiency : 50;
          const collaborationScore = this.calculateCollaborationScore(member, tasks);

          return {
            userId: member.userId,
            userName: member.userName,
            tasksCompleted: completedTasks.length,
            avgTimeToComplete,
            qualityScore,
            productivityScore,
            collaborationScore,
            overallRating: Math.round((qualityScore + productivityScore + collaborationScore) / 3)
          };
        }).sort((a, b) => b.overallRating - a.overallRating);
      })
    );
  }

  /**
   * Get team insights and recommendations
   */
  getTeamInsights(caseId: number): Observable<TeamInsights> {
    return combineLatest([
      this.getPerformanceMetrics(caseId),
      this.getTaskAnalytics(caseId),
      this.workloadBalancer.getWorkloadSummary(caseId)
    ]).pipe(
      map(([performance, analytics, workloadSummary]) => {
        const topPerformers = performance.slice(0, 3);
        const bottlenecks = this.identifyBottlenecks(performance, analytics, workloadSummary);
        const trends = this.analyzeTrends(performance, analytics);
        const recommendations = this.generateRecommendations(performance, analytics, workloadSummary);

        return { topPerformers, bottlenecks, trends, recommendations };
      })
    );
  }

  /**
   * Get productivity trends over time
   */
  getProductivityTrends(caseId: number): Observable<{
    labels: string[];
    completionData: number[];
    efficiencyData: number[];
    workloadData: number[];
  }> {
    // Simplified mock data - in real implementation would fetch historical data
    return of({
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      completionData: [75, 82, 78, 85],
      efficiencyData: [68, 71, 69, 76],
      workloadData: [65, 72, 68, 70]
    });
  }

  // Private helper methods
  private calculateTrend(completionRate: number, efficiency: number): 'improving' | 'declining' | 'stable' {
    const overallScore = (completionRate + efficiency) / 2;
    if (overallScore > 80) return 'improving';
    if (overallScore < 60) return 'declining';
    return 'stable';
  }

  private calculateAvgCompletionTime(completedTasks: any[]): number {
    if (completedTasks.length === 0) return 0;
    
    const times = completedTasks.map(task => {
      if (!task.createdAt || !task.updatedAt) return 3; // default 3 days
      const created = new Date(task.createdAt).getTime();
      const completed = new Date(task.updatedAt).getTime();
      return (completed - created) / (1000 * 60 * 60 * 24);
    });
    
    return Math.round((times.reduce((sum, time) => sum + time, 0) / times.length) * 10) / 10;
  }

  private calculateQualityScore(tasks: any[]): number {
    if (tasks.length === 0) return 50;
    
    const completedOnTime = tasks.filter(t => 
      t.status === 'COMPLETED' && 
      (!t.dueDate || new Date(t.updatedAt) <= new Date(t.dueDate))
    ).length;
    
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    const onTimeRate = completedTasks > 0 ? (completedOnTime / completedTasks) * 100 : 50;
    
    // Factor in rework (simplified)
    const reworkPenalty = tasks.filter(t => t.status === 'IN_PROGRESS' && t.updatedAt).length * 5;
    
    return Math.max(0, Math.min(100, Math.round(onTimeRate - reworkPenalty)));
  }

  private calculateCollaborationScore(member: any, allTasks: any[]): number {
    // Simplified collaboration score based on task interactions
    const memberTasks = allTasks.filter(t => t.assignedToId === member.userId);
    const collaborativeTasks = memberTasks.filter(t => 
      t.description?.toLowerCase().includes('review') || 
      t.description?.toLowerCase().includes('collaborate') ||
      t.taskType === 'REVIEW'
    ).length;
    
    const baseScore = 50;
    const collaborationBonus = Math.min(30, collaborativeTasks * 10);
    
    return Math.min(100, baseScore + collaborationBonus);
  }

  private identifyBottlenecks(performance: PerformanceMetrics[], analytics: TaskAnalytics, workloadSummary: any): any[] {
    const bottlenecks = [];
    
    if (analytics.overdueTasks > analytics.totalTasks * 0.2) {
      bottlenecks.push({
        area: 'Task Completion',
        impact: 'High number of overdue tasks affecting deadlines',
        suggestion: 'Review task prioritization and redistribute workload'
      });
    }
    
    if (workloadSummary.imbalanceScore > 25) {
      bottlenecks.push({
        area: 'Workload Distribution',
        impact: 'Uneven workload distribution affecting team efficiency',
        suggestion: 'Use auto-balancing feature to redistribute tasks'
      });
    }
    
    const lowPerformers = performance.filter(p => p.overallRating < 60);
    if (lowPerformers.length > 0) {
      bottlenecks.push({
        area: 'Performance',
        impact: `${lowPerformers.length} team member(s) below performance threshold`,
        suggestion: 'Provide additional support or training'
      });
    }
    
    return bottlenecks;
  }

  private analyzeTrends(performance: PerformanceMetrics[], analytics: TaskAnalytics): any[] {
    // Simplified trend analysis
    return [
      {
        metric: 'Team Completion Rate',
        direction: analytics.trend === 'improving' ? 'up' : analytics.trend === 'declining' ? 'down' : 'stable',
        change: Math.round(Math.random() * 10 - 5) // Mock change percentage
      },
      {
        metric: 'Average Productivity',
        direction: 'up',
        change: 8
      },
      {
        metric: 'Task Quality',
        direction: 'stable',
        change: 2
      }
    ];
  }

  private generateRecommendations(performance: PerformanceMetrics[], analytics: TaskAnalytics, workloadSummary: any): string[] {
    const recommendations = [];
    
    if (analytics.completionRate < 70) {
      recommendations.push('Focus on completing existing tasks before taking on new ones');
    }
    
    if (workloadSummary.overloadedMembers > 0) {
      recommendations.push('Use workload balancing to redistribute tasks from overloaded members');
    }
    
    if (analytics.overdueTasks > 5) {
      recommendations.push('Review and reprioritize overdue tasks with the team');
    }
    
    const topPerformer = performance[0];
    if (topPerformer && topPerformer.overallRating > 85) {
      recommendations.push(`Consider having ${topPerformer.userName} mentor other team members`);
    }
    
    if (performance.some(p => p.avgTimeToComplete > 7)) {
      recommendations.push('Investigate tasks taking longer than expected to complete');
    }
    
    return recommendations.length > 0 ? recommendations : ['Team performance is on track - continue current practices'];
  }
}