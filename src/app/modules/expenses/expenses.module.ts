import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { ExpensesRoutingModule } from './expenses-routing.module';
import { ExpensesListComponent } from './components/expenses-list/expenses-list.component';
import { ExpenseFormComponent } from './components/expense-form/expense-form.component';
import { ExpenseCategoryComponent } from './components/expense-category/expense-category.component';
import { ExpenseDetailsComponent } from './components/expense-details/expense-details.component';
import { VendorListComponent } from './components/vendor/vendor-list/vendor-list.component';
import { VendorFormComponent } from './components/vendor/vendor-form/vendor-form.component';
import { FlatpickrModule } from 'angularx-flatpickr';

@NgModule({
  declarations: [
    ExpensesListComponent,
    ExpenseFormComponent,
    ExpenseCategoryComponent,
    ExpenseDetailsComponent,
    VendorListComponent,
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    ExpensesRoutingModule,
    FlatpickrModule.forRoot(),
    VendorFormComponent
  ],
  exports: [
    RouterModule
  ]
})
export class ExpensesModule { } 