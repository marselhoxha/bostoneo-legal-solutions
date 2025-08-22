import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthenticationGuard } from '../../guard/authentication.guard';
import { UsersDirectoryComponent } from './users-directory/users-directory.component';

const routes: Routes = [
  {
    path: '',
    component: UsersDirectoryComponent,
    canActivate: [AuthenticationGuard],
    data: {
      title: 'Team Directory',
      requiredPermission: { resource: 'USER', action: 'VIEW' }
    }
  },
  {
    path: 'directory',
    component: UsersDirectoryComponent,
    canActivate: [AuthenticationGuard],
    data: {
      title: 'Team Directory',
      requiredPermission: { resource: 'USER', action: 'VIEW' }
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UsersRoutingModule { }