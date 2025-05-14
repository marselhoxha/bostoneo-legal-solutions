import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthenticationGuard } from '@app/guard/authentication.guard';

const routes: Routes = [
  {
    path: 'cases',
    loadChildren: () => import('@app/modules/legal/components/case/case.module').then(m => m.CaseModule)
  },
  {
    path: 'documents',
    loadChildren: () => import('@app/modules/legal/components/document/document.module').then(m => m.DocumentModule)
  },
  {
    path: 'calendar',
    loadChildren: () => import('@app/modules/legal/components/calendar/calendar.module').then(m => m.CalendarModule),
    canActivate: [AuthenticationGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LegalRoutingModule { }
