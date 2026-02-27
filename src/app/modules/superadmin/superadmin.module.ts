import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { NgApexchartsModule } from 'ng-apexcharts';

import { SuperadminRoutingModule } from './superadmin-routing.module';
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
import { CreateOrganizationComponent } from './components/create-organization/create-organization.component';
import { ApiDocsComponent } from './components/api-docs/api-docs.component';
import { ImageUrlPipe } from '../../pipes/image-url.pipe';

@NgModule({
  declarations: [
    SuperadminDashboardComponent,
    OrganizationListComponent,
    OrganizationDetailComponent,
    GlobalUserListComponent,
    UserDetailComponent,
    PlatformAnalyticsComponent,
    SystemHealthComponent,
    AuditLogViewerComponent,
    AnnouncementManagerComponent,
    IntegrationStatusComponent,
    SecurityDashboardComponent,
    CreateOrganizationComponent,
    ApiDocsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    SuperadminRoutingModule,
    NgApexchartsModule,
    ImageUrlPipe
  ]
})
export class SuperadminModule { }
