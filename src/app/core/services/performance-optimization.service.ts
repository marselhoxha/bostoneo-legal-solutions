import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, combineLatest, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { CaseContextService } from './case-context.service';
import { TaskAnalyticsService } from './task-analytics.service';
import { PredictiveAssignmentService } from './predictive-assignment.service';

export interface PerformanceOptimization {
  type: 'task_prioritization' | 'workload_balancing' | 'skill_development' | 'process_improvement';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  implementationSteps: string[];
  expectedBenefit: string;
}

export interface CacheConfig {
  analyticsCache: boolean;
  performanceCache: boolean;
  predictionCache: boolean;
  cacheTimeout: number;
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceOptimizationService {
  private cacheConfig = new BehaviorSubject<CacheConfig>({
    analyticsCache: true,
    performanceCache: true,
    predictionCache: true,
    cacheTimeout: 300000
  });

  private cachedData = new Map<string, { data: any; timestamp: number }>();

  constructor(
    private caseContext: CaseContextService,
    private analytics: TaskAnalyticsService,
    private predictive: PredictiveAssignmentService
  ) {
    this.initializeCacheCleanup();
  }

  getOptimizationRecommendations(caseId: number): Observable<PerformanceOptimization[]> {
    return combineLatest([
      this.analytics.getTaskAnalytics(caseId),
      this.analytics.getTeamInsights(caseId),
      this.predictive.predictTeamCapacity(caseId)
    ]).pipe(
      map(([analytics, insights, capacity]) => {
        const optimizations: PerformanceOptimization[] = [];

        if (analytics.overdueTasks > analytics.totalTasks * 0.2) {
          optimizations.push({
            type: 'task_prioritization',
            title: 'Implement Dynamic Task Prioritization',
            description: 'Use AI-driven prioritization to focus on high-impact tasks',
            impact: 'high',
            effort: 'medium',
            implementationSteps: [
              'Enable intelligent task scoring',
              'Set up automated priority adjustments',
              'Configure deadline-based escalation'
            ],
            expectedBenefit: `Reduce overdue tasks by up to 40%`
          });
        }

        const overloadedMembers = capacity.filter(c => c.burnoutRisk > 70).length;
        if (overloadedMembers > 0) {
          optimizations.push({
            type: 'workload_balancing',
            title: 'Automated Workload Distribution',
            description: 'Implement real-time workload balancing',
            impact: 'high',
            effort: 'low',
            implementationSteps: [
              'Enable auto-balancing feature',
              'Set workload thresholds',
              'Configure redistribution triggers'
            ],
            expectedBenefit: `Reduce burnout risk for ${overloadedMembers} member(s)`
          });
        }

        return optimizations;
      })
    );
  }

  getCachedData<T>(key: string, dataFactory: () => Observable<T>): Observable<T> {
    const cached = this.cachedData.get(key);
    const config = this.cacheConfig.value;
    
    if (cached && Date.now() - cached.timestamp < config.cacheTimeout) {
      return new BehaviorSubject(cached.data).asObservable();
    }

    return dataFactory().pipe(
      map(data => {
        this.cachedData.set(key, { data, timestamp: Date.now() });
        return data;
      })
    );
  }

  clearCache(): void {
    this.cachedData.clear();
  }

  private initializeCacheCleanup(): void {
    timer(300000, 300000).subscribe(() => {
      const now = Date.now();
      const timeout = this.cacheConfig.value.cacheTimeout;
      
      Array.from(this.cachedData.entries()).forEach(([key, value]) => {
        if (now - value.timestamp > timeout) {
          this.cachedData.delete(key);
        }
      });
    });
  }
}