import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ExpensesListComponent } from './components/expenses-list/expenses-list.component';
import { ExpenseFormComponent } from './components/expense-form/expense-form.component';
import { ExpenseDetailsComponent } from './components/expense-details/expense-details.component';
import { ExpenseCategoryComponent } from './components/expense-category/expense-category.component';
import { AuthenticationGuard } from '../../guard/authentication.guard';
import { VendorListComponent } from './components/vendor/vendor-list/vendor-list.component';

const routes: Routes = [
  {
    path: '',
    component: ExpensesListComponent,
    canActivate: [AuthenticationGuard]
  },
  {
    path: 'new',
    component: ExpenseFormComponent,
    canActivate: [AuthenticationGuard]
  },
  {
    path: 'edit/:id',
    component: ExpenseFormComponent,
    canActivate: [AuthenticationGuard]
  },
  {
    path: 'details/:id',
    component: ExpenseDetailsComponent,
    canActivate: [AuthenticationGuard]
  },
  {
    path: 'categories',
    component: ExpenseCategoryComponent,
    canActivate: [AuthenticationGuard]
  },
  {
    path: 'vendors',
    component: VendorListComponent,
    canActivate: [AuthenticationGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ExpensesRoutingModule { } 