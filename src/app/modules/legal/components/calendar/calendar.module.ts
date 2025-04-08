import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { CalendarViewModule } from './calendar-view/calendar-view.module';
import { CalendarService } from '../../services/calendar.service';

const routes: Routes = [
  { path: '', loadChildren: () => import('./calendar-view/calendar-view.module').then(m => m.CalendarViewModule) }
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    CalendarViewModule
  ],
  providers: [CalendarService]
})
export class CalendarModule { } 