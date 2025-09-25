import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { PdfFormsComponent } from './pdf-forms.component';

const routes: Routes = [
  {
    path: '',
    component: PdfFormsComponent
  }
];

@NgModule({
  declarations: [PdfFormsComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ]
})
export class PdfFormsModule { }