import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { LayoutsModule } from "../layouts/layouts.module";
import { InvoiceDetailComponent } from "./invoice-detail/invoice-detail.component";
import { InvoiceRoutingModule } from "./invoice-routing.module";
import { InvoicesComponent } from "./invoices/invoices.component";
import { NewinvoiceComponent } from "./newinvoice/newinvoice.component";
import { FlatpickrModule } from 'angularx-flatpickr';  // Use angularx-flatpickr


@NgModule({
  declarations: [InvoicesComponent, NewinvoiceComponent, InvoiceDetailComponent],
  imports: [SharedModule, InvoiceRoutingModule, FlatpickrModule.forRoot(), LayoutsModule,]
})
export class InvoiceModule { }
