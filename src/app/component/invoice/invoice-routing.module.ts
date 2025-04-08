import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthenticationGuard } from 'src/app/guard/authentication.guard';
import { InvoicesComponent } from './invoices/invoices.component';
import { NewinvoiceComponent } from './newinvoice/newinvoice.component';
import { InvoiceDetailComponent } from './invoice-detail/invoice-detail.component';


const invoiceRoutes: Routes = [
    
    { path: 'invoices', component: InvoicesComponent, canActivate: [AuthenticationGuard] },
    { path: 'invoices/new', component: NewinvoiceComponent, canActivate: [AuthenticationGuard] },
    { path: 'invoices/:id/:invoiceNumber', component: InvoiceDetailComponent, canActivate: [AuthenticationGuard] },
  
  ];

@NgModule({
  imports: [RouterModule.forChild(invoiceRoutes)],
  exports: [RouterModule]
})
export class InvoiceRoutingModule { }
