import { Injectable } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { WorkloadBalancerService, WorkloadMetrics } from './workload-balancer.service';
import { AssignmentRulesService, AssignmentRecommendation } from './assignment-rules.service';
import { CaseContextService } from './case-context.service';

export interface DistributionStrategy {
  id: string;
  name: string;
  description: string;
  factors: {
    workloadWeight: number;
    skillWeight: number;
    availabilityWeight: number;
    experienceWeight: number;
  };
}

export interface IntelligentAssignment {
  taskId: number;
  recommendedAssignee: number;
  assigneeName: string;
  confidenceScore: number;
  reasoning: string[];
  alternativeAssignees: { userId: number; userName: string; score: number }[];
  estimatedCompletionTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class IntelligentDistributionService {

  private strategies: DistributionStrategy[] = [
    {
      id: 'balanced',
      name: 'Balanced Distribution',
      description: 'Equal weight to all factors',
      factors: { workloadWeight: 25, skillWeight: 25, availabilityWeight: 25, experienceWeight: 25 }
    },
    {
      id: 'workload-focused',
      name: 'Workload Focused',
      description: 'Prioritize workload balance',
      factors: { workloadWeight: 50, skillWeight: 20, availabilityWeight: 20, experienceWeight: 10 }
    },
    {
      id: 'skill-focused',
      name: 'Skill Focused',
      description: 'Prioritize skill matching',
      factors: { workloadWeight: 15, skillWeight: 50, availabilityWeight: 20, experienceWeight: 15 }
    },
    {
      id: 'urgent',
      name: 'Urgent Tasks',
      description: 'Focus on availability and experience',
      factors: { workloadWeight: 10, skillWeight: 20, availabilityWeight: 40, experienceWeight: 30 }
    }
  ];

  constructor(
    private workloadBalancer: WorkloadBalancerService,
    private assignmentRules: AssignmentRulesService,
    private caseContextService: CaseContextService
  ) {}

  /**
   * Get intelligent assignment recommendation for a task
   */
  getIntelligentAssignment(
    taskId: number, 
    caseId: number, 
    strategyId: string = 'balanced'
  ): Observable<IntelligentAssignment | null> {
    const strategy = this.strategies.find(s => s.id === strategyId) || this.strategies[0];

    return combineLatest([
      this.workloadBalancer.calculateTeamWorkload(caseId),
      this.assignmentRules.getTaskAssignmentRecommendations(taskId, caseId),
      this.caseContextService.getCaseTasks(),
      this.caseContextService.getCaseTeam()
    ]).pipe(
      map(([workloads, recommendations, tasks, team]) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task || !team.length) return null;

        // Calculate intelligent scores for each team member
        const intelligentScores = team.map(member => {
          const workload = workloads.find(w => w.userId === member.userId);
          const recommendation = recommendations.find(r => r.userId === member.userId);
          
          return {
            userId: member.userId,
            userName: member.userName,
            score: this.calculateIntelligentScore(member, task, workload, recommendation, strategy),
            reasoning: this.generateReasoning(member, task, workload, recommendation, strategy)
          };
        }).sort((a, b) => b.score - a.score);

        const bestAssignee = intelligentScores[0];
        const alternatives = intelligentScores.slice(1, 4); // Top 3 alternatives

        return {
          taskId,
          recommendedAssignee: bestAssignee.userId,
          assigneeName: bestAssignee.userName,
          confidenceScore: bestAssignee.score,
          reasoning: bestAssignee.reasoning,
          alternativeAssignees: alternatives,
          estimatedCompletionTime: this.estimateCompletionTime(task, bestAssignee.userId, workloads)
        };
      })
    );
  }

  /**
   * Bulk assignment for multiple tasks
   */
  getBulkIntelligentAssignments(
    taskIds: number[], 
    caseId: number, 
    strategyId: string = 'balanced'
  ): Observable<IntelligentAssignment[]> {
    const assignments$ = taskIds.map(taskId => 
      this.getIntelligentAssignment(taskId, caseId, strategyId)
    );

    return combineLatest(assignments$).pipe(
      map(assignments => assignments.filter(a => a !== null) as IntelligentAssignment[]),
      switchMap(assignments => {
        // Optimize assignments to prevent overloading single person
        return of(this.optimizeAssignments(assignments));
      })
    );
  }

  /**
   * Get available distribution strategies
   */
  getStrategies(): DistributionStrategy[] {
    return this.strategies;
  }

  /**
   * Auto-distribute unassigned tasks
   */
  autoDistributeTasks(caseId: number, maxAssignments: number = 5): Observable<{
    assigned: IntelligentAssignment[];
    skipped: { taskId: number; reason: string }[];
  }> {
    return this.caseContextService.getCaseTasks().pipe(
      switchMap(tasks => {
        const unassignedTasks = tasks
          .filter(task => !task.assignedToId && task.status === 'TODO')
          .slice(0, maxAssignments);

        if (unassignedTasks.length === 0) {
          return of({ assigned: [], skipped: [] });
        }

        return this.getBulkIntelligentAssignments(
          unassignedTasks.map(t => t.id), 
          caseId, 
          'balanced'
        ).pipe(
          map(assignments => ({
            assigned: assignments.filter(a => a.confidenceScore > 60),
            skipped: assignments
              .filter(a => a.confidenceScore <= 60)
              .map(a => ({ 
                taskId: a.taskId, 
                reason: `Low confidence score: ${a.confidenceScore}%` 
              }))
          }))
        );
      })
    );
  }

  // Private helper methods
  private calculateIntelligentScore(
    member: any, 
    task: any, 
    workload: WorkloadMetrics | undefined, 
    recommendation: AssignmentRecommendation | undefined,
    strategy: DistributionStrategy
  ): number {
    const factors = strategy.factors;
    let score = 0;

    // Workload factor (lower workload = higher score)
    const workloadScore = workload ? Math.max(0, 100 - workload.workloadScore) : 50;
    score += (workloadScore * factors.workloadWeight) / 100;

    // Skill factor (role match)
    const skillScore = recommendation ? (recommendation.roleMatch ? 80 : 40) : 50;
    score += (skillScore * factors.skillWeight) / 100;

    // Availability factor (based on active tasks and efficiency)
    const availabilityScore = workload ? 
      Math.max(0, 100 - (workload.activeTasks * 10) + (workload.efficiency / 2)) : 50;
    score += (availabilityScore * factors.availabilityWeight) / 100;

    // Experience factor (based on role hierarchy)
    const experienceScore = this.getExperienceScore(member.roleType);
    score += (experienceScore * factors.experienceWeight) / 100;

    return Math.round(score);
  }

  private generateReasoning(
    member: any, 
    task: any, 
    workload: WorkloadMetrics | undefined, 
    recommendation: AssignmentRecommendation | undefined,
    strategy: DistributionStrategy
  ): string[] {
    const reasons: string[] = [];

    if (workload) {
      if (workload.workloadScore < 50) {
        reasons.push(`Light workload (${workload.workloadScore}%)`);
      } else if (workload.workloadScore > 80) {
        reasons.push(`Heavy workload (${workload.workloadScore}%)`);
      }

      if (workload.efficiency > 80) {
        reasons.push(`High efficiency (${workload.efficiency}%)`);
      }

      if (workload.completionRate > 90) {
        reasons.push(`Excellent completion rate (${workload.completionRate}%)`);
      }
    }

    if (recommendation?.roleMatch) {
      reasons.push('Role expertise match');
    }

    if (member.roleType.includes('SENIOR') || member.roleType.includes('LEAD')) {
      reasons.push('Senior experience');
    }

    if (reasons.length === 0) {
      reasons.push('Available team member');
    }

    return reasons;
  }

  private getExperienceScore(roleType: string): number {
    const experienceMap: { [key: string]: number } = {
      'LEAD_ATTORNEY': 95,
      'SENIOR_PARTNER': 100,
      'SUPPORTING_ATTORNEY': 80,
      'CO_COUNSEL': 75,
      'ASSOCIATE': 60,
      'PARALEGAL': 50,
      'LEGAL_ASSISTANT': 40,
      'SECRETARY': 30,
      'CONSULTANT': 70
    };

    return experienceMap[roleType] || 50;
  }

  private estimateCompletionTime(task: any, assigneeId: number, workloads: WorkloadMetrics[]): number {
    const assigneeWorkload = workloads.find(w => w.userId === assigneeId);
    const baseHours = task.estimatedHours || 4;
    
    // Adjust based on workload and efficiency
    if (assigneeWorkload) {
      const workloadMultiplier = 1 + (assigneeWorkload.workloadScore / 100);
      const efficiencyMultiplier = 1 - ((assigneeWorkload.efficiency - 50) / 100);
      return Math.round(baseHours * workloadMultiplier * efficiencyMultiplier);
    }

    return baseHours;
  }

  private optimizeAssignments(assignments: IntelligentAssignment[]): IntelligentAssignment[] {
    // Count assignments per person
    const assignmentCounts = new Map<number, number>();
    assignments.forEach(assignment => {
      const count = assignmentCounts.get(assignment.recommendedAssignee) || 0;
      assignmentCounts.set(assignment.recommendedAssignee, count + 1);
    });

    // Redistribute if someone gets too many assignments
    return assignments.map(assignment => {
      const currentCount = assignmentCounts.get(assignment.recommendedAssignee) || 0;
      
      if (currentCount > 3 && assignment.alternativeAssignees.length > 0) {
        // Try to use an alternative assignee
        const alternative = assignment.alternativeAssignees.find(alt => 
          (assignmentCounts.get(alt.userId) || 0) < 2
        );
        
        if (alternative) {
          assignmentCounts.set(assignment.recommendedAssignee, currentCount - 1);
          assignmentCounts.set(alternative.userId, (assignmentCounts.get(alternative.userId) || 0) + 1);
          
          return {
            ...assignment,
            recommendedAssignee: alternative.userId,
            assigneeName: alternative.userName,
            confidenceScore: alternative.score,
            reasoning: [...assignment.reasoning, 'Optimized for workload balance']
          };
        }
      }

      return assignment;
    });
  }
}