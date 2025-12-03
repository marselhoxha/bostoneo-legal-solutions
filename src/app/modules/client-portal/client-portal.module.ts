import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ClientPortalRoutingModule } from './client-portal-routing.module';
import { ClientPortalService } from './services/client-portal.service';
import { ClientGuard } from './guards/client.guard';
import { ClientDashboardComponent } from './components/dashboard/client-dashboard.component';
import { ClientCasesComponent } from './components/cases/client-cases.component';
import { ClientDocumentsComponent } from './components/documents/client-documents.component';
import { ClientAppointmentsComponent } from './components/appointments/client-appointments.component';
import { ClientMessagesComponent } from './components/messages/client-messages.component';
import { ClientInvoicesComponent } from './components/invoices/client-invoices.component';
import { ClientProfileComponent } from './components/profile/client-profile.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    HttpClientModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    ClientPortalRoutingModule,
    // Standalone components
    ClientDashboardComponent,
    ClientCasesComponent,
    ClientDocumentsComponent,
    ClientAppointmentsComponent,
    ClientMessagesComponent,
    ClientInvoicesComponent,
    ClientProfileComponent
  ],
  providers: [
    ClientPortalService,
    ClientGuard
  ]
})
export class ClientPortalModule { }
