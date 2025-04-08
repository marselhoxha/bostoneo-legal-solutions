import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CaseListComponent } from './components/case/case-list/case-list.component';
import { CaseDetailComponent } from './components/case/case-detail/case-detail.component';

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'cases',
        component: CaseListComponent
      },
      {
        path: 'cases/:id',
        component: CaseDetailComponent
      },
      {
        path: '',
        redirectTo: 'cases',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LegalRoutingModule { }
