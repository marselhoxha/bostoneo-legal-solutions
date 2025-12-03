import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientGuard } from './guards/client.guard';
import { ClientDashboardComponent } from './components/dashboard/client-dashboard.component';
import { ClientCasesComponent } from './components/cases/client-cases.component';
import { ClientDocumentsComponent } from './components/documents/client-documents.component';
import { ClientAppointmentsComponent } from './components/appointments/client-appointments.component';
import { ClientMessagesComponent } from './components/messages/client-messages.component';
import { ClientInvoicesComponent } from './components/invoices/client-invoices.component';
import { ClientProfileComponent } from './components/profile/client-profile.component';
import { ClientCaseDetailComponent } from './components/case-detail/client-case-detail.component';

const routes: Routes = [
  {
    path: '',
    canActivate: [ClientGuard],
    canActivateChild: [ClientGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        component: ClientDashboardComponent,
        data: { title: 'Client Dashboard' }
      },
      {
        path: 'cases',
        component: ClientCasesComponent,
        data: { title: 'My Cases' }
      },
      {
        path: 'cases/:id',
        component: ClientCaseDetailComponent,
        data: { title: 'Case Details' }
      },
      {
        path: 'documents',
        component: ClientDocumentsComponent,
        data: { title: 'My Documents' }
      },
      {
        path: 'appointments',
        component: ClientAppointmentsComponent,
        data: { title: 'My Appointments' }
      },
      {
        path: 'messages',
        component: ClientMessagesComponent,
        data: { title: 'Messages' }
      },
      {
        path: 'invoices',
        component: ClientInvoicesComponent,
        data: { title: 'My Invoices' }
      },
      {
        path: 'profile',
        component: ClientProfileComponent,
        data: { title: 'My Profile' }
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientPortalRoutingModule { }
