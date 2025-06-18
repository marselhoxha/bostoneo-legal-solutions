import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { TimeTrackingRoutingModule } from './time-tracking-routing.module';
import { FlatpickrModule } from 'angularx-flatpickr';

// Services
import { TimeTrackingService } from './services/time-tracking.service';
import { TimerService } from './services/timer.service';
import { BillingRateService } from './services/billing-rate.service';
import { InvoiceService } from './services/invoice.service';

// Standalone Components for exports only
import { TimerWidgetComponent } from './components/timer-widget/timer-widget.component';
import { TimeDashboardComponent } from './components/time-dashboard/time-dashboard.component';

@NgModule({
  declarations: [
    // No declarations needed - all components are standalone
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    TimeTrackingRoutingModule,
    FlatpickrModule.forRoot(),
    // Import standalone components that need to be exported
    TimerWidgetComponent,
    TimeDashboardComponent
  ],
  providers: [
    TimeTrackingService,
    TimerService,
    BillingRateService,
    InvoiceService
  ],
  exports: [
    TimerWidgetComponent, // Export for use in other modules
    TimeDashboardComponent
  ]
})
export class TimeTrackingModule { } 
 
 
 
 
 