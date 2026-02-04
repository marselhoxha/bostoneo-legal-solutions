import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SuperAdminGuard } from './guards/superadmin.guard';
import { SuperadminDashboardComponent } from './components/superadmin-dashboard/superadmin-dashboard.component';
import { OrganizationListComponent } from './components/organization-list/organization-list.component';
import { OrganizationDetailComponent } from './components/organization-detail/organization-detail.component';
import { GlobalUserListComponent } from './components/global-user-list/global-user-list.component';
import { UserDetailComponent } from './components/user-detail/user-detail.component';
import { PlatformAnalyticsComponent } from './components/platform-analytics/platform-analytics.component';
import { SystemHealthComponent } from './components/system-health/system-health.component';
import { AuditLogViewerComponent } from './components/audit-log-viewer/audit-log-viewer.component';
import { AnnouncementManagerComponent } from './components/announcement-manager/announcement-manager.component';
import { IntegrationStatusComponent } from './components/integration-status/integration-status.component';
import { SecurityDashboardComponent } from './components/security-dashboard/security-dashboard.component';

const routes: Routes = [
  {
    path: '',
    canActivate: [SuperAdminGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        component: SuperadminDashboardComponent,
        data: { title: 'SUPERADMIN Dashboard' }
      },
      {
        path: 'organizations',
        component: OrganizationListComponent,
        data: { title: 'Organizations' }
      },
      {
        path: 'organizations/:id',
        component: OrganizationDetailComponent,
        data: { title: 'Organization Details' }
      },
      {
        path: 'users',
        component: GlobalUserListComponent,
        data: { title: 'All Users' }
      },
      {
        path: 'users/:id',
        component: UserDetailComponent,
        data: { title: 'User Details' }
      },
      {
        path: 'analytics',
        component: PlatformAnalyticsComponent,
        data: { title: 'Platform Analytics' }
      },
      {
        path: 'system-health',
        component: SystemHealthComponent,
        data: { title: 'System Health' }
      },
      {
        path: 'audit-logs',
        component: AuditLogViewerComponent,
        data: { title: 'Audit Logs' }
      },
      {
        path: 'announcements',
        component: AnnouncementManagerComponent,
        data: { title: 'Announcements' }
      },
      {
        path: 'integrations',
        component: IntegrationStatusComponent,
        data: { title: 'Integration Status' }
      },
      {
        path: 'security',
        component: SecurityDashboardComponent,
        data: { title: 'Security Dashboard' }
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SuperadminRoutingModule { }
