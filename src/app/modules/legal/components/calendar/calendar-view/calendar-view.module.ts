import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CalendarViewComponent } from './calendar-view.component';
import { MonthViewComponent } from './month-view/month-view.component';

@NgModule({
  declarations: [
    CalendarViewComponent,
    MonthViewComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild([
      {
        path: '',
        component: CalendarViewComponent
      }
    ])
  ],
  exports: [
    CalendarViewComponent
  ]
})
export class CalendarViewModule { } 