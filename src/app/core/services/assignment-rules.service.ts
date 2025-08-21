import { Injectable } from '@angular/core';
import { Observable, of, combineLatest } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { CaseContextService } from './case-context.service';
import { RbacService } from './rbac.service';

export interface AssignmentRule {
  id: string;
  name: string;
  caseTypes: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  rolePreferences: string[];
  workloadCap: number;
  autoAssign: boolean;
  active: boolean;
}

export interface AssignmentRecommendation {
  userId: number;
  userName: string;
  score: number;
  reason: string;
  roleMatch: boolean;
  workloadStatus: string;
  availability: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AssignmentRulesService {

  private defaultRules: AssignmentRule[] = [
    {
      id: 'lead-attorney-rule',
      name: 'Lead Attorney Assignment',
      caseTypes: ['LITIGATION', 'CORPORATE_LAW'],
      priority: 'HIGH',
      rolePreferences: ['LEAD_ATTORNEY', 'SENIOR_PARTNER'],
      workloadCap: 80,
      autoAssign: false,
      active: true
    },
    {
      id: 'task-assignment-rule',
      name: 'Task Auto Assignment',
      caseTypes: ['ALL'],
      priority: 'MEDIUM',
      rolePreferences: ['ATTORNEY', 'ASSOCIATE'],
      workloadCap: 90,
      autoAssign: true,
      active: true
    }
  ];

  constructor(
    private caseContextService: CaseContextService,
    private rbacService: RbacService
  ) {}

  /**
   * Get assignment recommendations for a task
   */
  getTaskAssignmentRecommendations(taskId: number, caseId: number): Observable<AssignmentRecommendation[]> {
    return combineLatest([
      this.caseContextService.getCaseTeam(),
      this.getApplicableRules(caseId)
    ]).pipe(
      map(([team, rules]) => {
        return team.map(member => ({
          userId: member.userId,
          userName: member.userName,
          score: this.calculateAssignmentScore(member, rules),
          reason: this.getAssignmentReason(member, rules),
          roleMatch: this.checkRoleMatch(member.roleType, rules),
          workloadStatus: 'OPTIMAL', // Simplified
          availability: true
        })).sort((a, b) => b.score - a.score);
      })
    );
  }

  /**
   * Get applicable rules for case
   */
  private getApplicableRules(caseId: number): Observable<AssignmentRule[]> {
    return this.caseContextService.getCurrentCase().pipe(
      map(caseData => {
        if (!caseData) return [];
        
        return this.defaultRules.filter(rule => 
          rule.active && (
            rule.caseTypes.includes('ALL') || 
            rule.caseTypes.includes(caseData.type)
          )
        );
      })
    );
  }

  /**
   * Calculate assignment score for team member
   */
  private calculateAssignmentScore(member: any, rules: AssignmentRule[]): number {
    let score = 50; // Base score

    // Role preference match
    const roleMatch = rules.some(rule => 
      rule.rolePreferences.includes(member.roleType)
    );
    if (roleMatch) score += 30;

    // Experience bonus (simplified)
    if (member.roleType.includes('SENIOR')) score += 20;
    if (member.roleType.includes('LEAD')) score += 25;

    // Workload penalty (simplified)
    score -= Math.max(0, (member.workloadWeight || 50) - 70);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get assignment reason
   */
  private getAssignmentReason(member: any, rules: AssignmentRule[]): string {
    const reasons: string[] = [];

    if (rules.some(rule => rule.rolePreferences.includes(member.roleType))) {
      reasons.push('Role match');
    }

    if (member.roleType.includes('SENIOR') || member.roleType.includes('LEAD')) {
      reasons.push('Senior expertise');
    }

    if ((member.workloadWeight || 50) < 70) {
      reasons.push('Available capacity');
    }

    return reasons.join(', ') || 'Available team member';
  }

  /**
   * Check role match
   */
  private checkRoleMatch(roleType: string, rules: AssignmentRule[]): boolean {
    return rules.some(rule => rule.rolePreferences.includes(roleType));
  }

  /**
   * Auto-assign task based on rules
   */
  autoAssignTask(taskId: number, caseId: number): Observable<number | null> {
    return this.getTaskAssignmentRecommendations(taskId, caseId).pipe(
      switchMap(recommendations => {
        // Get best recommendation that allows auto-assignment
        const bestRecommendation = recommendations.find(rec => rec.availability && rec.score > 70);
        
        if (bestRecommendation) {
          // Would trigger actual assignment via API
          return of(bestRecommendation.userId);
        }
        
        return of(null);
      })
    );
  }

  /**
   * Get all active rules
   */
  getActiveRules(): AssignmentRule[] {
    return this.defaultRules.filter(rule => rule.active);
  }

  /**
   * Update rule
   */
  updateRule(ruleId: string, updates: Partial<AssignmentRule>): void {
    const rule = this.defaultRules.find(r => r.id === ruleId);
    if (rule) {
      Object.assign(rule, updates);
    }
  }
}