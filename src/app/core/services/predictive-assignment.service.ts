import { Injectable } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { CaseContextService } from './case-context.service';
import { TaskAnalyticsService } from './task-analytics.service';
import { IntelligentDistributionService } from './intelligent-distribution.service';

export interface PredictiveAssignment {
  taskId: number;
  recommendedUserId: number;
  confidence: number;
  reasoning: string[];
  estimatedCompletionDays: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CapacityPrediction {
  userId: number;
  userName: string;
  currentCapacity: number;
  predictedCapacity: number;
  availableHours: number;
  burnoutRisk: number;
}

@Injectable({
  providedIn: 'root'
})
export class PredictiveAssignmentService {

  constructor(
    private caseContext: CaseContextService,
    private analytics: TaskAnalyticsService,
    private intelligentDistribution: IntelligentDistributionService
  ) {}

  /**
   * Get predictive assignment recommendations
   */
  getPredictiveAssignments(caseId: number, upcomingTasks: any[]): Observable<PredictiveAssignment[]> {
    return combineLatest([
      this.caseContext.getCaseTeam(),
      this.analytics.getPerformanceMetrics(caseId),
      this.analytics.getTaskAnalytics(caseId)
    ]).pipe(
      map(([team, performance, analytics]) => {
        return upcomingTasks.map(task => {
          const predictions = team.map(member => {
            const memberPerf = performance.find(p => p.userId === member.userId);
            return this.calculatePredictiveScore(task, member, memberPerf, analytics);
          });

          const bestMatch = predictions.reduce((best, current) => 
            current.confidence > best.confidence ? current : best
          );

          return {
            taskId: task.id,
            recommendedUserId: bestMatch.userId,
            confidence: bestMatch.confidence,
            reasoning: bestMatch.reasoning,
            estimatedCompletionDays: bestMatch.estimatedDays,
            riskLevel: bestMatch.riskLevel
          };
        });
      })
    );
  }

  /**
   * Predict team capacity for upcoming period
   */
  predictTeamCapacity(caseId: number, daysAhead: number = 14): Observable<CapacityPrediction[]> {
    return combineLatest([
      this.caseContext.getCaseTeam(),
      this.caseContext.getCaseTasks(),
      this.analytics.getPerformanceMetrics(caseId)
    ]).pipe(
      map(([team, tasks, performance]) => {
        return team.map(member => {
          const memberTasks = tasks.filter(t => t.assignedToId === member.userId);
          const activeTasks = memberTasks.filter(t => t.status === 'IN_PROGRESS');
          const memberPerf = performance.find(p => p.userId === member.userId);

          const currentWorkload = activeTasks.length;
          const avgCompletionTime = memberPerf?.avgTimeToComplete || 5;
          
          // Predict capacity based on current workload and completion rate
          const taskCompletionRate = 1 / avgCompletionTime; // tasks per day
          const expectedCompletions = Math.floor(taskCompletionRate * daysAhead);
          const predictedCapacity = Math.max(0, currentWorkload - expectedCompletions);
          
          // Calculate available hours (assuming 8-hour workdays)
          const workingDays = Math.floor(daysAhead * (5/7)); // weekdays only
          const currentUtilization = currentWorkload * 2; // 2 hours per active task
          const availableHours = Math.max(0, (workingDays * 8) - currentUtilization);

          // Calculate burnout risk
          const burnoutRisk = this.calculateBurnoutRisk(memberPerf, currentWorkload);

          return {
            userId: member.userId,
            userName: member.userName,
            currentCapacity: currentWorkload,
            predictedCapacity,
            availableHours,
            burnoutRisk
          };
        });
      })
    );
  }

  /**
   * Get smart workload recommendations
   */
  getWorkloadRecommendations(caseId: number): Observable<{
    action: 'redistribute' | 'add_resources' | 'extend_timeline' | 'maintain';
    reason: string;
    details: string[];
    priority: 'low' | 'medium' | 'high';
  }[]> {
    return combineLatest([
      this.predictTeamCapacity(caseId),
      this.analytics.getTaskAnalytics(caseId)
    ]).pipe(
      map(([capacity, analytics]) => {
        const recommendations = [];

        // Check for overloaded members
        const overloaded = capacity.filter(c => c.burnoutRisk > 70);
        if (overloaded.length > 0) {
          recommendations.push({
            action: 'redistribute' as const,
            reason: 'High burnout risk detected',
            details: overloaded.map(m => `${m.userName} has ${m.burnoutRisk}% burnout risk`),
            priority: 'high' as const
          });
        }

        // Check completion rate
        if (analytics.completionRate < 60) {
          recommendations.push({
            action: 'add_resources' as const,
            reason: 'Low completion rate indicates insufficient capacity',
            details: [`Current completion rate: ${analytics.completionRate}%`, 'Consider adding team members'],
            priority: 'medium' as const
          });
        }

        // Check overdue tasks
        if (analytics.overdueTasks > analytics.totalTasks * 0.3) {
          recommendations.push({
            action: 'extend_timeline' as const,
            reason: 'High number of overdue tasks',
            details: [`${analytics.overdueTasks} tasks are overdue`, 'Timeline may need adjustment'],
            priority: 'high' as const
          });
        }

        // All good
        if (recommendations.length === 0) {
          recommendations.push({
            action: 'maintain' as const,
            reason: 'Team capacity and performance are optimal',
            details: ['Continue current practices', 'Monitor regularly for changes'],
            priority: 'low' as const
          });
        }

        return recommendations;
      })
    );
  }

  // Private helper methods
  private calculatePredictiveScore(task: any, member: any, performance: any, analytics: any): {
    userId: number;
    confidence: number;
    reasoning: string[];
    estimatedDays: number;
    riskLevel: 'low' | 'medium' | 'high';
  } {
    let confidence = 50;
    const reasoning = [];

    if (!performance) {
      return {
        userId: member.userId,
        confidence: 30,
        reasoning: ['No performance history available'],
        estimatedDays: 7,
        riskLevel: 'medium'
      };
    }

    // Skill match (simplified)
    if (task.taskType === 'RESEARCH' && member.role?.includes('ASSOCIATE')) {
      confidence += 20;
      reasoning.push('Strong skill match for research tasks');
    }

    // Performance history
    if (performance.overallRating > 80) {
      confidence += 15;
      reasoning.push('Consistently high performance');
    } else if (performance.overallRating < 60) {
      confidence -= 10;
      reasoning.push('Below average performance history');
    }

    // Workload consideration
    if (performance.tasksCompleted < 3) {
      confidence += 10;
      reasoning.push('Currently has light workload');
    } else if (performance.tasksCompleted > 8) {
      confidence -= 15;
      reasoning.push('Currently heavily loaded');
    }

    // Task complexity
    const isComplexTask = task.priority === 'HIGH' || task.description?.length > 200;
    if (isComplexTask && performance.qualityScore > 80) {
      confidence += 10;
      reasoning.push('Capable of handling complex tasks');
    }

    // Availability (mock - would use calendar integration)
    const isAvailable = Math.random() > 0.3;
    if (!isAvailable) {
      confidence -= 20;
      reasoning.push('Limited availability in coming days');
    }

    const estimatedDays = Math.max(1, Math.round(
      (performance.avgTimeToComplete || 5) * (isComplexTask ? 1.5 : 1)
    ));

    const riskLevel = confidence > 75 ? 'low' : confidence > 50 ? 'medium' : 'high';

    return {
      userId: member.userId,
      confidence: Math.max(0, Math.min(100, confidence)),
      reasoning,
      estimatedDays,
      riskLevel
    };
  }

  private calculateBurnoutRisk(performance: any, currentWorkload: number): number {
    if (!performance) return 50;

    let risk = 0;

    // High workload
    if (currentWorkload > 8) risk += 30;
    else if (currentWorkload > 5) risk += 15;

    // Low performance could indicate stress
    if (performance.overallRating < 60) risk += 20;
    else if (performance.overallRating < 70) risk += 10;

    // Long completion times
    if (performance.avgTimeToComplete > 7) risk += 20;
    else if (performance.avgTimeToComplete > 5) risk += 10;

    // Quality decline
    if (performance.qualityScore < 60) risk += 15;

    return Math.min(100, risk);
  }
}