import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthenticationGuard } from 'src/app/guard/authentication.guard';
import { InvoicesComponent } from './invoices/invoices.component';
import { NewinvoiceComponent } from './newinvoice/newinvoice.component';
import { InvoiceDetailComponent } from './invoice-detail/invoice-detail.component';
// EditInvoiceComponent is now standalone and imported dynamically
import { InvoiceTemplatesComponent } from './invoice-templates/invoice-templates.component';
import { InvoiceTemplateFormComponent } from './invoice-template-form/invoice-template-form.component';
import { InvoiceWorkflowsComponent } from './invoice-workflows/invoice-workflows.component';
import { InvoiceWorkflowConfigComponent } from './invoice-workflow-config/invoice-workflow-config.component';
import { PaymentDashboardComponent } from './payment-dashboard/payment-dashboard.component';


const invoiceRoutes: Routes = [
    { path: '', component: InvoicesComponent, canActivate: [AuthenticationGuard] },
    { path: 'new', component: InvoiceDetailComponent, canActivate: [AuthenticationGuard] },
    { path: 'payments', component: PaymentDashboardComponent, canActivate: [AuthenticationGuard] },
    { path: 'templates', component: InvoiceTemplatesComponent, canActivate: [AuthenticationGuard] },
    { path: 'templates/new', component: InvoiceTemplateFormComponent, canActivate: [AuthenticationGuard] },
    { path: 'templates/:id/edit', component: InvoiceTemplateFormComponent, canActivate: [AuthenticationGuard] },
    { path: 'workflows', component: InvoiceWorkflowsComponent, canActivate: [AuthenticationGuard] },
    { 
      path: 'workflows/:id', 
      loadComponent: () => import('./invoice-workflow-detail/invoice-workflow-detail.component').then(c => c.InvoiceWorkflowDetailComponent),
      canActivate: [AuthenticationGuard] 
    },
    { path: 'workflows/:id/config', component: InvoiceWorkflowConfigComponent, canActivate: [AuthenticationGuard] },
    { path: 'edit/:id', component: InvoiceDetailComponent, canActivate: [AuthenticationGuard] },
    { path: ':id/:invoiceNumber', component: InvoiceDetailComponent, canActivate: [AuthenticationGuard] },
    { path: ':id', component: InvoiceDetailComponent, canActivate: [AuthenticationGuard] },
  ];

@NgModule({
  imports: [RouterModule.forChild(invoiceRoutes)],
  exports: [RouterModule]
})
export class InvoiceRoutingModule { }
