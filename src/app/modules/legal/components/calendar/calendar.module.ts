import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import {
  LucideAngularModule,
  ChevronLeft, ChevronRight, Plus, AlertCircle,
  X, MapPin, Bell,
  // Used in calendar-event-view-modal (Trash2 = Delete) and the rox-styled
  // event-modal + event-form chrome (Loader2 spinner, Calendar/Clock pickers,
  // AlertTriangle warn-hint, Mail/Check action icons).
  Trash2, Loader2, Calendar, Clock, AlertTriangle, Mail, Check,
} from 'lucide-angular';

import { CalendarViewComponent } from './calendar-view/calendar-view.component';
import { CalendarEventViewModalComponent } from './calendar-event-view-modal/calendar-event-view-modal.component';
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
    CalendarEventViewModalComponent,
    MonthViewComponent,
    EventFormComponent,
    EventModalComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    NgbModalModule,
    // Lucide icons used by:
    //   • calendar-view page-head (chevron-left/right, plus, alert-circle)
    //   • calendar-event-view-modal (x close, trash-2 delete, map-pin
    //     location row, bell reminder cascade rows)
    //   • event-modal create/edit shell (loader-2 spinner, alert-circle error)
    //   • event-form fields (calendar/clock pickers, map-pin location,
    //     alert-triangle warn-hint, mail/bell notification toggles, check save)
    LucideAngularModule.pick({
      ChevronLeft, ChevronRight, Plus, AlertCircle,
      X, MapPin, Bell,
      Trash2, Loader2, Calendar, Clock, AlertTriangle, Mail, Check,
    }),
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [CalendarService],
  exports: [
    CalendarViewComponent
  ]
})
export class CalendarModule { }
