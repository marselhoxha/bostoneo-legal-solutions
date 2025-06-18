import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthenticationGuard } from 'src/app/guard/authentication.guard';
import { ClientDetailComponent } from './client-detail/client-detail.component';
import { ClientsComponent } from './clients/clients.component';
import { NewclientComponent } from './newclient/newclient.component';


const clientRoutes: Routes = [
 
    { path: '', component: ClientsComponent, canActivate: [AuthenticationGuard] },
    { path: 'new', component: NewclientComponent, canActivate: [AuthenticationGuard] },
    { path: ':id', component: ClientDetailComponent, canActivate: [AuthenticationGuard] },
  
  ];

@NgModule({
  imports: [RouterModule.forChild(clientRoutes)],
  exports: [RouterModule]
})
export class ClientRoutingModule { }
