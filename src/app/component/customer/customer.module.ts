import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { LayoutsModule } from "../layouts/layouts.module";
import { CustomerDetailComponent } from "./customer-detail/customer-detail.component";
import { CustomerRoutingModule } from "./customer-routing.module";
import { CustomersComponent } from "./customers/customers.component";
import { NewcustomerComponent } from "./newcustomer/newcustomer.component";

@NgModule({
  declarations: [CustomersComponent, NewcustomerComponent, CustomerDetailComponent],
  imports: [SharedModule, CustomerRoutingModule, LayoutsModule]
  
})
export class CustomerModule { }
