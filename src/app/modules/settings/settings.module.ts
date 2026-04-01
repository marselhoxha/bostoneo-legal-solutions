import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// Shell
import { SettingsShellComponent } from './settings-shell/settings-shell.component';

// Tabs
import { ProfileTabComponent } from './tabs/profile-tab/profile-tab.component';
import { SecurityTabComponent } from './tabs/security-tab/security-tab.component';
import { NotificationsTabComponent } from './tabs/notifications-tab/notifications-tab.component';
import { OrganizationTabComponent } from './tabs/organization-tab/organization-tab.component';
import { IntegrationsTabComponent } from './tabs/integrations-tab/integrations-tab.component';

// Reused standalone components
import { NotificationPreferencesComponent } from '../../component/profile/user/notification-preferences/notification-preferences.component';
import { StationerySettingsComponent } from '../legal/components/ai-assistant/stationery-settings/stationery-settings.component';
import { OrganizationTeamComponent } from '../organization-management/components/organization-team/organization-team.component';
import { OrganizationInvitationsComponent } from '../organization-management/components/organization-invitations/organization-invitations.component';

// Shared
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { path: '', redirectTo: 'profile', pathMatch: 'full' },
  { path: ':tab', component: SettingsShellComponent }
];

@NgModule({
  declarations: [
    SettingsShellComponent,
    ProfileTabComponent,
    SecurityTabComponent,
    NotificationsTabComponent,
    OrganizationTabComponent,
    IntegrationsTabComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    SharedModule,
    NotificationPreferencesComponent,
    StationerySettingsComponent,
    OrganizationTeamComponent,
    OrganizationInvitationsComponent
  ]
})
export class SettingsModule {}
