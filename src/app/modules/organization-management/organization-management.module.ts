import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgbDropdownModule, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';

import { OrganizationManagementRoutingModule } from './organization-management-routing.module';
import { OrganizationListComponent } from './components/organization-list/organization-list.component';
import { OrganizationFormComponent } from './components/organization-form/organization-form.component';
import { OrganizationDetailsComponent } from './components/organization-details/organization-details.component';
import { OrganizationSwitcherComponent } from './components/organization-switcher/organization-switcher.component';
import { OrganizationTeamComponent } from './components/organization-team/organization-team.component';
import { OrganizationInvitationsComponent } from './components/organization-invitations/organization-invitations.component';
import { OrganizationSettingsComponent } from './components/organization-settings/organization-settings.component';
import { OrganizationPlanComponent } from './components/organization-plan/organization-plan.component';

@NgModule({
  declarations: [
    OrganizationListComponent,
    OrganizationFormComponent,
    OrganizationDetailsComponent,
    OrganizationSwitcherComponent,
    OrganizationTeamComponent,
    OrganizationInvitationsComponent,
    OrganizationSettingsComponent,
    OrganizationPlanComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NgbDropdownModule,
    NgbModalModule,
    OrganizationManagementRoutingModule
  ],
  exports: [
    OrganizationSwitcherComponent
  ]
})
export class OrganizationManagementModule {}
