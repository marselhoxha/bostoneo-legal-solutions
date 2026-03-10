import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RbacGuard, RoutePermissions } from '../../guard/rbac.guard';

import { TimeEntryFormComponent } from './components/time-entry-form/time-entry-form.component';
import { TimeApprovalComponent } from './components/time-approval/time-approval.component';
import { BillingRatesComponent } from './components/billing-rates/billing-rates.component';
import { InvoiceGenerationComponent } from './components/invoice-generation/invoice-generation.component';
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

      // Time Approval - Direct route for /approval
      {
        path: 'approval',
        component: TimeApprovalComponent,
        data: { 
          title: 'Time Approval'
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
 