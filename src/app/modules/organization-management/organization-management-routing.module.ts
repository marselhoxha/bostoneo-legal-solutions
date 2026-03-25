import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrganizationListComponent } from './components/organization-list/organization-list.component';
import { OrganizationFormComponent } from './components/organization-form/organization-form.component';
import { OrganizationDetailsComponent } from './components/organization-details/organization-details.component';
import { OrganizationSettingsComponent } from './components/organization-settings/organization-settings.component';
import { OrganizationPlanComponent } from './components/organization-plan/organization-plan.component';
import { SuperAdminGuard } from '../superadmin/guards/superadmin.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'list',
    component: OrganizationListComponent,
    canActivate: [SuperAdminGuard]
  },
  {
    path: 'create',
    component: OrganizationFormComponent,
    canActivate: [SuperAdminGuard]
  },
  {
    path: 'edit/:id',
    component: OrganizationFormComponent
  },
  {
    path: 'details/:id',
    component: OrganizationDetailsComponent
  },
  {
    path: 'details/:id/settings',
    redirectTo: 'details/:id',
    pathMatch: 'full'
  },
  {
    path: 'details/:id/plan',
    component: OrganizationPlanComponent,
    canActivate: [SuperAdminGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OrganizationManagementRoutingModule {}
