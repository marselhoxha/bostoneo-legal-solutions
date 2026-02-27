import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { RbacService } from '../core/services/rbac.service';
import { environment } from '../../environments/environment';

export interface DashboardMetrics {
  revenue?: RevenueMetrics;
  clients?: ClientMetrics;
  cases?: CaseMetrics;
  staff?: StaffMetrics;
  financial?: FinancialMetrics;
  operations?: OperationalMetrics;
}

export interface RevenueMetrics {
  totalRevenue: number;
  monthlyRevenue: number;
  quarterlyRevenue: number;
  yearlyRevenue: number;
  revenueGrowth: number;
  revenueByPracticeArea?: { [key: string]: number };
  revenueByAttorney?: { [key: string]: number };
}

export interface ClientMetrics {
  totalClients: number;
  activeClients: number;
  newClientsThisMonth: number;
  clientRetentionRate: number;
  clientSatisfactionScore: number;
  topClients?: Array<{ id: number; name: string; revenue: number }>;
}

export interface CaseMetrics {
  totalCases: number;
  activeCases: number;
  closedCases: number;
  successRate: number;
  casesByStatus?: { [key: string]: number };
  casesByPracticeArea?: { [key: string]: number };
  upcomingDeadlines: number;
}

export interface StaffMetrics {
  totalStaff: number;
  attorneys: number;
  paralegals: number;
  supportStaff: number;
  utilizationRate: number;
  billableHours: number;
  staffByDepartment?: { [key: string]: number };
}

export interface FinancialMetrics {
  totalBilled: number;
  totalCollected: number;
  cashFlow: number;
  accountsReceivable: number;
  accountsPayable: number;
  workInProgress: number;
  operatingExpenses: number;
  grossMargin: number;
  netMargin: number;
  ebitda: number;
  collectionRate: number;
  averageCollectionDays: number;
  overdueInvoices: number;
  trustAccountBalance?: number;
}

export interface OperationalMetrics {
  taskCompletionRate: number;
  averageResponseTime: number;
  clientCommunications: number;
  documentsProcessed: number;
  complianceScore: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private baseUrl = `${environment.apiUrl}/api/dashboard`;

  constructor(
    private http: HttpClient,
    private rbacService: RbacService
  ) {}

  /**
   * Get dashboard metrics based on user role and permissions
   */
  getDashboardMetrics(): Observable<DashboardMetrics> {
    return this.rbacService.getCurrentUserPermissions().pipe(
      switchMap(permissions => {
        if (!permissions) {
          return throwError(() => new Error('No permissions found'));
        }

        const hierarchyLevel = permissions.hierarchyLevel;
        const hasFinancialAccess = permissions.hasFinancialAccess;
        const hasAdministrativeAccess = permissions.hasAdministrativeAccess;

        // Determine which metrics to fetch based on role hierarchy
        const metrics: DashboardMetrics = {};
        
        // Managing Partner & Admin get everything
        if (hierarchyLevel >= 95 || hasAdministrativeAccess) {
          return this.getFullMetrics();
        }
        
        // CFO & Finance roles get financial metrics
        if (hasFinancialAccess || hierarchyLevel >= 90) {
          return this.getFinancialMetrics();
        }
        
        // Senior Partners get department metrics
        if (hierarchyLevel >= 85) {
          return this.getDepartmentMetrics();
        }
        
        // Attorneys get their own metrics
        if (hierarchyLevel >= 50) {
          return this.getPersonalMetrics();
        }
        
        // Support staff get limited metrics
        if (hierarchyLevel >= 20) {
          return this.getSupportMetrics();
        }
        
        // Clients get minimal metrics
        return this.getClientMetrics();
      }),
      catchError(error => {
        console.error('Error fetching dashboard metrics:', error);
        return of(this.getDefaultMetrics());
      })
    );
  }

  /**
   * Get full metrics for executives
   */
  private getFullMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.baseUrl}/full`).pipe(
      catchError(() => of(this.getDefaultMetrics()))
    );
  }

  /**
   * Get financial metrics for CFO/Finance roles
   */
  private getFinancialMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.baseUrl}/financial`).pipe(
      catchError(() => of(this.getDefaultMetrics()))
    );
  }

  /**
   * Get department metrics for Senior Partners
   */
  private getDepartmentMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.baseUrl}/department`).pipe(
      catchError(() => of(this.getDefaultMetrics()))
    );
  }

  /**
   * Get personal metrics for attorneys
   */
  private getPersonalMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.baseUrl}/personal`).pipe(
      catchError(() => of(this.getDefaultMetrics()))
    );
  }

  /**
   * Get support staff metrics
   */
  private getSupportMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.baseUrl}/support`).pipe(
      catchError(() => of(this.getDefaultMetrics()))
    );
  }

  /**
   * Get client portal metrics
   */
  private getClientMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.baseUrl}/client`).pipe(
      catchError(() => of(this.getDefaultMetrics()))
    );
  }

  /**
   * Check if user has permission to view specific metric
   */
  canViewMetric(metricType: string): Observable<boolean> {
    const permissionMap: { [key: string]: { resource: string; action: string } } = {
      'revenue': { resource: 'FINANCIAL', action: 'VIEW' },
      'clients': { resource: 'CLIENT', action: 'VIEW' },
      'cases': { resource: 'CASE', action: 'VIEW' },
      'staff': { resource: 'USER', action: 'VIEW' },
      'financial': { resource: 'FINANCIAL', action: 'VIEW' },
      'operations': { resource: 'SYSTEM', action: 'VIEW' }
    };

    const permission = permissionMap[metricType];
    if (!permission) return of(false);

    return this.rbacService.hasPermission(permission.resource, permission.action);
  }

  /**
   * Get practice area specific metrics
   */
  getPracticeAreaMetrics(practiceArea: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/practice-area/${practiceArea}`).pipe(
      catchError(() => of(this.getDefaultMetrics()))
    );
  }

  /**
   * Get time-based metrics (daily, weekly, monthly, yearly)
   */
  getTimeBasedMetrics(period: 'daily' | 'weekly' | 'monthly' | 'yearly'): Observable<any> {
    return this.http.get(`${this.baseUrl}/trends/${period}`).pipe(
      catchError(() => of(this.getDefaultMetrics()))
    );
  }

  getAttorneyPerformance(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/attorney-performance`).pipe(
      catchError(() => of([]))
    );
  }

  // Default empty metrics for error fallback
  private getDefaultMetrics(): DashboardMetrics {
    return {
      revenue: { totalRevenue: 0, monthlyRevenue: 0, quarterlyRevenue: 0, yearlyRevenue: 0, revenueGrowth: 0 },
      clients: { totalClients: 0, activeClients: 0, newClientsThisMonth: 0, clientRetentionRate: 0, clientSatisfactionScore: 0 },
      cases: { totalCases: 0, activeCases: 0, closedCases: 0, successRate: 0, upcomingDeadlines: 0 }
    };
  }

}