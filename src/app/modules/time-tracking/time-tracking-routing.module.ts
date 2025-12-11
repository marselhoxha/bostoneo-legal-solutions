import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RbacGuard, RoutePermissions } from '../../guard/rbac.guard';

import { TimeEntryFormComponent } from './components/time-entry-form/time-entry-form.component';
import { TimesheetViewComponent } from './components/timesheet-view/timesheet-view.component';
import { TimeApprovalComponent } from './components/time-approval/time-approval.component';
import { BillingRatesComponent } from './components/billing-rates/billing-rates.component';
import { TimeReportsComponent } from './components/time-reports/time-reports.component';
import { InvoiceGenerationComponent } from './components/invoice-generation/invoice-generation.component';
import { BillingCyclesComponent } from './components/billing-cycles/billing-cycles.component';
import { RateManagementComponent } from './components/rate-management/rate-management.component';
import { BillingAnalyticsComponent } from './components/billing-analytics/billing-analytics.component';
import { TimeDashboardComponent } from './components/time-dashboard/time-dashboard.component';

const routes: Routes = [
  {
    path: '',
    children: [
      // Time Dashboard - Basic access for own time entries
      {
        path: 'dashboard',
        component: TimeDashboardComponent,
        data: { 
          title: 'Time Dashboard'
        }
      },

      // Time Entry Form - Basic access for creating time entries
      {
        path: 'entry',
        component: TimeEntryFormComponent,
        data: {
          title: 'New Time Entry'
        }
      },

      // Edit Time Entry
      {
        path: 'entry/:id/edit',
        component: TimeEntryFormComponent,
        data: { 
          title: 'Edit Time Entry'
        }
      },

      // Personal Timesheet - Own time entries only
      {
        path: 'timesheet',
        component: TimesheetViewComponent,
        data: { 
          title: 'My Timesheet'
        }
      },

      // Team Timesheet
      {
        path: 'timesheet/team',
        component: TimesheetViewComponent,
        data: { 
          title: 'Team Timesheet',
          viewMode: 'team'
        }
      },

      // All Timesheet
      {
        path: 'timesheet/all',
        component: TimesheetViewComponent,
        data: { 
          title: 'All Timesheets',
          viewMode: 'all'
        }
      },

      // Time Approval - Direct route for /approval
      {
        path: 'approval',
        component: TimeApprovalComponent,
        data: { 
          title: 'Time Approval'
        }
      },

      // Time Reports
      {
        path: 'reports',
        component: TimeReportsComponent,
        data: { 
          title: 'Time Reports'
        }
      },

      // Team Reports
      {
        path: 'reports/team',
        component: TimeReportsComponent,
        data: { 
          title: 'Team Reports',
          reportScope: 'team'
        }
      },

      // All Reports
      {
        path: 'reports/all',
        component: TimeReportsComponent,
        data: { 
          title: 'All Reports',
          reportScope: 'all'
        }
      },

      // Billing Analytics - Direct route for /analytics
      {
        path: 'analytics',
        component: BillingAnalyticsComponent,
        data: { 
          title: 'Time Tracking Analytics'
        }
      },

      // Billing Analytics - Alternative path
      {
        path: 'billing/analytics',
        component: BillingAnalyticsComponent,
        data: { 
          title: 'Billing Analytics'
        }
      },

      // Billing Rates - Direct route for /rates
      {
        path: 'rates',
        component: BillingRatesComponent,
        data: { 
          title: 'Billing Rates'
        }
      },

      // Billing Rates - Alternative path
      {
        path: 'billing/rates',
        component: BillingRatesComponent,
        data: { 
          title: 'Billing Rates Management'
        }
      },

      // Rate Management
      {
        path: 'rate-management',
        component: RateManagementComponent,
        data: { 
          title: 'Rate Management'
        }
      },

      // Invoice Generation - Direct route for /billing/invoice-generation
      {
        path: 'billing/invoice-generation',
        component: InvoiceGenerationComponent,
        data: { 
          title: 'Invoice Generation'
        }
      },

      // Invoice Generation - Alternative path
      {
        path: 'invoices',
        component: InvoiceGenerationComponent,
        data: { 
          title: 'Generate Invoices'
        }
      },

      // Billing Cycles
      {
        path: 'billing/cycles',
        component: BillingCyclesComponent,
        data: { 
          title: 'Billing Cycles'
        }
      },

      // Default redirect to dashboard
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TimeTrackingRoutingModule { } 
 