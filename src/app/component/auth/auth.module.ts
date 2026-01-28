import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { AuthRoutingModule } from "./auth-routing.module";
import { LoginComponent } from "./login/login.component";
import { RegisterComponent } from "./register/register.component";
import { ResetpasswordComponent } from "./resetpassword/resetpassword.component";
import { VerifyComponent } from "./verify/verify.component";
import { AcceptInviteComponent } from "./accept-invite/accept-invite.component";

@NgModule({
  declarations: [
    LoginComponent,
    RegisterComponent,
    ResetpasswordComponent,
    VerifyComponent,
    AcceptInviteComponent,
  ],
  imports: [SharedModule, AuthRoutingModule],
  exports: [AcceptInviteComponent]
})
export class AuthModule { }
