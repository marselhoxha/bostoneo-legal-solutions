import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
// HttpClientModule removed - must only be in AppModule for interceptors to work
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { LegalRoutingModule } from './legal-routing.module';
import { CaseService } from './services/case.service';
import { FlatpickrModule } from 'angularx-flatpickr';
import { CaseCreateComponent } from './components/case/case-create/case-create.component';

@NgModule({
  declarations: [
    // DeadlineDashboardComponent has been removed as it's now a standalone component
    // Other Components
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    LegalRoutingModule,
    FlatpickrModule.forRoot(),
    CaseCreateComponent
  ],
  providers: [CaseService],
  exports: [
    // DeadlineDashboardComponent has been removed as it's now a standalone component
  ]
})
export class LegalModule { }
