import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DocumentAnalyzerComponent } from './document-analyzer.component';

@NgModule({
  declarations: [
    DocumentAnalyzerComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild([
      { path: '', component: DocumentAnalyzerComponent }
    ])
  ]
})
export class DocumentAnalyzerModule { }