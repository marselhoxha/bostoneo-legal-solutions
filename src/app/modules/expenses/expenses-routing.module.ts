import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ExpensesListComponent } from './components/expenses-list/expenses-list.component';
import { ExpenseFormComponent } from './components/expense-form/expense-form.component';
import { ExpenseDetailsComponent } from './components/expense-details/expense-details.component';
import { ExpenseCategoryComponent } from './components/expense-category/expense-category.component';
import { AuthenticationGuard } from '../../guard/authentication.guard';
import { VendorListComponent } from './components/vendor/vendor-list/vendor-list.component';
import { PermissionGuard } from '../../guard/permission.guard';

const routes: Routes = [
  {
    path: '',
    component: ExpensesListComponent,
    canActivate: [AuthenticationGuard, PermissionGuard],
    data: {
      permission: { resource: 'DOCUMENT', action: 'VIEW' }
    }
  },
  {
    path: 'new',
    component: ExpenseFormComponent,
    canActivate: [AuthenticationGuard, PermissionGuard],
    data: {
      permission: { resource: 'DOCUMENT', action: 'CREATE' }
    }
  },
  {
    path: 'edit/:id',
    component: ExpenseFormComponent,
    canActivate: [AuthenticationGuard, PermissionGuard],
    data: {
      permission: { resource: 'DOCUMENT', action: 'EDIT' }
    }
  },
  {
    path: 'details/:id',
    component: ExpenseDetailsComponent,
    canActivate: [AuthenticationGuard, PermissionGuard],
    data: {
      permission: { resource: 'DOCUMENT', action: 'VIEW' }
    }
  },
  {
    path: 'categories',
    component: ExpenseCategoryComponent,
    canActivate: [AuthenticationGuard, PermissionGuard],
    data: {
      permission: { resource: 'DOCUMENT', action: 'ADMIN' }
    }
  },
  {
    path: 'vendors',
    component: VendorListComponent,
    canActivate: [AuthenticationGuard, PermissionGuard],
    data: {
      permission: { resource: 'DOCUMENT', action: 'VIEW' }
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ExpensesRoutingModule { } 