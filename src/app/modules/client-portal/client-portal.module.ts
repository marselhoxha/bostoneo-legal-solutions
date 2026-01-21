import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
// HttpClientModule removed - must only be in AppModule for interceptors to work
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ClientPortalRoutingModule } from './client-portal-routing.module';
import { ClientPortalService } from './services/client-portal.service';
import { ClientGuard } from './guards/client.guard';
import { ClientDashboardComponent } from './components/dashboard/client-dashboard.component';
import { ClientCasesComponent } from './components/cases/client-cases.component';
import { ClientDocumentsComponent } from './components/documents/client-documents.component';
import { ClientAppointmentsComponent } from './components/appointments/client-appointments.component';
import { ClientInvoicesComponent } from './components/invoices/client-invoices.component';
import { ClientProfileComponent } from './components/profile/client-profile.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    ClientPortalRoutingModule,
    // Standalone components
    ClientDashboardComponent,
    ClientCasesComponent,
    ClientDocumentsComponent,
    ClientAppointmentsComponent,
    // ClientMessagesComponent removed - using unified MessagesComponent loaded via router
    ClientInvoicesComponent,
    ClientProfileComponent
  ],
  providers: [
    ClientPortalService,
    ClientGuard
  ]
})
export class ClientPortalModule { }
