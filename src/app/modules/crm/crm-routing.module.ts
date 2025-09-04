import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CrmDashboardComponent } from './components/crm-dashboard/crm-dashboard.component';
import { LeadsDashboardComponent } from './components/leads-dashboard/leads-dashboard.component';
import { IntakeSubmissionsComponent } from './components/intake-submissions/intake-submissions.component';
import { ConflictChecksListComponent } from './components/conflict-checks-list/conflict-checks-list.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    component: CrmDashboardComponent,
    data: { title: 'CRM Dashboard' }
  },
  {
    path: 'leads',
    component: LeadsDashboardComponent,
    data: { title: 'Lead Management' }
  },
  {
    path: 'intake-submissions',
    component: IntakeSubmissionsComponent,
    data: { title: 'Intake Submissions' }
  },
  {
    path: 'conflict-checks',
    component: ConflictChecksListComponent,
    data: { title: 'Conflict Checks' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CrmRoutingModule { }