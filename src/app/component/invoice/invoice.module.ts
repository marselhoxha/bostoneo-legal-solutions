import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { LayoutsModule } from "../layouts/layouts.module";
import { InvoiceDetailComponent } from "./invoice-detail/invoice-detail.component";
import { InvoiceRoutingModule } from "./invoice-routing.module";
import { InvoicesComponent } from "./invoices/invoices.component";
import { NewinvoiceComponent } from "./newinvoice/newinvoice.component";
// EditInvoiceComponent is now standalone
import { InvoiceTemplatesComponent } from "./invoice-templates/invoice-templates.component";
import { InvoiceTemplateFormComponent } from "./invoice-template-form/invoice-template-form.component";
import { InvoiceWorkflowsComponent } from "./invoice-workflows/invoice-workflows.component";

import { InvoiceWorkflowConfigComponent } from "./invoice-workflow-config/invoice-workflow-config.component";
import { InvoicePaymentsComponent } from "./invoice-payments/invoice-payments.component";
import { FlatpickrModule } from 'angularx-flatpickr';
import { PaymentDashboardComponent } from './payment-dashboard/payment-dashboard.component';  // Use angularx-flatpickr
import { NgSelectModule } from '@ng-select/ng-select';
import { InvoiceStatusCountPipe } from './pipes/invoice-status-count.pipe';
import { InvoiceTotalAmountPipe } from './pipes/invoice-total-amount.pipe';


@NgModule({
  declarations: [
    InvoicesComponent,
    NewinvoiceComponent,
    InvoiceDetailComponent,
    InvoiceTemplatesComponent,
    InvoiceTemplateFormComponent,
    InvoiceWorkflowsComponent,
    InvoiceWorkflowConfigComponent,
    InvoicePaymentsComponent,
    PaymentDashboardComponent,
    InvoiceStatusCountPipe,
    InvoiceTotalAmountPipe
  ],
  imports: [SharedModule, InvoiceRoutingModule, FlatpickrModule.forRoot(), LayoutsModule, NgSelectModule]
})
export class InvoiceModule { }
