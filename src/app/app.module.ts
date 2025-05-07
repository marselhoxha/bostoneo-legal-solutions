import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StoreModule } from '@ngrx/store';
import { NgChartsModule } from 'ng2-charts';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthModule } from './component/auth/auth.module';
import { CustomerModule } from './component/customer/customer.module';
import { InvoiceAnalyticsComponent } from './component/invoice-analytics/invoice-analytics.component';
import { InvoiceModule } from './component/invoice/invoice.module';
import { CoreModule } from './core/core.module';
import { ToastrNotificationModule } from './notification.module';
import { rootReducer } from './store';
import { CountUpModule } from 'ngx-countup';
import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';
import { FaqsComponent } from './component/faqs/faqs.component'; 
import { PreloaderComponent } from './component/preloader/preloader.component'; 
import { InvoiceAnalyticsService } from './service/invoice-analytics.service';



@NgModule({
  declarations: [AppComponent,InvoiceAnalyticsComponent,PreloaderComponent,FaqsComponent],
  imports: [
    ReactiveFormsModule,
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    ToastrNotificationModule,
    CoreModule,
    AuthModule,
    
    CustomerModule,
    InvoiceModule,
    AppRoutingModule, 
    NgChartsModule, 
    CountUpModule, 
    NgbAccordionModule,
    StoreModule.forRoot(rootReducer),
    RouterModule.forRoot([]) // Import RouterModule and configure routes

    ],
    
  providers: [
    InvoiceAnalyticsService
  ],
  
  bootstrap: [AppComponent]
})
export class AppModule { }
