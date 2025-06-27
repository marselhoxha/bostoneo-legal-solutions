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
      catchError(() => of(this.getMockFullMetrics()))
    );
  }

  /**
   * Get financial metrics for CFO/Finance roles
   */
  private getFinancialMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.baseUrl}/financial`).pipe(
      catchError(() => of(this.getMockFinancialMetrics()))
    );
  }

  /**
   * Get department metrics for Senior Partners
   */
  private getDepartmentMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.baseUrl}/department`).pipe(
      catchError(() => of(this.getMockDepartmentMetrics()))
    );
  }

  /**
   * Get personal metrics for attorneys
   */
  private getPersonalMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.baseUrl}/personal`).pipe(
      catchError(() => of(this.getMockPersonalMetrics()))
    );
  }

  /**
   * Get support staff metrics
   */
  private getSupportMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.baseUrl}/support`).pipe(
      catchError(() => of(this.getMockSupportMetrics()))
    );
  }

  /**
   * Get client portal metrics
   */
  private getClientMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.baseUrl}/client`).pipe(
      catchError(() => of(this.getMockClientMetrics()))
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
      catchError(() => of(this.getMockPracticeAreaMetrics(practiceArea)))
    );
  }

  /**
   * Get time-based metrics (daily, weekly, monthly, yearly)
   */
  getTimeBasedMetrics(period: 'daily' | 'weekly' | 'monthly' | 'yearly'): Observable<any> {
    return this.http.get(`${this.baseUrl}/trends/${period}`).pipe(
      catchError(() => of(this.getMockTimeBasedMetrics(period)))
    );
  }

  // Mock data methods for development/fallback
  private getDefaultMetrics(): DashboardMetrics {
    return {
      revenue: { totalRevenue: 0, monthlyRevenue: 0, quarterlyRevenue: 0, yearlyRevenue: 0, revenueGrowth: 0 },
      clients: { totalClients: 0, activeClients: 0, newClientsThisMonth: 0, clientRetentionRate: 0, clientSatisfactionScore: 0 },
      cases: { totalCases: 0, activeCases: 0, closedCases: 0, successRate: 0, upcomingDeadlines: 0 }
    };
  }

  private getMockFullMetrics(): DashboardMetrics {
    return {
      revenue: {
        totalRevenue: 8543750,
        monthlyRevenue: 742500,
        quarterlyRevenue: 2227500,
        yearlyRevenue: 8543750,
        revenueGrowth: 12,
        revenueByPracticeArea: {
          'Corporate Law': 2987312,
          'Litigation': 2140937,
          'Real Estate': 1711750,
          'Tax Law': 854375,
          'Family Law': 849376
        }
      },
      clients: {
        totalClients: 342,
        activeClients: 198,
        newClientsThisMonth: 12,
        clientRetentionRate: 94,
        clientSatisfactionScore: 4.7,
        topClients: [
          { id: 1, name: 'Tech Solutions Inc', revenue: 450000 },
          { id: 2, name: 'Global Finance Corp', revenue: 380000 },
          { id: 3, name: 'Healthcare Partners', revenue: 320000 }
        ]
      },
      cases: {
        totalCases: 523,
        activeCases: 187,
        closedCases: 336,
        successRate: 92,
        casesByStatus: { 'Active': 187, 'Closed': 336, 'On Hold': 12 },
        upcomingDeadlines: 23
      },
      staff: {
        totalStaff: 89,
        attorneys: 34,
        paralegals: 18,
        supportStaff: 37,
        utilizationRate: 87,
        billableHours: 4832
      },
      financial: {
        cashFlow: 523000,
        accountsReceivable: 1234000,
        accountsPayable: 234000,
        workInProgress: 892000,
        operatingExpenses: 423000,
        grossMargin: 72,
        netMargin: 34,
        ebitda: 2890000,
        collectionRate: 91,
        averageCollectionDays: 35,
        overdueInvoices: 23,
        trustAccountBalance: 3456000
      }
    };
  }

  private getMockFinancialMetrics(): DashboardMetrics {
    return {
      revenue: {
        totalRevenue: 8543750,
        monthlyRevenue: 742500,
        quarterlyRevenue: 2227500,
        yearlyRevenue: 8543750,
        revenueGrowth: 12
      },
      financial: {
        cashFlow: 523000,
        accountsReceivable: 1234000,
        accountsPayable: 234000,
        workInProgress: 892000,
        operatingExpenses: 423000,
        grossMargin: 72,
        netMargin: 34,
        ebitda: 2890000,
        collectionRate: 91,
        averageCollectionDays: 35,
        overdueInvoices: 23,
        trustAccountBalance: 3456000
      }
    };
  }

  private getMockDepartmentMetrics(): DashboardMetrics {
    return {
      revenue: {
        totalRevenue: 2140937,
        monthlyRevenue: 178411,
        quarterlyRevenue: 535234,
        yearlyRevenue: 2140937,
        revenueGrowth: 15
      },
      clients: {
        totalClients: 68,
        activeClients: 42,
        newClientsThisMonth: 3,
        clientRetentionRate: 96,
        clientSatisfactionScore: 4.8
      },
      cases: {
        totalCases: 89,
        activeCases: 34,
        closedCases: 55,
        successRate: 95,
        upcomingDeadlines: 8
      }
    };
  }

  private getMockPersonalMetrics(): DashboardMetrics {
    return {
      revenue: {
        totalRevenue: 450000,
        monthlyRevenue: 37500,
        quarterlyRevenue: 112500,
        yearlyRevenue: 450000,
        revenueGrowth: 8
      },
      cases: {
        totalCases: 23,
        activeCases: 12,
        closedCases: 11,
        successRate: 91,
        upcomingDeadlines: 3
      }
    };
  }

  private getMockSupportMetrics(): DashboardMetrics {
    return {
      operations: {
        taskCompletionRate: 94,
        averageResponseTime: 2.3,
        clientCommunications: 142,
        documentsProcessed: 234,
        complianceScore: 98
      }
    };
  }

  private getMockClientMetrics(): DashboardMetrics {
    return {
      cases: {
        totalCases: 3,
        activeCases: 2,
        closedCases: 1,
        successRate: 100,
        upcomingDeadlines: 1
      }
    };
  }

  private getMockPracticeAreaMetrics(practiceArea: string): any {
    return {
      practiceArea,
      revenue: 2140937,
      cases: 89,
      attorneys: 8,
      utilizationRate: 92
    };
  }

  private getMockTimeBasedMetrics(period: string): any {
    return {
      period,
      data: [
        { date: '2024-01', value: 650000 },
        { date: '2024-02', value: 720000 },
        { date: '2024-03', value: 680000 },
        { date: '2024-04', value: 742500 }
      ]
    };
  }
}