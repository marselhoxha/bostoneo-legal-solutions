import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CrmService } from '../../services/crm.service';

@Component({
  selector: 'app-crm-dashboard',
  templateUrl: './crm-dashboard.component.html',
  styleUrls: ['./crm-dashboard.component.scss']
})
export class CrmDashboardComponent implements OnInit {
  dashboardData: any = {};
  isLoading = true;
  error: string = '';

  // Make Object.keys available in template
  objectKeys = Object.keys;

  constructor(
    private crmService: CrmService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoading = true;
    this.error = '';

    this.crmService.getDashboardData().subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.error = 'Failed to load dashboard data. Please try again.';
        this.isLoading = false;
        
        // Fallback to mock data for development
        this.dashboardData = {
          submissionCounts: {
            'PENDING': 2,
            'REVIEWED': 1,
            'CONVERTED_TO_LEAD': 3,
            'REJECTED': 1,
            'SPAM': 2
          },
          practiceAreaCounts: {
            'Personal Injury': 4,
            'Family Law': 2,
            'Criminal Defense': 1,
            'Business Law': 1,
            'Real Estate Law': 0,
            'Immigration Law': 1
          },
          priorityRanges: {
            'low': 2,
            'medium': 3,
            'high': 2,
            'critical': 2
          },
          recentSubmissions: [],
          conversionStats: {
            totalSubmissions: 9,
            convertedToLeads: 3,
            conversionRate: 33.3
          }
        };
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'bg-warning-subtle text-warning';
      case 'REVIEWED': return 'bg-info-subtle text-info';
      case 'CONVERTED_TO_LEAD': return 'bg-success-subtle text-success';
      case 'REJECTED': return 'bg-danger-subtle text-danger';
      case 'SPAM': return 'bg-secondary-subtle text-secondary';
      default: return 'bg-light text-dark';
    }
  }

  navigateToSubmissions(): void {
    this.router.navigate(['/crm/intake-submissions']);
  }

  navigateToLeads(): void {
    this.router.navigate(['/crm/leads']);
  }

  navigateToConflictChecks(): void {
    this.router.navigate(['/crm/conflict-checks']);
  }
}