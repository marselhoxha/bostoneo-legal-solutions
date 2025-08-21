import { Injectable } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { TaskAnalyticsService, TaskAnalytics, PerformanceMetrics, TeamInsights } from './task-analytics.service';
import { WorkloadBalancerService } from './workload-balancer.service';
import { CaseContextService } from './case-context.service';

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'metric' | 'chart' | 'list' | 'progress';
  data: any;
  status: 'good' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}

export interface ExecutiveSummary {
  caseProgress: number;
  teamEfficiency: number;
  riskLevel: 'low' | 'medium' | 'high';
  keyMetrics: { label: string; value: string; change: string }[];
  alerts: { type: 'info' | 'warning' | 'error'; message: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceDashboardService {

  constructor(
    private taskAnalytics: TaskAnalyticsService,
    private workloadBalancer: WorkloadBalancerService,
    private caseContext: CaseContextService
  ) {}

  /**
   * Get executive summary for case
   */
  getExecutiveSummary(caseId: number): Observable<ExecutiveSummary> {
    return combineLatest([
      this.taskAnalytics.getTaskAnalytics(caseId),
      this.taskAnalytics.getTeamInsights(caseId),
      this.workloadBalancer.getWorkloadSummary(caseId)
    ]).pipe(
      map(([analytics, insights, workload]) => {
        const caseProgress = analytics.completionRate;
        const teamEfficiency = Math.round((analytics.efficiency + workload.averageWorkload) / 2);
        const riskLevel = this.calculateRiskLevel(analytics, workload);
        
        return {
          caseProgress,
          teamEfficiency,
          riskLevel,
          keyMetrics: [
            { label: 'Tasks Completed', value: `${analytics.completedTasks}/${analytics.totalTasks}`, change: analytics.trend === 'improving' ? '+5%' : '0%' },
            { label: 'Team Efficiency', value: `${teamEfficiency}%`, change: '+3%' },
            { label: 'Overdue Tasks', value: `${analytics.overdueTasks}`, change: analytics.overdueTasks > 5 ? '+2' : '0' },
            { label: 'Avg. Completion', value: `${analytics.avgCompletionTime}d`, change: '-0.5d' }
          ],
          alerts: this.generateAlerts(analytics, insights, workload)
        };
      })
    );
  }

  /**
   * Get dashboard widgets for case
   */
  getDashboardWidgets(caseId: number): Observable<DashboardWidget[]> {
    return combineLatest([
      this.taskAnalytics.getTaskAnalytics(caseId),
      this.taskAnalytics.getPerformanceMetrics(caseId),
      this.taskAnalytics.getTeamInsights(caseId),
      this.taskAnalytics.getProductivityTrends(caseId),
      this.workloadBalancer.getWorkloadSummary(caseId)
    ]).pipe(
      map(([analytics, performance, insights, trends, workload]) => [
        {
          id: 'task-completion',
          title: 'Task Completion Rate',
          type: 'metric' as const,
          data: { value: analytics.completionRate, target: 85, unit: '%' },
          status: analytics.completionRate >= 85 ? 'good' : analytics.completionRate >= 70 ? 'warning' : 'critical',
          trend: analytics.trend === 'improving' ? 'up' : analytics.trend === 'declining' ? 'down' : 'stable'
        },
        {
          id: 'team-efficiency',
          title: 'Team Efficiency',
          type: 'progress' as const,
          data: { current: analytics.efficiency, max: 100, segments: [
            { value: 60, color: 'red', label: 'Critical' },
            { value: 80, color: 'yellow', label: 'Warning' },
            { value: 100, color: 'green', label: 'Good' }
          ]},
          status: analytics.efficiency >= 80 ? 'good' : analytics.efficiency >= 60 ? 'warning' : 'critical'
        },
        {
          id: 'productivity-trends',
          title: 'Productivity Trends',
          type: 'chart' as const,
          data: trends,
          status: 'good'
        },
        {
          id: 'top-performers',
          title: 'Top Performers',
          type: 'list' as const,
          data: insights.topPerformers.map(p => ({
            name: p.userName,
            score: p.overallRating,
            tasks: p.tasksCompleted,
            badge: p.overallRating >= 90 ? 'Excellent' : p.overallRating >= 80 ? 'Good' : 'Average'
          })),
          status: 'good'
        },
        {
          id: 'workload-balance',
          title: 'Workload Balance',
          type: 'metric' as const,
          data: { 
            value: 100 - workload.imbalanceScore, 
            details: `${workload.overloadedMembers} overloaded, ${workload.underutilizedMembers} underutilized`
          },
          status: workload.imbalanceScore < 15 ? 'good' : workload.imbalanceScore < 30 ? 'warning' : 'critical'
        },
        {
          id: 'bottlenecks',
          title: 'Current Bottlenecks',
          type: 'list' as const,
          data: insights.bottlenecks.map(b => ({
            area: b.area,
            impact: b.impact,
            suggestion: b.suggestion,
            severity: b.area === 'Performance' ? 'high' : 'medium'
          })),
          status: insights.bottlenecks.length === 0 ? 'good' : insights.bottlenecks.length <= 2 ? 'warning' : 'critical'
        }
      ])
    );
  }

  /**
   * Get performance comparison between team members
   */
  getPerformanceComparison(caseId: number): Observable<{
    categories: string[];
    members: { name: string; scores: number[]; color: string }[];
  }> {
    return this.taskAnalytics.getPerformanceMetrics(caseId).pipe(
      map(metrics => ({
        categories: ['Productivity', 'Quality', 'Collaboration', 'Efficiency'],
        members: metrics.slice(0, 5).map((member, index) => ({
          name: member.userName,
          scores: [
            member.productivityScore,
            member.qualityScore,
            member.collaborationScore,
            Math.round((member.productivityScore + member.qualityScore) / 2)
          ],
          color: this.getColorForIndex(index)
        }))
      }))
    );
  }

  /**
   * Get real-time case health score
   */
  getCaseHealthScore(caseId: number): Observable<{
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
    factors: { name: string; score: number; weight: number }[];
  }> {
    return combineLatest([
      this.taskAnalytics.getTaskAnalytics(caseId),
      this.workloadBalancer.getWorkloadSummary(caseId)
    ]).pipe(
      map(([analytics, workload]) => {
        const factors = [
          { name: 'Task Completion', score: analytics.completionRate, weight: 30 },
          { name: 'Team Efficiency', score: analytics.efficiency, weight: 25 },
          { name: 'Workload Balance', score: Math.max(0, 100 - workload.imbalanceScore), weight: 20 },
          { name: 'On-Time Delivery', score: Math.max(0, 100 - (analytics.overdueTasks / Math.max(analytics.totalTasks, 1)) * 100), weight: 25 }
        ];

        const score = Math.round(
          factors.reduce((sum, factor) => sum + (factor.score * factor.weight / 100), 0)
        );

        let status: 'excellent' | 'good' | 'fair' | 'poor';
        if (score >= 90) status = 'excellent';
        else if (score >= 75) status = 'good';
        else if (score >= 60) status = 'fair';
        else status = 'poor';

        return { score, status, factors };
      })
    );
  }

  /**
   * Export performance report
   */
  exportPerformanceReport(caseId: number): Observable<{
    summary: ExecutiveSummary;
    analytics: TaskAnalytics;
    performance: PerformanceMetrics[];
    insights: TeamInsights;
    generatedAt: Date;
  }> {
    return combineLatest([
      this.getExecutiveSummary(caseId),
      this.taskAnalytics.getTaskAnalytics(caseId),
      this.taskAnalytics.getPerformanceMetrics(caseId),
      this.taskAnalytics.getTeamInsights(caseId)
    ]).pipe(
      map(([summary, analytics, performance, insights]) => ({
        summary,
        analytics,
        performance,
        insights,
        generatedAt: new Date()
      }))
    );
  }

  // Private helper methods
  private calculateRiskLevel(analytics: TaskAnalytics, workload: any): 'low' | 'medium' | 'high' {
    let riskScore = 0;
    
    if (analytics.overdueTasks > analytics.totalTasks * 0.2) riskScore += 30;
    if (analytics.completionRate < 70) riskScore += 25;
    if (workload.overloadedMembers > 1) riskScore += 20;
    if (analytics.efficiency < 60) riskScore += 25;
    
    if (riskScore >= 50) return 'high';
    if (riskScore >= 25) return 'medium';
    return 'low';
  }

  private generateAlerts(analytics: TaskAnalytics, insights: TeamInsights, workload: any): any[] {
    const alerts = [];
    
    if (analytics.overdueTasks > 5) {
      alerts.push({
        type: 'error' as const,
        message: `${analytics.overdueTasks} tasks are overdue and require immediate attention`
      });
    }
    
    if (workload.overloadedMembers > 0) {
      alerts.push({
        type: 'warning' as const,
        message: `${workload.overloadedMembers} team member(s) are overloaded`
      });
    }
    
    if (analytics.completionRate < 60) {
      alerts.push({
        type: 'error' as const,
        message: 'Case completion rate is below acceptable threshold'
      });
    }
    
    if (insights.topPerformers.length > 0 && insights.topPerformers[0].overallRating > 90) {
      alerts.push({
        type: 'info' as const,
        message: `${insights.topPerformers[0].userName} is performing exceptionally well`
      });
    }
    
    return alerts;
  }

  private getColorForIndex(index: number): string {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
    return colors[index % colors.length];
  }
}