import { Injectable } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { CaseContextService } from './case-context.service';
import { AssignmentRulesService } from './assignment-rules.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface WorkloadMetrics {
  userId: number;
  userName: string;
  totalTasks: number;
  activeTasks: number;
  overdueTasks: number;
  completionRate: number;
  averageHours: number;
  capacity: number;
  efficiency: number;
  workloadScore: number;
}

export interface DistributionRecommendation {
  taskId: number;
  recommendedAssignee: number;
  currentAssignee?: number;
  redistributionReason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  expectedImpact: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkloadBalancerService {
  private readonly apiUrl = `${environment.apiUrl}/api/v1`;

  constructor(
    private http: HttpClient,
    private caseContextService: CaseContextService,
    private assignmentRulesService: AssignmentRulesService
  ) {}

  /**
   * Calculate workload metrics for case team
   */
  calculateTeamWorkload(caseId: number): Observable<WorkloadMetrics[]> {
    return combineLatest([
      this.caseContextService.getCaseTeam(),
      this.caseContextService.getCaseTasks()
    ]).pipe(
      map(([team, tasks]) => {
        return team.map(member => {
          const memberTasks = tasks.filter(task => task.assignedToId === member.userId);
          const activeTasks = memberTasks.filter(task => !['COMPLETED', 'CANCELLED'].includes(task.status));
          const overdueTasks = memberTasks.filter(task => 
            task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED'
          );
          
          return {
            userId: member.userId,
            userName: member.userName,
            totalTasks: memberTasks.length,
            activeTasks: activeTasks.length,
            overdueTasks: overdueTasks.length,
            completionRate: this.calculateCompletionRate(memberTasks),
            averageHours: this.calculateAverageHours(memberTasks),
            capacity: this.calculateCapacity(activeTasks.length),
            efficiency: this.calculateEfficiency(memberTasks),
            workloadScore: this.calculateWorkloadScore(activeTasks.length, overdueTasks.length)
          };
        });
      })
    );
  }

  /**
   * Get redistribution recommendations
   */
  getRedistributionRecommendations(caseId: number): Observable<DistributionRecommendation[]> {
    return this.calculateTeamWorkload(caseId).pipe(
      switchMap(workloads => {
        return this.caseContextService.getCaseTasks().pipe(
          map(tasks => {
            const recommendations: DistributionRecommendation[] = [];
            const overloadedMembers = workloads.filter(w => w.workloadScore > 80);
            const availableMembers = workloads.filter(w => w.workloadScore < 60).sort((a, b) => a.workloadScore - b.workloadScore);

            // Find tasks to redistribute from overloaded members
            overloadedMembers.forEach(overloaded => {
              const memberTasks = tasks.filter(task => 
                task.assignedToId === overloaded.userId && 
                ['TODO', 'IN_PROGRESS'].includes(task.status)
              );

              // Get least critical tasks for redistribution
              const redistributableTasks = memberTasks
                .filter(task => task.priority !== 'HIGH')
                .sort((a, b) => {
                  const priorityOrder = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
                  return (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) - 
                         (priorityOrder[b.priority as keyof typeof priorityOrder] || 2);
                })
                .slice(0, Math.min(2, Math.floor(memberTasks.length * 0.3))); // Max 30% of tasks

              redistributableTasks.forEach(task => {
                const bestAssignee = this.findBestAssignee(task, availableMembers, workloads);
                if (bestAssignee) {
                  recommendations.push({
                    taskId: task.id,
                    recommendedAssignee: bestAssignee.userId,
                    currentAssignee: overloaded.userId,
                    redistributionReason: `Balance workload (${overloaded.userName}: ${overloaded.workloadScore}% → ${bestAssignee.userName}: ${bestAssignee.workloadScore}%)`,
                    priority: this.getRedistributionPriority(overloaded.workloadScore, bestAssignee.workloadScore),
                    expectedImpact: `Reduce ${overloaded.userName} workload by ~${Math.round(100/overloaded.activeTasks)}%`
                  });
                }
              });
            });

            return recommendations;
          })
        );
      })
    );
  }

  /**
   * Auto-balance workload across team
   */
  autoBalanceWorkload(caseId: number): Observable<{applied: number, recommendations: DistributionRecommendation[]}> {
    return this.getRedistributionRecommendations(caseId).pipe(
      switchMap(recommendations => {
        // Apply high priority recommendations automatically
        const highPriorityRecs = recommendations.filter(rec => rec.priority === 'HIGH');
        const autoApplied = Math.min(highPriorityRecs.length, 3); // Limit auto-applications

        // In a real implementation, this would call the task reassignment API
        return of({
          applied: autoApplied,
          recommendations: recommendations
        });
      })
    );
  }

  /**
   * Get team workload summary
   */
  getWorkloadSummary(caseId: number): Observable<{
    averageWorkload: number;
    imbalanceScore: number;
    overloadedMembers: number;
    underutilizedMembers: number;
    recommendedActions: string[];
  }> {
    return this.calculateTeamWorkload(caseId).pipe(
      map(workloads => {
        const scores = workloads.map(w => w.workloadScore);
        const averageWorkload = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const variance = scores.reduce((sum, score) => sum + Math.pow(score - averageWorkload, 2), 0) / scores.length;
        const imbalanceScore = Math.sqrt(variance);
        
        const overloadedMembers = workloads.filter(w => w.workloadScore > 80).length;
        const underutilizedMembers = workloads.filter(w => w.workloadScore < 40).length;
        
        const recommendedActions: string[] = [];
        if (imbalanceScore > 20) recommendedActions.push('Consider redistributing tasks');
        if (overloadedMembers > 0) recommendedActions.push(`${overloadedMembers} member(s) overloaded`);
        if (underutilizedMembers > 1) recommendedActions.push(`${underutilizedMembers} member(s) underutilized`);
        
        return {
          averageWorkload: Math.round(averageWorkload),
          imbalanceScore: Math.round(imbalanceScore),
          overloadedMembers,
          underutilizedMembers,
          recommendedActions
        };
      })
    );
  }

  // Private helper methods
  private calculateCompletionRate(tasks: any[]): number {
    if (tasks.length === 0) return 100;
    const completed = tasks.filter(task => task.status === 'COMPLETED').length;
    return Math.round((completed / tasks.length) * 100);
  }

  private calculateAverageHours(tasks: any[]): number {
    const totalHours = tasks.reduce((sum, task) => sum + (task.estimatedHours || 4), 0);
    return tasks.length > 0 ? Math.round(totalHours / tasks.length) : 0;
  }

  private calculateCapacity(activeTasks: number): number {
    const maxCapacity = 10; // Assume max 10 active tasks per person
    return Math.min(100, Math.round((activeTasks / maxCapacity) * 100));
  }

  private calculateEfficiency(tasks: any[]): number {
    // Simplified efficiency calculation based on completion rate and overdue tasks
    const completionRate = this.calculateCompletionRate(tasks);
    const overdueTasks = tasks.filter(task => 
      task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED'
    ).length;
    const overduePercentage = tasks.length > 0 ? (overdueTasks / tasks.length) * 100 : 0;
    
    return Math.max(0, Math.round(completionRate - overduePercentage));
  }

  private calculateWorkloadScore(activeTasks: number, overdueTasks: number): number {
    const baseScore = Math.min(100, activeTasks * 10); // 10 points per active task
    const overdueStress = overdueTasks * 15; // 15 extra points per overdue task
    return Math.min(100, baseScore + overdueStress);
  }

  private findBestAssignee(task: any, availableMembers: WorkloadMetrics[], allWorkloads: WorkloadMetrics[]): WorkloadMetrics | null {
    if (availableMembers.length === 0) return null;

    // Find member with lowest workload who can handle the task type
    return availableMembers.find(member => member.workloadScore < 70) || availableMembers[0];
  }

  private getRedistributionPriority(currentWorkload: number, targetWorkload: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    const workloadDiff = currentWorkload - targetWorkload;
    if (currentWorkload > 90 && workloadDiff > 30) return 'HIGH';
    if (currentWorkload > 80 && workloadDiff > 20) return 'MEDIUM';
    return 'LOW';
  }
}