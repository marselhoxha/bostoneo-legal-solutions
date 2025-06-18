import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { LayoutsModule } from "../layouts/layouts.module";
import { ClientDetailComponent } from "./client-detail/client-detail.component";
import { ClientRoutingModule } from "./client-routing.module";
import { ClientsComponent } from "./clients/clients.component";
import { NewclientComponent } from "./newclient/newclient.component";

@NgModule({
  declarations: [ClientsComponent, NewclientComponent, ClientDetailComponent],
  imports: [SharedModule, ClientRoutingModule, LayoutsModule]
  
})
export class ClientModule { }
