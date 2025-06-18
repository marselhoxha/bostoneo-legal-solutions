import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { RoleListComponent } from './components/role-management/role-list.component';
import { RoleFormComponent } from './components/role-management/role-form.component';
import { RoleAdminComponent } from './components/role-management/role-admin.component';
import { PermissionAssignmentComponent } from './components/role-management/permission-assignment.component';
import { UserRoleAssignmentComponent } from './components/user-role-management/user-role-assignment.component';
import { RoleHierarchyComponent } from './components/role-hierarchy/role-hierarchy.component';
import { SharedModule } from '../../shared/shared.module';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { AuthenticationGuard } from '../../guard/authentication.guard';
import { PermissionGuard } from '../../guard/permission.guard';
import { PermissionDebuggerComponent } from '../../shared/components/permission-debugger/permission-debugger.component';

const routes: Routes = [
  {
    path: '',
    children: [
      { 
        path: 'roles', 
        component: RoleAdminComponent,
        canActivate: [AuthenticationGuard, PermissionGuard],
        data: { 
          permission: { resource: 'SYSTEM', action: 'VIEW' } 
        }
      },
      { 
        path: 'user-roles', 
        component: UserRoleAssignmentComponent,
        canActivate: [AuthenticationGuard, PermissionGuard],
        data: { 
          permission: { resource: 'ADMINISTRATIVE', action: 'EDIT' } 
        }
      },
      { 
        path: 'hierarchy', 
        component: RoleHierarchyComponent,
        canActivate: [AuthenticationGuard, PermissionGuard],
        data: { 
          permission: { resource: 'SYSTEM', action: 'VIEW' } 
        }
      }
    ]
  }
];

@NgModule({
  declarations: [
    RoleAdminComponent,
    RoleFormComponent,
    PermissionAssignmentComponent,
    UserRoleAssignmentComponent,
    RoleHierarchyComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule.forChild(routes),
    SharedModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTabsModule,
    ScrollingModule,
    PermissionDebuggerComponent,
    RoleListComponent
  ],
  providers: []
})
export class AdminModule { } 