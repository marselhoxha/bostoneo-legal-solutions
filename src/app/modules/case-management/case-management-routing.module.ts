import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthenticationGuard } from '../../guard/authentication.guard';
import { RbacGuard } from '../../guard/rbac.guard';

// Components
import { CaseAssignmentDashboardComponent } from '../../component/case-assignment/case-assignment-dashboard/case-assignment-dashboard.component';
import { TaskManagementComponent } from '../../component/case-task/task-management/task-management.component';
import { CaseManagementDashboardComponent } from './components/case-management-dashboard/case-management-dashboard.component';

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'dashboard',
        component: CaseManagementDashboardComponent,
        canActivate: [AuthenticationGuard],
        data: {
          title: 'Case Management Dashboard',
          breadcrumb: 'Dashboard'
        }
      },
      {
        path: 'assignments',
        component: CaseAssignmentDashboardComponent,
        canActivate: [AuthenticationGuard],
        data: {
          title: 'Case Assignments',
          breadcrumb: 'Assignments'
        }
      },
      {
        path: 'tasks',
        component: TaskManagementComponent,
        canActivate: [AuthenticationGuard],
        data: {
          title: 'All Tasks',
          breadcrumb: 'Tasks'
        }
      },
      {
        path: 'tasks/:caseId',
        component: TaskManagementComponent,
        canActivate: [AuthenticationGuard],
        data: {
          title: 'Task Management',
          breadcrumb: 'Tasks'
        }
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CaseManagementRoutingModule { }
