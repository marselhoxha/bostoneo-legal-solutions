import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/shared/shared.module';
import { InvoiceAnalyticsComponent } from './invoice-analytics.component';

@NgModule({
  declarations: [
  ],
  imports: [
    SharedModule,
    CommonModule,
    FormsModule,
  ],
  
})
export class InvoiceAnalyticsModule { }
