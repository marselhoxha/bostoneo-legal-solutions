import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { IntakeFormListComponent } from './components/intake-form-list/intake-form-list.component';
import { IntakeFormComponent } from './components/intake-form/intake-form.component';
import { SuccessPageComponent } from './components/success-page/success-page.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'intake-forms',
    pathMatch: 'full'
  },
  {
    path: 'intake-forms',
    component: IntakeFormListComponent,
    data: { title: 'Legal Intake Forms' }
  },
  {
    path: 'intake-forms/practice-area/:practiceArea',
    component: IntakeFormListComponent,
    data: { title: 'Practice Area Forms' }
  },
  {
    path: 'intake-forms/:formUrl',
    component: IntakeFormComponent,
    data: { title: 'Legal Intake Form' }
  },
  {
    path: 'success',
    component: SuccessPageComponent,
    data: { title: 'Form Submitted Successfully' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PublicRoutingModule { }