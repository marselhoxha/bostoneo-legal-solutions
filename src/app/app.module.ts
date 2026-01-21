import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';

import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StoreModule } from '@ngrx/store';
import { NgChartsModule } from 'ng2-charts';
import { JwtHelperService, JWT_OPTIONS } from '@auth0/angular-jwt';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthModule } from './component/auth/auth.module';
// Client and Invoice modules are lazy-loaded via routing
// import { ClientModule } from './component/client/client.module';
// import { InvoiceModule } from './component/invoice/invoice.module';
import { CoreModule } from './core/core.module';
import { ToastrNotificationModule } from './notification.module';
import { rootReducer } from './store';
import { CountUpModule } from 'ngx-countup';
import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';
import { FaqsComponent } from './component/faqs/faqs.component';

import { PreloaderComponent } from './component/preloader/preloader.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';

@NgModule({
  declarations: [
    AppComponent,
    PreloaderComponent,
    FaqsComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    ToastrNotificationModule,
    CoreModule,
    AuthModule,
    MatSnackBarModule,
    AppRoutingModule,
    NgChartsModule,
    CountUpModule,
    NgbAccordionModule,
    // JwtModule removed - custom TokenInterceptor handles auth to avoid conflicts
    StoreModule.forRoot(rootReducer)
  ],
    
  providers: [
    { provide: JWT_OPTIONS, useValue: {} },
    JwtHelperService
  ],

  bootstrap: [AppComponent]
})
export class AppModule { }
