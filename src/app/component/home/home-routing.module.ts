import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthenticationGuard } from 'src/app/guard/authentication.guard';
import { HomeComponent } from './home/home.component';

const homeRoutes: Routes = [
 
    { path: '', component: HomeComponent, canActivate: [AuthenticationGuard] },

  ];

@NgModule({
  imports: [RouterModule.forChild(homeRoutes)],
  exports: [RouterModule]
})
export class HomeRoutingModule { }
