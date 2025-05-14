import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { FullCalendarModule } from '@fullcalendar/angular';

import { CalendarViewComponent } from './calendar-view/calendar-view.component';
import { MonthViewComponent } from './calendar-view/month-view/month-view.component';
import { EventFormComponent } from './event-form/event-form.component';
import { EventModalComponent } from './event-modal/event-modal.component';
import { CalendarService } from '../../services/calendar.service';
import { ReminderTestComponent } from './reminder-test/reminder-test.component';

const routes: Routes = [
  { path: '', component: CalendarViewComponent },
  { path: 'test-reminders', component: ReminderTestComponent, title: 'Test Reminder Emails' }
];

@NgModule({
  declarations: [
    CalendarViewComponent,
    MonthViewComponent,
    EventFormComponent,
    EventModalComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    NgbModalModule,
    FullCalendarModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [CalendarService],
  exports: [
    CalendarViewComponent
  ]
})
export class CalendarModule { } 