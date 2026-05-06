import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TasksPageComponent } from './tasks-page.component';
import { AuthenticationGuard } from '../../../../guard/authentication.guard';

const routes: Routes = [
  {
    path: '',
    component: TasksPageComponent,
    canActivate: [AuthenticationGuard],
    data: { title: 'Tasks', breadcrumb: 'Tasks' },
  },
];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class TasksRoutingModule {}
