import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { UserRoutingModule } from "./user-routing.module";
import { UserComponent } from "./user/user.component";
import { NotificationPreferencesComponent } from "./user/notification-preferences/notification-preferences.component";
import { LayoutsModule } from "../layouts/layouts.module";
import { NgbNavModule } from "@ng-bootstrap/ng-bootstrap";

@NgModule({
  declarations: [
    UserComponent,
    NotificationPreferencesComponent
  ],
  imports: [SharedModule,NgbNavModule,UserRoutingModule],
  
})
export class UserModule { }
