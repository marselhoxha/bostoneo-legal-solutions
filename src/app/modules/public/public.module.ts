import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// Components
import { IntakeFormComponent } from './components/intake-form/intake-form.component';
import { IntakeFormListComponent } from './components/intake-form-list/intake-form-list.component';
import { SuccessPageComponent } from './components/success-page/success-page.component';

// Services
import { IntakeFormService } from './services/intake-form.service';

// Routes
import { PublicRoutingModule } from './public-routing.module';

@NgModule({
  declarations: [
    IntakeFormComponent,
    IntakeFormListComponent,
    SuccessPageComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    PublicRoutingModule
  ],
  providers: [
    IntakeFormService
  ]
})
export class PublicModule { }