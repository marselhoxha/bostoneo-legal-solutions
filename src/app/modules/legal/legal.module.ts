import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/shared/shared.module';
import { LegalRoutingModule } from './legal-routing.module';
import { CaseService } from './services/case.service';
import { FlatpickrModule } from 'angularx-flatpickr';
import { CaseCreateComponent } from './components/case/case-create/case-create.component';

@NgModule({
  declarations: [
    // Components will be added here
  ],
  imports: [
    CommonModule,
    HttpClientModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    LegalRoutingModule,
    FlatpickrModule.forRoot(),
    CaseCreateComponent
  ],
  providers: [CaseService]
})
export class LegalModule { }
