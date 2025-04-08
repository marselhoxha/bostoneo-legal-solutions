import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { LegalRoutingModule } from './legal-routing.module';
import { SharedModule } from '../../shared/shared.module';
import { CaseListComponent } from './components/case/case-list/case-list.component';
import { CaseDetailComponent } from './components/case/case-detail/case-detail.component';

@NgModule({
  declarations: [
    CaseListComponent,
    CaseDetailComponent
  ],
  imports: [
    CommonModule,
    LegalRoutingModule,
    SharedModule,
    ReactiveFormsModule
  ]
})
export class LegalModule { }
